import fs from 'node:fs';
import {createHash} from 'node:crypto';
export function parseCsv(input){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(field||row.length){row.push(field);rows.push(row);}
 const headers=rows.shift();return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]])));
}
const root='docs/database/';
const sources=['wedding_columns.csv','wedding_constraints.csv','wedding_policies.csv'];
const [columns,constraints,policies]=sources.map(f=>parseCsv(fs.readFileSync(root+f,'utf8')));
const spec=JSON.parse(fs.readFileSync('docs/audit/supabase-openapi.json','utf8')).definitions;
const out=[
 '-- TEST FIXTURE reconstructed from owner-provided CSV structure and readonly OpenAPI lengths.',
 '-- Auth users below are synthetic. Initial grants below model permissive defaults, not an exported grant list.',
 ...sources.map(f=>'-- SHA256 '+f+' '+createHash('sha256').update(fs.readFileSync(root+f)).digest('hex')),
 "create role anon;create role authenticated;create role service_role bypassrls;",
 "create schema auth;create table auth.users(id uuid primary key);",
 "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;"
];
for(const name of ['wedding_albums','wedding_settings','wedding_staff','wedding_rsvps','wedding_photos','wedding_messages']){
 const parts=columns.filter(c=>c.table_name===name).map(c=>{
  const property=spec[name].properties[c.column_name];
  const type=c.udt_name==='varchar'?'varchar('+property.maxLength+')':c.udt_name;
  return c.column_name+' '+type+(c.is_nullable==='NO'?' not null':'')+(c.column_default&&c.column_default!=='null'?' default '+c.column_default:'');
 });
 out.push('create table public.'+name+'('+parts.join(',')+');');
 for(const c of constraints.filter(c=>c.table_name===name))out.push('alter table public.'+name+' add constraint '+c.constraint_name+' '+c.definition+';');
 out.push('alter table public.'+name+' enable row level security;');
}
for(const p of policies){
 out.push('create policy "'+p.policyname.replaceAll('"','""')+'" on public.'+p.tablename+' for '+p.cmd+' to '+p.roles.replace(/[{}]/g,'')+' using ('+p.qual+');');
}
out.push("grant usage on schema public,auth to service_role,anon,authenticated;grant all on all tables in schema public to service_role;grant select on all tables in schema public to anon,authenticated;",
 "insert into auth.users values('20000000-0000-4000-8000-000000000001');",
 "insert into public.wedding_albums(id,title) values('10000000-0000-4000-8000-000000000001','Cérémonie civile'),('10000000-0000-4000-8000-000000000002','Vin d’honneur'),('10000000-0000-4000-8000-000000000003','Soirée de mariage');",
 "insert into public.wedding_settings(id) values(1);",
 "insert into public.wedding_staff(user_id,role) values('20000000-0000-4000-8000-000000000001','photographer');");
fs.writeFileSync('tests/schema-fixture.sql',out.join('\n')+'\n');
console.log('Fixture reproduced: '+columns.length+' columns, '+constraints.length+' constraints, '+policies.length+' policies.');
