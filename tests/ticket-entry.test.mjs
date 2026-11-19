import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer,get} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {createHandler} from '../serverless/handler.mjs';
import {Repository} from '../serverless/repository.mjs';
import {OfficialList,matchOfficialRows,normalizeGuestName,officialNames,inspectOfficialRows} from '../serverless/official-list.mjs';
import {ApiError} from '../serverless/http.mjs';
import {scanChallenge,requireScanProof} from '../serverless/ticket-page.mjs';
import {database,clientFor} from './database.mjs';
test('admission HTTP + real isolated PostgreSQL, no hosted data',async t=>{
 const {pg}=await database(),repo=new Repository(clientFor(pg));
 let rows=[['  ÉLODIE   NDIAYE  ']],down=false,reads=0,databaseDown=false;
 const lookup=repo.lookupTicket.bind(repo);repo.lookupTicket=token=>{if(databaseDown)throw new ApiError(503,'database_unavailable','Unavailable');return lookup(token);};
 const officialList={async match(guest){
  reads++;if(down)throw new ApiError(503,'official_list_unavailable','Unavailable');
  const name=normalizeGuestName(guest.first_name+' '+guest.last_name);
  return {name,status:matchOfficialRows(rows,name)};
 }};
 const server=createServer(createHandler({repo,storage:{},officialList,rateSecret:'isolated-tests-only'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const post=async(path,body,headers={})=>{
  const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Sec-Fetch-Site':'same-origin',...headers},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
 };
 const confirm=async(first,last,ref=randomUUID())=>(await post('/api/rsvp',{first_name:first,last_name:last,client_ref:ref})).body;
 const open=async(token,headers={})=>{
  const response=await new Promise((resolve,reject)=>{
   get(origin+'/api/tickets/open?token='+token,{headers:{'Sec-Fetch-User':'?1','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document',...headers}},res=>{
    let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({
     status:res.statusCode,text:async()=>text,headers:new Headers(Object.entries(res.headers).flatMap(([key,value])=>Array.isArray(value)?value.map(v=>[key,v]):[[key,value]]))
    }));
   }).on('error',reject);
  });
  const html=await response.text(),match=html.match(/const input=(.*);/);
  return {status:response.status,html,input:match?JSON.parse(match[1]):null,cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
 };
 const scan=async ticket=>{
  const opened=await open(ticket.qr_token);
  return post('/api/tickets/verify',{token:ticket.qr_token,proof:opened.input.proof},{Cookie:opened.cookie});
 };
 try{
 let known,absent;
 await t.test('both recognized and absent guests confirm without consulting the official list',async()=>{
  const ref=randomUUID();known=(await confirm('Élodie','Ndiaye',ref)).ticket;
  absent=(await confirm('Autre','Invité')).ticket;
  assert.equal(reads,0);assert.equal(known.qr_version,2);assert.match(known.qr_token,/^[A-Za-z0-9_-]{43}$/);
  const duplicate=await confirm('Élodie','Ndiaye',ref);assert.deepEqual(duplicate.ticket,known);
  const restored=await post('/api/rsvp/ticket',{client_ref:ref});assert.deepEqual(restored.body.ticket,known);
  assert.equal((await pg.query('select count(*)::int n from wedding_rsvps')).rows[0].n,2);
 });
 await t.test('GET, HEAD, link previews and forged/cross-origin/missing proofs cannot consume tickets',async()=>{
  const opened=await open(known.qr_token);assert.equal(opened.status,200);
  assert.equal(opened.input.automatic,true);assert.match(opened.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.match(opened.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  for(const headers of [{'Sec-Purpose':'prefetch'},{Purpose:'prefetch'},{'User-Agent':'WhatsApp/2'},{'User-Agent':'Googlebot'}]){
   const preview=await open(known.qr_token,headers);assert.equal(preview.input.proof,undefined);assert.equal(preview.input.automatic,false);
  }
  assert.equal((await fetch(origin+'/api/tickets/open?token='+known.qr_token,{method:'HEAD'})).status,405);
  assert.equal((await post('/api/tickets/verify',{token:known.qr_token})).status,403);
  assert.equal((await post('/api/tickets/verify',{token:known.qr_token,proof:opened.input.proof},{Cookie:opened.cookie,Origin:'https://evil.invalid'})).status,403);
  assert.equal((await post('/api/tickets/verify',{token:known.qr_token,proof:opened.input.proof+'x'},{Cookie:opened.cookie})).status,403);
  const nonUser=await open(known.qr_token,{'Sec-Fetch-User':'?0'});assert.equal(nonUser.input.automatic,false);
  assert.equal((await repo.lookupTicket(known.qr_token)).checked_in_at,null);
 });
 await t.test('recognized guest gets one valid entry; next scan is already used',async()=>{
  assert.equal((await scan(known)).body.status,'valid');
  assert.equal((await scan(known)).body.status,'used');
  assert.ok((await repo.lookupTicket(known.qr_token)).checked_in_at);
 });
 await t.test('absent guest is not consumed and a later list addition is recognized',async()=>{
  assert.equal((await scan(absent)).body.status,'absent');
  assert.equal((await repo.lookupTicket(absent.qr_token)).checked_in_at,null);
  rows.push(['Autre Invité']);assert.equal((await scan(absent)).body.status,'valid');
 });
 await t.test('unknown/forged ID never calls Sheets and is never admitted',async()=>{
  const before=reads;const result=await scan({qr_token:randomBytes(32).toString('base64url')});
  assert.equal(result.body.status,'unknown');assert.equal(result.body.admitted,false);assert.equal(reads,before);
  assert.equal((await post('/api/tickets/verify',{token:'invalid'})).body.status,'unknown');
 });
 await t.test('two concurrent scans authorize exactly one first entry',async()=>{
  rows.push(['Scan Simultané']);const ticket=(await confirm('Scan','Simultané')).ticket,opened=await open(ticket.qr_token);
  const scanOnce=()=>post('/api/tickets/verify',{token:ticket.qr_token,proof:opened.input.proof},{Cookie:opened.cookie});
  const results=await Promise.all([scanOnce(),scanOnce()]);
  assert.deepEqual(results.map(x=>x.body.status).sort(),['used','valid']);
 });
 await t.test('same official person cannot enter twice through two different RSVP references',async()=>{
  const another=(await confirm('Élodie','Ndiaye')).ticket;
  const result=await scan(another);assert.equal(result.body.status,'used');
  assert.equal((await repo.lookupTicket(another.qr_token)).checked_in_at,null);
 });
 await t.test('homonyms duplicated in Sheets fail closed without consuming the ticket',async()=>{
  rows.push(['Nom Identique'],['NOM   IDENTIQUE']);const ticket=(await confirm('Nom','Identique')).ticket;
  const result=await scan(ticket);assert.equal(result.body.status,'error');assert.equal(result.body.reason,'ambiguous_name');
  assert.equal((await repo.lookupTicket(ticket.qr_token)).checked_in_at,null);
 });
 await t.test('Sheets downtime and database error never authorize entry; RSVP still works without Sheets',async()=>{
  down=true;const ticket=(await confirm('Liste','Indisponible')).ticket;
  const result=await scan(ticket);assert.equal(result.status,503);
  assert.equal(result.body.code,'official_list_unavailable');assert.equal(result.body.admitted,false);assert.equal(result.body.label,'ERREUR DE VÉRIFICATION');assert.equal((await repo.lookupTicket(ticket.qr_token)).checked_in_at,null);
  down=false;databaseDown=true;assert.equal((await scan(ticket)).body.code,'database_unavailable');databaseDown=false;rows.push(['Liste Indisponible']);assert.equal((await scan(ticket)).body.status,'valid');
 });
 await t.test('database outage on landing returns a minimal error page and never a valid proof',async()=>{
  const rate=repo.rate.bind(repo);repo.rate=async()=>{throw new ApiError(503,'database_unavailable','Unavailable');};
  try{const opened=await open(known.qr_token);assert.equal(opened.status,503);assert.equal(opened.input.failed,true);assert.equal(opened.input.proof,undefined);}
  finally{repo.rate=rate;}
 });
 await t.test('name edit during verification is detected atomically and admitted names cannot be replaced',async()=>{
  const ref=randomUUID(),ticket=(await confirm('Identité','Avant',ref)).ticket;
  const before=await repo.lookupTicket(ticket.qr_token);await confirm('Identité','Après',ref);
  const raced=await repo.enterTicket(ticket.qr_token,before.updated_at,'identite avant');
  assert.equal(raced.status,'changed');assert.equal((await repo.lookupTicket(ticket.qr_token)).checked_in_at,null);
  rows.push(['Identité Après']);assert.equal((await scan(ticket)).body.status,'valid');
  const edit=await post('/api/rsvp',{first_name:'Identité',last_name:'Autre',client_ref:ref});
  assert.equal(edit.status,409);
 });
 await t.test('migration is repeatable, preserves all business rows, and rejects direct browser access',async()=>{
  const before=(await pg.query('select jsonb_agg(to_jsonb(r) order by id) v from wedding_rsvps r')).rows[0].v;
  await pg.exec(await fs.readFile(new URL('../supabase/migrations/004_ticket_entry.sql',import.meta.url),'utf8'));
  assert.deepEqual((await pg.query('select jsonb_agg(to_jsonb(r) order by id) v from wedding_rsvps r')).rows[0].v,before);
  for(const role of ['anon','authenticated']){
   await pg.exec('set role '+role);
   await assert.rejects(pg.query('select * from public.wedding_ticket_entries'),/permission denied/);
   await assert.rejects(pg.query('select public.wedding_api_ticket_lookup($1)',[known.qr_token]),/permission denied/);
   await pg.exec('reset role');
  }
  const auditResults=await pg.exec(await fs.readFile(new URL('../supabase/activation/inspect-ticket-entry-readonly.sql',import.meta.url),'utf8'));
  const audit=auditResults.find(result=>result.rows?.[0]?.ticket_entry_audit)?.rows[0].ticket_entry_audit;
  assert.equal(audit.ticket_functions.length,4);assert.equal(audit.ticket_table.rls,true);
  assert.equal(audit.ticket_table.anon_direct_select,false);assert.equal(audit.ticket_table.policies,0);
  const metadata=(await pg.query("select p.prosecdef,p.proconfig from pg_proc p where p.proname in ('wedding_api_confirm','wedding_api_ticket_restore','wedding_api_ticket_lookup','wedding_api_ticket_enter')")).rows;
  assert.equal(metadata.length,4);assert.ok(metadata.every(p=>!p.prosecdef&&p.proconfig.includes('search_path=pg_catalog, pg_temp')));
 });
 await t.test('disabling rollback preserves confirmations and all admitted entries',async()=>{
  const count=(await pg.query('select count(*)::int n from wedding_ticket_entries where checked_in_at is not null')).rows[0].n;
  await pg.exec(await fs.readFile(new URL('../supabase/activation/rollback-ticket-entry.sql',import.meta.url),'utf8'));
  await pg.exec('set role service_role');await assert.rejects(pg.query('select public.wedding_api_ticket_lookup($1)',[known.qr_token]),/permission denied/);await pg.exec('reset role');
  assert.equal((await pg.query('select count(*)::int n from wedding_ticket_entries where checked_in_at is not null')).rows[0].n,count);
 });
 }finally{await new Promise(resolve=>server.close(resolve));await pg.close();}
});
test('private Google Sheets reader: exact normalization, no fuzzy or reordered matching, no stale cache',async()=>{
 const env={GUEST_NAME_ORDER:'first_last',GOOGLE_SHEETS_SPREADSHEET_ID:'test-only-sheet-1234567890',GOOGLE_SHEETS_RANGE:"'Invités'!A2:A10001",GOOGLE_SERVICE_ACCOUNT_EMAIL:'test@example.invalid',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'not-a-real-key'};
 let calls=0,status=200,rows=[['Élodie Ndiaye']],headersSeen;
 const list=new OfficialList({env,authFactory:()=>({getRequestHeaders:async()=>new Headers({Authorization:'Bearer isolated-test'})}),
  fetchImpl:async(url,options)=>{assert.ok(url.startsWith('https://sheets.googleapis.com/'));headersSeen=options.headers;calls++;return new Response(JSON.stringify({values:rows}),{status});}});
 const guest={first_name:'Elodie',last_name:'Ndiaye'};
 assert.equal((await list.match(guest)).status,'recognized');assert.equal(headersSeen.get('Authorization'),'Bearer isolated-test');
 rows=[['Élodie NdiayéX']];assert.equal((await list.match(guest)).status,'absent');
 rows=[['Ndiaye Elodie']];assert.equal((await list.match(guest)).status,'absent');
 rows=[['Elodie Ndiaye'],['ÉLODIE   NDIAYE']];assert.equal((await list.match(guest)).status,'ambiguous');
 status=503;await assert.rejects(list.match(guest),e=>e.code==='official_list_unavailable');assert.equal(calls,5);
 assert.equal(normalizeGuestName('  ÉLODIE\u00a0  NDIAYE '),'elodie ndiaye');
 await assert.rejects(new OfficialList({env:{}}).match(guest),e=>e.code==='official_list_unavailable');
 assert.throws(()=>matchOfficialRows([['Name','extra-column']],'name'),e=>e.code==='official_list_unavailable');
});

test('navigation proof expiry, cookie binding and ticket substitution fail closed',()=>{
 const secret='isolated-only-secret',token='A'.repeat(43),now=Date.now(),proof=scanChallenge(token,secret,now);
 const request={headers:{origin:'https://wedding.example','sec-fetch-site':'same-origin',cookie:'aj_ticket_scan='+proof.nonce}};
 assert.doesNotThrow(()=>requireScanProof(request,{token,proof:proof.proof},secret,now));
 assert.throws(()=>requireScanProof(request,{token,proof:proof.proof},secret,now+90001),e=>e.status===403);
 assert.throws(()=>requireScanProof(request,{token:'B'.repeat(43),proof:proof.proof},secret,now),e=>e.status===403);
 assert.throws(()=>requireScanProof({...request,headers:{...request.headers,cookie:'aj_ticket_scan=wrong'}},{token,proof:proof.proof},secret,now),e=>e.status===403);
});
test('pre-activation compatibility stores real RSVP through the original RPC; other database errors do not fall back',async()=>{
 let calls=[];const legacy={ticket:{id:'existing'},message_published:false};
 const client={rpc:async(name)=>{calls.push(name);return name==='wedding_api_confirm'?{data:null,error:{code:'PGRST202'}}:{data:legacy,error:null};}};
 const result=await new Repository(client).rsvp({client_ref:randomUUID(),first_name:'Test',last_name:'Legacy',participants:1});
 assert.deepEqual(result,{...legacy,entry_verification_ready:false});assert.deepEqual(calls,['wedding_api_confirm','wedding_api_rsvp']);
 calls=[];client.rpc=async(name)=>{calls.push(name);return{data:null,error:{code:'42703'}};};
 await assert.rejects(new Repository(client).rsvp({client_ref:randomUUID()}),e=>e.code==='schema_required');
 assert.deepEqual(calls,['wedding_api_confirm']);
});

test('mixed name order compares two exact forms and rejects reversed-name ambiguity',()=>{
 const names=officialNames({first_name:'Jean Pierre',last_name:'Ndiaye'});
 assert.equal(inspectOfficialRows([['Ndiaye Jean Pierre']],names).status,'recognized');
 assert.equal(inspectOfficialRows([['Jean Pierre Ndiaye']],names).status,'recognized');
 assert.equal(inspectOfficialRows([['Jean Ndiaye Pierre']],names).status,'absent');
 assert.equal(inspectOfficialRows([['Jean Pierre Ndiaye'],['Ndiaye Jean Pierre']],names).status,'ambiguous');
 assert.equal(inspectOfficialRows([['Ndiaye Jean Pierre'],['NDIAYE JEAN PIERRE']],names).status,'ambiguous');
 assert.equal(inspectOfficialRows([['Pierre Pierre']],officialNames({first_name:'Pierre',last_name:'Pierre'})).status,'recognized');
});

test('Google Sheets provider defaults to mixed order and returns the exact matched roster key',async()=>{
 const env={GOOGLE_SHEETS_SPREADSHEET_ID:'test-only-sheet-1234567890',GOOGLE_SHEETS_RANGE:"'Invités'!A2:A10001",GOOGLE_SERVICE_ACCOUNT_EMAIL:'test@example.invalid',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'not-a-real-key'};
 const list=new OfficialList({env,authFactory:()=>({getRequestHeaders:async()=>new Headers()}),fetchImpl:async()=>new Response(JSON.stringify({values:[['NDIAYE Élodie']]}))});
 assert.deepEqual(await list.match({first_name:'Elodie',last_name:'Ndiaye'}),{status:'recognized',name:'ndiaye elodie'});
});
