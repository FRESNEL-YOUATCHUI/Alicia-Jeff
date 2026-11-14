import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {localEnvironment,vercelEnvironment,projectRoot,portNumber} from '../scripts/lib/environment.mjs';
import {runSteps} from '../scripts/lib/checks.mjs';
import {startLocalApp} from '../scripts/lib/local-app.mjs';
import {createHandler} from '../serverless/handler.mjs';
const quiet={info(){},warn(){},error(){}};
async function temporary(){
 await fs.mkdir(path.join(projectRoot,'.qa-artifacts'),{recursive:true});
 const dir=await fs.mkdtemp(path.join(projectRoot,'.qa-artifacts','runtime-test-'));
 return{dir,async remove(){
  const root=path.join(projectRoot,'.qa-artifacts'),relative=path.relative(root,dir);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  await fs.rm(dir,{recursive:true,force:true});
 }};
}
test('local dotenv is independent of cwd and preserves explicitly supplied process values',async()=>{
 const temp=await temporary();
 try{
  await fs.writeFile(path.join(temp.dir,'.env.local'),'SUPABASE_URL=https://test.invalid\nSUPABASE_SECRET_KEY=local-test-value\n');
  const source={SUPABASE_SECRET_KEY:'explicit-test-value'};
  const env=localEnvironment(source,temp.dir);
  assert.equal(env.SUPABASE_URL,'https://test.invalid');assert.equal(env.SUPABASE_SECRET_KEY,'explicit-test-value');
  assert.deepEqual(source,{SUPABASE_SECRET_KEY:'explicit-test-value'});
 }finally{await temp.remove();}
});
test('Windows child environment removes native mode flags and preserves secrets and Path',()=>{
 const env=vercelEnvironment({Path:'C:\\Windows\\System32',VERCEL_VC_NATIVE:'0',VERCEL_CLI_MANAGED_BUILDERS:'0',SUPABASE_SECRET_KEY:'test-value'},'C:\\Program Files\\nodejs\\node.exe','win32');
 assert.equal(env.VERCEL_VC_NATIVE,undefined);assert.equal(env.VERCEL_CLI_MANAGED_BUILDERS,undefined);
 assert.equal(env.VERCEL_NODE_EXEC_PATH,'C:\\Program Files\\nodejs\\node.exe');
 assert.equal(env.PATH,'C:\\Program Files\\nodejs;C:\\Windows\\System32');
 assert.equal(env.Path,undefined);assert.equal(env.SUPABASE_SECRET_KEY,'test-value');
});
test('installed Vercel Node detector reproduces single-Node PATH failure and corrected detection',()=>{
 const require=createRequire(import.meta.url);
 const util=path.join(path.dirname(require.resolve('@vercel/build-utils/package.json')),'dist/get-node-exec-path.js');
 const base={...process.env};
 for(const k of Object.keys(base))if(k.toUpperCase()==='PATH')delete base[k];
 base.PATH=path.dirname(process.execPath);delete base.VERCEL_NODE_EXEC_PATH;
 const source='try{require('+JSON.stringify(util)+').getNodeExecPath();}catch{process.exitCode=7;}';
 const bad=spawnSync(process.execPath,['-e',source],{env:{...base,VERCEL_VC_NATIVE:'0'},windowsHide:true});
 assert.equal(bad.status,7);
 const good=spawnSync(process.execPath,['-e',source],{env:vercelEnvironment(base),windowsHide:true});
 assert.equal(good.status,0);
});
test('verification stops at the first failed command and preserves its exit code',async()=>{
 const temp=await temporary();
 try{
  const marker=path.join(temp.dir,'should-not-exist');
  const code=await runSteps([
   {name:'expected failure',args:['-e','process.exit(7)']},
   {name:'must not execute',args:['-e','require("node:fs").writeFileSync('+JSON.stringify(marker)+',"unexpected")']},
  ],{logger:quiet});
  assert.equal(code,7);await assert.rejects(()=>fs.access(marker));
 }finally{await temp.remove();}
});
test('verification cancellation stops the process tree and returns a failure code',async()=>{
 const temp=await temporary();
 try{
  const marker=path.join(temp.dir,'must-not-run');
  const moduleUrl=new URL('../scripts/lib/checks.mjs',import.meta.url).href;
  const source=[
   'import {runSteps} from '+JSON.stringify(moduleUrl)+';',
   'setTimeout(()=>process.emit("SIGTERM"),250);',
   'process.exitCode=await runSteps('+JSON.stringify([
    {name:'waiting child',args:['-e','setInterval(()=>{},1000)']},
    {name:'must not run',args:['-e','require("node:fs").writeFileSync('+JSON.stringify(marker)+',"unexpected")']},
   ])+',{logger:{info(){},error(){}}});',
  ].join('\n');
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{timeout:15000,windowsHide:true,encoding:'utf8'});
  assert.equal(result.status,130,result.stderr);
  await assert.rejects(()=>fs.access(marker));
 }finally{await temp.remove();}
});
test('anonymous protected API is 401 even when server configuration is absent',async()=>{
 const saved={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY};
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SECRET_KEY;
 try{
  let status,body;
  await createHandler()({url:'/api/admin/state',method:'GET',headers:{}},{writeHead(value){status=value;},end(value){body=JSON.parse(value);}});
  assert.equal(status,401);assert.equal(body.code,'authentication_required');
 }finally{for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('occupied port fails clearly without leaving a Vite listener',async()=>{
 const occupied=net.createServer();
 await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));
 const port=occupied.address().port;
 try{await assert.rejects(()=>startLocalApp({port,logger:quiet}),e=>e.code==='EADDRINUSE'&&e.message.includes(String(port)));}
 finally{await new Promise(resolve=>occupied.close(resolve));}
 const reusable=net.createServer();await new Promise(resolve=>reusable.listen(port,'127.0.0.1',resolve));
 await new Promise(resolve=>reusable.close(resolve));
});
test('full local app closes and can rebind its own port',async()=>{
 const first=await startLocalApp({port:0,logger:quiet}),port=first.server.address().port;
 assert.equal((await fetch(first.url+'/api/admin/state')).status,401);
 await first.close();await first.close();
 const second=await startLocalApp({port,logger:quiet});
 try{assert.equal((await fetch(second.url+'/api/health')).status,200);}
 finally{await second.close();}
});
test('ports are validated before spawning a frontend process',()=>{
 assert.equal(portNumber('5174'),5174);
 for(const value of ['NaN','3000;echo bad','-1','65536'])assert.throws(()=>portNumber(value));
});
