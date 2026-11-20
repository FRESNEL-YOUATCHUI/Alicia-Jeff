import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createServer} from 'node:http';
import {createGoogleSheetsReadiness} from '../serverless/google-sheets-readiness.mjs';
import {oidcRequestDiagnostic,VERCEL_IDENTITY,SHEETS_READONLY_SCOPE} from '../serverless/google-oidc.mjs';
import {DEFAULT_SHEET_ID,DEFAULT_SHEET_RANGE} from '../serverless/official-list.mjs';
import {createHandler} from '../serverless/handler.mjs';
import {requireStaff} from '../serverless/supabase.mjs';

const jwt=()=>[
  Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url'),
  Buffer.from(JSON.stringify({iss:VERCEL_IDENTITY.issuer,aud:VERCEL_IDENTITY.audience,sub:VERCEL_IDENTITY.subject,
    environment:'production',iat:Math.floor(Date.now()/1000)-10,nbf:Math.floor(Date.now()/1000)-10,
    exp:Math.floor(Date.now()/1000)+7200})).toString('base64url'),
  Buffer.from('isolated-test-signature').toString('base64url')
].join('.');
const activation=now=>({VERCEL:'1',VERCEL_ENV:'production',GOOGLE_SHEETS_READINESS_ENABLED:'true',GOOGLE_SHEETS_READINESS_UNTIL:new Date(now+3600000).toISOString()});

function safeResult(body,ready,code){
  assert.deepEqual(body,{ready,sheets_readable:ready,...(code?{code}:{})});
  assert.equal(JSON.stringify(body).includes('PRIVATE_TEST'),false);
}

test('Google read probe shares the real SDK and full OIDC/STSIAM/Sheets reader; HTTP is admin-only and readonly',async t=>{
  const nativeFetch=globalThis.fetch,symbol=Symbol.for('@vercel/request-context'),previous=globalThis[symbol],context=new AsyncLocalStorage();
  const state={clock:Date.now(),env:null,tokenMissing:false,failure:null,status:403,network:false,malformed:false,hold:null,cloud:[],staffReads:0};
  state.env=activation(state.clock);
  let probe=createGoogleSheetsReadiness({env:state.env,now:()=>state.clock});
  const reset=()=>{
    state.clock=Date.now();state.env=activation(state.clock);state.tokenMissing=false;state.failure=null;state.status=403;state.network=false;state.malformed=false;state.hold=null;state.cloud=[];
    probe=createGoogleSheetsReadiness({env:state.env,now:()=>state.clock});
  };
  const ids={admin:'20000000-0000-4000-8000-000000000001',photographer:'20000000-0000-4000-8000-000000000002',guest:'20000000-0000-4000-8000-000000000003'};
  const client={
    auth:{async getUser(token){return ids[token]?{data:{user:{id:ids[token]}},error:null}:{data:{user:null},error:{status:401,message:'PRIVATE_TEST_AUTH_ERROR'}};}},
    from(table){assert.equal(table,'wedding_staff');return{select(columns){assert.equal(columns,'role');return{eq(column,id){assert.equal(column,'user_id');return{async maybeSingle(){state.staffReads++;return{data:{role:Object.keys(ids).find(k=>ids[k]===id)},error:null};}};}};}};}
  };
  const forbidden=new Proxy({},{get(){throw Error('Business RPC or Storage access is forbidden');}});
  const handler=createHandler({repo:forbidden,storage:forbidden,authenticate:req=>requireStaff(req,client),
    googleSheetsReadiness:req=>probe(req),oidcDiagnostic:req=>oidcRequestDiagnostic(req,{env:state.env})});
  globalThis[symbol]={get:()=>context.getStore()??{}};
  const server=createServer((req,res)=>context.run({headers:req.headers},()=>handler(req,res)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  globalThis.fetch=async(url,options)=>{
    const value=String(url),stage=value==='https://sts.googleapis.com/v1/token'?'sts':value.includes('iamcredentials.googleapis.com')?'iam':value.startsWith('https://sheets.googleapis.com/v4/spreadsheets/')?'sheets':null;
    assert.ok(stage,'Unexpected external endpoint');state.cloud.push(stage);
    if(state.failure===stage){if(state.network)throw Error('PRIVATE_TEST_NETWORK_CREDENTIAL');return new Response(JSON.stringify({error:{message:'PRIVATE_TEST_ERROR_TOKEN_NAME'}}),{status:state.status});}
    if(stage==='sts'){
      assert.equal(options.method,'POST');assert.equal(options.body.get('audience'),'//iam.googleapis.com/projects/691833411750/locations/global/workloadIdentityPools/alicia-jeff-vercel/providers/vercel-alicia-jeff');
      assert.equal(JSON.parse(Buffer.from(options.body.get('subject_token').split('.')[1],'base64url')).sub,VERCEL_IDENTITY.subject);
      return new Response(JSON.stringify({access_token:'PRIVATE_TEST_federated_token',issued_token_type:'urn:ietf:params:oauth:token-type:access_token',token_type:'Bearer',expires_in:3600}));
    }
    if(stage==='iam'){
      assert.deepEqual(JSON.parse(options.body),{scope:[SHEETS_READONLY_SCOPE],lifetime:'600s'});
      assert.equal(options.headers.Authorization,'Bearer PRIVATE_TEST_federated_token');
      return new Response(JSON.stringify({accessToken:'PRIVATE_TEST_impersonated_token',expireTime:new Date(Date.now()+600000).toISOString()}));
    }
    assert.ok(value.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'+DEFAULT_SHEET_ID+'/values/'+encodeURIComponent(DEFAULT_SHEET_RANGE)+'?'));
    assert.equal(options.headers.get('Authorization'),'Bearer PRIVATE_TEST_impersonated_token');
    assert.ok(options.signal instanceof AbortSignal);assert.equal(options.cache,'no-store');
    if(state.hold)await state.hold();
    return new Response(state.malformed?'{invalid-private-json':JSON.stringify({values:[['PRIVATE_TEST_NOM_COMPLET']]}));
  };
  const call=async({auth='admin',method='GET',path='/api/admin/google-sheets-readiness'}={})=>{
    const headers={};if(auth)headers.Authorization='Bearer '+auth;if(!state.tokenMissing)headers['x-vercel-oidc-token']=jwt();
    const response=await nativeFetch(base+path,{method,headers});const body=method==='HEAD'?null:await response.json();
    assert.match(response.headers.get('cache-control'),/private, no-store/);
    if(path.includes('google-sheets-readiness'))assert.equal(response.headers.get('cdn-cache-control'),'no-store');
    return{response,body};
  };
  try{
    await t.test('missing/invalid session and non-staff denied with no Google calls',async()=>{
      for(const auth of [null,'expired'])assert.equal((await call({auth})).response.status,401);
      assert.equal((await call({auth:'guest'})).response.status,403);assert.deepEqual(state.cloud,[]);
    });
    await t.test('photographer keeps existing OIDC diagnostic but cannot invoke the real Google probe',async()=>{
      assert.equal((await call({auth:'photographer'})).body.code,'admin_required');
      const old=await call({auth:'photographer',path:'/api/admin/oidc-readiness'});assert.equal(old.response.status,200);assert.equal(old.body.ready,true);
      assert.deepEqual(state.cloud,[]);
    });
    await t.test('disabled by default, absent deadline, malformed or expired deadline never calls Google',async()=>{
      const until=state.env.GOOGLE_SHEETS_READINESS_UNTIL;
      for(const config of [
        {GOOGLE_SHEETS_READINESS_ENABLED:undefined},
        {GOOGLE_SHEETS_READINESS_ENABLED:'false'},
        {GOOGLE_SHEETS_READINESS_UNTIL:undefined},
        {GOOGLE_SHEETS_READINESS_UNTIL:'invalid'},
        {GOOGLE_SHEETS_READINESS_UNTIL:new Date(state.clock-1).toISOString()}
      ]){
        Object.assign(state.env,{GOOGLE_SHEETS_READINESS_ENABLED:'true',GOOGLE_SHEETS_READINESS_UNTIL:until},config);
        const result=await call();assert.equal(result.response.status,404);safeResult(result.body,false,'diagnostic_disabled');
      }
      assert.deepEqual(state.cloud,[]);reset();
    });
    await t.test('Preview, Development and missing production flags fail closed before Google',async()=>{
      for(const fields of [{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{VERCEL:undefined},{VERCEL_ENV:undefined}]){
        reset();Object.assign(state.env,fields);const result=await call();assert.equal(result.response.status,503);safeResult(result.body,false,'google_sheets_unavailable');assert.deepEqual(state.cloud,[]);
      }
      reset();
    });
    await t.test('missing request OIDC token never falls back to a different identity',async()=>{
      state.tokenMissing=true;const result=await call();assert.equal(result.response.status,503);safeResult(result.body,false,'google_sheets_unavailable');assert.deepEqual(state.cloud,[]);reset();
    });
    await t.test('admin executes all three real adapter stages and response reveals no rows or tokens',async()=>{
      const result=await call();assert.equal(result.response.status,200);safeResult(result.body,true);assert.deepEqual(state.cloud,['sts','iam','sheets']);
      assert.equal(result.response.headers.get('vary'),'Authorization');assert.equal(result.response.headers.get('pragma'),'no-cache');reset();
    });
    await t.test('HTTP query and server overrides cannot change the probe target or readonly range',async()=>{
      Object.assign(state.env,{GOOGLE_SHEETS_SPREADSHEET_ID:'other-private-sheet-1234567890',GOOGLE_SHEETS_RANGE:"'Other'!A2:A"});
      const result=await call({path:'/api/admin/google-sheets-readiness?sheet=other&range=PRIVATE_TEST_QUERY'});
      safeResult(result.body,true);assert.deepEqual(state.cloud,['sts','iam','sheets']);reset();
    });
    for(const stage of ['sts','iam','sheets']){
      for(const status of [403,429,503])await t.test(stage+' HTTP '+status+' is generic and retains no successful result',async()=>{
        reset();state.failure=stage;state.status=status;const result=await call();assert.equal(result.response.status,503);safeResult(result.body,false,'google_sheets_unavailable');
        assert.equal(state.cloud.at(-1),stage);
      });
      await t.test(stage+' network error is generic',async()=>{
        reset();state.failure=stage;state.network=true;const result=await call();assert.equal(result.response.status,503);safeResult(result.body,false,'google_sheets_unavailable');
      });
    }
    await t.test('malformed Sheets response is not reported as ready',async()=>{
      reset();state.malformed=true;const result=await call();assert.equal(result.response.status,503);safeResult(result.body,false,'google_sheets_unavailable');reset();
    });
    await t.test('cooldown rejects repeat requests; later requests re-read Google instead of a cached result',async()=>{
      safeResult((await call()).body,true);const before=state.cloud.length;
      const blocked=await call();assert.equal(blocked.response.status,429);safeResult(blocked.body,false,'diagnostic_rate_limited');assert.equal(blocked.response.headers.get('retry-after'),'60');assert.equal(state.cloud.length,before);
      state.clock+=60000;safeResult((await call()).body,true);assert.equal(state.cloud.length,before+3);reset();
    });
    await t.test('failed Google calls also consume cooldown',async()=>{
      state.failure='sts';assert.equal((await call()).response.status,503);assert.equal((await call()).response.status,429);assert.equal(state.cloud.length,1);reset();
    });
    await t.test('parallel requests cannot start a second Google probe even after cooldown elapses',async()=>{
      let release,arrive;const arrived=new Promise(resolve=>{arrive=resolve;}),blocked=new Promise(resolve=>{release=resolve;});
      state.hold=async()=>{arrive();await blocked;};
      const first=call();await arrived;state.clock+=61000;
      try{const second=await call();assert.equal(second.response.status,429);assert.equal(state.cloud.length,3);}
      finally{release();}
      assert.equal((await first).response.status,200);reset();
    });
    await t.test('manual disable and expiry stop future calls without touching Google',async()=>{
      state.env.GOOGLE_SHEETS_READINESS_ENABLED='false';assert.equal((await call()).response.status,404);assert.equal(state.cloud.length,0);
      reset();state.clock=Date.parse(state.env.GOOGLE_SHEETS_READINESS_UNTIL);assert.equal((await call()).response.status,404);assert.equal(state.cloud.length,0);reset();
    });
    await t.test('gateway rewrite is supported; POST/HEAD are rejected before Google',async()=>{
      const good=await call({path:'/api/gateway?__wedding_route=admin/google-sheets-readiness'});safeResult(good.body,true);const before=state.cloud.length;
      for(const method of ['POST','HEAD'])assert.equal((await call({method})).response.status,405);
      assert.equal(state.cloud.length,before);
    });
    assert.ok(state.staffReads>0);
  }finally{
    globalThis.fetch=nativeFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(previous===undefined)delete globalThis[symbol];else globalThis[symbol]=previous;
  }
});
