import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {snapshotQuery} from '../prepare-activation-backup.mjs';
import {parseCsv} from './csv.mjs';
export const MIGRATION005_SHA='6cdd11593eca2d970c132fe112be716b36df02e63ffd1822dfb7b758e3499d95';
export const PROJECT_REF='mcnpagbcehupdbhshcea';
export const ticketNames=['wedding_api_ticket_restore','wedding_api_confirm','wedding_api_ticket_lookup','wedding_api_ticket_enter'];
export const draftNames=['wedding_api_upload_complete_draft','wedding_api_upload_draft_ready'];
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const normalize=value=>value.replace(/\r\n?/g,'\n').trim();
const stable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function body(sql,name){const found=sql.match(new RegExp('function public\\.'+name+'\\([^]*?as \\$\\$([^]*?)\\$\\$;','i'));if(!found)throw Error('Local SQL definition unavailable');return normalize(found[1]);}
const procs=names=>`coalesce((select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'source',p.prosrc,'arguments',pg_get_function_arguments(p.oid),'strict',p.proisstrict,'volatility',p.provolatile,'parallel',p.proparallel,'returns_set',p.proretset,'result',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,'language',l.lanname,'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname,p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname in (${names.map(n=>"'"+n+"'").join(',')})),'[]'::jsonb)`;
export function backupSql(){return `-- READ ONLY. Private logical backup: includes names and bearer ticket references. Never share or commit results.
-- One repeatable-read snapshot, all nine application tables. Not a physical backup: Auth users and Storage bytes are excluded.
begin transaction isolation level repeatable read read only;
set local row_security=off;
set local lock_timeout='5s';
set local statement_timeout='120s';
with original as (${snapshotQuery().trim().replace(/;$/,'')})
select jsonb_build_object(
 'format','alicia-jeff-migration005-backup-v1','captured_at',now(),
 'expected_project_ref','${PROJECT_REF}',
 'protected',snapshot-'captured_at'-'business_data'-'fingerprints',
 'private_rows',(snapshot->'business_data')||jsonb_build_object(
 'wedding_api_uploads',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.wedding_api_uploads t),
 'wedding_api_limits',(select coalesce(jsonb_agg(to_jsonb(t) order by t.key),'[]'::jsonb) from public.wedding_api_limits t),
 'wedding_ticket_entries',(select coalesce(jsonb_agg(to_jsonb(t) order by t.rsvp_id),'[]'::jsonb) from public.wedding_ticket_entries t)),
 'ticket_metadata',jsonb_build_object(
 'rls',(select relrowsecurity from pg_class where oid='public.wedding_ticket_entries'::regclass),
 'owner',(select pg_get_userbyid(relowner) from pg_class where oid='public.wedding_ticket_entries'::regclass),
 'acl',(select relacl::text from pg_class where oid='public.wedding_ticket_entries'::regclass),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.wedding_ticket_entries'::regclass and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid),'validated',convalidated) order by conname) from pg_constraint where conrelid='public.wedding_ticket_entries'::regclass),
 'policies',coalesce((select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='wedding_ticket_entries'),'[]'::jsonb),
 'indexes',(select jsonb_agg(to_jsonb(i) order by indexname) from pg_indexes i where schemaname='public' and tablename='wedding_ticket_entries'),
 'browser_access',exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated') and (has_table_privilege(r.oid,'public.wedding_ticket_entries','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.oid,'public.wedding_ticket_entries','SELECT,INSERT,UPDATE,REFERENCES')))),
 'ticket_functions',${procs(ticketNames)},
 'draft_functions',${procs(draftNames)},
 'migration004_history',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(statements::text)) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations where version='20261119203629'),
 'unexpected_function_defaults',exists(select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclobjtype='f' and d.defaclrole=current_user::regrole and (d.defaclnamespace=0 or d.defaclnamespace='public'::regnamespace) and a.privilege_type='EXECUTE' and a.grantee not in (0,current_user::regrole::oid,(select oid from pg_roles where rolname='anon'),(select oid from pg_roles where rolname='authenticated'),(select oid from pg_roles where rolname='service_role')))
) snapshot from original;
commit;
`;}
export function parseBackup(text){
 text=text.replace(/^\uFEFF/,'');let value;
 try{value=JSON.parse(text);}catch{const rows=parseCsv(text);if(rows.length!==1||Object.keys(rows[0]).length!==1||typeof rows[0].snapshot!=='string')throw Error('Complete one-row snapshot export required');value=JSON.parse(rows[0].snapshot);}
 if(Array.isArray(value)&&value.length===1)value=value[0];if(value?.snapshot)value=typeof value.snapshot==='string'?JSON.parse(value.snapshot):value.snapshot;
 if(value?.format!=='alicia-jeff-migration005-backup-v1'||value.expected_project_ref!==PROJECT_REF||!value.protected||!value.private_rows)throw Error('Unexpected backup format');
 if(!Array.isArray(value.ticket_functions)||!Array.isArray(value.draft_functions)||!Array.isArray(value.protected.tables)||!Array.isArray(value.protected.functions)||!Array.isArray(value.protected.effective_browser_grants)||!value.ticket_metadata)throw Error('Incomplete private export');
 return value;
}
export function validateBefore(s,root){
 if(s.draft_functions.length)throw Error('005 objects already exist: stop, never replay');
 if(s.unexpected_function_defaults)throw Error('Unexpected default function grants: review required');
 if(s.migration004_history?.length!==1)throw Error('004 migration history unavailable or unexpected');
 if(s.protected.tables.length!==8||s.protected.functions.length!==20||Object.keys(s.private_rows).length!==9||Object.values(s.private_rows).some(x=>!Array.isArray(x)))throw Error('Incomplete logical backup');
 if(!s.protected.tables.every(t=>t.rls)||s.protected.effective_browser_grants.some(x=>['anon','authenticated'].includes(x.role)&&x.schema_create)||!s.ticket_metadata.rls||s.ticket_metadata.browser_access||s.ticket_metadata.policies.length)throw Error('RLS, schema or ticket permissions require review');
 const constraints=s.ticket_metadata.constraints||[];for(const expected of ['PRIMARY KEY (rsvp_id)','UNIQUE (token)','UNIQUE (admitted_name_hash)','FOREIGN KEY (rsvp_id) REFERENCES wedding_rsvps(id) ON DELETE RESTRICT'])if(!constraints.some(c=>c.validated&&c.definition.replaceAll('public.','')===expected))throw Error('004 ticket constraints require review');
 if(!s.protected.functions.every(f=>!f.security_definer&&f.config?.includes('search_path=pg_catalog, pg_temp')))throw Error('Existing API function security differs');
 const old=fs.readFileSync(root+'/supabase/migrations/001_serverless.sql','utf8'),ticket=fs.readFileSync(root+'/supabase/migrations/004_ticket_entry.sql','utf8');
 if(s.ticket_functions.length!==4)throw Error('004 functions unavailable or overloaded');
 for(const fn of s.ticket_functions){if(!ticketNames.includes(fn.name)||normalize(fn.source)!==body(ticket,fn.name)||fn.security_definer||fn.anon_execute||fn.authenticated_execute||!fn.service_execute||!fn.config?.includes('search_path=pg_catalog, pg_temp'))throw Error('004 function definition or permissions differ');}
 for(const name of ['wedding_api_upload_complete','wedding_api_assert_staff']){const fn=s.protected.functions.find(f=>f.signature.startsWith('public.'+name+'('));const source=fn?.definition.match(/AS (\$[A-Za-z_0-9]*\$)([^]*?)\1/i)?.[2];if(!source||normalize(source)!==body(old,name))throw Error('Existing upload prerequisite definition differs');}
 return {ready:true,table_count:9,migration004_preserved:true,private_backup:true};
}
export function validateAfter(before,after,root){
 validateBefore(before,root);
 for(const key of ['protected','ticket_metadata','ticket_functions','migration004_history'])if(stable(before[key])!==stable(after[key]))throw Error('Protected metadata changed: stop and diagnose, no automatic rollback');
 const sql=fs.readFileSync(root+'/supabase/migrations/005_draft_uploads.sql','utf8');if(after.draft_functions.length!==2)throw Error('Expected exactly two new functions');
 for(const name of draftNames){const f=after.draft_functions.find(x=>x.name===name);if(!f||f.owner!==before.protected.executor||f.arguments!==(name.endsWith('_ready')?'':'p_id uuid, p_nonce uuid, p_staff uuid')||f.strict||f.returns_set||f.volatility!=='v'||f.parallel!=='u'||f.config?.length!==1||f.signature.replace(/^public\./,'')!==(name.endsWith('_ready')?name+'()':name+'(uuid,uuid,uuid)')||normalize(f.source)!==body(sql,name)||f.security_definer||f.anon_execute||f.authenticated_execute||!f.service_execute||!f.config?.includes('search_path=pg_catalog, pg_temp')||f.result!==(name.endsWith('_ready')?'boolean':'jsonb')||f.language!==(name.endsWith('_ready')?'sql':'plpgsql')||f.acl.some(a=>!['service_role',f.owner].includes(a.grantee)||a.privilege!=='EXECUTE'||a.grantable))throw Error('New function source, signature or security differs');}
 const changedTables=Object.keys(before.private_rows).filter(t=>stable(before.private_rows[t])!==stable(after.private_rows[t]));
 return {ready:changedTables.length===0,metadata_unchanged:true,data_unchanged:changedTables.length===0,changed_tables:changedTables,requires_traffic_review:changedTables.length>0};
}
export function guardedSql(original){
 if(sha(original)!==MIGRATION005_SHA)throw Error('005 hash mismatch: stop for review');
 const guard=`\n-- DELIVERY GUARD ONLY: reads catalog; creates no object. Original 005 below is otherwise unchanged.\nset local lock_timeout='5s';\nset local statement_timeout='30s';\ndo $delivery005$ begin\n if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('wedding_api_upload_complete_draft','wedding_api_upload_draft_ready'))\n then raise exception '005 objects already exist: stop; do not replay';end if;\nend $delivery005$;\n-- END DELIVERY GUARD\n`;
 return original.toString('utf8').replace(/^begin;(\r?\n)/m,line=>line+guard);
}
