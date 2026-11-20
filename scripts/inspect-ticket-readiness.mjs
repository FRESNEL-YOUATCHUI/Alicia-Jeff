import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {applyLocalEnvironment} from './lib/environment.mjs';
import {OfficialList,DEFAULT_SHEET_ID,DEFAULT_SHEET_RANGE} from '../serverless/official-list.mjs';
import {GOOGLE_IDENTITY,googleOidcReadiness} from '../serverless/google-oidc.mjs';
applyLocalEnvironment();
const resolved={
  GOOGLE_SHEETS_SPREADSHEET_ID:process.env.GOOGLE_SHEETS_SPREADSHEET_ID||DEFAULT_SHEET_ID,
  GOOGLE_SHEETS_RANGE:process.env.GOOGLE_SHEETS_RANGE||DEFAULT_SHEET_RANGE,
  ...Object.fromEntries(Object.entries(GOOGLE_IDENTITY).map(([name,value])=>[name,process.env[name]??value]))
};
const variables=Object.fromEntries(Object.entries(resolved).map(([name,value])=>[name,Boolean(value)]));
const identity=googleOidcReadiness();
let schema={ready:false,code:'configuration_required'};
let sheet={ready:false,code:!identity.configuration_valid?'oidc_configuration_required':!identity.production_runtime?'production_identity_required':'configuration_required'};
if(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY){
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const check=await client.from('wedding_ticket_entries').select('rsvp_id,token,checked_in_at,admitted_name_hash,created_at').limit(0).abortSignal(AbortSignal.timeout(15000));
 const lookup=check.status===200&&!check.error?await client.rpc('wedding_api_ticket_lookup',{p_token:''}).abortSignal(AbortSignal.timeout(15000)):null;
 schema={ready:check.status===200&&!check.error&&lookup?.status===200&&!lookup?.error,
 code:check.error?.code||lookup?.error?.code||(lookup?.status===200?'ready':'schema_required'),
 lookup_rpc_ready:lookup?.status===200&&!lookup?.error};
}
if(Object.values(variables).every(Boolean)&&identity.configuration_valid&&identity.production_runtime){
 try{await new OfficialList().match({first_name:'Healthcheck',last_name:'No-admission-probe'});sheet={ready:true,code:'read_only_access_verified'};}
 catch(error){sheet={ready:false,code:error.code||'official_list_unavailable'};}
}
const result={checked_at:new Date().toISOString(),read_only:true,variables,identity,name_order:process.env.GUEST_NAME_ORDER||'mixed',schema,sheet,ready:schema.ready&&sheet.ready};
await fs.mkdir('.qa-artifacts',{recursive:true});await fs.writeFile('.qa-artifacts/ticket-readiness.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:2;
