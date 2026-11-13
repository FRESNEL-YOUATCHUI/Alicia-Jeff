import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import handler from '../serverless/handler.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{process.loadEnvFile(path.join(root,'.env.local'));}catch(error){if(error.code!=='ENOENT')throw error;}
const server=createServer(handler);
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8787,'127.0.0.1',resolve);});
console.log('API Supabase locale sur http://127.0.0.1:8787 ; aucune donnée JSON historique n’est utilisée.');
const viteEntry=path.join(path.dirname(fileURLToPath(import.meta.resolve('vite/package.json'))),'bin/vite.js');
const child=spawn(process.execPath,[viteEntry,'--host','127.0.0.1','--port','5173','--strictPort'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,WEDDING_DEV_API:'http://127.0.0.1:8787'}});
const stop=()=>{child.kill();server.close();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);child.on('exit',()=>server.close());
