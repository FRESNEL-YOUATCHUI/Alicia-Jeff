-- TEST FIXTURE reconstructed from owner-provided CSV structure and readonly OpenAPI lengths.
-- Auth users below are synthetic. Initial grants below model permissive defaults, not an exported grant list.
-- SHA256 wedding_columns.csv c69d61119001a01e0595fc00998c0b91719736b14848cc02fc4141208bef6773
-- SHA256 wedding_constraints.csv 9530bee423286eabf1f4e905d3a9075347ddae684cbd18576148da1d8262a13f
-- SHA256 wedding_policies.csv dc8b2e058213f09097ff925d573dad8940b78a68ac4ddc73b815a2b18ca2d660
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.wedding_albums(id uuid not null default gen_random_uuid(),title varchar(120) not null,description text,published bool not null default false,hidden bool not null default false,created_at timestamptz not null default now());
alter table public.wedding_albums add constraint wedding_albums_pkey PRIMARY KEY (id);
alter table public.wedding_albums enable row level security;
create table public.wedding_settings(id int4 not null default 1,gallery_published bool not null default false,release_at timestamptz not null default '2026-12-18 15:00:00+00'::timestamp with time zone);
alter table public.wedding_settings add constraint wedding_settings_id_check CHECK ((id = 1));
alter table public.wedding_settings add constraint wedding_settings_pkey PRIMARY KEY (id);
alter table public.wedding_settings enable row level security;
create table public.wedding_staff(user_id uuid not null,role text not null,created_at timestamptz not null default now());
alter table public.wedding_staff add constraint wedding_staff_pkey PRIMARY KEY (user_id);
alter table public.wedding_staff add constraint wedding_staff_role_check CHECK ((role = ANY (ARRAY['photographer'::text, 'admin'::text])));
alter table public.wedding_staff add constraint wedding_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wedding_staff enable row level security;
create table public.wedding_rsvps(id uuid not null default gen_random_uuid(),ref_hash varchar(64) not null,first_name varchar(80) not null,last_name varchar(80) not null,participants int4 not null,song varchar(200) not null default ''::character varying,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.wedding_rsvps add constraint wedding_rsvps_first_name_check CHECK ((length(TRIM(BOTH FROM first_name)) > 0));
alter table public.wedding_rsvps add constraint wedding_rsvps_last_name_check CHECK ((length(TRIM(BOTH FROM last_name)) > 0));
alter table public.wedding_rsvps add constraint wedding_rsvps_participants_check CHECK (((participants >= 1) AND (participants <= 20)));
alter table public.wedding_rsvps add constraint wedding_rsvps_pkey PRIMARY KEY (id);
alter table public.wedding_rsvps add constraint wedding_rsvps_ref_hash_key UNIQUE (ref_hash);
alter table public.wedding_rsvps enable row level security;
create table public.wedding_photos(id uuid not null default gen_random_uuid(),album_id uuid not null,storage_path text not null,caption varchar(200),hidden bool not null default false,created_at timestamptz not null default now());
alter table public.wedding_photos add constraint wedding_photos_album_id_fkey FOREIGN KEY (album_id) REFERENCES wedding_albums(id) ON DELETE CASCADE;
alter table public.wedding_photos add constraint wedding_photos_pkey PRIMARY KEY (id);
alter table public.wedding_photos add constraint wedding_photos_storage_path_key UNIQUE (storage_path);
alter table public.wedding_photos enable row level security;
create table public.wedding_messages(id uuid not null default gen_random_uuid(),response_id uuid,ref_hash varchar(64),author varchar(80) not null,body varchar(2000) not null,hidden bool not null default false,created_at timestamptz not null default now());
alter table public.wedding_messages add constraint wedding_messages_author_check CHECK ((length(TRIM(BOTH FROM author)) > 0));
alter table public.wedding_messages add constraint wedding_messages_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0));
alter table public.wedding_messages add constraint wedding_messages_pkey PRIMARY KEY (id);
alter table public.wedding_messages add constraint wedding_messages_ref_hash_key UNIQUE (ref_hash);
alter table public.wedding_messages add constraint wedding_messages_response_id_fkey FOREIGN KEY (response_id) REFERENCES wedding_rsvps(id) ON DELETE SET NULL;
alter table public.wedding_messages add constraint wedding_messages_response_id_key UNIQUE (response_id);
alter table public.wedding_messages enable row level security;
create policy "Read published albums" on public.wedding_albums for SELECT to anon,authenticated using (((published = true) AND (hidden = false)));
create policy "Read published photos" on public.wedding_photos for SELECT to anon,authenticated using (((hidden = false) AND (EXISTS ( SELECT 1
   FROM wedding_albums a
  WHERE ((a.id = wedding_photos.album_id) AND (a.published = true) AND (a.hidden = false))))));
create policy "Staff can read own role" on public.wedding_staff for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
grant usage on schema public,auth to service_role,anon,authenticated;grant all on all tables in schema public to service_role;grant select on all tables in schema public to anon,authenticated;
insert into auth.users values('20000000-0000-4000-8000-000000000001');
insert into public.wedding_albums(id,title) values('10000000-0000-4000-8000-000000000001','Cérémonie civile'),('10000000-0000-4000-8000-000000000002','Vin d’honneur'),('10000000-0000-4000-8000-000000000003','Soirée de mariage');
insert into public.wedding_settings(id) values(1);
insert into public.wedding_staff(user_id,role) values('20000000-0000-4000-8000-000000000001','photographer');
