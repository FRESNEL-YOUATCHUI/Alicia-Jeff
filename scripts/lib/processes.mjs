import {execFile} from 'node:child_process';
import path from 'node:path';
export function stopChildTree(child,signal='SIGTERM'){
  if(!child?.pid||child.exitCode!==null)return Promise.resolve();
  if(process.platform!=='win32'){child.kill(signal);return Promise.resolve();}
  const taskkill=path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe');
  return new Promise(resolve=>execFile(taskkill,['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>resolve()));
}
