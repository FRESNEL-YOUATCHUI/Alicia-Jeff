import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHmac} from 'node:crypto';
import {database,clientFor,STAFF} from './database.mjs';
import {Repository} from '../serverless/repository.mjs';
import {createHandler} from '../serverless/handler.mjs';
import {requireStaff} from '../serverless/supabase.mjs';
import {inspectImage} from '../serverless/storage.mjs';
import {ApiError} from '../serverless/http.mjs';
import {mintOwnerProbeGrant} from '../serverless/owner-probe-grant.mjs';
export async function fullBrowserFixture(){
 const {pg}=await database(),client=clientFor(pg),repo=new Repository(client),objects=new Map(),secret=randomBytes(32).toString('hex');let url,cardFailures=0;
 await pg.exec("update wedding_settings set gallery_published=true,release_at=now()-interval '1 hour';update wedding_albums set published=true;");
 const sign=(id,expires)=>createHmac('sha256',secret).update(id+':'+expires).digest('hex');
 const storage={
  async sign(rows){return rows.map(({storage_path:_storagePath,...p})=>{const expires=Date.now()+600000;return{...p,url:url+'/test/photo/'+p.id+'?expires='+expires+'&sig='+sign(p.id,expires),expires_at:new Date(expires).toISOString()};});},
  async uploadToken(u){return{bucket:'wedding-photos',path:u.storage_path,token:'isolated-upload-token'};},
  async verify(u){const file=objects.get(u.storage_path);if(!file)throw new ApiError(409,'upload_incomplete','Import absent.');if(file.data.length!==u.size||file.type!==u.content_type)throw new ApiError(415,'photo_mismatch','Image non conforme.');inspectImage(file.data.subarray(0,131072),file.data.subarray(-12),file.data.length,file.type);},
  async remove(paths){paths.forEach(p=>objects.delete(p));}
 };
 const handler=createHandler({repo,storage,authenticate:req=>requireStaff(req,client),rateSecret:secret,googleSheetsReadiness:async()=>({status:200,body:{ready:true,sheets_readable:true}}),officialList:{async match(guest){const name=(guest.first_name+' '+guest.last_name).toLowerCase();return{status:name==='camille test'?'recognized':'absent',name};}}});
 const root=path.resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4'};
 const server=http.createServer(async(req,res)=>{try{
  const route=new URL(req.url,'http://local.invalid');
  if(route.pathname.startsWith('/api/'))return await handler(req,res);
  if(route.pathname.startsWith('/test/upload/')&&req.method==='PUT'){
   const p=decodeURIComponent(route.pathname.slice('/test/upload/'.length)),parts=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>20*1024*1024)throw Error();parts.push(chunk);}objects.set(p,{data:Buffer.concat(parts),type:req.headers['content-type']});res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');return;
  }
  if(route.pathname.startsWith('/test/photo/')){
   const id=route.pathname.split('/').at(-1),expires=Number(route.searchParams.get('expires'));
   if(expires<Date.now()||route.searchParams.get('sig')!==sign(id,expires))throw Error();
   const row=(await pg.query('select storage_path from wedding_photos where id=$1',[id])).rows[0],image=objects.get(row?.storage_path);if(!image)throw Error();res.writeHead(200,{'Content-Type':image.type,'Cache-Control':'private, no-store'});res.end(image.data);return;
  }
  if(route.pathname==='/wedding/invitation.png'&&cardFailures>0){cardFailures--;res.writeHead(503);res.end();return;}
  const pathname=route.pathname==='/'||route.pathname==='/photographe'||route.pathname==='/photographe/'?'/index.html':route.pathname;
  const p=path.resolve(root,'.'+decodeURIComponent(pathname));if(!p.startsWith(root+path.sep))throw Error();const data=await fs.readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{if(!res.headersSent)res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;
 return{url,pg,staff:STAFF,ownerGrant(){return mintOwnerProbeGrant(STAFF,secret);},failCardOnce(){cardFailures=1;},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();}};
}
