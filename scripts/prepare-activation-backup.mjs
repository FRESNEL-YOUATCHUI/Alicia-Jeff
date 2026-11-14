import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {businessTables,coordinationTables,apiFunctions,activationIndexes} from './lib/activation-manifest.mjs';
const literal=value=>"'"+value.replaceAll("'","''")+"'";
export function snapshotQuery(){
 const tables=[...businessTables,...coordinationTables].map(literal).join(',');
 const signatures=apiFunctions.map(f=>'('+literal('public.'+f)+')').join(',');
 const rows=businessTables.map(name=>{
  const key=name==='wedding_staff'?'user_id':'id';
  return `select '${name}' name,coalesce(jsonb_agg(to_jsonb(t) order by t.${key}),'[]'::jsonb) rows from public.${name} t`;
 }).join('\nunion all\n');
 return `with targets as (
 select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${tables}) and c.relkind='r'
 ), business_data as (${rows}), expected_functions(signature) as (values ${signatures})
 select jsonb_build_object(
 'format','alicia-jeff-preactivation-v1','captured_at',now(),'database',current_database(),'executor',current_user,'server_version',current_setting('server_version'),
 'tables',coalesce((select jsonb_agg(jsonb_build_object(
 'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable) order by x.grantee,x.privilege_type) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x),'[]'::jsonb),
 'columns',coalesce((select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable) order by x.grantee,x.privilege_type) from aclexplode(a.attacl) x),'[]'::jsonb)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb),
 'constraints',coalesce((select jsonb_agg(jsonb_build_object('name',x.conname,'definition',pg_get_constraintdef(x.oid)) order by x.conname) from pg_constraint x where x.conrelid=c.oid),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname),'[]'::jsonb),
 'triggers',coalesce((select jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),'[]'::jsonb)
 ) order by c.relname) from targets c),'[]'::jsonb),
 'functions',coalesce((select jsonb_agg(jsonb_build_object('signature',e.signature,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,
 'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable) order by x.grantee,x.privilege_type) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x),'[]'::jsonb)) order by e.signature) from expected_functions e join pg_proc p on p.oid=to_regprocedure(e.signature)),'[]'::jsonb),
 'indexes',coalesce((select jsonb_agg(to_jsonb(i) order by i.indexname) from pg_indexes i where i.schemaname='public' and (i.tablename in (${tables}) or i.indexname in (${activationIndexes.map(literal).join(',')}))),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit,'can_login',rolcanlogin,'create_role',rolcreaterole,'create_database',rolcreatedb) order by rolname) from pg_roles),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg((to_jsonb(m)-'roleid'-'member'-'grantor'-'oid')||jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor)) order by roleid,member) from pg_auth_members m),'[]'::jsonb),
 'schema_acl',coalesce((select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) order by nspname) from pg_namespace where nspname in ('public','auth','storage')),'[]'::jsonb),
 'effective_browser_grants',coalesce((select jsonb_agg(jsonb_build_object('role',r.rolname,'table',c.relname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE'),'schema_create',has_schema_privilege(r.oid,'public','CREATE')) order by r.rolname,c.relname) from targets c cross join pg_roles r where r.rolname in ('anon','authenticated','service_role')),'[]'::jsonb),
 'default_acl',coalesce((select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',coalesce(n.nspname,''),'type',defaclobjtype,'acl',defaclacl::text) order by d.oid) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),'[]'::jsonb),
 'storage_metadata',coalesce((select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,'policies',coalesce((select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='storage' and p.tablename=c.relname),'[]'::jsonb)) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname in ('buckets','objects')),'[]'::jsonb),
 'business_data',(select jsonb_object_agg(name,rows) from business_data),
 'fingerprints',(select jsonb_object_agg(name,md5(rows::text)) from business_data)
 ) snapshot;`;
}
export async function prepareSnapshotSql(){
 const sql='-- READ ONLY. Result contains personal data: save the complete JSON in an ignored/private backup folder.\n-- Never paste the result in chat or commit it. No database is contacted by the generator.\nbegin transaction isolation level repeatable read read only;\nset local row_security=off;\nset local lock_timeout=\'5s\';\nset local statement_timeout=\'120s\';\n'+snapshotQuery()+'\ncommit;\n';
 await fs.writeFile(new URL('../supabase/activation/preflight-backup-readonly.sql',import.meta.url),sql);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await prepareSnapshotSql();console.log('Read-only snapshot SQL prepared locally; no database contacted.');}
