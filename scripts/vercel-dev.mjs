import {spawn} from 'node:child_process';
import {stopChildTree} from './lib/processes.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {localEnvironment,projectRoot,vercelEnvironment} from './lib/environment.mjs';

const require=createRequire(import.meta.url);
const packageName=process.platform==='win32'?'@vercel/cli-support':'vercel';
const entry=path.join(path.dirname(require.resolve(packageName+'/package.json')),'dist','vc.js');
if(!fs.existsSync(entry))throw new Error('Le lanceur Vercel installé est incomplet. Réinstaller avec npm ci ou utiliser npm run dev.');
const child=spawn(process.execPath,[entry,'dev',...process.argv.slice(2)],{
  cwd:projectRoot,stdio:'inherit',windowsHide:true,
  env:vercelEnvironment(localEnvironment())
});
let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;void stopChildTree(child);};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
child.once('error',()=>{console.error('Vercel Dev n’a pas pu démarrer. Utilisez npm run dev pour le runtime local des mêmes API.');process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=stopping?0:(code??(signal?1:0));});
