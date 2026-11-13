-- Prepared from wedding_policies.csv. Execution requires explicit owner approval.
-- No rows or existing policies are deleted; RLS stays enabled.
begin;
-- Only the server API can read business tables (including publication gates).
revoke all on public.wedding_albums,public.wedding_photos,public.wedding_settings,
 public.wedding_rsvps,public.wedding_messages,public.wedding_staff from public,anon,authenticated;
-- Column-level grants must not bypass table-level revocations.
do $$
declare t text;cols text;
begin
 foreach t in array array['wedding_albums','wedding_photos','wedding_settings','wedding_rsvps','wedding_messages','wedding_staff'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t;
  execute format('revoke all (%s) on public.%I from public,anon,authenticated',cols,t);
 end loop;
end $$;
grant select,insert,update on public.wedding_albums,public.wedding_photos,public.wedding_rsvps,public.wedding_messages to service_role;
grant select,update on public.wedding_settings to service_role;
grant select on public.wedding_staff to service_role;
grant select(user_id,role) on public.wedding_staff to authenticated;
-- Preserve the exported own-role policy, and refuse unexpected policy drift.
do $$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='wedding_staff'
 and policyname='Staff can read own role' and cmd='SELECT'
 and roles::text[]=array['authenticated']
 and regexp_replace(qual,'\s','','g')='(user_id=(SELECTauth.uid()ASuid))') then raise exception 'Own-role policy missing or changed. Stop and re-audit.';end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='wedding_staff'
 and policyname<>'Staff can read own role') then raise exception 'Unexpected staff policy. Stop and re-audit.';end if;
end $$;
commit;
