-- COMPLEMENT LOCAL NON EXECUTE. Requires explicit owner authorization before hosting.
-- No existing business row, function, policy, Auth or Storage object is changed.
do $preflight$
begin
 if to_regprocedure('public.wedding_api_rsvp(jsonb)') is null
 or to_regprocedure('public.wedding_api_rate(text,integer,integer)') is null
 or not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls)
 or exists(select 1 from pg_class where oid in ('public.wedding_rsvps'::regclass,'public.wedding_messages'::regclass) and not relrowsecurity)
 then raise exception 'Ticket prerequisites missing or RLS disabled';end if;
 if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE')
 then raise exception 'Untrusted public schema CREATE privilege';end if;
end $preflight$;

-- A raw 256-bit bearer token must remain retrievable for re-download.
-- This private table is inaccessible to browser roles, even through column grants.
create table if not exists public.wedding_ticket_entries(
 rsvp_id uuid primary key references public.wedding_rsvps(id) on delete restrict,
 token text not null unique check(token ~ '^[A-Za-z0-9_-]{43}$'),
 checked_in_at timestamptz,
 admitted_name_hash text unique check(admitted_name_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 check((checked_in_at is null)=(admitted_name_hash is null))
);
do $ticket_guard$
begin
 if exists(select 1 from pg_policy where polrelid='public.wedding_ticket_entries'::regclass)
 or (select relowner<>current_user::regrole from pg_class where oid='public.wedding_ticket_entries'::regclass)
 then raise exception 'Unexpected ticket table policies or owner; stop for review';end if;
end $ticket_guard$;
alter table public.wedding_ticket_entries enable row level security;
revoke all on public.wedding_ticket_entries from public,anon,authenticated;
do $columns$
declare c record;
begin
 for c in select attname from pg_attribute where attrelid='public.wedding_ticket_entries'::regclass and attnum>0 and not attisdropped loop
  execute format('revoke all (%I) on public.wedding_ticket_entries from public,anon,authenticated',c.attname);
 end loop;
end $columns$;
grant select,insert,update on public.wedding_ticket_entries to service_role;

create or replace function public.wedding_api_ticket_restore(p_ref_hash text,p_token text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare r public.wedding_rsvps; t public.wedding_ticket_entries;
begin
 if p_ref_hash is null or p_ref_hash !~ '^[a-f0-9]{64}$' or p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$'
 then raise exception using errcode='AJ400';end if;
 select * into r from public.wedding_rsvps where ref_hash=p_ref_hash for update;
 if not found then raise exception using errcode='AJ404';end if;
 insert into public.wedding_ticket_entries(rsvp_id,token) values(r.id,p_token)
 on conflict(rsvp_id) do nothing;
 select * into t from public.wedding_ticket_entries where rsvp_id=r.id;
 return jsonb_build_object('ticket',jsonb_build_object(
 'id',r.id,'guest_id',r.id,'rsvp_id',r.id,'ticket_number','AJ-'||upper(left(r.id::text,8)),
 'qr_token',t.token,'qr_version',2,
 'bride_first_name','Alicia','groom_first_name','Jeff','wedding_date','2026-12-18T15:00:00Z',
 'venue_name','Dakar · Ambassade du Cameroun & Fun Time',
 'guest_full_name',r.first_name||' '||r.last_name,'guest_first_name',r.first_name,'guest_last_name',r.last_name,
 'allowed_persons',1,'pdf_url',null,'png_url',null,'created_at',r.created_at));
end $$;

create or replace function public.wedding_api_confirm(p_input jsonb,p_token text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare result jsonb; existing public.wedding_rsvps;
begin
 if p_input->>'participants' is distinct from '1' then raise exception using errcode='AJ400';end if;
 -- Same lock order as the existing RSVP implementation, including concurrent retries.
 perform pg_advisory_xact_lock(hashtextextended('rsvp:'||(p_input->>'ref_hash'),0));
 select r.* into existing from public.wedding_rsvps r
 join public.wedding_ticket_entries t on t.rsvp_id=r.id
 where r.ref_hash=p_input->>'ref_hash' and t.checked_in_at is not null for update of r;
 if found and (existing.first_name is distinct from p_input->>'first_name'
 or existing.last_name is distinct from p_input->>'last_name')
 then raise exception using errcode='AJ409';end if;
 result:=public.wedding_api_rsvp(p_input);
 return public.wedding_api_ticket_restore(p_input->>'ref_hash',p_token)
 ||jsonb_build_object('message_published',result->'message_published');
end $$;

create or replace function public.wedding_api_ticket_lookup(p_token text)
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('rsvp_id',r.id,'first_name',r.first_name,'last_name',r.last_name,
 'updated_at',r.updated_at,'checked_in_at',t.checked_in_at)
 from public.wedding_ticket_entries t join public.wedding_rsvps r on r.id=t.rsvp_id
 where t.token=p_token
$$;

create or replace function public.wedding_api_ticket_enter(p_token text,p_expected_updated_at timestamptz,p_name_hash text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare r public.wedding_rsvps; t public.wedding_ticket_entries;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' or p_name_hash is null or p_name_hash !~ '^[a-f0-9]{64}$'
 or p_expected_updated_at is null then raise exception using errcode='AJ400';end if;
 -- Lock the RSVP first, preventing a concurrent identity change between lookup and entry.
 select rsvp.* into r from public.wedding_rsvps rsvp
 join public.wedding_ticket_entries e on e.rsvp_id=rsvp.id where e.token=p_token for update of rsvp;
 if not found then return jsonb_build_object('status','unknown');end if;
 select * into t from public.wedding_ticket_entries where rsvp_id=r.id for update;
 if t.checked_in_at is not null then return jsonb_build_object('status','used','checked_in_at',t.checked_in_at);end if;
 if r.updated_at is distinct from p_expected_updated_at then return jsonb_build_object('status','changed');end if;
 begin
  update public.wedding_ticket_entries set checked_in_at=clock_timestamp(),admitted_name_hash=p_name_hash
  where rsvp_id=r.id returning * into t;
 exception when unique_violation then
  -- One official name cannot enter again using a second RSVP from another browser.
  return jsonb_build_object('status','used','reason','name_already_entered');
 end;
 return jsonb_build_object('status','valid','checked_in_at',t.checked_in_at);
end $$;

do $permissions$
declare fn text;
begin
 for fn in select unnest(array[
 'public.wedding_api_ticket_restore(text,text)',
 'public.wedding_api_confirm(jsonb,text)',
 'public.wedding_api_ticket_lookup(text)',
 'public.wedding_api_ticket_enter(text,timestamp with time zone,text)'
 ]) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn::regprocedure);
  execute format('grant execute on function %s to service_role',fn::regprocedure);
 end loop;
end $permissions$;
do $verify$
declare role_name text; fn text;
begin
 foreach role_name in array array['anon','authenticated'] loop
  if has_table_privilege(role_name,'public.wedding_ticket_entries','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  or has_any_column_privilege(role_name,'public.wedding_ticket_entries','SELECT,INSERT,UPDATE,REFERENCES')
  then raise exception 'Inherited ticket privilege found for %',role_name;end if;
  foreach fn in array array['public.wedding_api_confirm(jsonb,text)','public.wedding_api_ticket_restore(text,text)',
   'public.wedding_api_ticket_lookup(text)','public.wedding_api_ticket_enter(text,timestamp with time zone,text)'] loop
   if has_function_privilege(role_name,fn,'EXECUTE') then raise exception 'Inherited ticket function privilege found';end if;
  end loop;
 end loop;
end $verify$;
