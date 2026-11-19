import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {applyLocalEnvironment} from './lib/environment.mjs';
import {OfficialList} from '../serverless/official-list.mjs';
applyLocalEnvironment();
const names=['GOOGLE_SHEETS_SPREADSHEET_ID','GOOGLE_SHEETS_RANGE','GOOGLE_SERVICE_ACCOUNT_EMAIL','GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'];
const variables=Object.fromEntries(names.map(name=>[name,Boolean(process.env[name])]));
let schema={ready:false,code:'configuration_required'},sheet={ready:false,code:'configuration_required'};
if(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY){
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const check=await client.from('wedding_ticket_entries').select('rsvp_id').limit(0).abortSignal(AbortSignal.timeout(15000));
 schema={ready:check.status===200&&!check.error,code:check.error?.code||(check.status===200?'ready':'http_'+check.status)};
}
if(Object.values(variables).every(Boolean)){
 try{await new OfficialList().match({first_name:'Healthcheck',last_name:'No-admission-probe'});sheet={ready:true,code:'read_only_access_verified'};}
 catch(error){sheet={ready:false,code:error.code||'official_list_unavailable'};}
}
const result={checked_at:new Date().toISOString(),read_only:true,variables,name_order:process.env.GUEST_NAME_ORDER||'mixed',schema,sheet,ready:schema.ready&&sheet.ready};
await fs.mkdir('.qa-artifacts',{recursive:true});await fs.writeFile('.qa-artifacts/ticket-readiness.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:2;
