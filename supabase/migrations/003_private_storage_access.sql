-- PROPOSAL ONLY. Explicit owner approval is required before hosted execution.
-- OPTIONAL defense in depth: the exported zero-policy configuration already defaults to deny.
-- Restrictive policies deny only the wedding bucket, without granting any new access.
begin;
do $bucket$
begin
 if to_regclass('storage.buckets') is null then raise exception 'Storage schema unavailable. Stop and audit.';end if;
 if not exists(select 1 from storage.buckets where id='wedding-photos' and public=false) then
  raise exception 'The wedding bucket must already exist and remain private. Stop and audit.';
 end if;
end $bucket$;
do $hardening$
declare t text;policy_name text;column_name text;expected text;existing record;
begin
 foreach t in array array['objects','buckets'] loop
  if to_regclass('storage.'||t) is null then raise exception 'Storage schema unavailable. Stop and audit.';end if;
  if not exists(select 1 from pg_class where oid=to_regclass('storage.'||t) and relrowsecurity) then
   raise exception 'Storage RLS must remain enabled on %.',t;
  end if;
  column_name=case when t='objects' then 'bucket_id' else 'id' end;
  policy_name=case when t='objects' then 'wedding_api_private_bucket_only' else 'wedding_api_private_bucket_metadata_only' end;
  expected='('||column_name||'<>''wedding-photos''::text)';
  select * into existing from pg_policies where schemaname='storage' and tablename=t and policyname=policy_name;
  if not found then
   execute format('create policy %I on storage.%I as restrictive for all to anon,authenticated using(%I<>''wedding-photos'') with check(%I<>''wedding-photos'')',policy_name,t,column_name,column_name);
  elsif existing.permissive<>'RESTRICTIVE' or existing.cmd<>'ALL'
    or existing.roles::text[]<>array['anon','authenticated']
    or regexp_replace(existing.qual,'\s','','g') is distinct from expected
    or regexp_replace(existing.with_check,'\s','','g') is distinct from expected then
   raise exception 'Unexpected existing storage protection on %. Stop and re-audit.',t;
  end if;
 end loop;
end $hardening$;
commit;
