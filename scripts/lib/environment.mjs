import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';

export const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
export function localEnvironment(base=process.env,root=projectRoot){
  const file=path.join(root,'.env.local');
  let parsed={};
  try{parsed=parseEnv(fs.readFileSync(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('Impossible de lire .env.local ('+error.code+').');}
  const env={...base};
  for(const [key,value]of Object.entries(parsed))if(env[key]===undefined)env[key]=value;
  return env;
}
export function applyLocalEnvironment(root=projectRoot){
  const env=localEnvironment(process.env,root);
  for(const [key,value]of Object.entries(env))if(process.env[key]===undefined)process.env[key]=value;
  return env;
}
export function vercelEnvironment(base=process.env,execPath=process.execPath,platform=process.platform){
  const env={...base};
  // The JavaScript CLI is Node, not the native standalone executable.
  // build-utils tests this flag for truthiness, so the string "0" is unsafe.
  delete env.VERCEL_VC_NATIVE;
  delete env.VERCEL_CLI_MANAGED_BUILDERS;
  env.VERCEL_NODE_EXEC_PATH=execPath;
  const keys=Object.keys(env).filter(k=>k.toUpperCase()==='PATH');
  const original=keys.map(k=>env[k]).find(Boolean)||'';
  for(const key of keys)delete env[key];
  const paths=platform==='win32'?path.win32:path.posix;
  env.PATH=paths.dirname(execPath)+paths.delimiter+original;
  return env;
}
export function portNumber(value,fallback=3000){
  if(value===undefined||value==='')return fallback;
  if(!/^\d+$/.test(String(value))||Number(value)<1||Number(value)>65535)throw new Error('Le port doit être un entier entre 1 et 65535.');
  return Number(value);
}
