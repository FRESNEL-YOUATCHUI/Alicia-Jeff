import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {localEnvironment,vercelEnvironment} from './lib/environment.mjs';
const require=createRequire(import.meta.url),env=localEnvironment();
const util=path.join(path.dirname(require.resolve('@vercel/build-utils/package.json')),'dist/get-node-exec-path.js');
const js='try{const p=require('+JSON.stringify(util)+').getNodeExecPath();console.log(JSON.stringify({found:true,isCurrentNode:p===process.execPath}));}catch(e){console.log(JSON.stringify({found:false,error:e.message}));process.exitCode=1;}';
const isolated={...env};
for(const key of Object.keys(isolated))if(key.toUpperCase()==='PATH')delete isolated[key];
isolated.PATH=path.dirname(process.execPath);delete isolated.VERCEL_NODE_EXEC_PATH;
const probe=flag=>{
  const childEnv={...isolated};
  if(flag===undefined)delete childEnv.VERCEL_VC_NATIVE;else childEnv.VERCEL_VC_NATIVE=flag;
  const result=spawnSync(process.execPath,['-e',js],{env:childEnv,encoding:'utf8',windowsHide:true});
  return{exit:result.status,...JSON.parse(result.stdout||'{}')};
};
const corrected=spawnSync(process.execPath,['-e',js],{env:vercelEnvironment(isolated),encoding:'utf8',windowsHide:true});
const required=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','SUPABASE_URL','SUPABASE_SECRET_KEY'];
const result={
  node_version:process.versions.node,node_executable_exists:fs.existsSync(process.execPath),
  required_variables:Object.fromEntries(required.map(name=>[name,Boolean(env[name])])),
  url_pair_matches:env.VITE_SUPABASE_URL===env.SUPABASE_URL,
  node_detection:{single_node_without_flag:probe(undefined),single_node_with_legacy_zero_flag:probe('0'),corrected:{exit:corrected.status,...JSON.parse(corrected.stdout||'{}')}},
  details:'No PATH, secret values or credentials recorded. Legacy zero-flag failure is reproduced in an isolated child PATH.',
};
fs.mkdirSync('.qa-artifacts',{recursive:true});fs.writeFileSync('.qa-artifacts/runtime-diagnostic.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!result.node_executable_exists||required.some(name=>!env[name])||!result.url_pair_matches||corrected.status!==0)process.exitCode=1;
