import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {snapshotQuery} from '../scripts/prepare-activation-backup.mjs';
import {buildRollback} from '../scripts/prepare-activation-rollback.mjs';
import {apiFunctions,businessTables} from '../scripts/lib/activation-manifest.mjs';
const fixture=await fs.readFile(new URL('./schema-fixture.sql',import.meta.url),'utf8');
const activation=await fs.readFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),'utf8');
const snapshot=async pg=>(await pg.query(snapshotQuery())).rows[0].snapshot;
const init=async()=>{const pg=new PGlite();await pg.exec(fixture);return pg;};
async function seed(pg){
 await pg.exec(`insert into wedding_rsvps(id,ref_hash,first_name,last_name,participants,song) values('30000000-0000-4000-8000-000000000001',repeat('a',64),'Avant','Migration',2,'Chanson');
 insert into wedding_messages(id,response_id,author,body,hidden) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Avant','Message privé',true);
 insert into wedding_photos(id,album_id,storage_path,caption,hidden) values('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','existing/private.jpg','Photo privée',true);`);
}
test('all six populated business tables, columns, constraints, policies and triggers remain unchanged through activation twice',async()=>{
 const pg=await init();try{await seed(pg);const before=await snapshot(pg);await pg.exec(activation);await pg.exec(activation);const after=await snapshot(pg);
 assert.deepEqual(after.business_data,before.business_data);assert.deepEqual(after.fingerprints,before.fingerprints);
 for(const name of businessTables){const a=after.tables.find(t=>t.name===name),b=before.tables.find(t=>t.name===name);for(const key of ['owner','rls','force_rls','constraints','policies','triggers'])assert.deepEqual(a[key],b[key]);assert.deepEqual(a.columns.map(({acl:_acl,...x})=>x),b.columns.map(({acl:_acl,...x})=>x));}
 }finally{await pg.close();}
});
test('all twenty functions are invokers with pinned catalog/temp path; PUBLIC/default custom grants denied and unrelated overload retained',async()=>{
 const pg=await init();try{
 await pg.exec("create role extra_reader;alter default privileges grant execute on functions to extra_reader;create function public.wedding_api_unrelated() returns int language sql as $$select 7$$;create function public.wedding_api_admin_state(text) returns int language sql as $$select 9$$;");
 await pg.exec(activation);
 for(const signature of apiFunctions){const f=(await pg.query('select prosecdef,proconfig from pg_proc where oid=to_regprocedure($1)',['public.'+signature])).rows[0];assert.equal(f.prosecdef,false);assert.deepEqual(f.proconfig,['search_path=pg_catalog, pg_temp']);for(const role of ['anon','authenticated','extra_reader'])assert.equal((await pg.query('select has_function_privilege($1,$2,\'execute\') ok',[role,'public.'+signature])).rows[0].ok,false);}
 assert.equal((await pg.query("select has_function_privilege('extra_reader','wedding_api_unrelated()','execute') ok")).rows[0].ok,true);
 assert.equal((await pg.query("select has_function_privilege('anon','wedding_api_admin_state(text)','execute') ok")).rows[0].ok,true);
 }finally{await pg.close();}
});
test('inherited business grants abort activation atomically instead of leaving an effective bypass',async()=>{
 const pg=await init();try{await pg.exec('create role inherited_reader;grant select on wedding_rsvps to inherited_reader;grant inherited_reader to authenticated');await assert.rejects(()=>pg.exec(activation),/inherited business privilege/);await pg.exec('rollback');assert.equal((await pg.query("select to_regclass('wedding_api_uploads') obj")).rows[0].obj,null);}finally{await pg.close();}
});
test('snapshot-bound rollback restores table/column grants and grant options, prior function definition/ACL, indexes, RLS; preserves all data',async()=>{
 const pg=await init();try{await seed(pg);await pg.exec("grant truncate on wedding_rsvps to anon with grant option;grant update(song) on wedding_rsvps to authenticated with grant option;create function wedding_api_admin_state() returns jsonb language sql security definer set search_path=public as $$select '{\"old\":true}'::jsonb$$;revoke all on function wedding_api_admin_state() from PUBLIC;grant execute on function wedding_api_admin_state() to anon with grant option;");
 const before=await snapshot(pg);const rollback=await buildRollback(before);await pg.exec(activation);await pg.exec(rollback);const after=await snapshot(pg);
 for(const key of ['tables','functions','indexes','business_data','fingerprints','memberships','roles','default_acl','storage_metadata'])assert.deepEqual(after[key],before[key],key);
 }finally{await pg.close();}
});
test('rollback preserves business rows created after activation and never restores a stale data snapshot',async()=>{
 const pg=await init();try{const before=await snapshot(pg);await pg.exec(activation);await seed(pg);const newData=(await snapshot(pg)).business_data;await pg.exec(await buildRollback(before));assert.deepEqual((await snapshot(pg)).business_data,newData);}finally{await pg.close();}
});
test('rollback refuses nonempty new coordination tables and leaves activation/data intact',async()=>{
 const pg=await init();try{const before=await snapshot(pg);await pg.exec(activation);await pg.exec("insert into wedding_api_limits values(repeat('a',64),now(),1)");const rollback=await buildRollback(before);await assert.rejects(()=>pg.exec(rollback),/Coordination data exists/);await pg.exec('rollback');assert.equal((await pg.query('select hits from wedding_api_limits')).rows[0].hits,1);assert.notEqual((await pg.query("select to_regprocedure('wedding_api_admin_state()') obj")).rows[0].obj,null);}finally{await pg.close();}
});

test('rollback refuses missing snapshot, wrong database, function or policy drift; applies no partial changes',async()=>{
 const pg=await init();try{const before=await snapshot(pg);await assert.rejects(()=>buildRollback({}),/snapshot/i);await pg.exec(activation);
 for(const altered of ['database','function','policy']){
  let sql;
  if(altered==='database')sql=await buildRollback({...before,database:'wrong_database'});
  else if(altered==='function'){await pg.exec("create or replace function wedding_api_admin_state() returns jsonb language sql as $$select '{}'::jsonb$$");sql=await buildRollback(before);}
  else{await pg.exec(activation);await pg.exec('create policy unexpected on wedding_rsvps for select to authenticated using(true)');sql=await buildRollback(before);}
  await assert.rejects(()=>pg.exec(sql),/mismatch|drift/);await pg.exec('rollback');assert.notEqual((await pg.query("select to_regprocedure('wedding_api_admin_state()') obj")).rows[0].obj,null);
 }
 }finally{await pg.close();}
});
test('rollback rejects delegated grant chains instead of inventing a different grantor history',async()=>{
 const pg=await init();try{await pg.exec('create role delegated;grant select on wedding_rsvps to authenticated with grant option;set role authenticated;grant select on wedding_rsvps to delegated;reset role');const before=await snapshot(pg);await assert.rejects(()=>buildRollback(before),/grant chain/);}finally{await pg.close();}
});

test('read-only SQL backup captures a complete consistent result and blocks writes',async()=>{
 const pg=await init();try{await seed(pg);await pg.exec('begin transaction isolation level repeatable read read only;set local row_security=off');const s=await snapshot(pg);assert.equal(s.business_data.wedding_rsvps.length,1);assert.equal(s.business_data.wedding_messages[0].hidden,true);assert.equal(s.business_data.wedding_photos.length,1);await assert.rejects(()=>pg.exec("insert into wedding_albums(title) values('forbidden')"),/read-only/);await pg.exec('rollback');}finally{await pg.close();}
});
test('changed FK/unique constraints, incompatible length or public CREATE privilege fail before supplemental DDL',async()=>{
 for(const change of ['alter table wedding_messages drop constraint wedding_messages_response_id_fkey','alter table wedding_rsvps alter column first_name type varchar(40)','grant create on schema public to authenticated']){
  const pg=await init();try{await pg.exec(change);await assert.rejects(()=>pg.exec(activation),/Constraint changed|length incompatible|CREATE privilege/);await pg.exec('rollback');assert.equal((await pg.query("select to_regclass('wedding_api_uploads') obj")).rows[0].obj,null);}finally{await pg.close();}
 }
});

test('generated activation and read-only backup match their audited local sources',async()=>{
 const {createHash}=await import('node:crypto');
 for(const name of ['001_serverless.sql','002_api_only_access.sql']){
  const raw=await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
  assert.ok(activation.includes('SHA256 '+createHash('sha256').update(raw.replace(/\r\n/g,'\n')).digest('hex')));
 }
 const sql=await fs.readFile(new URL('../supabase/activation/preflight-backup-readonly.sql',import.meta.url),'utf8');assert.ok(sql.includes(snapshotQuery()));assert.match(sql,/repeatable read read only/);assert.match(sql,/set local row_security=off/);
});
test('rollback refuses a baseline with RLS disabled rather than preparing a security downgrade',async()=>{
 const pg=await init();try{const before=await snapshot(pg);before.tables[0].rls=false;await assert.rejects(()=>buildRollback(before),/ownership\/coverage/);}finally{await pg.close();}
});

test('noninheriting membership in privileged role is refused before any hosted architecture objects would be created',async()=>{
 const pg=await init();try{await pg.exec('alter role authenticated noinherit;grant service_role to authenticated');await assert.rejects(()=>pg.exec(activation),/membership in a privileged/);await pg.exec('rollback');assert.equal((await pg.query("select to_regclass('wedding_api_uploads') obj")).rows[0].obj,null);}finally{await pg.close();}
});
