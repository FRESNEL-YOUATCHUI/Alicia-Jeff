import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results={inspected_at:new Date().toISOString(),read_only:true};
const bucket=await client.storage.getBucket('wedding-photos');
results.bucket=bucket.error?{available:false,status:bucket.error.status}:{available:true,private:!bucket.data.public,max_bytes:bucket.data.file_size_limit,mime_types:bucket.data.allowed_mime_types};
results.table_counts={};
for(const name of ['wedding_albums','wedding_photos','wedding_rsvps','wedding_messages','wedding_staff']){
 const result=await client.from(name).select('*',{count:'exact',head:true});
 results.table_counts[name]=result.error?{available:false,code:result.error.code}:{count:result.count};
}
const settings=await client.from('wedding_settings').select('id,gallery_published,release_at').eq('id',1).maybeSingle();
results.settings=settings.error?{available:false,code:settings.error.code}:settings.data;
const legacy=JSON.parse(await fs.readFile('.wedding-data/souvenirs.json','utf8').catch(()=>'{}'));
results.local_legacy_counts={responses:legacy.responses?.length||0,messages:legacy.messages?.length||0,albums:legacy.albums?.length||0,photos:legacy.albums?.reduce((n,a)=>n+(a.photos?.length||0),0)||0};
await fs.writeFile('docs/audit/readonly-health.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
