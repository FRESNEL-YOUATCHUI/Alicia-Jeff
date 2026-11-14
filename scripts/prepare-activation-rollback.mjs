import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {businessTables,coordinationTables,apiFunctions,activationIndexes} from './lib/activation-manifest.mjs';
import {projectRoot} from './lib/environment.mjs';
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const ident=value=>'"'+String(value).replaceAll('"','""')+'"';
const role=value=>value==='PUBLIC'?'PUBLIC':ident(value);
const affected=new Set(['PUBLIC','anon','authenticated','service_role']);
function validateSnapshot(s){
 if(s?.format!=='alicia-jeff-preactivation-v1'||!s.database||!s.executor||!Array.isArray(s.tables)||!Array.isArray(s.functions)||!Array.isArray(s.indexes))throw Error('Complete, trusted preactivation snapshot required.');
 const names=s.tables.map(t=>t.name);
 if(new Set(names).size!==names.length||businessTables.some(t=>!names.includes(t)||!Array.isArray(s.business_data?.[t])||!/^[a-f0-9]{32}$/.test(s.fingerprints?.[t]||'')))throw Error('Incomplete business backup or fingerprint.');
 for(const t of s.tables){
  if(![...businessTables,...coordinationTables].includes(t.name)||t.owner!==s.executor||t.rls!==true||!Array.isArray(t.columns)||!Array.isArray(t.acl)||!Array.isArray(t.policies))throw Error('Snapshot ownership/coverage requires a dedicated rollback review.');
  for(const a of [...t.acl,...t.columns.flatMap(c=>c.acl)])if(a.grantor!==t.owner)throw Error('Delegated grant chain requires dedicated rollback review.');
 }
 if(s.functions.some(f=>!apiFunctions.includes(f.signature.replace(/^public\./,''))||f.owner!==s.executor||f.acl.some(a=>a.grantor!==f.owner)))throw Error('Existing function ownership/grant chain requires dedicated rollback review.');
}
function resetAcl(kind,target,scope){
 const query=kind==='function'?`select distinct x.grantee,p.proowner owner from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where p.oid=to_regprocedure(${q(target)})`:`select distinct x.grantee,c.relowner owner from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x where c.oid=to_regclass(${q(target)})`;
 return `do $reset$ declare g record;begin for g in ${query} loop if g.grantee<>g.owner ${scope?"and (g.grantee=0 or pg_get_userbyid(g.grantee) in ('anon','authenticated','service_role'))":''} then execute format('revoke all on ${kind} ${target.replaceAll('%','%%')} from %s',case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end);end if;end loop;end $reset$;`;
}
function grants(acl,target,kind,onlyAffected=false,column){
 return acl.filter(a=>!onlyAffected||affected.has(a.grantee)).map(a=>{
  if(!['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','EXECUTE','MAINTAIN'].includes(a.privilege))throw Error('Unexpected privilege in snapshot.');
  return `grant ${a.privilege}${column?' ('+ident(column)+')':''} on ${kind} ${target} to ${role(a.grantee)}${a.grantable?' with grant option':''};`;
 }).join('\n');
}
export async function buildRollback(snapshot){
 validateSnapshot(snapshot);
 const source=await fs.readFile(new URL('../supabase/migrations/001_serverless.sql',import.meta.url),'utf8');
 const bodies=[...source.matchAll(/create or replace function public\.(wedding_api_\w+)\([^)]*\)[\s\S]*? as \$\$([\s\S]*?)\$\$;/g)];
 if(bodies.length!==apiFunctions.length||bodies.some((b,i)=>b[1]!==apiFunctions[i].split('(')[0]))throw Error('Function audit manifest/source mismatch.');
 const lines=[`-- Generated from a complete PREACTIVATION snapshot. Review and authorize hosted execution separately.
-- Restores permissions/configuration; never restores, truncates or deletes business rows.
-- Stop writers first. Nonempty newly-created coordination tables or schema/function drift abort the entire rollback.
begin;
set local lock_timeout='5s';set local statement_timeout='120s';
select pg_advisory_xact_lock(7812471901126);
lock table ${businessTables.map(t=>'public.'+ident(t)).join(',')} in share row exclusive mode;
do $guard$ begin if current_database()<>${q(snapshot.database)} or current_user<>${q(snapshot.executor)} then raise exception 'Rollback database/executor mismatch';end if;end $guard$;`];
 for(const t of snapshot.tables){
  lines.push(`do $guard$ declare p jsonb;begin
 if not exists(select 1 from pg_class c where c.oid=to_regclass(${q('public.'+t.name)}) and pg_get_userbyid(c.relowner)=${q(t.owner)}) then raise exception 'Rollback table missing or ownership drift';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.policyname),'[]'::jsonb) into p from pg_policies x where schemaname='public' and tablename=${q(t.name)};
 if p is distinct from ${q(JSON.stringify(t.policies))}::jsonb then raise exception 'Policy drift: rollback refused';end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum),'[]'::jsonb) into p from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=to_regclass(${q('public.'+t.name)}) and a.attnum>0 and not a.attisdropped;
 if p is distinct from ${q(JSON.stringify(t.columns.map(({acl:_acl,...c})=>c)))}::jsonb then raise exception 'Column drift: rollback refused';end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'definition',pg_get_constraintdef(x.oid)) order by x.conname),'[]'::jsonb) into p from pg_constraint x where x.conrelid=to_regclass(${q('public.'+t.name)});
 if p is distinct from ${q(JSON.stringify(t.constraints))}::jsonb then raise exception 'Constraint drift: rollback refused';end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',x.tgname,'definition',pg_get_triggerdef(x.oid),'enabled',x.tgenabled) order by x.tgname),'[]'::jsonb) into p from pg_trigger x where x.tgrelid=to_regclass(${q('public.'+t.name)}) and not x.tgisinternal;
 if p is distinct from ${q(JSON.stringify(t.triggers))}::jsonb then raise exception 'Trigger drift: rollback refused';end if;
 end $guard$;`);
 }
 for(const [i,signature]of apiFunctions.entries()){
  lines.push(`do $guard$ begin if not exists(select 1 from pg_proc where oid=to_regprocedure(${q('public.'+signature)}) and pg_get_userbyid(proowner)=${q(snapshot.executor)} and prosrc=${q(bodies[i][2])} and not prosecdef and proconfig=array['search_path=pg_catalog, pg_temp']) then raise exception 'Function drift: rollback refused';end if;end $guard$;`);
 }
 for(const t of coordinationTables.filter(name=>!snapshot.tables.some(t=>t.name===name))){
  lines.push(`lock table public.${ident(t)} in access exclusive mode;\ndo $guard$ begin if exists(select 1 from public.${ident(t)}) then raise exception 'Coordination data exists: rollback refused without a new preservation plan';end if;end $guard$;`);
 }
 for(const signature of [...apiFunctions].reverse())if(!snapshot.functions.some(f=>f.signature==='public.'+signature))lines.push('drop function public.'+signature+';');
 for(const f of snapshot.functions){
  lines.push(f.definition+';',resetAcl('function',f.signature,false),grants(f.acl,f.signature,'function'));
 }
 for(const index of activationIndexes)if(!snapshot.indexes.some(i=>i.indexname===index))lines.push('drop index if exists public.'+ident(index)+';');
 for(const t of snapshot.tables){
  const target='public.'+ident(t.name);
  lines.push(resetAcl('table',target,true));
  for(const col of t.columns){
   lines.push(`revoke all (${ident(col.name)}) on table ${target} from PUBLIC,anon,authenticated,service_role;`);
  }
  lines.push(grants(t.acl,target,'table',true));
  for(const col of t.columns)lines.push(grants(col.acl,target,'table',true,col.name));
  lines.push(`alter table ${target} enable row level security;\nalter table ${target} ${t.force_rls?'force':'no force'} row level security;`);
 }
 for(const t of [...coordinationTables].reverse())if(!snapshot.tables.some(x=>x.name===t))lines.push('drop table public.'+ident(t)+';');
 lines.push("notify pgrst,'reload schema';\ncommit;\n");
 return lines.filter(Boolean).join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=process.argv[2];
 if(!input||process.argv.length!==3)throw Error('Usage: node scripts/prepare-activation-rollback.mjs <private snapshot.json>. No database is contacted.');
 let s=JSON.parse(await fs.readFile(input,'utf8'));if(Array.isArray(s))s=s[0]?.snapshot;if(typeof s?.snapshot==='string')s=JSON.parse(s.snapshot);else if(s?.snapshot)s=s.snapshot;if(typeof s==='string')s=JSON.parse(s);
 const sql=await buildRollback(s);
 const dir=path.join(projectRoot,'.qa-artifacts','backups');await fs.mkdir(dir,{recursive:true});
 const dest=path.join(dir,'rollback-serverless-'+Date.now()+'.sql');await fs.writeFile(dest,sql,{flag:'wx',mode:0o600});
 console.log('Rollback prepared locally in ignored backup folder; no SQL executed. SHA256 '+createHash('sha256').update(sql).digest('hex'));
 console.log(dest);
}
