-- READ ONLY after authorized activation. No RSVP, upload, mutation RPC or signed URL is created.
begin transaction isolation level repeatable read read only;
set local row_security=off;
set local statement_timeout='120s';
with expected(signature) as (values ('public.wedding_api_assert_staff(uuid)'),('public.wedding_api_rate(text,integer,integer)'),('public.wedding_api_rsvp(jsonb)'),('public.wedding_api_message(jsonb)'),('public.wedding_api_messages(integer)'),('public.wedding_api_gallery_open()'),('public.wedding_api_public_state()'),('public.wedding_api_public_photos(uuid,integer)'),('public.wedding_api_public_photo(uuid)'),('public.wedding_api_admin_photos(uuid,integer)'),('public.wedding_api_admin_messages(integer)'),('public.wedding_api_admin_state()'),('public.wedding_api_mutate(text,uuid,jsonb,uuid)'),('public.wedding_api_upload_reserve(jsonb,uuid)'),('public.wedding_api_upload_claim(uuid,uuid)'),('public.wedding_api_upload_release(uuid,uuid,uuid)'),('public.wedding_api_upload_complete(uuid,uuid,uuid)'),('public.wedding_api_upload_cancel(uuid,uuid)'),('public.wedding_api_cleanup_claim()'),('public.wedding_api_cleanup_done(uuid[])')),
 functions as (select p.* from expected e join pg_proc p on p.oid=to_regprocedure(e.signature)),
 tables as (select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages','wedding_api_limits','wedding_api_uploads') and c.relkind='r'),
 checks(name,passed) as (
 select 'twenty_functions_present',(select count(*) from functions)=20 union all
 select 'functions_invoker_and_path',not exists(select 1 from functions where prosecdef or proconfig is distinct from array['search_path=pg_catalog, pg_temp']) union all
 select 'execute_server_only',not exists(select 1 from functions f cross join lateral aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x where x.grantee<>f.proowner and x.grantee<>(select oid from pg_roles where rolname='service_role'))
 and not exists(select 1 from functions f where has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') or not has_function_privilege('service_role',f.oid,'EXECUTE')) union all
 select 'eight_tables_with_rls',(select count(*) from tables)=8 and not exists(select 1 from tables where not relrowsecurity) union all
 select 'browser_business_access_denied',not exists(select 1 from tables c cross join pg_roles r where c.relname in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages') and r.rolname in ('anon','authenticated') and (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES')))
 and not exists(select 1 from tables c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped cross join pg_roles r where c.relname in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages') and r.rolname in ('anon','authenticated') and not(c.relname='wedding_staff' and r.rolname='authenticated' and a.attname in ('user_id','role')) and has_column_privilege(r.oid,c.oid,a.attnum,'SELECT')) union all
 select 'authenticated_own_role_lookup',has_column_privilege('authenticated','public.wedding_staff','user_id','SELECT') and has_column_privilege('authenticated','public.wedding_staff','role','SELECT') and has_schema_privilege('authenticated','public','USAGE') and has_schema_privilege('authenticated','auth','USAGE') and has_function_privilege('authenticated','auth.uid()','EXECUTE') and exists(select 1 from pg_policies where schemaname='public' and tablename='wedding_staff' and policyname='Staff can read own role' and cmd='SELECT' and roles::text[]=array['authenticated'] and regexp_replace(qual,'\s','','g')='(user_id=(SELECTauth.uid()ASuid))') union all
 select 'server_table_access',has_schema_privilege('service_role','public','USAGE') and not exists(select 1 from tables c where not has_table_privilege('service_role',c.oid,'SELECT') or (c.relname<>'wedding_staff' and not has_table_privilege('service_role',c.oid,'UPDATE')) or (c.relname not in ('wedding_staff','wedding_settings') and not has_table_privilege('service_role',c.oid,'INSERT')) or (c.relname in ('wedding_api_limits','wedding_api_uploads') and not has_table_privilege('service_role',c.oid,'DELETE'))) union all
 select 'three_valid_indexes',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_index i on i.indexrelid=c.oid where n.nspname='public' and c.relname in ('wedding_api_upload_cleanup','wedding_api_photo_album_order','wedding_api_message_order') and i.indisvalid)=3 union all
 select 'private_photo_bucket',exists(select 1 from storage.buckets where id='wedding-photos' and not public)
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
select 'wedding_messages' name,coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) rows from public.wedding_messages t)
 select jsonb_build_object('checked_at',now(),'read_only',true,'all_checks_passed',(select bool_and(coalesce(passed,false)) from checks),
 'checks',(select jsonb_object_agg(name,coalesce(passed,false)) from checks),
 'business_counts',(select jsonb_object_agg(name,jsonb_array_length(rows)) from business_data),
 'business_fingerprints',(select jsonb_object_agg(name,md5(rows::text)) from business_data)) verification;
commit;
