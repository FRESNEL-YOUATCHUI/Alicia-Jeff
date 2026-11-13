import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCsv} from './lib/csv.mjs';
const files=['storage_bucket.csv','storage_rls.csv','storage_policies.csv','storage_grants.csv','storage_effective_privileges.csv'];
const data={},sources=[];
for(const file of files){
 const raw=await fs.readFile(new URL('../docs/database/'+file,import.meta.url));
 data[file]=parseCsv(raw.toString('utf8'));
 sources.push({file,sha256:createHash('sha256').update(raw).digest('hex'),rows:data[file].length});
}
const bucket=data['storage_bucket.csv'];
if(bucket.length!==1||bucket[0].id!=='wedding-photos')throw Error('Expected the wedding-photos bucket snapshot.');
if(bucket[0].public!=='false')throw Error('The bucket is no longer private: review the audit and fixture before proceeding.');
const rls=data['storage_rls.csv'].map(r=>({...r,schema_name:r.schema_name??r.schemaname,table_name:r.table_name??r.tablename})),tables=['objects','buckets'],roles=['anon','authenticated','service_role'];
for(const name of tables)if(rls.filter(r=>r.schema_name==='storage'&&r.table_name===name).length!==1)throw Error('Storage RLS table missing or duplicated.');
const policyRows=data['storage_policies.csv'];
const empty=policyRows.length===1&&policyRows[0].policyname==='NO_POLICY_DEFINED'&&Object.entries(policyRows[0]).every(([k,v])=>k==='policyname'||v==='null'||v==='');
const policies=empty?[]:policyRows;
if(policies.length)throw Error('Policies changed: this zero-policy fixture must be reviewed before regeneration.');
const grants=data['storage_grants.csv'].map(r=>({...r,table_schema:r.table_schema??r.schemaname,table_name:r.table_name??r.tablename,is_grantable:r.is_grantable==='true'?'YES':r.is_grantable==='false'?'NO':r.is_grantable}));
const effective=data['storage_effective_privileges.csv'].map(r=>({...r,table_name:r.table_name??r.tablename}));
const operations={SELECT:'can_select',INSERT:'can_insert',UPDATE:'can_update',DELETE:'can_delete'};
const matrix=[];
for(const role of roles)for(const table of tables){
 const entries=effective.filter(r=>r.role_name===role&&r.table_name===table);
 if(entries.length!==1)throw Error('Effective privilege entry missing or duplicated.');
 const sql={};
 for(const [operation,column]of Object.entries(operations)){
  const value=entries[0][column];if(!['true','false'].includes(value))throw Error('Invalid privilege boolean.');
  sql[operation]=value==='true';
 }
 const rowRls=rls.find(r=>r.table_name===table);
 matrix.push({role,table,sql_privileges:sql,rls_enabled:rowRls.rls_enabled==='true',policies:0,
  row_access_assessment:role==='service_role'?'privileged_server_role_requires_bypass_or_owner_check':rowRls.rls_enabled==='true'?'default_deny_for_nonowner_without_bypassrls':'not_protected_by_rls'});
}
const statement={inspected_from_exports:true,sources,bucket:{id:bucket[0].id,private:bucket[0].public==='false',file_size_limit:bucket[0].file_size_limit==='null'?null:bucket[0].file_size_limit,allowed_mime_types:bucket[0].allowed_mime_types==='null'?null:bucket[0].allowed_mime_types},
 policy_count:policies.length,explicit_grant_rows:grants.length,matrix,
 limitations:['Exports do not include role BYPASSRLS, ownership, inherited memberships, schema/column privileges or effective TRUNCATE/REFERENCES/TRIGGER.',
 'PostgreSQL tests model ordinary anon/authenticated and the standard privileged service_role on minimal synthetic Storage tables.',
 'No hosted permission change, SQL mutation, object upload/deletion or signed-capability network test is performed.']};
await fs.writeFile(new URL('../docs/audit/storage-permissions.json',import.meta.url),JSON.stringify(statement,null,2)+'\n');
const sql=[
 '-- LOCAL TEST fixture: minimal Storage tables; not a complete Storage schema migration.',
 '-- Grants and RLS flags reproduced from owner-supplied exports; zero policies exported.',
 '-- Test assumptions: schema USAGE granted; synthetic owner; anon/authenticated nonowner NOBYPASSRLS; service_role BYPASSRLS.',
 ...sources.map(r=>'-- SHA256 '+r.file+' '+r.sha256),
 'create role storage_owner;',
 'create schema storage;',
 "create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);",
 'create table storage.objects(id uuid primary key,bucket_id text not null references storage.buckets(id),name text not null);',
 "insert into storage.buckets(id,name,public) values('wedding-photos','wedding-photos',false),('other-bucket','other-bucket',false);",
 "insert into storage.objects values('30000000-0000-4000-8000-000000000001','wedding-photos','wedding.png'),('30000000-0000-4000-8000-000000000002','other-bucket','other.png');",
 'grant usage on schema storage to anon,authenticated,service_role,storage_owner;'
];
for(const t of tables){
 const row=rls.find(r=>r.table_name===t);
 if(row.rls_enabled==='true')sql.push('alter table storage.'+t+' enable row level security;');
 if(row.rls_forced==='true')sql.push('alter table storage.'+t+' force row level security;');
 sql.push('alter table storage.'+t+' owner to storage_owner;');
}
for(const g of grants){
 if(g.table_schema!=='storage'||!tables.includes(g.table_name)||!['anon','authenticated','service_role','postgres'].includes(g.grantee)||!['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'].includes(g.privilege_type)||!['YES','NO'].includes(g.is_grantable))throw Error('Unexpected grant: review the export before generating SQL.');
 sql.push('grant '+g.privilege_type+' on storage.'+g.table_name+' to '+g.grantee+(g.is_grantable==='YES'?' with grant option':'')+';');
}
await fs.writeFile(new URL('../tests/storage-fixture.sql',import.meta.url),sql.join('\n')+'\n');
console.log('Storage exports analyzed: '+policies.length+' policies, '+grants.length+' explicit grants, '+matrix.length+' role/table entries; private bucket='+statement.bucket.private+'.');
