import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('atomic activation is repeatable on the exported schema and preserves the three album IDs',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(await fs.readFile(new URL('./schema-fixture.sql',import.meta.url),'utf8'));
  const before=(await pg.query('select id,title from wedding_albums order by id')).rows;
  const sql=await fs.readFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),'utf8');
  await pg.exec(sql);await pg.exec(sql);
  assert.deepEqual((await pg.query('select id,title from wedding_albums order by id')).rows,before);
  assert.equal((await pg.query('select count(*)::int n from wedding_rsvps')).rows[0].n,0);
  assert.equal((await pg.query("select has_function_privilege('anon','public.wedding_api_admin_state()','EXECUTE') ok")).rows[0].ok,false);
 }finally{await pg.close();}
});
test('a permission precheck failure rolls back the entire activation in a synthetic database',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(await fs.readFile(new URL('./schema-fixture.sql',import.meta.url),'utf8'));
  await pg.exec('drop policy "Staff can read own role" on wedding_staff');
  const sql=await fs.readFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),'utf8');
  await assert.rejects(()=>pg.exec(sql),/Own-role policy missing/);
  await pg.exec('rollback');
  assert.equal((await pg.query("select to_regclass('public.wedding_api_uploads') obj")).rows[0].obj,null);
  assert.equal((await pg.query("select to_regprocedure('public.wedding_api_admin_state()') obj")).rows[0].obj,null);
  assert.equal((await pg.query('select count(*)::int n from wedding_albums')).rows[0].n,3);
 }finally{await pg.close();}
});
