-- READ ONLY. Run before and after the separately approved 004 migration.
-- Export the single JSON value privately. Compare business fingerprints and original function definitions.
begin isolation level repeatable read read only;
set local time zone 'UTC';
select jsonb_build_object(
 'captured_at',now(),
 'business',jsonb_build_object(
 'wedding_albums',(select jsonb_build_object('rows',count(*),'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]'))) from public.wedding_albums t),
 'wedding_photos',(select jsonb_build_object('rows',count(*),'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]'))) from public.wedding_photos t),
 'wedding_settings',(select jsonb_build_object('rows',count(*),'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]'))) from public.wedding_settings t),
 'wedding_staff',(select jsonb_build_object('rows',count(*),'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.user_id)::text,'[]'))) from public.wedding_staff t),
 'wedding_rsvps',(select jsonb_build_object('rows',count(*),'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]'))) from public.wedding_rsvps t),
 'wedding_messages',(select jsonb_build_object('rows',count(*),'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]'))) from public.wedding_messages t)),
 'business_rls',(select jsonb_object_agg(c.relname,c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname),'[]'::jsonb) from pg_policies p
 where p.schemaname='public' and p.tablename in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages')),
 'original_functions_fingerprint',(select md5(string_agg(pg_get_functiondef(p.oid),E'\n' order by p.oid::regprocedure::text))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'wedding_api_%'
 and p.proname not in ('wedding_api_confirm','wedding_api_ticket_restore','wedding_api_ticket_lookup','wedding_api_ticket_enter')),
 'ticket_table',(select jsonb_build_object('rls',c.relrowsecurity,'owner',c.relowner::regrole::text,
 'anon_direct_select',has_table_privilege('anon',c.oid,'SELECT'),
 'authenticated_direct_select',has_table_privilege('authenticated',c.oid,'SELECT'),
 'anon_any_column_select',has_any_column_privilege('anon',c.oid,'SELECT'),
 'authenticated_any_column_select',has_any_column_privilege('authenticated',c.oid,'SELECT'),
 'policies',(select count(*) from pg_policy where polrelid=c.oid))
 from pg_class c where c.oid=to_regclass('public.wedding_ticket_entries')),
 'ticket_functions',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
 'security_definer',p.prosecdef,'configuration',p.proconfig,
 'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname),'[]'::jsonb)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('wedding_api_confirm','wedding_api_ticket_restore','wedding_api_ticket_lookup','wedding_api_ticket_enter'))
) as ticket_entry_audit;
commit;
