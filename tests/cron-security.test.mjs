import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandler} from '../serverless/handler.mjs';
import {ApiError} from '../serverless/http.mjs';
const isolatedSecret='test-only-cron-secret-for-isolated-security-checks';
async function harness({secret=isolatedSecret,rows=[],removeError}={}){
 const calls=[];let dependencyAccesses=0;
 const repo={cleanup:async()=>{calls.push({step:'claim'});return rows;},cleaned:async ids=>{calls.push({step:'cleaned',ids});}};
 const storage={remove:async paths=>{calls.push({step:'remove',paths});if(removeError)throw removeError;}};
 const deps={cronSecret:secret,get repo(){dependencyAccesses++;return repo;},get storage(){dependencyAccesses++;return storage;},authenticate:async()=>{calls.push({step:'staff_auth'});throw new ApiError(401,'invalid_token','Isolated staff refusal');}};
 const server=createServer(createHandler(deps));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {calls,get dependencyAccesses(){return dependencyAccesses;},async request({path='/api/internal/uploads/cleanup',method='GET',headers={}}={}){
  const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers});const text=await response.text();const body=text?JSON.parse(text):null;
  assert.match(response.headers.get('cache-control'),/private/);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok(!text.includes(isolatedSecret));
  return {status:response.status,body,allow:response.headers.get('allow')};
 },close:()=>new Promise(resolve=>server.close(resolve))};
}
test('empty or short cron configuration fails closed before repository/storage access',async()=>{
 for(const secret of ['', 'x'.repeat(31)]){const h=await harness({secret});try{const r=await h.request();assert.equal(r.status,503);assert.equal(r.body.code,'cron_configuration_required');assert.equal(h.dependencyAccesses,0);assert.deepEqual(h.calls,[]);}finally{await h.close();}}
});
test('cron rejects wrong equal-length tokens, spoofed Vercel headers, query tokens and gateway rewrites before dependencies',async()=>{
 const h=await harness();try{
  const cases=[{}, {headers:{Authorization:'Bearer wrong'}}, {headers:{Authorization:'Bearer '+isolatedSecret.slice(0,-1)+'x'}}, {headers:{Authorization:'Basic '+isolatedSecret}}, {headers:{Authorization:'Bearer '+isolatedSecret+' trailing'}},
   {headers:{'User-Agent':'vercel-cron/1.0','x-vercel-cron':'1','x-vercel-cron-schedule':'0 3 * * *'}},
   {path:'/api/internal/uploads/cleanup?secret='+isolatedSecret},
   {path:'/api/gateway?__wedding_route=internal/uploads/cleanup'},
   {path:'/api/gateway?__wedding_route=internal/uploads/cleanup',headers:{'User-Agent':'vercel-cron/1.0',Authorization:'Bearer staff-like-token-that-is-not-a-cron-secret'}}];
  for(const input of cases){const r=await h.request(input);assert.equal(r.status,401);assert.equal(r.body.code,'authentication_required');assert.equal(h.dependencyAccesses,0);assert.deepEqual(h.calls,[]);}
 }finally{await h.close();}
});
test('cron refuses HEAD, POST and OPTIONS even with a correct isolated credential',async()=>{
 const h=await harness();try{for(const method of ['HEAD','POST','OPTIONS']){const r=await h.request({method,headers:{Authorization:'Bearer '+isolatedSecret}});assert.equal(r.status,405);assert.equal(r.allow,'GET');assert.equal(h.dependencyAccesses,0);assert.deepEqual(h.calls,[]);}}finally{await h.close();}
});
test('authorized isolated cron removes only claimed paths and marks only those IDs after removal',async()=>{
 const rows=[{id:'isolated-1',storage_path:'albums/isolated/a.jpg'},{id:'isolated-2',storage_path:'albums/isolated/b.png'}];const h=await harness({rows});
 try{const r=await h.request({headers:{Authorization:'Bearer '+isolatedSecret}});assert.equal(r.status,200);assert.deepEqual(r.body,{ok:true,cleaned:2});assert.deepEqual(h.calls,[{step:'claim'},{step:'remove',paths:rows.map(x=>x.storage_path)},{step:'cleaned',ids:rows.map(x=>x.id)}]);}finally{await h.close();}
});
test('failed storage removal never marks cleanup complete and generic SDK errors remain redacted',async()=>{
 for(const removeError of [new ApiError(503,'cleanup_pending','Le nettoyage sera repris.'),new Error('private SDK details '+isolatedSecret)]){
  const h=await harness({rows:[{id:'isolated-1',storage_path:'albums/isolated/a.jpg'}],removeError});
  try{const r=await h.request({headers:{Authorization:'Bearer '+isolatedSecret}});assert.equal(r.status,removeError instanceof ApiError?503:500);assert.equal(r.body.code,removeError instanceof ApiError?'cleanup_pending':'internal_error');assert.deepEqual(h.calls.map(c=>c.step),['claim','remove']);}finally{await h.close();}
 }
});
