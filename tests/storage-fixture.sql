-- LOCAL TEST fixture: minimal Storage tables; not a complete Storage schema migration.
-- Grants and RLS flags reproduced from owner-supplied exports; zero policies exported.
-- Test assumptions: schema USAGE granted; synthetic owner; anon/authenticated nonowner NOBYPASSRLS; service_role BYPASSRLS.
-- SHA256 storage_bucket.csv 6f721273b5560dedf45a3fbfa801abf15fcdac2b583bde13485c9bdc1d7795de
-- SHA256 storage_rls.csv 6d5e7d20f4e0bc87cc91204332724e53e0541df0ea15b31a79daf393da0c040b
-- SHA256 storage_policies.csv c7f5e7d5d1b3fe042711face1e2e2f95335712dc05696d6ce149d44e30250a07
-- SHA256 storage_grants.csv 20afef40a96954ca8883c63c8899059da40d6e3c5e7fc29e0e891609436b7128
-- SHA256 storage_effective_privileges.csv 74c738106e1b340a4ac3fcf5c177110774da6a1a8520b72ebeaf01b578645a8a
create role storage_owner;
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key,bucket_id text not null references storage.buckets(id),name text not null);
insert into storage.buckets(id,name,public) values('wedding-photos','wedding-photos',false),('other-bucket','other-bucket',false);
insert into storage.objects values('30000000-0000-4000-8000-000000000001','wedding-photos','wedding.png'),('30000000-0000-4000-8000-000000000002','other-bucket','other.png');
grant usage on schema storage to anon,authenticated,service_role,storage_owner;
alter table storage.objects enable row level security;
alter table storage.objects owner to storage_owner;
alter table storage.buckets enable row level security;
alter table storage.buckets owner to storage_owner;
grant DELETE on storage.buckets to anon;
grant INSERT on storage.buckets to anon;
grant SELECT on storage.buckets to anon;
grant UPDATE on storage.buckets to anon;
grant DELETE on storage.buckets to authenticated;
grant INSERT on storage.buckets to authenticated;
grant SELECT on storage.buckets to authenticated;
grant UPDATE on storage.buckets to authenticated;
grant DELETE on storage.buckets to postgres with grant option;
grant INSERT on storage.buckets to postgres with grant option;
grant REFERENCES on storage.buckets to postgres with grant option;
grant SELECT on storage.buckets to postgres with grant option;
grant TRIGGER on storage.buckets to postgres with grant option;
grant TRUNCATE on storage.buckets to postgres with grant option;
grant UPDATE on storage.buckets to postgres with grant option;
grant DELETE on storage.buckets to service_role;
grant INSERT on storage.buckets to service_role;
grant REFERENCES on storage.buckets to service_role;
grant SELECT on storage.buckets to service_role;
grant TRIGGER on storage.buckets to service_role;
grant TRUNCATE on storage.buckets to service_role;
grant UPDATE on storage.buckets to service_role;
grant DELETE on storage.objects to anon;
grant INSERT on storage.objects to anon;
grant SELECT on storage.objects to anon;
grant UPDATE on storage.objects to anon;
grant DELETE on storage.objects to authenticated;
grant INSERT on storage.objects to authenticated;
grant SELECT on storage.objects to authenticated;
grant UPDATE on storage.objects to authenticated;
grant DELETE on storage.objects to postgres with grant option;
grant INSERT on storage.objects to postgres with grant option;
grant REFERENCES on storage.objects to postgres with grant option;
grant SELECT on storage.objects to postgres with grant option;
grant TRIGGER on storage.objects to postgres with grant option;
grant TRUNCATE on storage.objects to postgres with grant option;
grant UPDATE on storage.objects to postgres with grant option;
grant DELETE on storage.objects to service_role;
grant INSERT on storage.objects to service_role;
grant REFERENCES on storage.objects to service_role;
grant SELECT on storage.objects to service_role;
grant TRIGGER on storage.objects to service_role;
grant TRUNCATE on storage.objects to service_role;
grant UPDATE on storage.objects to service_role;
