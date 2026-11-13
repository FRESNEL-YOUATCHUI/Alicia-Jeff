-- READ ONLY: five complete result sets. Export all rows, not the first 100.
-- No object names, file bytes, visitor records, JWTs or secrets are selected.

-- 1 -> docs/database/storage_bucket.csv
select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='wedding-photos';

-- 2 -> docs/database/storage_rls.csv (tables only, excluding indexes)
select n.nspname as schemaname,c.relname as tablename,
 c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced,
 pg_get_userbyid(c.relowner) as table_owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='storage' and c.relname in ('objects','buckets')
and c.relkind in ('r','p') order by c.relname;

-- 3 -> docs/database/storage_policies.csv
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='storage' and tablename in ('objects','buckets')
order by tablename,policyname;

-- 4 -> docs/database/storage_grants.csv (including PUBLIC)
select n.nspname as schemaname,c.relname as tablename,
 case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
 pg_get_userbyid(a.grantor) as grantor,a.privilege_type,a.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
where n.nspname='storage' and c.relname in ('objects','buckets')
and c.relkind in ('r','p') order by c.relname,grantee,a.privilege_type;

-- 5 -> docs/database/storage_effective_privileges.csv
select r.rolname as role_name,n.nspname as schemaname,c.relname as tablename,
 r.rolbypassrls as bypass_rls,(r.oid=c.relowner) as is_table_owner,
 has_schema_privilege(r.oid,n.oid,'USAGE') as schema_usage,
 has_table_privilege(r.oid,c.oid,'SELECT') as can_select,
 has_table_privilege(r.oid,c.oid,'INSERT') as can_insert,
 has_table_privilege(r.oid,c.oid,'UPDATE') as can_update,
 has_table_privilege(r.oid,c.oid,'DELETE') as can_delete,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') as can_truncate,
 has_table_privilege(r.oid,c.oid,'REFERENCES') as can_reference,
 has_table_privilege(r.oid,c.oid,'TRIGGER') as can_trigger,
 has_any_column_privilege(r.oid,c.oid,'SELECT') as any_column_select,
 has_any_column_privilege(r.oid,c.oid,'INSERT') as any_column_insert,
 has_any_column_privilege(r.oid,c.oid,'UPDATE') as any_column_update
from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
where r.rolname in ('anon','authenticated','service_role')
and n.nspname='storage' and c.relname in ('objects','buckets') and c.relkind in ('r','p')
order by r.rolname,c.relname;
