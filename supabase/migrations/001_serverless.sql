-- Prepared from the three owner-supplied CSV exports and read-only OpenAPI metadata.
-- Local migration only: execution on hosted Supabase still requires explicit approval.
-- No base table, album, Auth account or business record is recreated.
begin;
do $preflight$
declare item record; actual text;
begin
  for item in select * from (values
    ('wedding_albums','id','uuid'),('wedding_albums','title','varchar'),('wedding_albums','published','bool'),('wedding_albums','hidden','bool'),('wedding_albums','created_at','timestamptz'),
    ('wedding_photos','id','uuid'),('wedding_photos','album_id','uuid'),('wedding_photos','storage_path','text'),('wedding_photos','caption','varchar'),('wedding_photos','hidden','bool'),('wedding_photos','created_at','timestamptz'),
    ('wedding_settings','id','int4'),('wedding_settings','gallery_published','bool'),('wedding_settings','release_at','timestamptz'),
    ('wedding_staff','user_id','uuid'),('wedding_staff','role','text'),
    ('wedding_rsvps','ref_hash','varchar'),('wedding_rsvps','updated_at','timestamptz'),('wedding_rsvps','id','uuid'),('wedding_rsvps','first_name','varchar'),('wedding_rsvps','last_name','varchar'),('wedding_rsvps','participants','int4'),('wedding_rsvps','song','varchar'),('wedding_rsvps','created_at','timestamptz'),
    ('wedding_messages','response_id','uuid'),('wedding_messages','ref_hash','varchar'),('wedding_messages','id','uuid'),('wedding_messages','author','varchar'),('wedding_messages','body','varchar'),('wedding_messages','hidden','bool'),('wedding_messages','created_at','timestamptz')
  ) as expected(tab,col,typ) loop
    select udt_name into actual from information_schema.columns where table_schema='public' and table_name=item.tab and column_name=item.col;
    if actual is distinct from item.typ then raise exception 'Schema mismatch: %.% (expected %, found %). No changes applied.',item.tab,item.col,item.typ,actual;end if;
  end loop;
  if not exists(select 1 from public.wedding_settings where id=1 and release_at is not null) then
    raise exception 'Missing settings singleton/release date. Preserve and review real settings before proceeding.';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in
    ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages') and not c.relrowsecurity) then
    raise exception 'RLS must remain enabled.';
  end if;
end $preflight$;


-- Revalidate constraints and server trust boundaries; exported CSVs may be stale.
do $dependencies$
declare expected record;r text;
begin
 for expected in select * from (values
 ('wedding_albums','wedding_albums_pkey','PRIMARY KEY (id)'),
 ('wedding_photos','wedding_photos_album_id_fkey','FOREIGN KEY (album_id) REFERENCES wedding_albums(id) ON DELETE CASCADE'),
 ('wedding_photos','wedding_photos_pkey','PRIMARY KEY (id)'),
 ('wedding_photos','wedding_photos_storage_path_key','UNIQUE (storage_path)'),
 ('wedding_settings','wedding_settings_id_check','CHECK ((id = 1))'),
 ('wedding_settings','wedding_settings_pkey','PRIMARY KEY (id)'),
 ('wedding_staff','wedding_staff_pkey','PRIMARY KEY (user_id)'),
 ('wedding_staff','wedding_staff_role_check','CHECK ((role = ANY (ARRAY[''photographer''::text, ''admin''::text])))'),
 ('wedding_staff','wedding_staff_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
 ('wedding_rsvps','wedding_rsvps_first_name_check','CHECK ((length(TRIM(BOTH FROM first_name)) > 0))'),
 ('wedding_rsvps','wedding_rsvps_last_name_check','CHECK ((length(TRIM(BOTH FROM last_name)) > 0))'),
 ('wedding_rsvps','wedding_rsvps_participants_check','CHECK (((participants >= 1) AND (participants <= 20)))'),
 ('wedding_rsvps','wedding_rsvps_pkey','PRIMARY KEY (id)'),
 ('wedding_rsvps','wedding_rsvps_ref_hash_key','UNIQUE (ref_hash)'),
 ('wedding_messages','wedding_messages_author_check','CHECK ((length(TRIM(BOTH FROM author)) > 0))'),
 ('wedding_messages','wedding_messages_body_check','CHECK ((length(TRIM(BOTH FROM body)) > 0))'),
 ('wedding_messages','wedding_messages_pkey','PRIMARY KEY (id)'),
 ('wedding_messages','wedding_messages_ref_hash_key','UNIQUE (ref_hash)'),
 ('wedding_messages','wedding_messages_response_id_fkey','FOREIGN KEY (response_id) REFERENCES wedding_rsvps(id) ON DELETE SET NULL'),
 ('wedding_messages','wedding_messages_response_id_key','UNIQUE (response_id)')
 ) as required(tab,name,definition) loop
 if not exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||expected.tab) and c.conname=expected.name and c.convalidated and pg_get_constraintdef(c.oid)=expected.definition) then
 raise exception 'Constraint changed or missing: %.%. Stop and re-audit.',expected.tab,expected.name;end if;
 end loop;
 for expected in select * from (values
 ('wedding_albums','title',120),('wedding_photos','caption',200),('wedding_rsvps','ref_hash',64),('wedding_rsvps','first_name',80),('wedding_rsvps','last_name',80),('wedding_rsvps','song',200),('wedding_messages','ref_hash',64),('wedding_messages','author',80),('wedding_messages','body',2000)
 ) as limits(tab,col,n) loop
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=expected.tab and column_name=expected.col and (character_maximum_length is null or character_maximum_length>=expected.n)) then raise exception 'Column length incompatible with API';end if;
 end loop;
 if not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls) then raise exception 'Expected privileged server role unavailable';end if;
 foreach r in array array['anon','authenticated'] loop
 if not exists(select 1 from pg_roles where rolname=r and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb) or has_schema_privilege(r,'public','CREATE') then raise exception 'Untrusted browser role or public schema CREATE privilege';end if;
 if exists(select 1 from pg_roles privileged where (privileged.rolsuper or privileged.rolbypassrls or privileged.oid in(select c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages'))) and pg_has_role((select oid from pg_roles where rolname=r),privileged.oid,'MEMBER')) then raise exception 'Browser membership in a privileged/owner role detected';end if;
 end loop;
end $dependencies$;

-- Supplemental durable coordination only. No base table/albums recreated or seeded.
create table if not exists public.wedding_api_limits(
  key text primary key,window_start timestamptz not null,hits integer not null
);
create table if not exists public.wedding_api_uploads(
  id uuid primary key,staff_id uuid not null,client_ref uuid not null,album_id uuid not null references public.wedding_albums(id) on delete restrict,
  filename text not null,content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
  size bigint not null check(size between 1 and 20971520),
  storage_path text not null unique,
  status text not null default 'pending' check(status in ('pending','validating','complete','cancelled','cleaning','cleaned')),
  photo_id uuid,nonce uuid,lease_until timestamptz,
  created_at timestamptz not null default now(),expires_at timestamptz not null,
  cleanup_after timestamptz not null,unique(staff_id,client_ref)
);
alter table public.wedding_api_limits enable row level security;
alter table public.wedding_api_uploads enable row level security;
revoke all on public.wedding_api_limits,public.wedding_api_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.wedding_api_limits,public.wedding_api_uploads to service_role;
create index if not exists wedding_api_upload_cleanup on public.wedding_api_uploads(cleanup_after) where status not in ('complete','cleaned');
create index if not exists wedding_api_photo_album_order on public.wedding_photos(album_id,created_at,id);
create index if not exists wedding_api_message_order on public.wedding_messages(created_at desc,id desc);

create or replace function public.wedding_api_assert_staff(p_staff uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin
 if not exists(select 1 from public.wedding_staff where user_id=p_staff and role in ('admin','photographer')) then
   raise exception using errcode='AJ404',message='Staff unavailable';
 end if;
end $$;

create or replace function public.wedding_api_rate(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare n integer;
begin
 if p_limit not between 1 and 1000 or p_seconds not between 1 and 86400 or p_key !~ '^[a-f0-9]{64}$' then raise exception using errcode='AJ400';end if;
 insert into public.wedding_api_limits as t(key,window_start,hits) values(p_key,clock_timestamp(),1)
 on conflict(key) do update set
 hits=case when t.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else t.hits+1 end,
 window_start=case when t.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else t.window_start end
 returning hits into n;
 if n>p_limit then raise exception using errcode='AJ429',message='Rate limited';end if;
 -- Old anonymous buckets contain hashes only; bounded indexed cleanup during use.
 delete from public.wedding_api_limits where key in(select key from public.wedding_api_limits where window_start<now()-interval '2 days' limit 100);
 return true;
end $$;

create or replace function public.wedding_api_rsvp(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare r public.wedding_rsvps; m public.wedding_messages;
 first_n text:=p_input->>'first_name';last_n text:=p_input->>'last_name';n integer:=(p_input->>'participants')::integer;
begin
 if first_n is null or last_n is null or n is null or p_input->>'ref_hash' is null
 or length(first_n) not between 1 and 80 or length(last_n) not between 1 and 80 or n not between 1 and 20
 or length(coalesce(p_input->>'song',''))>200 or length(coalesce(p_input->>'message',''))>2000
 or p_input->>'ref_hash' !~ '^[a-f0-9]{64}$' then raise exception using errcode='AJ400';end if;
 perform pg_advisory_xact_lock(hashtextextended('rsvp:'||(p_input->>'ref_hash'),0));
 -- The existing UNIQUE(ref_hash) preserves all previous RSVP UUIDs and QR references.
 insert into public.wedding_rsvps(id,ref_hash,first_name,last_name,participants,song,created_at,updated_at)
 values(gen_random_uuid(),p_input->>'ref_hash',first_n,last_n,n,coalesce(p_input->>'song',''),now(),now())
 on conflict(ref_hash) do update set first_name=excluded.first_name,last_name=excluded.last_name,
 participants=excluded.participants,song=excluded.song,updated_at=now()
 returning * into r;
 if coalesce(p_input->>'message','')<>'' then
   insert into public.wedding_messages(id,response_id,author,body,hidden,created_at)
   values(gen_random_uuid(),r.id,first_n,p_input->>'message',false,now())
   on conflict(response_id) do update set author=excluded.author,body=excluded.body returning * into m;
   -- A repeat confirmation must not undo hidden=true from moderation.
 end if;
 return jsonb_build_object('ticket',jsonb_build_object(
  'id',r.id,'guest_id',r.id,'rsvp_id',r.id,'ticket_number','AJ-'||upper(left(r.id::text,8)),'qr_token',r.id,
  'bride_first_name','Alicia','groom_first_name','Jeff','wedding_date','2026-12-18T15:00:00Z',
  'venue_name','Dakar · Ambassade du Cameroun & Fun Time',
  'guest_full_name',first_n||' '||last_n,'guest_first_name',first_n,'guest_last_name',last_n,
  'allowed_persons',n,'pdf_url',null,'png_url',null,'created_at',r.created_at),
  'message_published',coalesce(not m.hidden,false));
end $$;

create or replace function public.wedding_api_message(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare m public.wedding_messages;
begin
 if p_input->>'author' is null or p_input->>'body' is null or p_input->>'ref_hash' is null
 or length(p_input->>'author') not between 1 and 80 or length(p_input->>'body') not between 1 and 2000
 or p_input->>'ref_hash' !~ '^[a-f0-9]{64}$' then raise exception using errcode='AJ400';end if;
 insert into public.wedding_messages(id,ref_hash,author,body,hidden,created_at)
 values(gen_random_uuid(),p_input->>'ref_hash',p_input->>'author',p_input->>'body',false,now())
 on conflict(ref_hash) do update set author=excluded.author,body=excluded.body returning * into m;
 return jsonb_build_object('id',m.id,'author',m.author,'body',m.body,'created_at',m.created_at);
end $$;

create or replace function public.wedding_api_messages(p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m)) from
 (select id,author,body,created_at from public.wedding_messages where not hidden order by created_at desc,id desc limit 50 offset greatest(p_offset,0)) m),'[]'::jsonb),
 'has_more',(select count(*)>greatest(p_offset,0)+50 from public.wedding_messages where not hidden))
$$;

create or replace function public.wedding_api_gallery_open()
returns boolean language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select coalesce((select gallery_published and release_at is not null and now()>=release_at from public.wedding_settings where id=1),false)
$$;
create or replace function public.wedding_api_public_state()
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object(
 'messages',public.wedding_api_messages(0)->'messages',
 'message_count',(select count(*) from public.wedding_messages where not hidden),
 'gallery_available',public.wedding_api_gallery_open(),
 'release_at',(select release_at from public.wedding_settings where id=1),
 'albums',case when public.wedding_api_gallery_open() then coalesce((select jsonb_agg(to_jsonb(a)) from (
 select a.id,a.title,
 (select count(*) from public.wedding_photos p where p.album_id=a.id and not p.hidden) as count,
 (select jsonb_build_object('id',p.id,'storage_path',p.storage_path) from public.wedding_photos p where p.album_id=a.id and not p.hidden order by p.created_at,p.id limit 1) as cover_photo
 from public.wedding_albums a where a.published and not a.hidden order by a.created_at,a.id
 ) a),'[]'::jsonb) else '[]'::jsonb end)
$$;
create or replace function public.wedding_api_public_photos(p_album uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,pg_temp as $$
begin
 if not public.wedding_api_gallery_open() or not exists(select 1 from public.wedding_albums where id=p_album and published and not hidden) then raise exception using errcode='AJ404';end if;
 return jsonb_build_object('photos',coalesce((select jsonb_agg(to_jsonb(p)) from (
 select id,caption,storage_path from public.wedding_photos where album_id=p_album and not hidden order by created_at,id limit 60 offset greatest(p_offset,0)) p),'[]'::jsonb),
 'has_more',(select count(*)>greatest(p_offset,0)+60 from public.wedding_photos where album_id=p_album and not hidden));
end $$;
create or replace function public.wedding_api_public_photo(p_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('id',p.id,'caption',p.caption,'storage_path',p.storage_path) from public.wedding_photos p
 join public.wedding_albums a on a.id=p.album_id
 where p.id=p_id and not p.hidden and a.published and not a.hidden and public.wedding_api_gallery_open()
$$;

create or replace function public.wedding_api_admin_photos(p_album uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,pg_temp as $$
begin
 if not exists(select 1 from public.wedding_albums where id=p_album) then raise exception using errcode='AJ404';end if;
 return jsonb_build_object('photos',coalesce((select jsonb_agg(to_jsonb(p)) from (
 select id,caption,hidden,storage_path from public.wedding_photos where album_id=p_album order by created_at,id limit 60 offset greatest(p_offset,0)) p),'[]'::jsonb),
 'has_more',(select count(*)>greatest(p_offset,0)+60 from public.wedding_photos where album_id=p_album));
end $$;
create or replace function public.wedding_api_admin_messages(p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m)) from
 (select id,author,body,hidden,created_at from public.wedding_messages order by created_at desc,id desc limit 50 offset greatest(p_offset,0)) m),'[]'::jsonb),
 'has_more',(select count(*)>greatest(p_offset,0)+50 from public.wedding_messages))
$$;
create or replace function public.wedding_api_admin_state()
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object(
 'albums',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'hidden',a.hidden,'published',a.published)
 ||public.wedding_api_admin_photos(a.id,0)) from public.wedding_albums a),'[]'::jsonb),
 'settings',jsonb_build_object('galleryPublished',coalesce((select gallery_published from public.wedding_settings where id=1),false)),
 'messages',public.wedding_api_admin_messages(0)->'messages','messages_has_more',public.wedding_api_admin_messages(0)->'has_more',
 'response_count',(select count(*) from public.wedding_rsvps))
$$;

create or replace function public.wedding_api_mutate(p_kind text,p_id uuid,p_patch jsonb,p_staff uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
 perform public.wedding_api_assert_staff(p_staff);
 if p_kind='album-create' then
   insert into public.wedding_albums(id,title,published,hidden,created_at) values(gen_random_uuid(),p_patch->>'title',false,false,now()) returning jsonb_build_object('id',id,'title',title) into result;
 elsif p_kind='album' then
   update public.wedding_albums set title=coalesce(p_patch->>'title',title),published=coalesce((p_patch->>'published')::boolean,published),hidden=coalesce((p_patch->>'hidden')::boolean,hidden) where id=p_id returning jsonb_build_object('id',id) into result;
 elsif p_kind='photo' then
   update public.wedding_photos set hidden=(p_patch->>'hidden')::boolean where id=p_id returning jsonb_build_object('id',id) into result;
 elsif p_kind='message' then
   update public.wedding_messages set hidden=(p_patch->>'hidden')::boolean where id=p_id returning jsonb_build_object('id',id) into result;
 elsif p_kind='settings' then
   update public.wedding_settings set gallery_published=(p_patch->>'gallery_published')::boolean where id=1 returning jsonb_build_object('ok',true) into result;
 else raise exception using errcode='AJ400';
 end if;
 if result is null then raise exception using errcode='AJ404';end if;
 return result;
end $$;

create or replace function public.wedding_api_upload_reserve(p_input jsonb,p_staff uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare u public.wedding_api_uploads; album uuid:=(p_input->>'album_id')::uuid; uid uuid:=gen_random_uuid();ext text;
begin
 perform public.wedding_api_assert_staff(p_staff);
 perform pg_advisory_xact_lock(hashtextextended('upload:'||p_staff::text,0));
 if not exists(select 1 from public.wedding_albums where id=album and not hidden) then raise exception using errcode='AJ404';end if;
 select * into u from public.wedding_api_uploads where staff_id=p_staff and client_ref=(p_input->>'client_ref')::uuid for update;
 if found then
   if u.album_id<>album or u.filename<>p_input->>'filename' or u.content_type<>p_input->>'content_type' or u.size<>(p_input->>'size')::bigint then raise exception using errcode='AJ409';end if;
   if u.status='complete' then return to_jsonb(u);end if;
   if u.status not in ('pending','validating') or u.expires_at<now() then raise exception using errcode='AJ410';end if;
   -- Supabase signed upload URLs live two hours; defer removal beyond every re-sign.
   update public.wedding_api_uploads set cleanup_after=greatest(cleanup_after,now()+interval '130 minutes') where id=u.id returning * into u;
   return to_jsonb(u);
 end if;
 if (select count(*) from public.wedding_api_uploads where staff_id=p_staff and status in ('pending','validating') and expires_at>now())>=5 then raise exception using errcode='AJ429';end if;
 ext=case p_input->>'content_type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else null end;
 if ext is null or (p_input->>'size')::bigint not between 1 and 20971520 then raise exception using errcode='AJ400';end if;
 insert into public.wedding_api_uploads(id,staff_id,client_ref,album_id,filename,content_type,size,storage_path,expires_at,cleanup_after)
 values(uid,p_staff,(p_input->>'client_ref')::uuid,album,p_input->>'filename',p_input->>'content_type',(p_input->>'size')::bigint,
 'albums/'||album::text||'/'||uid::text||'.'||ext,now()+interval '30 minutes',now()+interval '130 minutes') returning * into u;
 return to_jsonb(u);
end $$;
create or replace function public.wedding_api_upload_claim(p_id uuid,p_staff uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare u public.wedding_api_uploads;
begin
 perform public.wedding_api_assert_staff(p_staff);
 select * into u from public.wedding_api_uploads where id=p_id and staff_id=p_staff for update;
 if not found then raise exception using errcode='AJ404';end if;
 if u.status='complete' then return to_jsonb(u);end if;
 if u.expires_at<now() or u.status not in ('pending','validating') then raise exception using errcode='AJ410';end if;
 if not exists(select 1 from public.wedding_albums where id=u.album_id and not hidden) then raise exception using errcode='AJ404';end if;
 if u.status='validating' and u.lease_until>now() then raise exception using errcode='AJ409';end if;
 update public.wedding_api_uploads set status='validating',nonce=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=p_id returning * into u;
 return to_jsonb(u);
end $$;
create or replace function public.wedding_api_upload_release(p_id uuid,p_nonce uuid,p_staff uuid)
returns boolean language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin
 perform public.wedding_api_assert_staff(p_staff);
 update public.wedding_api_uploads set status='pending',nonce=null,lease_until=null where id=p_id and staff_id=p_staff and status='validating' and nonce=p_nonce;
 return true;
end $$;
create or replace function public.wedding_api_upload_complete(p_id uuid,p_nonce uuid,p_staff uuid)
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
 values(u.id,u.album_id,u.storage_path,u.filename,false,now());
 update public.wedding_api_uploads set status='complete',photo_id=u.id,nonce=null,lease_until=null where id=p_id;
 return jsonb_build_object('ok',true,'photo_id',u.id);
end $$;
create or replace function public.wedding_api_upload_cancel(p_id uuid,p_staff uuid)
returns boolean language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin
 perform public.wedding_api_assert_staff(p_staff);
 update public.wedding_api_uploads set status='cancelled',nonce=null,lease_until=null where id=p_id and staff_id=p_staff and status in ('pending','validating');
 if not found and not exists(select 1 from public.wedding_api_uploads where id=p_id and staff_id=p_staff) then raise exception using errcode='AJ404';end if;
 return true;
end $$;
create or replace function public.wedding_api_cleanup_claim()
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
 -- Leased cleanup is retryable. No valid signed upload token remains at this time.
 with candidates as(
 select id from public.wedding_api_uploads u where u.status not in ('complete','cleaned')
 and u.cleanup_after<now() and (u.lease_until is null or u.lease_until<now())
 and not exists(select 1 from public.wedding_photos p where p.storage_path=u.storage_path)
 order by cleanup_after limit 50 for update skip locked
 ), claimed as(
 update public.wedding_api_uploads u set status='cleaning',lease_until=now()+interval '90 seconds' from candidates c where c.id=u.id returning u.id,u.storage_path)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 return result;
end $$;
create or replace function public.wedding_api_cleanup_done(p_ids uuid[])
returns boolean language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin
 update public.wedding_api_uploads set status='cleaned',lease_until=null where id=any(p_ids) and status='cleaning';
 return true;
end $$;

-- All RPCs are callable ONLY by the privileged server, never by a browser JWT.
-- SECURITY INVOKER plus service_role privileges: no SECURITY DEFINER escalation.
do $permissions$
declare f record;g record;fn oid;
begin
 for f in select signature from (values
 ('public.wedding_api_assert_staff(uuid)'),
 ('public.wedding_api_rate(text,integer,integer)'),
 ('public.wedding_api_rsvp(jsonb)'),
 ('public.wedding_api_message(jsonb)'),
 ('public.wedding_api_messages(integer)'),
 ('public.wedding_api_gallery_open()'),
 ('public.wedding_api_public_state()'),
 ('public.wedding_api_public_photos(uuid,integer)'),
 ('public.wedding_api_public_photo(uuid)'),
 ('public.wedding_api_admin_photos(uuid,integer)'),
 ('public.wedding_api_admin_messages(integer)'),
 ('public.wedding_api_admin_state()'),
 ('public.wedding_api_mutate(text,uuid,jsonb,uuid)'),
 ('public.wedding_api_upload_reserve(jsonb,uuid)'),
 ('public.wedding_api_upload_claim(uuid,uuid)'),
 ('public.wedding_api_upload_release(uuid,uuid,uuid)'),
 ('public.wedding_api_upload_complete(uuid,uuid,uuid)'),
 ('public.wedding_api_upload_cancel(uuid,uuid)'),
 ('public.wedding_api_cleanup_claim()'),
 ('public.wedding_api_cleanup_done(uuid[])')
 ) as expected(signature) loop
 fn:=to_regprocedure(f.signature);
 if fn is null then raise exception 'Expected API function missing: %',f.signature;end if;
 -- Remove default ACL grants too. Unrelated functions/overloads are not changed.
 for g in select distinct x.grantee from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
 where p.oid=fn and x.grantee<>p.proowner loop
 execute format('revoke all on function %s from %s',fn::regprocedure,case when g.grantee=0 then 'public' else quote_ident(pg_get_userbyid(g.grantee)) end);
 end loop;
 execute format('grant execute on function %s to service_role',fn::regprocedure);
 if exists(select 1 from pg_proc where oid=fn and (prosecdef or proconfig is distinct from array['search_path=pg_catalog, pg_temp'])) then
 raise exception 'Unexpected API security configuration: %',f.signature;end if;
 if has_function_privilege('anon',fn,'execute') or has_function_privilege('authenticated',fn,'execute') then
 raise exception 'Inherited API execute privilege detected. Stop and audit role memberships.';end if;
 end loop;
end $permissions$;
notify pgrst,'reload schema';
commit;
