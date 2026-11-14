import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {projectRoot} from './environment.mjs';
import {stopChildTree} from './processes.mjs';

export async function runSteps(steps,{logger=console}={}){
  for(const step of steps){
    logger.info('\n[verify] '+step.name);
    const child=spawn(process.execPath,step.args,{cwd:projectRoot,env:process.env,stdio:'inherit',windowsHide:true});
    let interrupted=false;
    const stop=()=>{interrupted=true;void stopChildTree(child);};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    const code=await new Promise(resolve=>{
      child.once('error',()=>resolve(1));
      child.once('exit',(code,signal)=>resolve(code??(signal?1:0)));
    });
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    const exit=interrupted?130:code;
    if(exit!==0){logger.error('[verify] Échec : '+step.name+' (code '+exit+').');return exit;}
  }
  logger.info('\n[verify] Tous les contrôles ont réussi.');
  return 0;
}
export function npmSteps(names){
  const npm=process.env.npm_execpath;
  if(!npm||!path.isAbsolute(npm)||!fs.existsSync(npm))throw Error('Lancez cette vérification avec npm run verify.');
  return names.map(name=>({name,args:[npm,'run',name]}));
}
