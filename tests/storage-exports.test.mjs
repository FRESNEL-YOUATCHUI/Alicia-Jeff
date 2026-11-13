import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {database} from './database.mjs';

test('exported Storage privileges and RLS are evaluated together in isolated PostgreSQL',async t=>{
 const {pg}=await database();
 try{
  await pg.exec(await fs.readFile(new URL('./storage-fixture.sql',import.meta.url),'utf8'));
  await t.test('six role/table SQL privilege entries match the snapshot',async()=>{
   for(const role of ['anon','authenticated','service_role'])for(const table of ['buckets','objects']){
    const {rows}=await pg.query("select has_table_privilege($1,$2,'SELECT') s,has_table_privilege($1,$2,'INSERT') i,has_table_privilege($1,$2,'UPDATE') u,has_table_privilege($1,$2,'DELETE') d",[role,'storage.'+table]);
    assert.deepEqual(rows[0],{s:true,i:true,u:true,d:true});
   }
   assert.equal((await pg.query("select count(*)::int n from pg_policies where schemaname='storage'")).rows[0].n,0);
  });
  await t.test('anon and authenticated cannot read, insert, update or delete target rows with no policy',async()=>{
   for(const role of ['anon','authenticated']){
    await pg.exec('set role '+role);
    try{
     assert.equal((await pg.query("select * from storage.objects where bucket_id='wedding-photos'")).rows.length,0);
     assert.equal((await pg.query("select * from storage.buckets where id='wedding-photos'")).rows.length,0);
     await assert.rejects(()=>pg.exec("insert into storage.objects values(gen_random_uuid(),'wedding-photos','unapproved.png')"),/row-level security/);
     await assert.rejects(()=>pg.exec("insert into storage.buckets(id,name,public) values('unapproved','unapproved',true)"),/row-level security/);
     assert.equal((await pg.query("update storage.objects set name='changed.png' where bucket_id='wedding-photos' returning id")).rows.length,0);
     assert.equal((await pg.query("delete from storage.objects where bucket_id='wedding-photos' returning id")).rows.length,0);
     assert.equal((await pg.query("update storage.buckets set public=true where id='wedding-photos' returning id")).rows.length,0);
     assert.equal((await pg.query("delete from storage.buckets where id='wedding-photos' returning id")).rows.length,0);
     assert.equal((await pg.query("select has_table_privilege(current_user,'storage.objects','TRUNCATE') ok")).rows[0].ok,false);
    }finally{await pg.exec('reset role');}
   }
   assert.equal((await pg.query('select count(*)::int n from storage.objects')).rows[0].n,2);
  });
  await t.test('standard privileged service_role remains usable by server operations',async()=>{
   await pg.exec('set role service_role');
   try{
    assert.equal((await pg.query("select count(*)::int n from storage.objects where bucket_id='wedding-photos'")).rows[0].n,1);
    assert.equal((await pg.query("select public from storage.buckets where id='wedding-photos'")).rows[0].public,false);
    await pg.exec("insert into storage.objects values('30000000-0000-4000-8000-000000000003','wedding-photos','server.png')");
    assert.equal((await pg.query("update storage.objects set name='verified.png' where id='30000000-0000-4000-8000-000000000003' returning id")).rows.length,1);
    await pg.exec("delete from storage.objects where id='30000000-0000-4000-8000-000000000003'");
   }finally{await pg.exec('reset role');}
  });
  await t.test('optional hardening is idempotent and grants no new ordinary access',async()=>{
   const sql=await fs.readFile(new URL('../supabase/migrations/003_private_storage_access.sql',import.meta.url),'utf8');
   await pg.exec(sql);await pg.exec(sql);
   for(const role of ['anon','authenticated']){
    await pg.exec('set role '+role);
    try{
     assert.equal((await pg.query('select * from storage.objects')).rows.length,0);
     await assert.rejects(()=>pg.exec("insert into storage.objects values(gen_random_uuid(),'wedding-photos','unapproved.png')"),/row-level security/);
    }finally{await pg.exec('reset role');}
   }
   const {rows}=await pg.query("select permissive from pg_policies where schemaname='storage'");
   assert.deepEqual(rows.map(r=>r.permissive),['RESTRICTIVE','RESTRICTIVE']);
  });
  await t.test('a public bucket drift aborts hardening without changing its visibility',async()=>{
   await pg.exec("update storage.buckets set public=true where id='wedding-photos'");
   const sql=await fs.readFile(new URL('../supabase/migrations/003_private_storage_access.sql',import.meta.url),'utf8');
   await assert.rejects(()=>pg.exec(sql),/must already exist and remain private/);
   await pg.exec('rollback');
   assert.equal((await pg.query("select public from storage.buckets where id='wedding-photos'")).rows[0].public,true);
   await pg.exec("update storage.buckets set public=false where id='wedding-photos'");
  });
 }finally{await pg.close();}
});
