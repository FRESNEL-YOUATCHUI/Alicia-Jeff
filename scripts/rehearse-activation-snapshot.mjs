import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {coordinationTables} from './lib/activation-manifest.mjs';
import {snapshotQuery} from './prepare-activation-backup.mjs';
import {buildRollback} from './prepare-activation-rollback.mjs';
import {verificationQuery} from './prepare-activation-verification.mjs';
import {projectRoot} from './lib/environment.mjs';
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const role=s=>s==='PUBLIC'?'PUBLIC':ident(s);
const raw=await fs.readFile(path.join(projectRoot,'.qa-artifacts/backups/preactivation.json'),'utf8');
let capture=JSON.parse(raw.replace(/^\uFEFF/,''));if(Array.isArray(capture)){assert.equal(capture.length,1);capture=capture[0];}capture=capture.snapshot??capture;if(typeof capture==='string')capture=JSON.parse(capture);
assert.equal(capture.executor,'postgres');assert.equal(capture.database,'postgres');assert.equal(capture.functions.length,0,'Existing functions require a dedicated reconstruction');assert.equal(capture.tables.length,6,'Existing coordination tables require a dedicated reconstruction');
const hash=s=>createHash('sha256').update(s).digest('hex');
const canonical=x=>JSON.stringify(x);
const sortAcl=acl=>[...acl].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
function normalizedTables(tables){return tables.map(t=>({...t,acl:sortAcl(t.acl),columns:t.columns.map(c=>({...c,acl:sortAcl(c.acl)}))})).sort((a,b)=>a.name.localeCompare(b.name));}
function compareTables(actual,expected){assert.deepEqual(normalizedTables(actual),normalizedTables(expected),'Table metadata/ACL differs from the captured production state');}
const rollback=await buildRollback(capture);
const pg=new PGlite();
const proof={checked_at:new Date().toISOString(),hosted_mutations_performed:false,private_snapshot_sha256:hash(raw),snapshot_captured_at:capture.captured_at,hosted_version:capture.server_version,method:'Offline PGlite PostgreSQL major 17: exact captured business data, columns/defaults/constraints/indexes/policies/ACLs, browser role flags and public default grants; non-superuser postgres executor',limitations:['Supabase Auth users and Storage internals are represented by local fixtures, not a complete hosted platform clone.','PGlite minor version may differ from hosted PostgreSQL; no hosted migration or rollback has been executed.']};
let stage='local bootstrap separation';
try{
 // PGlite bootstrap OID 10 must remain a superuser. Create a distinct postgres role, as on hosted Supabase.
 await pg.exec('create role rehearsal_bootstrap superuser;set session authorization rehearsal_bootstrap;alter role postgres rename to rehearsal_origin;create role postgres superuser bypassrls createrole createdb login;alter database template1 owner to postgres;alter schema public owner to pg_database_owner;set session authorization postgres');
 stage='fixture';
 await pg.exec(await fs.readFile(new URL('../tests/schema-fixture.sql',import.meta.url),'utf8'));
 await pg.exec(await fs.readFile(new URL('../tests/storage-fixture.sql',import.meta.url),'utf8'));
 await pg.exec("set timezone='UTC'");
 proof.local_version=(await pg.query('show server_version')).rows[0].server_version;
 stage='role attributes';
 for(const r of capture.roles.filter(r=>['anon','authenticated','service_role'].includes(r.name))){
  await pg.exec(`alter role ${ident(r.name)} ${r.superuser?'superuser':'nosuperuser'} ${r.bypass_rls?'bypassrls':'nobypassrls'} ${r.inherit?'inherit':'noinherit'} ${r.can_login?'login':'nologin'} ${r.create_role?'createrole':'nocreaterole'} ${r.create_database?'createdb':'nocreatedb'}`);
 }
 stage='private row reconstruction';
 for(const table of ['wedding_messages','wedding_photos','wedding_staff','wedding_rsvps','wedding_albums','wedding_settings'])await pg.exec('delete from public.'+ident(table));
 for(const staff of capture.business_data.wedding_staff)await pg.query('insert into auth.users(id) values($1) on conflict do nothing',[staff.user_id]);
 for(const table of ['wedding_albums','wedding_settings','wedding_staff','wedding_rsvps','wedding_photos','wedding_messages']){
  await pg.query(`insert into public.${ident(table)} select * from jsonb_populate_recordset(null::public.${ident(table)},$1::jsonb)`,[JSON.stringify(capture.business_data[table])]);
 }
 for(const index of capture.indexes){
  if(!(await pg.query('select to_regclass($1) obj',['public.'+index.indexname])).rows[0].obj){assert.match(index.indexdef,/^CREATE (?:UNIQUE )?INDEX /);await pg.exec(index.indexdef);}
 }
 stage='captured ACLs';
 for(const table of capture.tables){
  const target='public.'+ident(table.name);
  assert.equal(table.triggers.length,0,'Triggers require dedicated reconstruction');
  await pg.exec('revoke all on table '+target+' from PUBLIC,postgres,anon,authenticated,service_role');
  for(const col of table.columns)await pg.exec('revoke all ('+ident(col.name)+') on table '+target+' from PUBLIC,postgres,anon,authenticated,service_role');
  for(const acl of table.acl){assert.equal(acl.grantor,'postgres');await pg.exec(`grant ${acl.privilege} on table ${target} to ${role(acl.grantee)}${acl.grantable?' with grant option':''}`);}
  for(const col of table.columns)for(const acl of col.acl)await pg.exec(`grant ${acl.privilege} (${ident(col.name)}) on table ${target} to ${role(acl.grantee)}${acl.grantable?' with grant option':''}`);
 }
 // Reproduce the relevant permissive defaults that the migration must revoke on new API objects.
 await pg.exec('alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role');
 stage='owner memberships';
 await pg.exec('grant anon,authenticated,service_role to postgres');
 stage='non-superuser owner';
 await pg.exec('alter role postgres nosuperuser bypassrls createrole createdb inherit');
 await pg.exec('grant usage on schema public to anon,authenticated,service_role');
 const get=async()=>(await pg.query(snapshotQuery())).rows[0].snapshot;
 stage='metadata equivalence';
 const before=await get();
 compareTables(before.tables,capture.tables);
 assert.deepEqual(before.business_data,capture.business_data,'Private business rows were not reconstructed exactly');
 assert.deepEqual(before.fingerprints,capture.fingerprints,'Private data fingerprint mismatch');
 assert.deepEqual(before.indexes,capture.indexes,'Captured indexes were not reconstructed exactly');
 assert.equal(before.roles.find(r=>r.name==='postgres').superuser,false);
 proof.preconditions={business_rows_exact:true,business_metadata_and_acls_exact:true,fingerprints_valid:true,indexes_exact:true,postgres_is_non_superuser:true,roles_and_relevant_defaults_reproduced:true};
 const sql=await fs.readFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),'utf8');
 proof.activation_sha256_lf=hash(sql.replace(/\r\n/g,'\n'));
 proof.local_executor_context=(await pg.query("select current_database() database,current_user executor,has_schema_privilege(current_user,'public','CREATE') can_create_public")).rows[0];
 stage='activation';
 await pg.exec(sql);await pg.exec(sql);
 const after=await get();assert.deepEqual(after.business_data,before.business_data);assert.deepEqual(after.fingerprints,before.fingerprints);
 const verification=(await pg.query(verificationQuery())).rows[0].verification;assert.equal(verification.all_checks_passed,true,'Post-activation SQL Editor security check failed');
 proof.activation={runs:2,idempotent:true,business_data_unchanged:true,sql_editor_checks:verification.checks};
 stage='rollback database guard';
 // This installed PGlite always connects to template1 despite its database option.
 // Prove the original production guard rejects this different database, then map only that literal offline.
 const localDb=(await pg.query('select current_database() db')).rows[0].db;
 let testedRollback=rollback;
 if(localDb!==capture.database){
  await assert.rejects(()=>pg.exec(rollback),/Rollback database\/executor mismatch/);await pg.exec('rollback');
  const literal="current_database()<>'"+capture.database.replaceAll("'","''")+"'";
  assert.equal(rollback.split(literal).length,2,'Production database guard must occur once');
  testedRollback=rollback.replace(literal,"current_database()<>'"+localDb.replaceAll("'","''")+"'");
  proof.local_database_mapping={hosted:capture.database,local:localDb,original_guard_rejected_wrong_database:true,only_database_name_literal_mapped_in_memory:true,production_rollback_file_unchanged:true};
 }
 stage='rollback';
 await pg.exec(testedRollback);
 const restored=await get();compareTables(restored.tables,before.tables);
 for(const key of ['business_data','fingerprints','indexes','functions','default_acl','storage_metadata','memberships','schema_acl'])assert.deepEqual(restored[key],before[key],'Rollback mismatch: '+key);
 for(const table of coordinationTables)assert.equal((await pg.query('select to_regclass($1) obj',['public.'+table])).rows[0].obj,null);
 proof.rollback={executed_offline:true,permissions_and_grant_options_restored:true,rls_and_policies_restored:true,private_rows_unchanged:true,indexes_restored:true,functions_restored:true,defaults_and_storage_untouched:true,coordination_tables_removed_only_while_empty:true,sha256:hash(rollback)};
 proof.passed=true;
}catch(error){
 proof.passed=false;proof.error_code=error.code;proof.stage=stage;proof.failed_check=String(error.message).split('\n')[0];
 console.error('Snapshot rehearsal failed; only a redacted summary is written.');process.exitCode=1;
}finally{
 await pg.close();
 await fs.writeFile(path.join(projectRoot,'docs/audit/preactivation-rehearsal.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof,null,2));
}
