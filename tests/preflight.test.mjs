import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
test('schema mismatch refuses migration before DDL and leaves no coordination table',async()=>{
 const pg=new PGlite();
 try{
  const sql=await fs.readFile(new URL('../supabase/migrations/001_serverless.sql',import.meta.url),'utf8');
  await assert.rejects(()=>pg.exec(sql),/Schema mismatch/);
  await pg.exec('rollback');
  assert.equal((await pg.query("select to_regclass('public.wedding_api_uploads') table_name")).rows[0].table_name,null);
 }finally{await pg.close();}
});
