import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandler} from '../serverless/handler.mjs';
test('scheduled cleanup requires its separate server credential before accessing storage',async()=>{
 let calls=0;
 const secret='a-test-only-secret-of-at-least-32-characters';
 const server=createServer(createHandler({cronSecret:secret,repo:{cleanup:async()=>{calls++;return[];},cleaned:async()=>{}},storage:{remove:async()=>{}},authenticate:async()=>{throw Error('Not an admin route');}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/api/internal/uploads/cleanup';
 try{
  assert.equal((await fetch(url)).status,401);assert.equal(calls,0);
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer wrong'}})).status,401);assert.equal(calls,0);
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+secret}})).status,200);assert.equal(calls,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
