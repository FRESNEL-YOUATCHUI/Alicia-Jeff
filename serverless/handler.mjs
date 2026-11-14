import {timingSafeEqual} from 'node:crypto';
import {ApiError,checkOrigin,readJson,requireMethod,routeFromRequest,sendError,sendJson} from './http.mjs';
import {albumPatch,bool,messageInput,offset,rejectUnknown,rsvpInput,string,uploadInput,uuid} from './validation.mjs';
import {getSupabase,requireStaff,serverConfig,bearerToken} from './supabase.mjs';
import {Repository} from './repository.mjs';
import {PhotoStorage} from './storage.mjs';
const ok={ok:true};
export function createHandler(dependencies){
  return async function handler(req,res){
    try{
      const {route,query}=routeFromRequest(req);
      if(route==='/api/health'){requireMethod(req,['GET']);sendJson(res,200,{ok:true,backend:'supabase-serverless'});return;}
      const known=['/api/rsvp','/api/messages','/api/souvenirs','/api/photos','/api/admin/state','/api/admin/messages','/api/admin/albums','/api/admin/settings','/api/admin/uploads/authorize','/api/admin/uploads/cleanup','/api/internal/uploads/cleanup'].includes(route)||/^\/api\/photos\/[^/]+$/.test(route)||/^\/api\/admin\/albums\/[^/]+(?:\/photos)?$/.test(route)||/^\/api\/admin\/(?:photos|messages)\/[^/]+$/.test(route)||/^\/api\/admin\/uploads\/[^/]+\/(?:finalize|cancel)$/.test(route);
      if(!known)throw new ApiError(404,'not_found','Cette adresse n’existe pas.');
      if(route==='/api/internal/uploads/cleanup'){
        requireMethod(req,['GET']);
        const secret=dependencies?.cronSecret??process.env.CRON_SECRET;
        if(!secret||secret.length<32)throw new ApiError(503,'cron_configuration_required','Le nettoyage planifié attend sa configuration.');
        const expected=Buffer.from('Bearer '+secret),provided=Buffer.from(String(req.headers.authorization??''));
        if(expected.length!==provided.length||!timingSafeEqual(expected,provided))throw new ApiError(401,'authentication_required','Accès non autorisé.');
      }
      // Missing authentication is always 401, even before server configuration is available.
      if(route.startsWith('/api/admin/'))bearerToken(req);
      const deps=dependencies??(()=>{const client=getSupabase();return{repo:new Repository(client),storage:new PhotoStorage(client),authenticate:r=>requireStaff(r,client),rateSecret:serverConfig().key};})();
      const {repo,storage}=deps;
      if(!['GET','HEAD'].includes(req.method))checkOrigin(req);
      let staff;
      if(route.startsWith('/api/admin/'))staff=await deps.authenticate(req);
      const rate=async(scope,limit=30,seconds=900)=>repo.rate(req,scope,limit,seconds,deps.rateSecret);
      let result,status=200;
      if(route==='/api/rsvp'){
        requireMethod(req,['POST']);const input=rsvpInput(await readJson(req));await rate('rsvp',40);result=await repo.rsvp(input);
      }else if(route==='/api/messages'){
        requireMethod(req,['GET','POST']);
        if(req.method==='POST'){const input=messageInput(await readJson(req));await rate('message',12);result=await repo.message(input);status=201;}
        else result=await repo.messages(offset(query.get('offset')));
      }else if(route==='/api/souvenirs'){
        requireMethod(req,['GET']);result=await repo.publicState();
        if(!result.gallery_available)result.albums=[];
        else result.albums=await Promise.all(result.albums.map(async a=>{const {cover_photo,...safe}=a;return{...safe,cover:cover_photo?(await storage.sign([cover_photo]))[0].url:null};}));
      }else if(route==='/api/photos'){
        requireMethod(req,['GET']);const page=await repo.publicPhotos(uuid(query.get('album'),'album'),offset(query.get('offset')));
        const [view,download]=await Promise.all([storage.sign(page.photos),storage.sign(page.photos,{download:true})]);
        result={photos:view.map((p,i)=>({...p,download_url:download[i].url})),has_more:page.has_more};
      }else if(/^\/api\/photos\/[^/]+$/.test(route)){
        requireMethod(req,['GET']);const photo=await repo.publicPhoto(uuid(route.split('/')[3]));
        if(!photo)throw new ApiError(404,'not_found','Cette photographie n’est pas disponible.');
        const signed=await storage.sign([photo],{download:query.get('download')==='1'});
        res.writeHead(302,{'Location':signed[0].url,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});res.end();return;
      }else if(route==='/api/admin/state'){
        requireMethod(req,['GET']);result=await repo.adminState();
        result.albums=await Promise.all(result.albums.map(async a=>({...a,photos:await storage.sign(a.photos)})));
      }else if(route==='/api/admin/messages'){
        requireMethod(req,['GET']);result=await repo.adminMessages(offset(query.get('offset')));
      }else if(/^\/api\/admin\/albums\/[^/]+\/photos$/.test(route)){
        requireMethod(req,['GET']);result=await repo.adminPhotos(uuid(route.split('/')[4]),offset(query.get('offset')));result.photos=await storage.sign(result.photos);
      }else if(route==='/api/admin/albums'){
        requireMethod(req,['POST']);const body=await readJson(req);rejectUnknown(body,['title']);await rate('admin:'+staff.id,120,60);
        result=await repo.mutate('album-create',null,{title:string(body.title,120,{required:true,field:'titre'})},staff);status=201;
      }else if(/^\/api\/admin\/albums\/[^/]+$/.test(route)){
        requireMethod(req,['PATCH']);await rate('admin:'+staff.id,120,60);result=await repo.mutate('album',uuid(route.split('/')[4]),albumPatch(await readJson(req)),staff);
      }else if(/^\/api\/admin\/(photos|messages)\/[^/]+$/.test(route)){
        requireMethod(req,['PATCH']);const body=await readJson(req);rejectUnknown(body,['hidden']);const patch={hidden:bool(body.hidden,'visibilité')};await rate('admin:'+staff.id,120,60);
        result=await repo.mutate(route.split('/')[3]==='photos'?'photo':'message',uuid(route.split('/')[4]),patch,staff);
      }else if(route==='/api/admin/settings'){
        requireMethod(req,['PATCH']);const body=await readJson(req);rejectUnknown(body,['galleryPublished']);await rate('admin:'+staff.id,120,60);
        result=await repo.mutate('settings',null,{gallery_published:bool(body.galleryPublished,'publication')},staff);
      }else if(route==='/api/admin/uploads/authorize'){
        requireMethod(req,['POST']);const input=uploadInput(await readJson(req));await rate('upload:'+staff.id,80,900);
        const intent=await repo.reserve(input,staff);
        result=intent.status==='complete'?{id:intent.id,status:'complete',photo_id:intent.photo_id}:{id:intent.id,status:intent.status,...await storage.uploadToken(intent)};
      }else if(/^\/api\/admin\/uploads\/[^/]+\/(finalize|cancel)$/.test(route)){
        requireMethod(req,['POST']);const id=uuid(route.split('/')[4]);await rate('finalize:'+staff.id,160,900);
        const body=await readJson(req);rejectUnknown(body,[]);
        if(route.endsWith('/cancel')){await repo.cancel(id,staff);result=ok;}
        else{
          const claim=await repo.claim(id,staff);
          if(claim.status==='complete')result={ok:true,photo_id:claim.photo_id};
          else{
            try{await storage.verify(claim);}
            catch(error){
              if(error instanceof ApiError&&error.status===415)await repo.cancel(id,staff);
              else await repo.release(id,claim.nonce,staff);
              throw error;
            }
            result=await repo.complete(id,claim.nonce,staff);
          }
        }
      }else if(route==='/api/admin/uploads/cleanup'){
        requireMethod(req,['POST']);rejectUnknown(await readJson(req),[]);await rate('cleanup:'+staff.id,6,60);
        const expired=await repo.cleanup();await storage.remove(expired.map(p=>p.storage_path));await repo.cleaned(expired.map(p=>p.id));result={ok:true,cleaned:expired.length};
      }else if(route==='/api/internal/uploads/cleanup'){
        const expired=await repo.cleanup();await storage.remove(expired.map(p=>p.storage_path));await repo.cleaned(expired.map(p=>p.id));result={ok:true,cleaned:expired.length};
      }else throw new ApiError(404,'not_found','Cette adresse n’existe pas.');
      sendJson(res,status,result);
    }catch(error){sendError(res,error);}
  };
}
export default createHandler();
