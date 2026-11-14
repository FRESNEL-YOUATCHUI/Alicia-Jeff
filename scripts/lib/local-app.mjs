import path from 'node:path';
import http from 'node:http';
import {createServer as createViteServer} from 'vite';
import {applyLocalEnvironment,portNumber,projectRoot} from './environment.mjs';
import gateway from '../../api/gateway.mjs';
import {sendError} from '../../serverless/http.mjs';

export async function startLocalApp({port=3000,host='127.0.0.1',logger=console}={}){
  applyLocalEnvironment();
  let vite,closed=false;
  const server=http.createServer((req,res)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://local.invalid').pathname);}catch{
      res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Adresse non valide.',code:'invalid_path'}));return;
    }
    const segments=pathname.toLowerCase().split('/');
    if(segments.some(part=>part.startsWith('.env')||['.git','.vercel','.wedding-data','.qa-artifacts'].includes(part))||['server','serverless','scripts','supabase','docs'].includes(segments[1])){
      res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Adresse introuvable.',code:'not_found'}));return;
    }
    if(pathname==='/api'||pathname.startsWith('/api/')){
      // The local browser cannot impersonate Vercel's trusted edge header.
      delete req.headers['x-vercel-forwarded-for'];
      void Promise.resolve(gateway(req,res)).catch(error=>sendError(res,error));
    }else{
      vite.middlewares(req,res,error=>{
        if(error){sendError(res,error);return;}
        res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Adresse introuvable.');
      });
    }
  });
  server.requestTimeout=30_000;server.headersTimeout=15_000;
  const close=async()=>{
    if(closed)return;closed=true;
    const stopped=new Promise(resolve=>{if(server.listening)server.close(resolve);else resolve();});
    server.closeAllConnections();
    await vite?.close();
    await stopped;
  };
  try{
    vite=await createViteServer({
      root:projectRoot,appType:'spa',clearScreen:false,
      ...(port===0?{cacheDir:path.join(projectRoot,'.qa-artifacts','vite-cache-'+process.pid)}:{}),
      server:{middlewareMode:true,hmr:{server},host},
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  }catch(error){
    await close();
    if(error.code==='EADDRINUSE')throw Object.assign(new Error('Le port '+port+' est déjà utilisé. Arrêtez l’autre instance ou lancez npm run dev -- --port 3001.'),{code:'EADDRINUSE'});
    throw error;
  }
  const url='http://'+host+':'+server.address().port;
  logger.info('Alicia & Jeff : '+url+'/');
  logger.info('API : vrais handlers Vercel avec Supabase ; aucun backend simulé, aucune donnée JSON historique.');
  const required=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','SUPABASE_URL','SUPABASE_SECRET_KEY'];
  const missing=required.filter(name=>!process.env[name]);
  if(missing.length)logger.warn('Variables manquantes : '+missing.join(', ')+'. Le site affiche des erreurs structurées pour les services non configurés.');
  return{server,vite,url,close};
}
export function cliPort(argv=process.argv.slice(2),env=process.env){
  if(argv.length===0)return portNumber(env.PORT,3000);
  if(argv.length!==2||argv[0]!=='--port')throw new Error('Utilisation : npm run dev [-- --port 3001].');
  return portNumber(argv[1]);
}
