import fs from 'node:fs/promises';
const base=process.env.WEDDING_QA_URL||'http://localhost:3000';
const scenarios=[
 {path:'/api/health',status:200,type:'application/json'},
 {path:'/api/admin/state',status:401,type:'application/json'},
 {path:'/api/admin/state',status:401,type:'application/json',headers:{Authorization:'Bearer invalid-test-token'}},
 {path:'/api/inconnue',status:404,type:'application/json'},
 {path:'/',status:200,type:'text/html'},
 {path:'/src/main.tsx',status:200,type:'javascript'},
 {path:'/wedding/jeff-decor.webp',status:200,type:'image/webp'},
 {path:'/wedding/music.mp4',status:200,type:'video/mp4'}
];
const results=[];
for(const scenario of scenarios){
 const response=await fetch(base+scenario.path,{headers:scenario.headers,signal:AbortSignal.timeout(25000)});
 const type=response.headers.get('content-type')||'';
 let code;
 if(type.includes('application/json')){const body=await response.json();code=body.code;}
 else await response.body?.cancel();
 if(response.status!==scenario.status||!type.includes(scenario.type))throw new Error('Local routing check failed for '+scenario.path+' (HTTP '+response.status+', '+type+').');
 results.push({path:scenario.path,mode:scenario.headers?'invalid_token':'anonymous',status:response.status,content_type:type,...(code?{code}:{})});
}
const state=await fetch(base+'/api/souvenirs',{signal:AbortSignal.timeout(25000)});
const body=await state.json();
if(!state.ok&&!(state.status===503&&body.code==='schema_required'))throw Error('Unexpected backend readiness error.');
const report={checked_at:new Date().toISOString(),read_only:true,routing_passed:true,database_api_ready:state.ok,readiness:{status:state.status,code:body.code??'ready'},results};
await fs.writeFile('docs/audit/vercel-readonly.json',JSON.stringify(report,null,2)+'\n');
console.log('Vercel Dev: '+results.length+' read-only routing/Auth checks passed. Database API ready: '+state.ok+'.');
if(process.argv.includes('--require-ready')&&!state.ok)process.exitCode=1;
