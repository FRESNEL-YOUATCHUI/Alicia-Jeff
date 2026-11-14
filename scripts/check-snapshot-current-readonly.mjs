import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createClient} from '@supabase/supabase-js';
import {businessTables} from './lib/activation-manifest.mjs';
import {localEnvironment} from './lib/environment.mjs';
const raw=await fs.readFile(new URL('../.qa-artifacts/backups/preactivation.json',import.meta.url),'utf8');
let capture=JSON.parse(raw.replace(/^\uFEFF/,''));if(Array.isArray(capture))capture=capture[0];capture=capture.snapshot??capture;if(typeof capture==='string')capture=JSON.parse(capture);
const env=localEnvironment();
if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)throw Error('Server configuration unavailable.');
const client=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const pg=new PGlite();const results=[];
try{
 for(const table of businessTables){
  const count=await client.from(table).select('*',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(15000));
  if(count.error||count.count!==capture.business_data[table]?.length){results.push({table,matches:false,count_matches:false});continue;}
  const rows=[];let available=true;
  for(let at=0;at<count.count;at+=500){const result=await client.from(table).select('*').order(table==='wedding_staff'?'user_id':'id').range(at,at+499).abortSignal(AbortSignal.timeout(15000));if(result.error){available=false;break;}rows.push(...result.data);}
  const tail=await client.from(table).select('*',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(15000));
  const fingerprint=available?(await pg.query('select md5($1::jsonb::text) value',[JSON.stringify(rows)])).rows[0].value:null;
  results.push({table,count:count.count,count_matches:!tail.error&&tail.count===count.count,matches:available&&rows.length===count.count&&!tail.error&&tail.count===count.count&&fingerprint===capture.fingerprints[table]});
 }
 const bucket=await client.storage.getBucket('wedding-photos');
 const proof={checked_at:new Date().toISOString(),read_only:true,hosted_mutations_performed:false,private_snapshot_sha256:createHash('sha256').update(raw).digest('hex'),configured_project:new URL(env.SUPABASE_URL).hostname.split('.')[0],business_tables:results,all_business_rows_still_match:results.length===6&&results.every(r=>r.matches),bucket:bucket.error?{available:false}:{available:true,private:!bucket.data.public,max_bytes:bucket.data.file_size_limit,mime_types:bucket.data.allowed_mime_types},limitation:'REST reread is not a transaction; SQL privileges are reviewed from the prior transactionally captured snapshot. Writers must remain stopped until activation.'};
 await fs.writeFile(new URL('../docs/audit/preactivation-current-readonly.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof,null,2));if(!proof.all_business_rows_still_match||!proof.bucket.private)process.exitCode=1;
}finally{await pg.close();}
