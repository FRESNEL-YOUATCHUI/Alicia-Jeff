import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {database} from './database.mjs';
test('storage restrictive policy blocks a broad permissive policy without changing other buckets',async()=>{
 const {pg}=await database();
 try{
  await pg.exec("create schema storage;create table storage.buckets(id text primary key);alter table storage.buckets enable row level security;grant all on storage.buckets to anon,authenticated,service_role;create policy broad_bucket_access on storage.buckets for all to anon,authenticated using(true) with check(true);insert into storage.buckets values('wedding-photos'),('other-bucket');create table storage.objects(id uuid primary key,bucket_id text not null);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to anon,authenticated,service_role;create policy broad_access on storage.objects for all to anon,authenticated using(true) with check(true);insert into storage.objects values(gen_random_uuid(),'wedding-photos'),(gen_random_uuid(),'other-bucket');");
  const sql=await fs.readFile(new URL('../supabase/migrations/003_private_storage_access.sql',import.meta.url),'utf8');
  await pg.exec(sql);await pg.exec(sql);
  await pg.exec('set role authenticated');
  assert.deepEqual((await pg.query('select bucket_id from storage.objects')).rows,[{bucket_id:'other-bucket'}]);
  assert.deepEqual((await pg.query('select id from storage.buckets')).rows,[{id:'other-bucket'}]);
  assert.equal((await pg.query("update storage.buckets set id='renamed' where id='wedding-photos' returning id")).rows.length,0);
  await assert.rejects(()=>pg.query("insert into storage.objects values(gen_random_uuid(),'wedding-photos')"),/row-level security/);
  await pg.exec('reset role;set role service_role');
  assert.equal((await pg.query("select count(*)::int n from storage.objects where bucket_id='wedding-photos'")).rows[0].n,1);
  await pg.exec('reset role');
 }finally{await pg.close();}
});
