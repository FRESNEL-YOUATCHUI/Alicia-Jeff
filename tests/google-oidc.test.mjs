import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createServer} from 'node:http';
import {createRsvpRef} from '../shared/rsvp-reference.mjs';
import {requireStaff} from '../serverless/supabase.mjs';
import {GoogleSheetsOidcAuth,GOOGLE_IDENTITY,VERCEL_IDENTITY,SHEETS_READONLY_SCOPE,googleOidcConfiguration,googleOidcReadiness} from '../serverless/google-oidc.mjs';
import {OfficialList} from '../serverless/official-list.mjs';
import {createHandler} from '../serverless/handler.mjs';
import {Repository} from '../serverless/repository.mjs';
import {database,clientFor} from './database.mjs';

const production={VERCEL:'1',VERCEL_ENV:'production'};
const unavailable=e=>e.status===503&&e.code==='official_list_unavailable'&&e.message==='La liste officielle est indisponible. Aucune entrée autorisée.';
const jwt=(claims={},now=Date.now(),header={alg:'RS256',kid:'isolated-test-key'})=>[
  Buffer.from(JSON.stringify(header)).toString('base64url'),
  Buffer.from(JSON.stringify({iss:VERCEL_IDENTITY.issuer,aud:VERCEL_IDENTITY.audience,
    sub:VERCEL_IDENTITY.subject,environment:'production',iat:Math.floor(now/1000)-10,
    nbf:Math.floor(now/1000)-10,exp:Math.floor(now/1000)+7200,...claims})).toString('base64url'),
  Buffer.from('isolated-not-a-real-signature').toString('base64url')
].join('.');

function fixture({env=production,tokenProvider,now=Date.now,deadlineMs=7000}={}){
  const calls=[],state={tokenCalls:0,stsStatus:200,iamStatus:200};
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(url==='https://sts.googleapis.com/v1/token'){
      if(state.stsOverride)return state.stsOverride(options);
      return new Response(JSON.stringify({access_token:'federated-test',issued_token_type:'urn:ietf:params:oauth:token-type:access_token',token_type:'Bearer',expires_in:3600}),{status:state.stsStatus});
    }
    assert.equal(url,googleOidcConfiguration().impersonationUrl);
    if(state.iamOverride)return state.iamOverride(options);
    return new Response(JSON.stringify({accessToken:'temporary-google-test',expireTime:new Date(now()+600000).toISOString()}),{status:state.iamStatus});
  };
  const auth=new GoogleSheetsOidcAuth({env,fetchImpl,now,deadlineMs,tokenProvider:tokenProvider??(async()=>{state.tokenCalls++;return jwt({jti:String(state.tokenCalls)},now());})});
  return {auth,calls,state,fetchImpl};
}

test('OIDC protocol uses the verified numeric resource, STS then impersonation, and readonly Sheets scope',async()=>{
  const f=fixture(),headers=await f.auth.getRequestHeaders();
  assert.equal(headers.get('Authorization'),'Bearer temporary-google-test');
  assert.equal(f.state.tokenCalls,1);assert.equal(f.calls.length,2);
  const [sts,iam]=f.calls,form=sts.options.body;
  assert.equal(sts.url,'https://sts.googleapis.com/v1/token');
  assert.equal(form.get('audience'),'//iam.googleapis.com/projects/691833411750/locations/global/workloadIdentityPools/alicia-jeff-vercel/providers/vercel-alicia-jeff');
  assert.notEqual(form.get('audience'),VERCEL_IDENTITY.audience);
  assert.equal(form.get('grant_type'),'urn:ietf:params:oauth:grant-type:token-exchange');
  assert.equal(form.get('subject_token_type'),'urn:ietf:params:oauth:token-type:jwt');
  assert.equal(form.get('requested_token_type'),'urn:ietf:params:oauth:token-type:access_token');
  assert.equal(form.get('scope'),'https://www.googleapis.com/auth/cloud-platform');
  assert.equal(JSON.parse(Buffer.from(form.get('subject_token').split('.')[1],'base64url')).sub,VERCEL_IDENTITY.subject);
  assert.equal(iam.options.headers.Authorization,'Bearer federated-test');
  assert.deepEqual(JSON.parse(iam.options.body),{scope:[SHEETS_READONLY_SCOPE],lifetime:'600s'});
  for(const call of f.calls){assert.equal(call.options.redirect,'error');assert.equal(call.options.cache,'no-store');assert.ok(call.options.signal instanceof AbortSignal);}
});

test('every scan obtains a fresh assertion and Google access token, including after an earlier failure',async()=>{
  const f=fixture();f.state.stsStatus=403;
  await assert.rejects(f.auth.getRequestHeaders(),unavailable);
  f.state.stsStatus=200;await f.auth.getRequestHeaders();await f.auth.getRequestHeaders();
  assert.equal(f.state.tokenCalls,3);
  const assertions=f.calls.filter(c=>c.url.includes('sts.googleapis.com')).map(c=>c.options.body.get('subject_token'));
  assert.equal(new Set(assertions).size,3);
});

test('real Vercel SDK reads each concurrent request context without module-level token capture',async()=>{
  const symbol=Symbol.for('@vercel/request-context'),previous=globalThis[symbol],storage=new AsyncLocalStorage();
  globalThis[symbol]={get:()=>storage.getStore()??{}};
  try{
    const f=fixture(),auth=new GoogleSheetsOidcAuth({env:production,fetchImpl:f.fetchImpl});
    const tokens=[jwt({jti:'request-one'}),jwt({jti:'request-two'})];
    await Promise.all(tokens.map(token=>storage.run({headers:{'x-vercel-oidc-token':token}},()=>auth.getRequestHeaders())));
    assert.deepEqual(new Set(f.calls.filter(c=>c.url.includes('sts.googleapis.com')).map(c=>c.options.body.get('subject_token'))),new Set(tokens));
  }finally{if(previous===undefined)delete globalThis[symbol];else globalThis[symbol]=previous;}
});

test('local, development and Preview runtimes fail before requesting any identity',async t=>{
  for(const env of [{},{VERCEL:'1',VERCEL_ENV:'preview'},{VERCEL:'1',VERCEL_ENV:'development'},{VERCEL:'0',VERCEL_ENV:'production'}]){
    await t.test(env.VERCEL_ENV||'local',async()=>{
      const f=fixture({env});await assert.rejects(f.auth.getRequestHeaders(),unavailable);
      assert.equal(f.state.tokenCalls,0);assert.equal(f.calls.length,0);
    });
  }
});

test('configuration rejects conflicting project, pool, provider or service account without a fallback',async t=>{
  for(const name of Object.keys(GOOGLE_IDENTITY)){
    await t.test(name,async()=>{
      const env={...production,[name]:'conflicting-unverified-value'},f=fixture({env});
      assert.throws(()=>googleOidcConfiguration(env),unavailable);
      assert.equal(googleOidcReadiness(env).configuration_valid,false);
      await assert.rejects(f.auth.getRequestHeaders(),unavailable);
      assert.equal(f.calls.length,0);assert.equal(f.state.tokenCalls,0);
    });
  }
  assert.equal(googleOidcReadiness({GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'ignored-test-only'}).legacy_private_key_ignored,true);
});

test('expired, future, malformed and wrong-production assertions never reach STS',async t=>{
  const now=Date.now(),seconds=Math.floor(now/1000);
  const cases=[
    ['expired',jwt({exp:seconds-1},now)],['not-yet-valid',jwt({nbf:seconds+60},now)],
    ['future-issued',jwt({iat:seconds+60},now)],['bad-expiry-type',jwt({exp:String(seconds+60)},now)],
    ['wrong-issuer',jwt({iss:'https://oidc.vercel.com/other-team'},now)],
    ['wrong-audience',jwt({aud:googleOidcConfiguration().stsAudience},now)],
    ['preview-subject',jwt({sub:'owner:dev-full1:project:alicia-jeff:environment:preview'},now)],
    ['preview-claim',jwt({environment:'preview'},now)],['unsigned',jwt({},now,{alg:'none'})],
    ['malformed','not-a-jwt'],['missing',''],['invalid-json','e30.bm90LWpzb24.c2ln']
  ];
  for(const [label,token] of cases)await t.test(label,async()=>{
    const f=fixture({tokenProvider:async()=>token,now:()=>now});
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);assert.equal(f.calls.length,0);
  });
});

test('SDK and Google error details are never exposed to the caller',async()=>{
  const f=fixture({tokenProvider:async()=>{throw Error('private-assertion-and-token-details');}});
  await assert.rejects(f.auth.getRequestHeaders(),e=>unavailable(e)&&!e.message.includes('private-assertion')&&e.cause===undefined);
});

test('STS authentication, signature, quota and availability failures do not call IAM',async t=>{
  for(const status of [400,401,403,429,503])await t.test(String(status),async()=>{
    const f=fixture();f.state.stsStatus=status;
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);assert.equal(f.calls.length,1);
  });
  const f=fixture();f.state.stsOverride=async()=>{throw Error('STS network offline');};
  await assert.rejects(f.auth.getRequestHeaders(),unavailable);assert.equal(f.calls.length,1);
});

test('IAM denial and outage never produce a Google Sheets authorization header',async t=>{
  for(const status of [400,401,403,429,503])await t.test(String(status),async()=>{
    const f=fixture();f.state.iamStatus=status;
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);assert.equal(f.calls.length,2);
  });
  const f=fixture();f.state.iamOverride=async()=>{throw Error('IAM network offline');};
  await assert.rejects(f.auth.getRequestHeaders(),unavailable);
});

test('malformed, expired and oversized STS responses fail closed',async t=>{
  const ok={access_token:'federated-test',issued_token_type:'urn:ietf:params:oauth:token-type:access_token',token_type:'Bearer',expires_in:3600};
  const cases=[
    ['zero-expiry',{...ok,expires_in:0}],['negative-expiry',{...ok,expires_in:-1}],
    ['wrong-token-type',{...ok,token_type:'other'}],['missing-issued-type',{...ok,issued_token_type:null}],
    ['missing-token',{...ok,access_token:null}],['header-injection',{...ok,access_token:'bad\nheader'}],
    ['oversized-token',{...ok,access_token:'x'.repeat(17000)}]
  ];
  for(const [label,body] of cases)await t.test(label,async()=>{
    const f=fixture();f.state.stsOverride=async()=>new Response(JSON.stringify(body));
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);assert.equal(f.calls.length,1);
  });
  for(const [label,response] of [['invalid-json',new Response('{')],['oversized-body',new Response('x'.repeat(65537))]]){
    await t.test(label,async()=>{const f=fixture();f.state.stsOverride=async()=>response;await assert.rejects(f.auth.getRequestHeaders(),unavailable);});
  }
});

test('expired or invalid impersonated tokens and assertions expiring during exchange are rejected',async t=>{
  const now=Date.now();
  for(const [label,body] of [
    ['expired',{accessToken:'token',expireTime:new Date(now-1000).toISOString()}],
    ['bad-expiry',{accessToken:'token',expireTime:'invalid'}],
    ['too-long-lived',{accessToken:'token',expireTime:new Date(now+7200000).toISOString()}],
    ['missing-token',{expireTime:new Date(now+600000).toISOString()}]
  ])await t.test(label,async()=>{
    const f=fixture({now:()=>now});f.state.iamOverride=async()=>new Response(JSON.stringify(body));
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);
  });
  let clock=now;
  const f=fixture({now:()=>clock,tokenProvider:async()=>jwt({exp:Math.floor(now/1000)+3},now)});
  f.state.iamOverride=async()=>{clock=now+5000;return new Response(JSON.stringify({accessToken:'temporary',expireTime:new Date(clock+600000).toISOString()}));};
  await assert.rejects(f.auth.getRequestHeaders(),unavailable);
  clock=now;
  const g=fixture({now:()=>clock});
  g.state.stsOverride=async()=>{clock=now+2000;return new Response(JSON.stringify({access_token:'federated',issued_token_type:'urn:ietf:params:oauth:token-type:access_token',token_type:'Bearer',expires_in:1}));};
  await assert.rejects(g.auth.getRequestHeaders(),unavailable);assert.equal(g.calls.length,1);
});

test('one deadline bounds token retrieval, STS and IAM, including unresponsive transports',async t=>{
  await t.test('token retrieval timeout prevents a late STS request',async()=>{
    const f=fixture({deadlineMs:10,tokenProvider:()=>new Promise(resolve=>setTimeout(()=>resolve(jwt()),30))});
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);
    await new Promise(resolve=>setTimeout(resolve,35));assert.equal(f.calls.length,0);
  });
  for(const stage of ['sts','iam'])await t.test(stage+' timeout',async()=>{
    const f=fixture({deadlineMs:15});f.state[stage+'Override']=()=>new Promise(()=>{});
    await assert.rejects(f.auth.getRequestHeaders(),unavailable);
    assert.equal(f.calls.length,stage==='sts'?1:2);
  });
});

test('real reader chains readonly impersonation to Sheets and rejects Sheets denial, outage and timeout',async()=>{
  const f=fixture();let status=200,offline=false,seen;
  const list=new OfficialList({env:production,authFactory:()=>f.auth,fetchImpl:async(url,options)=>{
    seen={url,options};if(offline)throw new DOMException('Timed out','TimeoutError');
    return new Response(JSON.stringify({values:[['NDIAYE Élodie']]}),{status});
  }});
  assert.deepEqual(await list.match({first_name:'Elodie',last_name:'Ndiaye'}),{status:'recognized',name:'ndiaye elodie'});
  assert.equal(seen.options.headers.get('Authorization'),'Bearer temporary-google-test');
  assert.ok(seen.url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'));
  assert.equal(seen.options.cache,'no-store');
  for(status of [401,403,429,503])await assert.rejects(list.match({first_name:'Elodie',last_name:'Ndiaye'}),unavailable);
  offline=true;await assert.rejects(list.match({first_name:'Elodie',last_name:'Ndiaye'}),unavailable);
  offline=false;status=200;assert.equal((await list.match({first_name:'Elodie',last_name:'Ndiaye'})).status,'recognized');
});

test('HTTP scan never consumes a ticket on STS, IAM, Sheets or assertion failure; RSVP never calls Google',async()=>{
  const {pg}=await database(),repo=new Repository(clientFor(pg)),f=fixture();
  let sheetStatus=200,expired=false;
  f.auth.tokenProvider=async()=>{f.state.tokenCalls++;return jwt(expired?{exp:Math.floor(Date.now()/1000)-1}:{});};
  const list=new OfficialList({env:production,authFactory:()=>f.auth,
    fetchImpl:async()=>new Response(JSON.stringify({values:[['Élodie Ndiaye']]}),{status:sheetStatus})});
  const server=createServer(createHandler({repo,storage:{},officialList:list,authenticate:req=>requireStaff(req,repo.client),rateSecret:'isolated-oidc-handler-test-only'}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(origin+'/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},
      body:JSON.stringify({first_name:'Élodie',last_name:'Ndiaye',client_ref:await createRsvpRef({first_name:'Élodie',last_name:'Ndiaye'})})});
    assert.equal(response.status,200);const ticket=(await response.json()).ticket;
    assert.equal(f.calls.length,0);assert.equal(f.state.tokenCalls,0);
    const opened=await fetch(origin+'/api/tickets/open?token='+ticket.qr_token);
    const html=await opened.text(),input=JSON.parse(html.match(/const input=(.*);/)[1]),cookie=opened.headers.get('set-cookie').split(';')[0];
    const scan=async()=>{const r=await fetch(origin+'/api/tickets/verify',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie,'Sec-Fetch-Site':'same-origin',Authorization:'Bearer valid'},body:JSON.stringify({token:ticket.qr_token,proof:input.proof})});return{status:r.status,body:await r.json()};};
    for(const stage of ['sts','iam','sheets','expired']){
      f.state.stsStatus=stage==='sts'?403:200;f.state.iamStatus=stage==='iam'?403:200;
      sheetStatus=stage==='sheets'?503:200;expired=stage==='expired';
      const result=await scan();assert.equal(result.status,503);assert.equal(result.body.admitted,false);
      assert.equal(result.body.code,'official_list_unavailable');assert.equal((await repo.lookupTicket(ticket.qr_token)).checked_in_at,null);
    }
    f.state.stsStatus=200;f.state.iamStatus=200;sheetStatus=200;expired=false;
    assert.equal((await scan()).body.status,'valid');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();}
});
