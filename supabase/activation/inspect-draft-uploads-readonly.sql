-- Read-only pre/post checks for 005. Save results privately outside Git before approval.
-- This does not replace a current database backup. It contains no RSVP or guest rows.
select current_database() as database_name, current_user as audit_role;
select to_regprocedure('public.wedding_api_upload_complete(uuid,uuid,uuid)') is not null as original_complete_present,
 to_regprocedure('public.wedding_api_assert_staff(uuid)') is not null as staff_guard_present,
 to_regprocedure('public.wedding_api_upload_complete_draft(uuid,uuid,uuid)') is not null as draft_complete_present,
 to_regprocedure('public.wedding_api_upload_draft_ready()') is not null as draft_marker_present;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('wedding_api_upload_complete','wedding_api_assert_staff',
 'wedding_api_upload_complete_draft','wedding_api_upload_draft_ready') order by p.proname;
select r.rolname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 has_function_privilege(r.oid,p.oid,'EXECUTE') as can_execute
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where r.rolname in ('anon','authenticated','service_role') and n.nspname='public'
 and p.proname in ('wedding_api_upload_complete_draft','wedding_api_upload_draft_ready') order by p.proname,r.rolname;
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('wedding_photos','wedding_albums','wedding_api_uploads');
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('wedding_photos','wedding_albums','wedding_api_uploads') order by tablename,policyname;
select r.rolname,has_schema_privilege(r.oid,'public','CREATE') as can_create_public
from pg_roles r where r.rolname in ('anon','authenticated');
-- Expected before: both new functions absent; prerequisites present; photo RLS true; public CREATE false.
-- Expected after: exactly two new invoker functions, pinned search_path; service_role EXECUTE only;
-- original function body/ACL, table RLS and policies unchanged. Stop on divergence; no automatic rollback.
