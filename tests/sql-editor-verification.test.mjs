import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {verificationQuery} from '../scripts/prepare-activation-verification.mjs';
import {snapshotQuery} from '../scripts/prepare-activation-backup.mjs';

test('SQL Editor verification is read-only, detects missing activation, validates applied security and unchanged business contents',async()=>{
 const pg=new PGlite();try{
  await pg.exec(await fs.readFile(new URL('./schema-fixture.sql',import.meta.url),'utf8'));
  await pg.exec(await fs.readFile(new URL('./storage-fixture.sql',import.meta.url),'utf8'));
  assert.equal((await pg.query(verificationQuery())).rows[0].verification.all_checks_passed,false);
  const before=(await pg.query(snapshotQuery())).rows[0].snapshot;
  await pg.exec(await fs.readFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),'utf8'));
  await pg.exec('begin transaction isolation level repeatable read read only;set local row_security=off');
  const result=(await pg.query(verificationQuery())).rows[0].verification;await pg.exec('commit');
  assert.equal(result.all_checks_passed,true,JSON.stringify(result.checks));
  assert.deepEqual(result.business_fingerprints,before.fingerprints);
  assert.deepEqual(result.business_counts,Object.fromEntries(Object.entries(before.business_data).map(([t,rows])=>[t,rows.length])));
  await pg.exec('grant execute on function wedding_api_admin_state() to anon');
  assert.equal((await pg.query(verificationQuery())).rows[0].verification.checks.execute_server_only,false);
  await pg.exec('revoke execute on function wedding_api_admin_state() from anon;alter table wedding_api_uploads disable row level security');
  assert.equal((await pg.query(verificationQuery())).rows[0].verification.checks.eight_tables_with_rls,false);
 }finally{await pg.close();}
});
