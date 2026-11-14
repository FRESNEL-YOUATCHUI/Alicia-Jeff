-- READ ONLY. Result contains personal data: save the complete JSON in an ignored/private backup folder.
-- Never paste the result in chat or commit it. No database is contacted by the generator.
begin transaction isolation level repeatable read read only;
set local row_security=off;
set local lock_timeout='5s';
set local statement_timeout='120s';
with targets as (
 select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages','wedding_api_limits','wedding_api_uploads') and c.relkind='r'
 ), business_data as (select 'wedding_albums' name,coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) rows from public.wedding_albums t
union all
select 'wedding_photos' name,coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) rows from public.wedding_photos t
union all
select 'wedding_settings' name,coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) rows from public.wedding_settings t
union all
select 'wedding_staff' name,coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]'::jsonb) rows from public.wedding_staff t
union all
select 'wedding_rsvps' name,coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) rows from public.wedding_rsvps t
union all
select 'wedding_messages' name,coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) rows from public.wedding_messages t), expected_functions(signature) as (values ('public.wedding_api_assert_staff(uuid)'),('public.wedding_api_rate(text,integer,integer)'),('public.wedding_api_rsvp(jsonb)'),('public.wedding_api_message(jsonb)'),('public.wedding_api_messages(integer)'),('public.wedding_api_gallery_open()'),('public.wedding_api_public_state()'),('public.wedding_api_public_photos(uuid,integer)'),('public.wedding_api_public_photo(uuid)'),('public.wedding_api_admin_photos(uuid,integer)'),('public.wedding_api_admin_messages(integer)'),('public.wedding_api_admin_state()'),('public.wedding_api_mutate(text,uuid,jsonb,uuid)'),('public.wedding_api_upload_reserve(jsonb,uuid)'),('public.wedding_api_upload_claim(uuid,uuid)'),('public.wedding_api_upload_release(uuid,uuid,uuid)'),('public.wedding_api_upload_complete(uuid,uuid,uuid)'),('public.wedding_api_upload_cancel(uuid,uuid)'),('public.wedding_api_cleanup_claim()'),('public.wedding_api_cleanup_done(uuid[])'))
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
 'indexes',coalesce((select jsonb_agg(to_jsonb(i) order by i.indexname) from pg_indexes i where i.schemaname='public' and (i.tablename in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages','wedding_api_limits','wedding_api_uploads') or i.indexname in ('wedding_api_upload_cleanup','wedding_api_photo_album_order','wedding_api_message_order'))),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit,'can_login',rolcanlogin,'create_role',rolcreaterole,'create_database',rolcreatedb) order by rolname) from pg_roles),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg((to_jsonb(m)-'roleid'-'member'-'grantor'-'oid')||jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor)) order by roleid,member) from pg_auth_members m),'[]'::jsonb),
 'schema_acl',coalesce((select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) order by nspname) from pg_namespace where nspname in ('public','auth','storage')),'[]'::jsonb),
 'effective_browser_grants',coalesce((select jsonb_agg(jsonb_build_object('role',r.rolname,'table',c.relname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE'),'schema_create',has_schema_privilege(r.oid,'public','CREATE')) order by r.rolname,c.relname) from targets c cross join pg_roles r where r.rolname in ('anon','authenticated','service_role')),'[]'::jsonb),
 'default_acl',coalesce((select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',coalesce(n.nspname,''),'type',defaclobjtype,'acl',defaclacl::text) order by d.oid) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),'[]'::jsonb),
 'storage_metadata',coalesce((select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,'policies',coalesce((select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='storage' and p.tablename=c.relname),'[]'::jsonb)) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname in ('buckets','objects')),'[]'::jsonb),
 'business_data',(select jsonb_object_agg(name,rows) from business_data),
 'fingerprints',(select jsonb_object_agg(name,md5(rows::text)) from business_data)
 ) snapshot;
commit;
