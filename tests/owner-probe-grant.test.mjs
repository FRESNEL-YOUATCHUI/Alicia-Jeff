import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mintOwnerProbeGrant,checkOwnerProbeGrant} from '../serverless/owner-probe-grant.mjs';
import {createHandler} from '../serverless/handler.mjs';
import {requireStaff} from '../serverless/supabase.mjs';
const key='isolated-owner-capability-signing-secret-long-enough',id='20000000-0000-4000-8000-000000000001';
const req=grant=>({headers:{'x-aj-owner-probe':grant}}),staff={id,role:'photographer'};
test('owner capability is short lived, subject bound, scoped and never contains a raw personal ID',()=>{
 const now=Date.now(),grant=mintOwnerProbeGrant(id,key,{now});
 assert.equal(checkOwnerProbeGrant(req(grant.grant),staff,key,now).audit_id,grant.audit_id);
 assert.equal(JSON.stringify(JSON.parse(Buffer.from(grant.grant.split('.')[0],'base64url'))).includes(id),false);
 assert.equal(checkOwnerProbeGrant(req(grant.grant),staff,key,now+600000),null);
 assert.equal(checkOwnerProbeGrant(req(grant.grant),{id:'20000000-0000-4000-8000-000000000002'},key,now),null);
 assert.equal(checkOwnerProbeGrant(req(grant.grant+'x'),staff,key,now),null);
 assert.equal(checkOwnerProbeGrant(req(grant.grant),staff,'wrong-but-long-enough-test-key-11111',now),null);
 assert.throws(()=>mintOwnerProbeGrant(id,key,{minutes:16}));assert.throws(()=>mintOwnerProbeGrant(id,'sb_publishable_not-a-secret-key-111111'));
});
test('owner delegation unlocks only the Google probe for an authenticated matching staff account and is traced without tokens',async()=>{
 let calls=0;const audit=[];
 const client={auth:{async getUser(token){return token==='fixture-owner'?{data:{user:{id}},error:null}:{data:{user:null},error:{status:401}};}},from(table){assert.equal(table,'wedding_staff');return{select(){return{eq(){return{async maybeSingle(){return{data:{role:'photographer'},error:null};}};}};}};}};
 const server=createServer(createHandler({repo:{},storage:{},rateSecret:key,authenticate:r=>requireStaff(r,client),audit:e=>audit.push(e),googleSheetsReadiness:async()=>{calls++;return{status:200,body:{ready:true,sheets_readable:true}};}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,grant=mintOwnerProbeGrant(id,key);
 const call=(headers,path='/api/admin/google-sheets-readiness')=>fetch(base+path,{headers});
 try{
  assert.equal((await call({'X-AJ-Owner-Probe':grant.grant})).status,401);
  assert.equal((await call({Authorization:'Bearer fixture-owner'})).status,403);
  assert.equal(calls,0);
  const response=await call({Authorization:'Bearer fixture-owner','X-AJ-Owner-Probe':grant.grant});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ready:true,sheets_readable:true});assert.equal(calls,1);
  assert.equal(audit.length,1);assert.deepEqual(Object.keys(audit[0]).sort(),['at','audit_id','event','status']);assert.equal(audit[0].audit_id,grant.audit_id);assert.equal(JSON.stringify(audit).includes(grant.grant),false);assert.equal(JSON.stringify(audit).includes(id),false);
  const expired=mintOwnerProbeGrant(id,key,{now:Date.now()-700000});assert.equal((await call({Authorization:'Bearer fixture-owner','X-AJ-Owner-Probe':expired.grant})).status,403);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
