import fs from 'node:fs/promises';
import {startLocalApp} from './lib/local-app.mjs';
import {checkSupabaseCompatibility} from './check-supabase-compatibility.mjs';

const allowPending=process.argv.includes('--routing-only');
const app=await startLocalApp({port:0,logger:{info(){},warn(){}}});
const results=[];
let readiness,compatibility;
try{
  const checks=[
    {path:'/',status:200,type:'text/html'},
    {path:'/api/health',status:200,type:'application/json'},
    {path:'/api/admin/state',status:401,code:'authentication_required'},
    {path:'/api/gateway?__wedding_route=admin/state',status:401,code:'authentication_required'},
    {path:'/api/admin/state',status:401,code:'invalid_token',headers:{Authorization:'Bearer invalid-test-token'}},
    {path:'/api/not-found',status:404,code:'not_found'},
    {path:'/api/rsvp',status:400,method:'POST',body:{participants:0}},
    {path:'/api/messages',status:400,method:'POST',body:{author:'',body:'',client_ref:'invalid'}},
    {path:'/src/main.tsx',status:200,type:'javascript'},
    {path:'/wedding/jeff-decor.webp',status:200,type:'image/webp'},
    {path:'/wedding/music.mp4',status:200,type:'video/mp4'},
    ...['/.env.local','/.wedding-data/souvenirs.json','/serverless/supabase.mjs','/docs/database/storage_grants.csv'].map(path=>({path,status:404})),
  ];
  for(const check of checks){
    const response=await fetch(app.url+check.path,{
      method:check.method||'GET',headers:{...check.headers,...(check.body?{'Content-Type':'application/json'}:{})},
      ...(check.body?{body:JSON.stringify(check.body)}:{}),signal:AbortSignal.timeout(15000),
    });
    const type=response.headers.get('content-type')||'';
    const body=type.includes('application/json')?await response.json():null;
    if(!body)await response.body?.cancel();
    if(response.status!==check.status||(check.type&&!type.includes(check.type))||(check.code&&body?.code!==check.code))throw Error('Contrôle HTTP échoué : '+check.path+' ('+response.status+').');
    results.push({path:check.path,status:response.status,type,code:body?.code,passed:true});
  }
  compatibility=await checkSupabaseCompatibility();
  if(compatibility.tables.some(t=>!t.compatible)||!compatibility.bucket.available||!compatibility.bucket.private){
    process.exitCode=1;console.error('Compatibilité des tables ou du bucket non validée. Voir .qa-artifacts/local-runtime.json.');
  }else console.log('Six tables compatibles et bucket privé confirmés sans lecture de ligne d’invité.');
  const response=await fetch(app.url+'/api/souvenirs',{signal:AbortSignal.timeout(15000)});
  const body=await response.json();
  readiness={status:response.status,code:body.code??'ready',ready:response.ok};
  if(!response.ok&&!allowPending)process.exitCode=1;
  if(!response.ok)console.error('Persistance non prête : HTTP '+response.status+' '+(body.code||'request_failed')+'. Aucune migration exécutée automatiquement.');
  else console.log('Lecture réelle des souvenirs Supabase : réussie.');
}finally{
  await app.close();
  await fs.mkdir('.qa-artifacts',{recursive:true});
  await fs.writeFile('.qa-artifacts/local-runtime.json',JSON.stringify({checked_at:new Date().toISOString(),mode:'real production gateway + Vite middleware, actual configured Supabase',read_only:true,checks:results,readiness,compatibility},null,2)+'\n');
}
console.log(results.length+' contrôles du runtime local réussis ; aucune requête de création valide ni de mutation distante.');
