import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {applyLocalEnvironment,projectRoot} from './lib/environment.mjs';
import {businessTables} from './lib/activation-manifest.mjs';
applyLocalEnvironment();
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw Error('Server configuration required for read-only backup.');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const data={},counts={};
for(const table of businessTables){
 const initial=await client.from(table).select('*',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(15000));
 if(initial.error||!Number.isSafeInteger(initial.count))throw Error('Read-only backup unavailable: '+table);
 const rows=[];const key=table==='wedding_staff'?'user_id':'id';
 for(let at=0;at<initial.count;at+=500){
  const result=await client.from(table).select('*').order(key).range(at,at+499).abortSignal(AbortSignal.timeout(15000));
  if(result.error||!Array.isArray(result.data)||!result.data.length)throw Error('Incomplete read-only backup: '+table);
  rows.push(...result.data);
 }
 const final=await client.from(table).select('*',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(15000));
 if(final.error||rows.length!==initial.count||final.count!==initial.count||new Set(rows.map(r=>r[key])).size!==rows.length)throw Error('Concurrent change or incomplete backup: '+table);
 data[table]=rows;counts[table]=rows.length;
}
const bucket=await client.storage.getBucket('wedding-photos');
if(bucket.error||!bucket.data||bucket.data.public)throw Error('Private bucket backup metadata unavailable.');
const bundle={format:'alicia-jeff-rest-business-backup-v1',captured_at:new Date().toISOString(),read_only:true,consistent_snapshot:false,
 limitation:'Supplemental REST archive only: not a PostgreSQL transactional backup, no ACL/function definitions, no Auth users or Storage object bytes.',
 tables:data,bucket:{id:bucket.data.id,public:bucket.data.public,file_size_limit:bucket.data.file_size_limit,allowed_mime_types:bucket.data.allowed_mime_types}};
const dir=path.join(projectRoot,'.qa-artifacts','backups');await fs.mkdir(dir,{recursive:true});
const dest=path.join(dir,'business-readonly-'+Date.now()+'.json');const content=JSON.stringify(bundle,null,2)+'\n';
await fs.writeFile(dest,content,{flag:'wx',mode:0o600});
const digest=value=>createHash('sha256').update(value).digest('hex');
if(digest(await fs.readFile(dest))!==digest(content))throw Error('Backup verification failed.');
console.log(JSON.stringify({captured_at:bundle.captured_at,read_only:true,consistent_snapshot:false,counts,sha256:digest(content),private_file:dest,verified_readback:true,sql_backup_still_required:true},null,2));
