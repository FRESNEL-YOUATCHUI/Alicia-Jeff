import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {PGlite} from '@electric-sql/pglite';
import {backupSql,parseBackup,validateBefore,validateAfter,guardedSql,MIGRATION005_SHA,sha} from '../scripts/lib/migration005.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));const read=p=>fs.readFile(new URL('../'+p,import.meta.url),'utf8');
async function isolated(){const pg=new PGlite();for(const p of ['tests/schema-fixture.sql','supabase/migrations/001_serverless.sql','supabase/migrations/002_api_only_access.sql','supabase/migrations/004_ticket_entry.sql'])await pg.exec(await read(p));await pg.exec("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);insert into supabase_migrations.schema_migrations values('20261119203629','ticket_entry_004',array['isolated test metadata']);");return pg;}
async function capture(pg){let value;for(const result of await pg.exec(backupSql()))if(result.rows?.[0]?.snapshot)value=result.rows[0].snapshot;assert.ok(value);return value;}
test('005 delivery: consistent private backup, exact additive DDL, unchanged 004/data/ACL, no replay, manual rollback',async()=>{
 const pg=await isolated();try{
  await pg.query("select public.wedding_api_confirm($1::jsonb,$2)",[JSON.stringify({first_name:'Isolated',last_name:'Test',participants:1,ref_hash:'f'.repeat(64)}),'q'.repeat(43)]);
  const before=await capture(pg);assert.equal(before.private_rows.wedding_ticket_entries.length,1);assert.equal(validateBefore(before,root).ready,true);
  const original=await fs.readFile(new URL('../supabase/migrations/005_draft_uploads.sql',import.meta.url));assert.equal(sha(original),MIGRATION005_SHA);
  const guarded=guardedSql(original);assert.equal(guarded.replace(/\n-- DELIVERY GUARD ONLY:[^]*?-- END DELIVERY GUARD\n/,''),original.toString('utf8'));
  await pg.exec(guarded);const after=await capture(pg);assert.deepEqual(validateAfter(before,after,root),{ready:true,metadata_unchanged:true,data_unchanged:true,changed_tables:[],requires_traffic_review:false});
  await pg.exec('set role service_role');assert.equal((await pg.query('select public.wedding_api_upload_draft_ready() ready')).rows[0].ready,true);await pg.exec('reset role');
  await assert.rejects(pg.exec(guarded),/already exist/);await pg.exec('rollback');assert.equal((await capture(pg)).draft_functions.length,2);
  await pg.exec(await read('supabase/activation/rollback-draft-uploads.sql'));const restored=await capture(pg);assert.equal(restored.draft_functions.length,0);assert.deepEqual(restored.private_rows,before.private_rows);assert.deepEqual(restored.protected,before.protected);assert.deepEqual(restored.ticket_functions,before.ticket_functions);
 }finally{await pg.close();}
});
test('005 delivery validation refuses missing history, altered functions/grants, changed rows and incomplete exports',async()=>{
 const pg=await isolated();try{
  const before=await capture(pg);const text=JSON.stringify(before);assert.deepEqual(parseBackup(text),before);const csv='snapshot\r\n"'+text.replaceAll('"','""')+'"\r\n';assert.deepEqual(parseBackup(csv),before);assert.deepEqual(parseBackup(JSON.stringify([{snapshot:before}])),before);assert.throws(()=>parseBackup('snapshot\n"incomplete'));
  for(const modify of [s=>s.migration004_history=[],s=>s.ticket_functions[0].source+=' altered',s=>s.ticket_metadata.constraints=[],s=>s.ticket_metadata.browser_access=true,s=>s.unexpected_function_defaults=true,s=>s.draft_functions=[{name:'already'}]]){const bad=structuredClone(before);modify(bad);assert.throws(()=>validateBefore(bad,root));}
  await pg.exec(guardedSql(await fs.readFile(new URL('../supabase/migrations/005_draft_uploads.sql',import.meta.url))));const after=await capture(pg);
  for(const modify of [f=>f.anon_execute=true,f=>f.owner='unexpected_owner',f=>f.arguments='changed uuid',f=>f.config.push('row_security=off')]){const bad=structuredClone(after);modify(bad.draft_functions[0]);assert.throws(()=>validateAfter(before,bad,root));}
  const traffic=structuredClone(after);traffic.private_rows.wedding_rsvps.push({id:'isolated traffic, never printed'});const result=validateAfter(before,traffic,root);assert.equal(result.ready,false);assert.deepEqual(result.changed_tables,['wedding_rsvps']);
  const drift=structuredClone(after);drift.protected.tables[0].rls=false;assert.throws(()=>validateAfter(before,drift,root));
 }finally{await pg.close();}
});

test('005 PowerShell-compatible CLI prepares and validates CSV/JSON offline without contacting production',async()=>{
 const pg=await isolated();const run=args=>execFileSync(process.execPath,['scripts/prepare-migration005.mjs',...args],{cwd:root,encoding:'utf8'});try{
  const pkg=JSON.parse(run(['prepare'])),before=await capture(pg),beforeFile=pkg.directory+'/before.json';await fs.writeFile(beforeFile,JSON.stringify(before));const accepted=JSON.parse(run(['before','--bundle',pkg.directory,'--snapshot',beforeFile]));assert.equal(accepted.ready,true);assert.equal(accepted.remote_writes,0);await pg.exec(await fs.readFile(accepted.application_sql,'utf8'));const afterFile=pkg.directory+'/after.json';await fs.writeFile(afterFile,JSON.stringify(await capture(pg)));assert.equal(JSON.parse(run(['after','--bundle',pkg.directory,'--snapshot',afterFile])).ready,true);
 }finally{await pg.close();}
});
