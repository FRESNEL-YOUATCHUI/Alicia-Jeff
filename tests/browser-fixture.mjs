import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHandler} from '../serverless/handler.mjs';
import {Repository} from '../serverless/repository.mjs';
import {database,clientFor} from './database.mjs';
import {normalizeGuestName,matchOfficialRows} from '../serverless/official-list.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const {pg}=await database(),repo=new Repository(clientFor(pg));
const handler=createHandler({repo,rateSecret:'browser-isolated-test-key',storage:{},
 officialList:{async match(guest){const name=normalizeGuestName(guest.first_name+' '+guest.last_name);return {name,status:matchOfficialRows([['Camille Test']],name)};}}});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
let cardFailures=process.argv.includes('--fail-card-once')?1:0;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/wedding/invitation.png'&&cardFailures-->0){res.writeHead(503,{'Cache-Control':'no-store'});res.end('Deliberate test-only download failure');return;}
  if(url.pathname.startsWith('/api/'))return await handler(req,res);
  const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!target.startsWith(root+path.sep))throw Error('Invalid path');
  const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
console.log('ISOLATED BROWSER FIXTURE http://127.0.0.1:'+server.address().port+'/');
const stop=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();};
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
