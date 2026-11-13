-- READ ONLY. Export the results as a local file; no visitor rows or credentials.
select table_name,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in
('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages')
order by table_name,ordinal_position;
select c.relname as table_name,con.conname,pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'wedding_%';
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename like 'wedding_%';
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename like 'wedding_%') or (schemaname='storage' and tablename='objects');
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'wedding_%';
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name like 'wedding_%' order by table_name,grantee;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='wedding-photos';
-- No Auth identities, RSVP contents, or message contents are queried.
