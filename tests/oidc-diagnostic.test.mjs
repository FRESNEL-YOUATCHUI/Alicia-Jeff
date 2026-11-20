import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createServer} from 'node:http';
import {oidcRequestDiagnostic,GOOGLE_IDENTITY,VERCEL_IDENTITY} from '../serverless/google-oidc.mjs';
import {createHandler} from '../serverless/handler.mjs';
import {requireStaff} from '../serverless/supabase.mjs';

const production={VERCEL:'1',VERCEL_ENV:'production'};
const fields=['vercel_variable_present','vercel_flag_valid','vercel_env_variable_present','production_environment',
  'google_configuration_valid','request_oidc_token_present','sdk_token_accessible','identity_claims_match','ready'];
const jwt=(claims={})=>[
  Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url'),
  Buffer.from(JSON.stringify({iss:VERCEL_IDENTITY.issuer,aud:VERCEL_IDENTITY.audience,sub:VERCEL_IDENTITY.subject,
    environment:'production',iat:Math.floor(Date.now()/1000)-10,nbf:Math.floor(Date.now()/1000)-10,
    exp:Math.floor(Date.now()/1000)+7200,...claims})).toString('base64url'),
  Buffer.from('isolated-test-signature-not-a-real-token').toString('base64url')
].join('.');
const request=token=>({headers:token===undefined?{}:{'x-vercel-oidc-token':token}});
function booleansOnly(body){
  assert.deepEqual(Object.keys(body).sort(),[...fields].sort());
  assert.ok(Object.values(body).every(value=>typeof value==='boolean'));
}

test('request diagnostic returns only boolean flags, with the strict production identity',()=>{
  const token=jwt(),env={...production},before={...env};let calls=0;
  const result=oidcRequestDiagnostic(request(token),{env,tokenProvider:()=>{calls++;return token;}});
  booleansOnly(result);assert.ok(Object.values(result).every(Boolean));assert.equal(calls,1);
  assert.deepEqual(env,before);assert.equal(JSON.stringify(result).includes(token),false);
});

test('missing or unauthorized environment never invokes the SDK',async t=>{
  for(const [label,env] of [
    ['local',{}],['Preview',{VERCEL:'1',VERCEL_ENV:'preview'}],['Development',{VERCEL:'1',VERCEL_ENV:'development'}],
    ['missing VERCEL',{VERCEL_ENV:'production'}],['missing VERCEL_ENV',{VERCEL:'1'}],
    ['invalid VERCEL',{VERCEL:'0',VERCEL_ENV:'production'}],['empty variables',{VERCEL:'',VERCEL_ENV:''}]
  ])await t.test(label,()=>{
    let calls=0;const result=oidcRequestDiagnostic(request(jwt()),{env,tokenProvider:()=>{calls++;throw Error('must not run');}});
    booleansOnly(result);assert.equal(result.ready,false);assert.equal(result.sdk_token_accessible,false);assert.equal(calls,0);
    assert.equal(result.vercel_variable_present,typeof env.VERCEL==='string');
    assert.equal(result.vercel_env_variable_present,typeof env.VERCEL_ENV==='string');
  });
});

test('missing or ambiguous request header cannot be replaced by an environment token',async t=>{
  for(const header of [undefined,'',[]])await t.test(header===undefined?'absent':Array.isArray(header)?'multiple':'empty',()=>{
    let calls=0;const result=oidcRequestDiagnostic(request(header),{env:production,tokenProvider:()=>{calls++;return jwt();}});
    booleansOnly(result);assert.equal(result.request_oidc_token_present,false);assert.equal(result.ready,false);assert.equal(calls,0);
  });
  const result=oidcRequestDiagnostic(request(jwt({jti:'request'})),{env:production,tokenProvider:()=>jwt({jti:'environment-fallback'})});
  assert.equal(result.request_oidc_token_present,true);assert.equal(result.sdk_token_accessible,false);assert.equal(result.ready,false);
});

test('SDK exceptions are converted to booleans without including error details',()=>{
  const result=oidcRequestDiagnostic(request(jwt()),{env:production,tokenProvider:()=>{throw Error('private-sdk-error-token-details');}});
  booleansOnly(result);assert.equal(result.sdk_token_accessible,false);assert.equal(result.ready,false);
  assert.equal(JSON.stringify(result).includes('private-sdk'),false);
});

test('expired or nonconforming identity claims cannot report ready',async t=>{
  for(const [label,token] of [
    ['expired',jwt({exp:Math.floor(Date.now()/1000)-1})],['wrong team',jwt({iss:'https://oidc.vercel.com/other'})],
    ['wrong project',jwt({sub:'owner:dev-full1:project:other:environment:production'})],
    ['wrong audience',jwt({aud:'https://vercel.com/other'})],['Preview token',jwt({environment:'preview'})],
    ['malformed','not-a-jwt']
  ])await t.test(label,()=>{
    const result=oidcRequestDiagnostic(request(token),{env:production,tokenProvider:()=>token});
    booleansOnly(result);assert.equal(result.sdk_token_accessible,true);assert.equal(result.identity_claims_match,false);assert.equal(result.ready,false);
  });
});

test('conflicting Google configuration is reduced to one boolean, never exposing its value',()=>{
  const token=jwt(),env={...production,GCP_PROJECT_NUMBER:'private-unexpected-configuration'};
  const result=oidcRequestDiagnostic(request(token),{env,tokenProvider:()=>token});
  booleansOnly(result);assert.equal(result.google_configuration_valid,false);assert.equal(result.sdk_token_accessible,true);
  assert.equal(result.ready,false);assert.equal(JSON.stringify(result).includes(env.GCP_PROJECT_NUMBER),false);
  assert.equal(Object.keys(GOOGLE_IDENTITY).length,5);
});

test('real synchronous Vercel SDK reads each current request, with no module-level token capture',async()=>{
  const symbol=Symbol.for('@vercel/request-context'),previous=globalThis[symbol],storage=new AsyncLocalStorage();
  globalThis[symbol]={get:()=>storage.getStore()??{}};
  try{
    const tokens=[jwt({jti:'first'}),jwt({jti:'second'})];
    const results=await Promise.all(tokens.map(token=>storage.run({headers:{'x-vercel-oidc-token':token}},async()=>{
      await Promise.resolve();return oidcRequestDiagnostic(request(token),{env:production});
    })));
    assert.ok(results.every(result=>result.ready));results.forEach(booleansOnly);
    const token=jwt();
    const missing=storage.run({headers:{'x-vercel-oidc-token':''}},()=>oidcRequestDiagnostic(request(token),{env:production}));
    assert.equal(missing.sdk_token_accessible,false);assert.equal(missing.ready,false);
  }finally{if(previous===undefined)delete globalThis[symbol];else globalThis[symbol]=previous;}
});

test('HTTP diagnostic uses the real staff authorization guard, and never touches business RPCs or Storage',async t=>{
  const calls={auth:0,roles:0,diagnostic:0,sdk:0};
  const ids={admin:'20000000-0000-4000-8000-000000000001',photographer:'20000000-0000-4000-8000-000000000002',guest:'20000000-0000-4000-8000-000000000003',missing:'20000000-0000-4000-8000-000000000004'};
  const roles=new Map([[ids.admin,'admin'],[ids.photographer,'photographer'],[ids.guest,'guest']]);
  const client={
    auth:{async getUser(token){calls.auth++;const id=ids[token];return id?{data:{user:{id}},error:null}:{data:{user:null},error:{status:401,message:'must-never-echo-auth-token'}};}},
    from(table){assert.equal(table,'wedding_staff');return{select(columns){assert.equal(columns,'role');return{eq(column,id){assert.equal(column,'user_id');return{async maybeSingle(){calls.roles++;return{data:roles.has(id)?{role:roles.get(id)}:null,error:null};}};}};}};}
  };
  const forbidden=new Proxy({},{get(){throw Error('Diagnostic attempted business or Storage access');}});
  const state={env:production,contextMissing:false,sdkError:false};
  const symbol=Symbol.for('@vercel/request-context'),previous=globalThis[symbol],context=new AsyncLocalStorage();
  globalThis[symbol]={get:()=>context.getStore()??{}};
  const handler=createHandler({repo:forbidden,storage:forbidden,authenticate:req=>requireStaff(req,client),
    oidcDiagnostic:req=>{calls.diagnostic++;const options={env:state.env};if(state.sdkError)options.tokenProvider=()=>{calls.sdk++;throw Error('private-oidc-error');};return oidcRequestDiagnostic(req,options);}});
  const server=createServer((req,res)=>context.run({headers:state.contextMissing?{'x-vercel-oidc-token':''}:req.headers},()=>handler(req,res)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async({auth,oidc=jwt(),path='/api/admin/oidc-readiness',method='GET'}={})=>{
    const headers={};if(auth)headers.Authorization='Bearer '+auth;if(oidc!==null)headers['x-vercel-oidc-token']=oidc;
    const response=await fetch(base+path,{method,headers});return{response,body:method==='HEAD'?null:await response.json()};
  };
  try{
    await t.test('anonymous and invalid bearer rejected before diagnosis, identical to admin state',async()=>{
      for(const path of ['/api/admin/state','/api/admin/oidc-readiness']){
        assert.equal((await call({path})).response.status,401);
        const invalid=await call({path,auth:'expired-or-invalid'});assert.equal(invalid.response.status,401);
        assert.equal(invalid.body.code,'invalid_token');assert.equal(JSON.stringify(invalid.body).includes('must-never'),false);
      }
      assert.equal(calls.diagnostic,0);assert.equal(calls.roles,0);
    });
    await t.test('authenticated user without allowed staff role is forbidden before diagnosis',async()=>{
      for(const auth of ['guest','missing']){
        const result=await call({auth});assert.equal(result.response.status,403);assert.equal(result.body.code,'staff_required');
      }
      assert.equal(calls.diagnostic,0);
    });
    await t.test('both existing admin and photographer roles can read boolean-only readiness',async()=>{
      for(const auth of ['admin','photographer']){
        const result=await call({auth});assert.equal(result.response.status,200);booleansOnly(result.body);assert.equal(result.body.ready,true);
        assert.match(result.response.headers.get('cache-control'),/private, no-store/);
      }
    });
    await t.test('gateway rewrite reaches the same protected diagnostic',async()=>{
      const result=await call({auth:'admin',path:'/api/gateway?__wedding_route=admin/oidc-readiness'});
      assert.equal(result.response.status,200);assert.equal(result.body.ready,true);
    });
    await t.test('non-Production stays unready without requesting SDK access',async()=>{
      state.env={VERCEL:'1',VERCEL_ENV:'preview'};state.sdkError=true;const before=calls.sdk;
      const result=await call({auth:'admin'});booleansOnly(result.body);assert.equal(result.body.ready,false);
      assert.equal(result.body.production_environment,false);assert.equal(calls.sdk,before);
      state.env=production;state.sdkError=false;
    });
    await t.test('missing request token or missing SDK context cannot report ready',async()=>{
      const missing=await call({auth:'admin',oidc:null});booleansOnly(missing.body);
      assert.equal(missing.body.request_oidc_token_present,false);assert.equal(missing.body.ready,false);
      state.contextMissing=true;const contextMissing=await call({auth:'admin'});state.contextMissing=false;
      assert.equal(contextMissing.body.sdk_token_accessible,false);assert.equal(contextMissing.body.ready,false);
    });
    await t.test('SDK failure never exposes exception text or identities',async()=>{
      state.sdkError=true;const result=await call({auth:'admin'});state.sdkError=false;
      assert.equal(result.response.status,200);booleansOnly(result.body);assert.equal(result.body.ready,false);
      assert.equal(JSON.stringify(result.body).includes('private-oidc'),false);
    });
    await t.test('GET only; authenticated POST and HEAD cannot invoke the diagnostic',async()=>{
      const before=calls.diagnostic;
      for(const method of ['POST','HEAD']){const result=await call({auth:'admin',method});assert.equal(result.response.status,405);assert.equal(result.response.headers.get('allow'),'GET');}
      assert.equal(calls.diagnostic,before);
    });
  }finally{
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(previous===undefined)delete globalThis[symbol];else globalThis[symbol]=previous;
  }
});
