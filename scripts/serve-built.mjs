import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import gateway from '../api/gateway.mjs';
import {sendError} from '../serverless/http.mjs';
import {applyLocalEnvironment,projectRoot,portNumber} from './lib/environment.mjs';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml',
 '.mp4':'video/mp4','.mp3':'audio/mpeg','.woff2':'font/woff2','.ico':'image/x-icon','.json':'application/json'};
export async function startBuiltApp({port=3000,host='127.0.0.1',root=path.join(projectRoot,'dist'),logger=console}={}){
 applyLocalEnvironment();const base=await fs.realpath(root);
 await fs.access(path.join(base,'index.html'));
 const server=http.createServer(async(req,res)=>{
  try{
   let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local.invalid').pathname);}catch{res.writeHead(400);res.end('Adresse invalide.');return;}
   const segments=pathname.toLowerCase().split('/');
   if(segments.some(part=>part.startsWith('.')&&part!=='')||['server','serverless','scripts','supabase','docs','tests','src'].includes(segments[1])){
    res.writeHead(404,{'Cache-Control':'no-store'});res.end('Adresse introuvable.');return;
   }
   if(pathname==='/api'||pathname.startsWith('/api/')){
    delete req.headers['x-vercel-forwarded-for'];await gateway(req,res);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
   let file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(base+path.sep)){res.writeHead(404);res.end();return;}
   let stat;
   try{file=await fs.realpath(file);stat=await fs.stat(file);}
   catch{if(!path.extname(pathname)){file=path.join(base,'index.html');stat=await fs.stat(file);}else{res.writeHead(404);res.end();return;}}
   if(!file.startsWith(base+path.sep)||!stat.isFile()){res.writeHead(404);res.end();return;}
   const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream',
    'Cache-Control':path.extname(file)==='.html'?'no-cache':'public, max-age=3600',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes'};
   let start=0,end=stat.size-1,status=200;
   if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}
    if(!match[1])start=Math.max(0,stat.size-Number(match[2]));
    else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}
    status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;
   }
   headers['Content-Length']=String(end-start+1);res.writeHead(status,headers);
   if(req.method==='HEAD'||!stat.size){res.end();return;}
   const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch(error){if(!res.headersSent)sendError(res,error);else res.destroy();}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 const url='http://'+host+':'+server.address().port;
 logger.info('Alicia & Jeff (build + API Supabase) : '+url+'/');
 logger.info('Version : finalisation-20261120. Un billet = une personne. Aucun backend historique.');
 return {server,url,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length&&(args.length!==2||args[0]!=='--port'))throw Error('Utilisation : npm start [-- --port 3001]');
 let app;
 try{app=await startBuiltApp({port:portNumber(args[1]||process.env.PORT,3000)});}
 catch(error){console.error(error.code==='ENOENT'?'Build absent : lancez npm run build.':error.code==='EADDRINUSE'?'Port déjà occupé. Arrêtez votre autre instance ou choisissez --port 3001.':'Le site n’a pas pu démarrer.');process.exitCode=1;}
 if(app){const stop=()=>void app.close();process.once('SIGINT',stop);process.once('SIGTERM',stop);}
}
