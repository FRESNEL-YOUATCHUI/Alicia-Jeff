import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
test('SQL TRUNCATE grant bypasses row policies; proposed revocation removes that privilege',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(await fs.readFile(new URL('./schema-fixture.sql',import.meta.url),'utf8'));
  await pg.exec('grant truncate on wedding_settings to anon;set role anon');
  // Synthetic fixture only: demonstrate that RLS does not protect a table-wide operation.
  await pg.exec('truncate wedding_settings');
  await pg.exec('reset role;insert into wedding_settings(id) values(1)');
  await pg.exec(await fs.readFile(new URL('../supabase/migrations/001_serverless.sql',import.meta.url),'utf8'));
  await pg.exec(await fs.readFile(new URL('../supabase/migrations/002_api_only_access.sql',import.meta.url),'utf8'));
  await pg.exec('set role anon');
  await assert.rejects(()=>pg.exec('truncate wedding_settings'),/permission denied/);
  await pg.exec('reset role');
 }finally{await pg.close();}
});
