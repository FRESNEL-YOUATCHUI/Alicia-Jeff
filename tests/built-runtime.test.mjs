import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {startBuiltApp} from '../scripts/serve-built.mjs';
test('built start and preview serve real gateway routes, private paths and media ranges',async()=>{
 await fs.mkdir('.qa-artifacts',{recursive:true});
 const root=await fs.mkdtemp(path.resolve('.qa-artifacts/built-runtime-'));
 await fs.writeFile(path.join(root,'index.html'),'<!doctype html><title>Isolated static fixture</title>');
 await fs.writeFile(path.join(root,'music.mp4'),Buffer.from([0,1,2,3,4,5]));
 const app=await startBuiltApp({port:0,root,logger:{info(){}}});
 try{
  const home=await fetch(app.url);assert.equal(home.status,200);assert.equal(home.headers.get('cache-control'),'no-cache');
  const health=await(await fetch(app.url+'/api/health')).json();
  assert.equal(health.release,'rsvp-qr-20261119');assert.equal(health.individual_rsvp,true);
  assert.equal((await fetch(app.url+'/api/admin/state')).status,401);
  assert.equal((await fetch(app.url+'/api/gateway?__wedding_route=health')).status,200);
  assert.equal((await fetch(app.url+'/api/missing')).status,404);
  for(const file of ['/.env.local','/.qa-artifacts/private.json','/serverless/handler.mjs','/docs/private','/tests/browser-fixture.mjs'])assert.equal((await fetch(app.url+file)).status,404);
  assert.equal((await fetch(app.url,{method:'POST'})).status,405);
  const media=await fetch(app.url+'/music.mp4',{headers:{Range:'bytes=1-3'}});
  assert.equal(media.status,206);assert.deepEqual(Buffer.from(await media.arrayBuffer()),Buffer.from([1,2,3]));
  assert.equal((await fetch(app.url+'/music.mp4',{headers:{Range:'bytes=99-100'}})).status,416);
  assert.equal((await fetch(app.url+'/music.mp4',{method:'HEAD'})).headers.get('content-length'),'6');
 }finally{await app.close();}
});
