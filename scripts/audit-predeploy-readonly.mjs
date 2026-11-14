import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {localEnvironment} from './lib/environment.mjs';
import {startLocalApp} from './lib/local-app.mjs';
import {MAX_PHOTO_BYTES,PHOTO_TYPES} from '../serverless/validation.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const secretFiles=['.env.local','.env.wedding.local'];
async function secretFileHashes(){const hashes={};for(const file of secretFiles){try{hashes[file]=hash(await fs.readFile(new URL('../'+file,import.meta.url)));}catch(e){if(e.code!=='ENOENT')throw e;hashes[file]=null;}}return hashes;}
const beforeSecrets=await secretFileHashes();
const env=localEnvironment();if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)throw Error('Server configuration required for read-only audit.');
const client=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const config=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const proposal=JSON.parse((await fs.readFile(new URL('../docs/storage-ingestion-proposal.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const example=parseEnv(await fs.readFile(new URL('../.env.example',import.meta.url),'utf8'));
const cron=config.crons?.find(c=>c.path==='/api/internal/uploads/cleanup');
assert.ok(cron,'Declared cleanup cron missing');
assert.ok(config.rewrites?.some(r=>r.source==='/api/:path*'&&r.destination==='/api/gateway?__wedding_route=:path'),'Gateway rewrite does not match the cron path');
assert.equal(MAX_PHOTO_BYTES,proposal.attributes.fileSizeLimit);assert.deepEqual([...PHOTO_TYPES].sort(),[...proposal.attributes.allowedMimeTypes].sort());assert.equal(proposal.attributes.public,false);
let linked=false;try{const p=JSON.parse(await fs.readFile(new URL('../.vercel/project.json',import.meta.url),'utf8'));linked=Boolean(p.projectId&&p.orgId);}catch(e){if(e.code!=='ENOENT')throw e;}
async function counts(){const result={};for(const table of ['wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages','wedding_api_limits','wedding_api_uploads']){const r=await client.from(table).select('*',{head:true,count:'exact'}).abortSignal(AbortSignal.timeout(15000));if(r.error)throw Error('Read-only count unavailable: '+table);result[table]=r.count;}return result;}
const app=await startLocalApp({port:0,logger:{info(){},warn(){}}});
const proof={checked_at:new Date().toISOString(),read_only:true,hosted_mutations_performed:false,storage_configuration_applied:false,secrets_modified:false,authorized_real_cleanup_executed:false,deployments_triggered:false,github_push:false,http_checks:[]};
try{
 proof.counts_before=await counts();
 const secret=process.env.CRON_SECRET;
 proof.cron_configuration={local_secret_present:Boolean(secret),local_minimum_length_met:Boolean(secret&&secret.length>=32),local_header_safe:Boolean(secret&&/^[\x21-\x7e]+$/.test(secret)),local_example_value:Boolean(secret&&secret===example.CRON_SECRET),local_reuses_backend_credential:Boolean(secret&&secret===env.SUPABASE_SECRET_KEY),production_variables_inspected:false};
 const configured=Boolean(secret&&secret.length>=32);
 let invalid='audit-token-not-an-actual-cron-secret';if(invalid===secret)invalid+='-different';
 const requests=[{name:'cron without authorization',path:'/api/internal/uploads/cleanup'},
 {name:'cron ignores forged Vercel headers',path:'/api/internal/uploads/cleanup',headers:{'User-Agent':'vercel-cron/1.0','x-vercel-cron':'1','x-vercel-cron-schedule':cron.schedule}},
 {name:'cron with an unrelated bearer',path:'/api/internal/uploads/cleanup',headers:{Authorization:'Bearer '+invalid}},
 {name:'query token does not authenticate cron',path:'/api/internal/uploads/cleanup?token='+invalid},
 {name:'gateway rewrite without authorization',path:'/api/gateway?__wedding_route=internal/uploads/cleanup'},
 {name:'cron POST refused',path:'/api/internal/uploads/cleanup',method:'POST'},
 {name:'cron HEAD refused',path:'/api/internal/uploads/cleanup',method:'HEAD'},
 {name:'cron OPTIONS refused',path:'/api/internal/uploads/cleanup',method:'OPTIONS'}];
 for(const input of requests){
  if(input.headers?.Authorization==='Bearer '+secret)throw Error('Refusing an authorized cleanup request in read-only audit.');
  const response=await fetch(app.url+input.path,{method:input.method??'GET',headers:input.headers,signal:AbortSignal.timeout(15000)});
  const text=await response.text();const body=text?JSON.parse(text):null;
  const expected=input.method?405:(configured?401:503);assert.equal(response.status,expected,'Cron guard response differs');
  assert.match(response.headers.get('cache-control'),/private/);assert.match(response.headers.get('cache-control'),/no-store/);
  if(secret)assert.ok(!text.includes(secret),'Secret must never be serialized');
  if(!input.method)assert.equal(body.code,configured?'authentication_required':'cron_configuration_required');
  proof.http_checks.push({name:input.name,method:input.method??'GET',status:response.status,code:body?.code,passed:true});
 }
 const bucket=await client.storage.getBucket('wedding-photos');if(bucket.error||!bucket.data)throw Error('Private bucket metadata unavailable');
 proof.bucket_current={id:bucket.data.id,private:!bucket.data.public,max_bytes:bucket.data.file_size_limit,allowed_mime_types:bucket.data.allowed_mime_types,global_limit_inspected:false};assert.equal(proof.bucket_current.private,true);
 proof.ingestion_proposal={file:'docs/storage-ingestion-proposal.json',backend_size_matches:true,backend_types_match:true,applied:false};
 proof.vercel_configuration={cron_path:cron.path,schedule:cron.schedule,schedule_timezone:'UTC',function_max_duration_seconds:config.functions?.['api/gateway.mjs']?.maxDuration,gateway_rewrite_matches:true,local_project_linked:linked,production_configuration_inspected:false};
 proof.counts_after=await counts();assert.deepEqual(proof.counts_after,proof.counts_before,'Data changed during read-only audit; investigate concurrent activity');
 const afterSecrets=await secretFileHashes();assert.deepEqual(afterSecrets,beforeSecrets,'Private configuration files changed during audit');proof.secret_files_unchanged=true;
 proof.audit_passed=true;proof.deployment_readiness='conditional';
 proof.pending=['Production CRON_SECRET presence/quality and active deployment configuration must be checked by owner.','Storage ingestion proposal not applied; global upload limit unverified.','Connected staff and valid write workflows still need manual acceptance.'];
}catch(error){proof.audit_passed=false;proof.failed_check=String(error.message).split('\n')[0];process.exitCode=1;}
finally{await app.close();await fs.writeFile(new URL('../docs/audit/predeploy-readonly.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));}
