import {spawn} from 'node:child_process';
import {stopChildTree} from './lib/processes.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {portNumber,projectRoot} from './lib/environment.mjs';

const vite=path.join(path.dirname(fileURLToPath(import.meta.resolve('vite/package.json'))),'bin/vite.js');
// Vercel assigns the internal frontend port. It is not the public --listen port.
const port=portNumber(process.env.PORT,5174);
console.log('[Vite pour Vercel] port interne : '+port);
const child=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{
  cwd:projectRoot,stdio:'inherit',windowsHide:true
});
let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;void stopChildTree(child);};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
child.once('error',()=>{console.error('Le frontend Vite n’a pas pu démarrer.');process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=stopping?0:(code??(signal?1:0));});
