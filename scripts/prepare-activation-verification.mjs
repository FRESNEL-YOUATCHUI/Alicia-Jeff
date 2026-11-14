import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {businessTables,coordinationTables,apiFunctions,activationIndexes} from './lib/activation-manifest.mjs';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
export function verificationQuery(){
 const business=businessTables.map(literal).join(',');
 const all=[...businessTables,...coordinationTables].map(literal).join(',');
 const signatures=apiFunctions.map(s=>'('+literal('public.'+s)+')').join(',');
 const data=businessTables.map(t=>`select '${t}' name,coalesce(jsonb_agg(to_jsonb(t) order by t.${t==='wedding_staff'?'user_id':'id'}),'[]'::jsonb) rows from public.${t} t`).join('\nunion all\n');
 return `with expected(signature) as (values ${signatures}),
 functions as (select p.* from expected e join pg_proc p on p.oid=to_regprocedure(e.signature)),
 tables as (select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${all}) and c.relkind='r'),
 checks(name,passed) as (
 select 'twenty_functions_present',(select count(*) from functions)=20 union all
 select 'functions_invoker_and_path',not exists(select 1 from functions where prosecdef or proconfig is distinct from array['search_path=pg_catalog, pg_temp']) union all
 select 'execute_server_only',not exists(select 1 from functions f cross join lateral aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x where x.grantee<>f.proowner and x.grantee<>(select oid from pg_roles where rolname='service_role'))
 and not exists(select 1 from functions f where has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') or not has_function_privilege('service_role',f.oid,'EXECUTE')) union all
 select 'eight_tables_with_rls',(select count(*) from tables)=8 and not exists(select 1 from tables where not relrowsecurity) union all
 select 'browser_business_access_denied',not exists(select 1 from tables c cross join pg_roles r where c.relname in (${business}) and r.rolname in ('anon','authenticated') and (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES')))
 and not exists(select 1 from tables c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped cross join pg_roles r where c.relname in (${business}) and r.rolname in ('anon','authenticated') and not(c.relname='wedding_staff' and r.rolname='authenticated' and a.attname in ('user_id','role')) and has_column_privilege(r.oid,c.oid,a.attnum,'SELECT')) union all
 select 'authenticated_own_role_lookup',has_column_privilege('authenticated','public.wedding_staff','user_id','SELECT') and has_column_privilege('authenticated','public.wedding_staff','role','SELECT') and has_schema_privilege('authenticated','public','USAGE') and has_schema_privilege('authenticated','auth','USAGE') and has_function_privilege('authenticated','auth.uid()','EXECUTE') and exists(select 1 from pg_policies where schemaname='public' and tablename='wedding_staff' and policyname='Staff can read own role' and cmd='SELECT' and roles::text[]=array['authenticated'] and regexp_replace(qual,'\\s','','g')='(user_id=(SELECTauth.uid()ASuid))') union all
 select 'server_table_access',has_schema_privilege('service_role','public','USAGE') and not exists(select 1 from tables c where not has_table_privilege('service_role',c.oid,'SELECT') or (c.relname<>'wedding_staff' and not has_table_privilege('service_role',c.oid,'UPDATE')) or (c.relname not in ('wedding_staff','wedding_settings') and not has_table_privilege('service_role',c.oid,'INSERT')) or (c.relname in ('wedding_api_limits','wedding_api_uploads') and not has_table_privilege('service_role',c.oid,'DELETE'))) union all
 select 'three_valid_indexes',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_index i on i.indexrelid=c.oid where n.nspname='public' and c.relname in (${activationIndexes.map(literal).join(',')}) and i.indisvalid)=3 union all
 select 'private_photo_bucket',exists(select 1 from storage.buckets where id='wedding-photos' and not public)
 ), business_data as (${data})
 select jsonb_build_object('checked_at',now(),'read_only',true,'all_checks_passed',(select bool_and(coalesce(passed,false)) from checks),
 'checks',(select jsonb_object_agg(name,coalesce(passed,false)) from checks),
 'business_counts',(select jsonb_object_agg(name,jsonb_array_length(rows)) from business_data),
 'business_fingerprints',(select jsonb_object_agg(name,md5(rows::text)) from business_data)) verification;`;
}
export async function prepareVerificationSql(){
 await fs.writeFile(new URL('../supabase/activation/verify-serverless-readonly.sql',import.meta.url),'-- READ ONLY after authorized activation. No RSVP, upload, mutation RPC or signed URL is created.\nbegin transaction isolation level repeatable read read only;\nset local row_security=off;\nset local statement_timeout=\'120s\';\n'+verificationQuery()+'\ncommit;\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await prepareVerificationSql();console.log('Post-activation verification SQL prepared locally; no database contacted.');}
