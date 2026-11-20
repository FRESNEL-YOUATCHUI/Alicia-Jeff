import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createHandler} from '../serverless/handler.mjs';
import {Repository,hashRef} from '../serverless/repository.mjs';
import {createRsvpRef,matchesRsvpRef} from '../shared/rsvp-reference.mjs';
import {database,clientFor} from './database.mjs';

test('public individual RSVP references and recovery, real isolated PostgreSQL; no cloud writes',async t=>{
 const {pg}=await database(),repo=new Repository(clientFor(pg));let sheets=0;
 const server=createServer(createHandler({repo,storage:{},officialList:{match(){sheets++;throw Error('RSVP must never read Sheets');}},rateSecret:'isolated-only'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const post=async(path,body)=>{const r=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
 const make=async(first_name,last_name)=>{const input={first_name,last_name};return{...input,client_ref:await createRsvpRef(input)};};
 const count=async()=>Number((await pg.query('select count(*) n from wedding_rsvps')).rows[0].n);
 try{
 let first,firstInput;
 await t.test('three people on one IP/device context receive distinct immutable tickets without Sheets',async()=>{
  const tickets=[];for(const first_name of ['Mamadou','Fatou','Ibrahima']){const input=await make(first_name,'Recette');const r=await post('/api/rsvp',input);assert.equal(r.status,200);tickets.push(r.body.ticket);if(!first){first=r.body.ticket;firstInput=input;}}
  assert.equal(new Set(tickets.map(t=>t.qr_token)).size,3);assert.equal(await count(),3);assert.equal(sheets,0);
  assert.deepEqual((await pg.query('select first_name from wedding_rsvps order by created_at')).rows.map(r=>r.first_name),['Mamadou','Fatou','Ibrahima']);
 });
 await t.test('homonyms create distinct RSVPs without merging or overwriting',async()=>{
  const a=await post('/api/rsvp',await make('Même','Nom')),b=await post('/api/rsvp',await make('Même','Nom'));
  assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.body.ticket.id,b.body.ticket.id);assert.notEqual(a.body.ticket.qr_token,b.body.ticket.qr_token);assert.equal(await count(),5);
 });
 await t.test('concurrent retries, reload/retry and double clicks keep one row and one ticket',async()=>{
  const before=await count(),input=await make('Retry','Recette');const responses=await Promise.all(Array.from({length:6},()=>post('/api/rsvp',input)));
  assert.ok(responses.every(r=>r.status===200));assert.equal(new Set(responses.map(r=>r.body.ticket.qr_token)).size,1);assert.equal(await count(),before+1);
  assert.deepEqual((await post('/api/rsvp',input)).body.ticket,responses[0].body.ticket);
 });
 await t.test('a substituted identity or message cannot race through the legacy upsert',async()=>{
  const input=await make('Identité','Immuable');const results=await Promise.all([post('/api/rsvp',input),post('/api/rsvp',{...input,first_name:'Autre'}),post('/api/rsvp',{...input,message:'Changed'})]);assert.deepEqual(results.map(r=>r.status),[200,409,409]);
  assert.equal((await pg.query('select first_name from wedding_rsvps where ref_hash=$1',[hashRef(input.client_ref)])).rows[0].first_name,'Identité');
  assert.equal(await matchesRsvpRef(input.client_ref,input),true);
 });
 await t.test('personal QR code and confirmation reference recover exactly the same ticket without writes or Sheets',async()=>{
  const before=(await pg.query('select jsonb_agg(to_jsonb(r) order by id) v from wedding_rsvps r')).rows[0].v;
  for(const body of [{qr_token:first.qr_token},{client_ref:firstInput.client_ref}]){const r=await post('/api/rsvp/ticket',body);assert.equal(r.status,200);assert.deepEqual(r.body.ticket,first);}
  assert.deepEqual((await pg.query('select jsonb_agg(to_jsonb(r) order by id) v from wedding_rsvps r')).rows[0].v,before);assert.equal(sheets,0);
  assert.equal((await post('/api/rsvp/ticket',{qr_token:'x'.repeat(43)})).status,404);assert.equal((await post('/api/rsvp/ticket',{qr_token:first.qr_token,client_ref:firstInput.client_ref})).status,400);
 });
 await t.test('legacy browser reference still recovers its owner, never overwrites it for the next person',async()=>{
  const ref=randomUUID();const old=(await repo.rpc('rsvp',{p_input:{first_name:'Ancien',last_name:'Invité',participants:1,ref_hash:hashRef(ref)}})).ticket;
  const recovered=await post('/api/rsvp/ticket',{client_ref:ref});assert.equal(recovered.body.ticket.id,old.id);
  assert.equal((await post('/api/rsvp',{first_name:'Ancien',last_name:'Invité',client_ref:ref})).status,200);
  const denied=await post('/api/rsvp',{first_name:'Nouvelle',last_name:'Personne',client_ref:ref});assert.equal(denied.status,409);assert.equal(denied.body.code,'rsvp_reference_mismatch');
  const other=await post('/api/rsvp',await make('Nouvelle','Personne'));assert.equal(other.status,200);assert.notEqual(other.body.ticket.id,old.id);
  assert.equal((await post('/api/rsvp/ticket',{qr_token:old.id})).body.ticket.id,old.id);
  assert.equal((await post('/api/rsvp',{first_name:'Obsolète',last_name:'Formulaire',client_ref:randomUUID()})).body.code,'fresh_confirmation_required');
 });
 await t.test('reconfirmation after admission does not mutate RSVP version or invalidate existing QR',async()=>{
  const guest=await repo.lookupTicket(first.qr_token);assert.equal((await repo.enterTicket(first.qr_token,guest.updated_at,'mamadou recette')).status,'valid');
  const before=await repo.lookupTicket(first.qr_token);assert.equal((await post('/api/rsvp',firstInput)).body.ticket.qr_token,first.qr_token);assert.deepEqual(await repo.lookupTicket(first.qr_token),before);
  assert.deepEqual((await post('/api/rsvp/ticket',{qr_token:first.qr_token})).body.ticket,first);
 });
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();}
});
