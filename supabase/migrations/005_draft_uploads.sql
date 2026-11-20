-- PREPARED LOCALLY ONLY. Explicit owner approval required before hosted execution.
-- Adds two service-only functions; does not modify any existing function, data, table, RLS, Auth or Storage permission.
begin;
do $preflight$ begin
 if to_regprocedure('public.wedding_api_upload_complete(uuid,uuid,uuid)') is null
 or to_regprocedure('public.wedding_api_assert_staff(uuid)') is null
 or has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE')
 then raise exception 'Draft upload prerequisites unavailable';end if;
 if not (select relrowsecurity from pg_class where oid='public.wedding_photos'::regclass)
 then raise exception 'Photo RLS must remain enabled';end if;
end $preflight$;
create or replace function public.wedding_api_upload_complete_draft(p_id uuid,p_nonce uuid,p_staff uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare u public.wedding_api_uploads;
begin
 perform public.wedding_api_assert_staff(p_staff);
 select * into u from public.wedding_api_uploads where id=p_id and staff_id=p_staff for update;
 if not found then raise exception using errcode='AJ404';end if;
 if u.status='complete' then return jsonb_build_object('ok',true,'photo_id',u.photo_id);end if;
 if u.expires_at<now() then raise exception using errcode='AJ410';end if;
 if u.status<>'validating' or u.nonce is distinct from p_nonce or u.lease_until<now() then raise exception using errcode='AJ409';end if;
 perform 1 from public.wedding_albums where id=u.album_id and not hidden for update;
 if not found then raise exception using errcode='AJ404';end if;
 -- Photo UUID equals the durable intent UUID. Repeated finalization cannot create duplicates.
 insert into public.wedding_photos(id,album_id,storage_path,caption,hidden,created_at)
 values(u.id,u.album_id,u.storage_path,u.filename,true,now());
 update public.wedding_api_uploads set status='complete',photo_id=u.id,nonce=null,lease_until=null where id=p_id;
 return jsonb_build_object('ok',true,'photo_id',u.id);
end $$;

create or replace function public.wedding_api_upload_draft_ready()
returns boolean language sql security invoker set search_path=pg_catalog,pg_temp as $$ select true $$;
revoke all on function public.wedding_api_upload_complete_draft(uuid,uuid,uuid),public.wedding_api_upload_draft_ready() from public,anon,authenticated;
grant execute on function public.wedding_api_upload_complete_draft(uuid,uuid,uuid),public.wedding_api_upload_draft_ready() to service_role;
do $verify$ declare r text; f text; begin
 foreach r in array array['anon','authenticated'] loop
 foreach f in array array['public.wedding_api_upload_complete_draft(uuid,uuid,uuid)','public.wedding_api_upload_draft_ready()'] loop
 if has_function_privilege(r,f,'EXECUTE') then raise exception 'Unexpected inherited draft function privilege';end if;
 end loop;end loop;
end $verify$;
commit;
