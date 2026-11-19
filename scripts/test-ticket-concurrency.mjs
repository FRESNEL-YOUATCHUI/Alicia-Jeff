import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd();
const bin=process.env.POSTGRES_BIN||(process.platform==='win32'?'C:/Program Files/PostgreSQL/16/bin':'/usr/lib/postgresql/16/bin');
const exe=name=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
await fs.access(exe('initdb'));
const dir=path.join(root,'.qa-artifacts','ticket-postgres-'+randomUUID()),data=path.join(dir,'data');
await fs.mkdir(dir,{recursive:true});
const password=randomBytes(32).toString('hex'),passwordFile=path.join(dir,'password.tmp');
await fs.writeFile(passwordFile,password,{mode:0o600});
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'postgres',PGDATABASE:'postgres',PGPASSWORD:password,PGCLIENTENCODING:'UTF8'};
async function run(command,args,input){
 return new Promise((resolve,reject)=>{
  const child=spawn(exe(command),args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  child.on('error',()=>reject(Error(command+' could not start.')));
  child.on(command==='pg_ctl'?'exit':'close',code=>code===0?resolve(stdout):reject(Error(command+' failed: '+stderr.slice(0,1500))));
  child.stdin.on('error',()=>{});child.stdin.end(input||'');
 });
}
const query=sql=>run('psql',['-X','-A','-t','-q','-v','ON_ERROR_STOP=1'],sql);
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const json=value=>literal(JSON.stringify(value))+'::jsonb';
let started=false;
try{
 await run('initdb',['--username=postgres','--auth=scram-sha-256','--encoding=UTF8','--no-locale','--pwfile='+passwordFile,'--pgdata='+data]);
 await run('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o','-h 127.0.0.1 -p '+port+' -c fsync=off','-w','start']);started=true;
 const parts=['tests/schema-fixture.sql','supabase/migrations/001_serverless.sql','supabase/migrations/002_api_only_access.sql','supabase/migrations/004_ticket_entry.sql'];
 await query((await Promise.all(parts.map(p=>fs.readFile(path.join(root,p),'utf8')))).join('\n'));
 const nameHash=createHash('sha256').update('concurrency guest').digest('hex');
 async function makeTicket(){
  const token=randomBytes(32).toString('base64url');
  const input={first_name:'Concurrency',last_name:'Guest',participants:1,ref_hash:randomBytes(32).toString('hex')};
  const ticket=JSON.parse((await query('set role service_role; select wedding_api_confirm('+json(input)+','+literal(token)+');')).trim()).ticket;
  const guest=JSON.parse((await query('set role service_role; select wedding_api_ticket_lookup('+literal(token)+');')).trim());
  return {ticket,guest,token};
 }
 async function race(a,b){
  const enter=x=>'select wedding_api_ticket_enter('+literal(x.token)+','+literal(x.guest.updated_at)+'::timestamptz,'+literal(nameHash)+');';
  const first=query('set role service_role; begin; select pg_backend_pid(); '+enter(a)+' select pg_sleep(1); commit;');
  await new Promise(resolve=>setTimeout(resolve,150));
  const second=query('set role service_role; begin; select pg_backend_pid(); '+enter(b)+' commit;');
  const outputs=await Promise.all([first,second]);
  const pids=outputs.map(out=>Number(out.trim().split('\n')[0]));assert.notEqual(pids[0],pids[1]);
  const statuses=outputs.map(out=>JSON.parse(out.split('\n').find(line=>line.startsWith('{'))).status).sort();
  assert.deepEqual(statuses,['used','valid']);
  return {independentConnections:true,results:statuses};
 }
 const one=await makeTicket();const same=await race(one,one);
 // Separate name hash for this second race, after clearing only the isolated synthetic admissions.
 await query('update wedding_ticket_entries set checked_in_at=null,admitted_name_hash=null;');
 const a=await makeTicket(),b=await makeTicket(),different=await race(a,b);
 assert.equal((await query('select count(*) from wedding_ticket_entries where checked_in_at is not null;')).trim(),'1');
 console.log(JSON.stringify({postgres:'16',sameTicket:same,differentTicketsSamePerson:different,hostedConnection:false}));
}finally{
 try{if(started)await run('pg_ctl',['-D',data,'-m','fast','-w','stop']);}finally{await fs.unlink(passwordFile).catch(()=>{});}
}
