import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RELEASE_AT = '2026-12-18T15:00:00.000Z';
const MAX_IMAGE = 20 * 1024 * 1024;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.mp4':'audio/mp4', '.ico':'image/x-icon' };
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, 'Veuillez vérifier les champs du formulaire.');
  const clean = value.trim().replace(/\r\n/g, '\n');
  if (required && !clean) throw new HttpError(400, 'Les champs obligatoires doivent être remplis.');
  return clean;
}
async function readBody(req, max = 20_000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw new HttpError(413, 'Le fichier est trop volumineux.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  try { return JSON.parse((await readBody(req)).toString('utf8')); }
  catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Le formulaire est incomplet.'); }
}
function send(res, status, value) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
  res.end(JSON.stringify(value));
}
function imageKind(buffer) {
  if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if (buffer[0]===255 && buffer[1]===216 && buffer[2]===255) return '.jpg';
  if (buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') return '.webp';
  throw new HttpError(400, 'Choisissez une photographie JPEG, PNG ou WebP.');
}
function safeEqual(a,b) { const x=createHash('sha256').update(a).digest(); const y=createHash('sha256').update(b).digest(); return timingSafeEqual(x,y); }

export async function createWeddingServer(options) {
  const dataDir = path.resolve(options.dataDir);
  const distDir = path.resolve(options.distDir || 'dist');
  const now = options.now || (() => Date.now());
  const password = options.adminPassword;
  const sessionSecret = options.sessionSecret;
  if (!password || password.length < 16 || !sessionSecret || sessionSecret.length < 32) throw new Error('Configurez un mot de passe photographe de 16 caractères minimum et une clé de session.');
  await fs.mkdir(path.join(dataDir,'photos'), {recursive:true});
  const stateFile = path.join(dataDir,'souvenirs.json');
  let state;
  try { state=JSON.parse(await fs.readFile(stateFile,'utf8')); }
  catch (e) { if(e.code!=='ENOENT') throw e; state={responses:[],messages:[],albums:[],settings:{galleryPublished:false}}; }
  let pending = Promise.resolve();
  const mutate = fn => {
    const result = pending.then(async () => {
      const draft = structuredClone(state);
      const value = await fn(draft);
      await fs.writeFile(stateFile+'.tmp', JSON.stringify(draft,null,2), {mode:0o600});
      await fs.rename(stateFile+'.tmp', stateFile);
      state=draft; return value;
    });
    pending=result.catch(()=>{}); return result;
  };
  const sessions = {
    create() { const payload=Buffer.from(JSON.stringify({expires:now()+12*3600_000,nonce:randomBytes(16).toString('hex')})).toString('base64url'); return payload+'.'+createHmac('sha256',sessionSecret).update(payload).digest('base64url'); },
    valid(req) { try { const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('aj_photographe='))?.slice(15); if(!token)return false; const [payload,signature]=token.split('.'); const expected=createHmac('sha256',sessionSecret).update(payload).digest('base64url'); return safeEqual(signature||'',expected) && JSON.parse(Buffer.from(payload,'base64url').toString()).expires>now(); } catch {return false;} }
  };
  const limits = new Map();
  function rateLimit(req, scope, max) {
    const time=now(); const key=scope+':'+req.socket.remoteAddress; const record=limits.get(key);
    if (!record || record.until<time) { if(limits.size>5000)limits.clear(); limits.set(key,{count:1,until:time+15*60_000}); return; }
    record.count++; if(record.count>max) throw new HttpError(429,'Patientez quelques minutes avant de réessayer.');
  }
  function requireAdmin(req) { if(!sessions.valid(req))throw new HttpError(401,'Connectez-vous à l’espace photographe.'); }
  function checkOrigin(req) {
    const origin=req.headers.origin;
    if(!origin)return;
    let parsed; try {parsed=new URL(origin);}catch{throw new HttpError(403,'Origine non autorisée.');}
    const local=options.allowLocalPreview && ['http://127.0.0.1:5173','http://localhost:5173'].includes(parsed.origin);
    if(!local && parsed.origin!==options.siteOrigin && parsed.host!==req.headers.host) throw new HttpError(403,'Origine non autorisée.');
  }
  const galleryAvailable=()=>state.settings.galleryPublished && now()>=Date.parse(RELEASE_AT);
  const visibleMessages=()=>state.messages.filter(m=>!m.hidden).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  function publicAlbum(album) {
    const photos=album.photos.filter(p=>!p.hidden);
    return {id:album.id,title:album.title,count:photos.length,cover:photos[0]?'/api/photos/'+photos[0].id:null};
  }
  async function serveFile(req,res,file,contentType,cache='no-cache',download=false) {
    let stat; try {stat=await fs.stat(file);}catch{throw new HttpError(404,'Fichier introuvable.');}
    const headers={'Content-Type':contentType,'X-Content-Type-Options':'nosniff','Cache-Control':cache,'Content-Length':stat.size};
    if(download)headers['Content-Disposition']='attachment; filename="Souvenir-Alicia-Jeff'+path.extname(file)+'"';
    // Range requests allow mobile browsers to load and loop the supplied MP4 audio.
    const range=req.headers.range;
    if(range && contentType==='audio/mp4') {
      const match=/^bytes=(\d+)-(\d*)$/.exec(range);
      if(!match){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):stat.size-1,stat.size-1);
      if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      const handle=await fs.open(file,'r'); const buffer=Buffer.alloc(end-start+1);
      try {await handle.read(buffer,0,buffer.length,start);}finally{await handle.close();}
      res.writeHead(206,{...headers,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':buffer.length});res.end(buffer);return;
    }
    if(contentType==='audio/mp4')headers['Accept-Ranges']='bytes';
    res.writeHead(200,headers);if(req.method==='HEAD')res.end();else res.end(await fs.readFile(file));
  }
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://wedding.local'); const route=url.pathname;
      if(req.method!=='GET' && req.method!=='HEAD')checkOrigin(req);
      if(route==='/api/health'){send(res,200,{ok:true});return;}
      if(route==='/api/rsvp' && req.method==='POST'){
        rateLimit(req,'rsvp',40);
        const body=await jsonBody(req);
        if(body.website)throw new HttpError(400,'Le formulaire n’a pas pu être envoyé.');
        const first=text(body.first_name,80,true),last=text(body.last_name,80,true);
        const ref=text(body.client_ref,64,true);
        if(!/^[a-zA-Z0-9-]{32,64}$/.test(ref)||!Number.isInteger(body.participants??1)||body.participants<1||body.participants>20)throw new HttpError(400,'Vérifiez le nom et le nombre de participants.');
        const message=text(body.message||'',2000),song=text(body.song||'',200);
        const refHash=createHash('sha256').update(ref).digest('hex');
        const result=await mutate(draft=>{
          let row=draft.responses.find(r=>r.ref_hash===refHash);
          if(!row){row={id:randomUUID(),ref_hash:refHash,created_at:new Date(now()).toISOString()};draft.responses.push(row);}
          Object.assign(row,{first_name:first,last_name:last,participants:body.participants??1,song,updated_at:new Date(now()).toISOString()});
          if(message){let m=draft.messages.find(m=>m.response_id===row.id);if(!m){m={id:randomUUID(),response_id:row.id,created_at:new Date(now()).toISOString(),hidden:false};draft.messages.push(m);}Object.assign(m,{author:first,body:message});}
          return {ticket:{id:row.id,guest_id:row.id,rsvp_id:row.id,ticket_number:'AJ-'+row.id.slice(0,8).toUpperCase(),qr_token:row.id,bride_first_name:'Alicia',groom_first_name:'Jeff',wedding_date:'2026-12-18T15:00:00Z',venue_name:'Dakar · Ambassade du Cameroun & Fun Time',guest_full_name:first+' '+last,guest_first_name:first,guest_last_name:last,allowed_persons:body.participants??1,pdf_url:null,png_url:null,created_at:row.created_at},message_published:Boolean(message)};
        });send(res,200,result);return;
      }
      if(route==='/api/messages' && req.method==='POST'){
        rateLimit(req,'messages',12);const body=await jsonBody(req);
        if(body.website)throw new HttpError(400,'Le message n’a pas pu être envoyé.');
        const author=text(body.author,80,true),message=text(body.body,2000,true),ref=text(body.client_ref,64,true);
        if(!/^[a-zA-Z0-9-]{32,64}$/.test(ref))throw new HttpError(400,'Veuillez recharger la page.');
        const hash=createHash('sha256').update(ref).digest('hex');
        const result=await mutate(draft=>{let row=draft.messages.find(m=>m.ref_hash===hash);if(!row){row={id:randomUUID(),ref_hash:hash,created_at:new Date(now()).toISOString(),hidden:false};draft.messages.push(row);}Object.assign(row,{author,body:message});return{id:row.id,author,body:message,created_at:row.created_at};});
        send(res,201,result);return;
      }
      if(route==='/api/souvenirs' && req.method==='GET'){
        const messages=visibleMessages();send(res,200,{messages:messages.slice(0,50).map(({id,author,body,created_at})=>({id,author,body,created_at})),message_count:messages.length,gallery_available:galleryAvailable(),release_at:RELEASE_AT,albums:galleryAvailable()?state.albums.filter(a=>a.published&&!a.hidden).map(publicAlbum):[]});return;
      }
      if(route==='/api/messages' && req.method==='GET'){
        const offset=Math.max(0,Number(url.searchParams.get('offset'))||0);const rows=visibleMessages();send(res,200,{messages:rows.slice(offset,offset+50).map(({id,author,body,created_at})=>({id,author,body,created_at})),has_more:offset+50<rows.length});return;
      }
      if(route==='/api/photos' && req.method==='GET'){
        const admin=sessions.valid(req);const album=state.albums.find(a=>a.id===url.searchParams.get('album'));
        if(!album||(!admin&&(!galleryAvailable()||!album.published||album.hidden)))throw new HttpError(404,'Cet album n’est pas encore disponible.');
        const offset=Math.max(0,Number(url.searchParams.get('offset'))||0);const rows=album.photos.filter(p=>admin||!p.hidden);
        send(res,200,{photos:rows.slice(offset,offset+60).map(p=>({id:p.id,caption:p.caption,hidden:p.hidden,url:'/api/photos/'+p.id,download_url:'/api/photos/'+p.id+'?download=1'})),has_more:offset+60<rows.length});return;
      }
      const photoMatch=/^\/api\/photos\/([a-f0-9-]{36})$/.exec(route);
      if(photoMatch && ['GET','HEAD'].includes(req.method)){
        const album=state.albums.find(a=>a.photos.some(p=>p.id===photoMatch[1]));const photo=album?.photos.find(p=>p.id===photoMatch[1]);
        if(!photo||(!sessions.valid(req)&&(!galleryAvailable()||!album.published||album.hidden||photo.hidden)))throw new HttpError(404,'Cette photographie n’est pas encore disponible.');
        await serveFile(req,res,path.join(dataDir,'photos',photo.file),MIME[path.extname(photo.file)],'private, no-store',url.searchParams.has('download'));return;
      }
      if(route==='/api/admin/login' && req.method==='POST'){
        rateLimit(req,'login',8);const body=await jsonBody(req);
        if(typeof body.password!=='string'||body.password.length>200||!safeEqual(body.password,password))throw new HttpError(401,'Le mot de passe est incorrect.');
        const secure=options.siteOrigin?.startsWith('https:')?'; Secure':'';
        res.setHeader('Set-Cookie',`aj_photographe=${sessions.create()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);send(res,200,{ok:true});return;
      }
      if(route==='/api/admin/logout' && req.method==='POST'){res.setHeader('Set-Cookie','aj_photographe=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');send(res,200,{ok:true});return;}
      if(route.startsWith('/api/admin/')){
        requireAdmin(req);
        if(route==='/api/admin/state' && req.method==='GET'){
          send(res,200,{albums:state.albums.map(a=>({...a,photos:a.photos.map(p=>({...p,url:'/api/photos/'+p.id}))})),settings:state.settings,messages:state.messages.map(({id,author,body,hidden,created_at})=>({id,author,body,hidden,created_at})),response_count:state.responses.length});return;
        }
        if(route==='/api/admin/settings' && req.method==='PATCH'){
          const body=await jsonBody(req);if(typeof body.galleryPublished!=='boolean')throw new HttpError(400,'Vérifiez les paramètres.');
          await mutate(d=>{d.settings.galleryPublished=body.galleryPublished;});send(res,200,{ok:true});return;
        }
        if(route==='/api/admin/albums' && req.method==='POST'){
          const body=await jsonBody(req);const title=text(body.title,120,true);
          const album=await mutate(d=>{const a={id:randomUUID(),title,published:false,hidden:false,photos:[]};d.albums.push(a);return a;});send(res,201,album);return;
        }
        const albumMatch=/^\/api\/admin\/albums\/([a-f0-9-]{36})$/.exec(route);
        if(albumMatch && req.method==='PATCH'){
          const body=await jsonBody(req);
          await mutate(d=>{const a=d.albums.find(a=>a.id===albumMatch[1]);if(!a)throw new HttpError(404,'Album introuvable.');if(body.title!==undefined)a.title=text(body.title,120,true);if(typeof body.published==='boolean')a.published=body.published;if(typeof body.hidden==='boolean')a.hidden=body.hidden;});send(res,200,{ok:true});return;
        }
        const uploadMatch=/^\/api\/admin\/albums\/([a-f0-9-]{36})\/photos$/.exec(route);
        if(uploadMatch && req.method==='POST'){
          if(!state.albums.some(a=>a.id===uploadMatch[1]))throw new HttpError(404,'Album introuvable.');
          const data=await readBody(req,MAX_IMAGE);const extension=imageKind(data),id=randomUUID(),filename=id+extension;
          const caption=text(decodeURIComponent(String(req.headers['x-photo-caption']||'Photographie du mariage')),200);
          await fs.writeFile(path.join(dataDir,'photos',filename),data,{flag:'wx'});
          try{await mutate(d=>{d.albums.find(a=>a.id===uploadMatch[1]).photos.push({id,file:filename,caption,hidden:false});});}
          catch(e){await fs.unlink(path.join(dataDir,'photos',filename));throw e;}
          send(res,201,{id});return;
        }
        const hideMatch=/^\/api\/admin\/(photos|messages)\/([a-f0-9-]{36})$/.exec(route);
        if(hideMatch && req.method==='PATCH'){
          const body=await jsonBody(req);if(typeof body.hidden!=='boolean')throw new HttpError(400,'Vérifiez votre demande.');
          await mutate(d=>{const row=hideMatch[1]==='messages'?d.messages.find(m=>m.id===hideMatch[2]):d.albums.flatMap(a=>a.photos).find(p=>p.id===hideMatch[2]);if(!row)throw new HttpError(404,'Élément introuvable.');row.hidden=body.hidden;});send(res,200,{ok:true});return;
        }
        throw new HttpError(404,'Cette opération n’existe pas.');
      }
      if(route.startsWith('/api/'))throw new HttpError(404,'Cette opération n’existe pas.');
      if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Opération non autorisée.');
      let decoded;try{decoded=decodeURIComponent(route);}catch{throw new HttpError(400,'Adresse non valide.');}
      const relative=decoded==='/'?'index.html':decoded.slice(1);
      const file=path.resolve(distDir,relative);
      if(!file.startsWith(distDir+path.sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.')))throw new HttpError(404,'Page introuvable.');
      await serveFile(req,res,file,MIME[path.extname(file)]||'application/octet-stream');
    } catch(e) {
      if(!res.headersSent)send(res,e instanceof HttpError?e.status:500,{error:e instanceof HttpError?e.message:'Le service est momentanément indisponible. Réessayez dans un instant.'});else res.end();
      if(!(e instanceof HttpError))console.error('Wedding API error:',e.message);
    }
  });
  return server;
}

export async function localConfiguration(projectRoot) {
  const filename=path.join(projectRoot,'.env.wedding.local');
  let content='';try{content=await fs.readFile(filename,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!content && !process.env.WEDDING_ADMIN_PASSWORD){
    content=`WEDDING_ADMIN_PASSWORD=${randomBytes(20).toString('base64url')}\nWEDDING_SESSION_SECRET=${randomBytes(32).toString('hex')}\n`;
    await fs.writeFile(filename,content,{mode:0o600,flag:'wx'});
    console.log('Accès photographe créé dans .env.wedding.local (fichier privé, à conserver).');
  }
  const values=Object.fromEntries(content.split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
  return {adminPassword:process.env.WEDDING_ADMIN_PASSWORD||values.WEDDING_ADMIN_PASSWORD,sessionSecret:process.env.WEDDING_SESSION_SECRET||values.WEDDING_SESSION_SECRET,siteOrigin:process.env.WEDDING_SITE_ORIGIN,dataDir:process.env.WEDDING_DATA_DIR||path.join(projectRoot,'.wedding-data')};
}
const currentFile=fileURLToPath(import.meta.url);
if(process.argv[1] && path.resolve(process.argv[1])===currentFile){
  const root=path.resolve(path.dirname(currentFile),'..');
  const config=await localConfiguration(root);
  const server=await createWeddingServer({...config,distDir:path.join(root,'dist'),allowLocalPreview:process.env.NODE_ENV!=='production'});
  const port=Number(process.env.PORT||8787);server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Site et souvenirs : http://127.0.0.1:${port}`));
}

