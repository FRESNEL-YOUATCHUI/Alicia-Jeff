import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {createHandler} from '../serverless/handler.mjs';
import {Repository,hashRef} from '../serverless/repository.mjs';
import {requireStaff} from '../serverless/supabase.mjs';
import {ApiError} from '../serverless/http.mjs';
import {database,clientFor,ALBUM,STAFF} from './database.mjs';

test('Serverless API + isolated PostgreSQL transactions (not hosted Supabase)',async t=>{
 const {pg,sql}=await database(),client=clientFor(pg),repo=new Repository(client);
 const objects=new Map();
 const storage={
  async sign(rows){return rows.map(({storage_path:_storagePath,...p})=>({...p,url:'https://storage.invalid/signed/'+p.id,expires_at:new Date(Date.now()+600000).toISOString()}));},
  async uploadToken(u){return{bucket:'wedding-photos',path:u.storage_path,token:'test-only'};},
  async verify(u){const object=objects.get(u.id);if(!object)throw new ApiError(409,'upload_incomplete','Incomplete');if(object==='bad')throw new ApiError(415,'invalid_photo','Invalid');},
  async remove(paths){for(const [key,value]of objects)if(paths.includes(value?.path))objects.delete(key);}
 };
 const server=createServer(createHandler({repo,storage,authenticate:req=>requireStaff(req,client),rateSecret:'isolated-test-only'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const call=async(path,{method='GET',body,token,headers={}}={})=>{
  const response=await fetch(origin+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return{status:response.status,headers:response.headers,body:await response.json()};
 };
 const json=body=>({method:'POST',body});
 try{
 await t.test('idempotent DDL preserves existing album IDs and data',async()=>{
  await pg.exec(sql);
  assert.equal((await pg.query('select count(*)::int n from wedding_albums')).rows[0].n,3);
  assert.equal((await pg.query('select title from wedding_albums where id=$1',[ALBUM])).rows[0].title,'Cérémonie civile');
 });
 await t.test('health / rewrite routing / API 404 remains JSON',async()=>{
  assert.equal((await call('/api/health')).body.backend,'supabase-serverless');
  assert.equal((await call('/api/gateway?__wedding_route=health')).status,200);
  const result=await call('/api/missing');assert.equal(result.status,404);assert.match(result.headers.get('content-type'),/json/);
 });
 await t.test('anonymous, invalid token, connected user without role, valid photographer',async()=>{
  assert.equal((await call('/api/admin/state')).status,401);
  assert.equal((await call('/api/admin/state',{token:'invalid'})).status,401);
  assert.equal((await call('/api/admin/state',{token:'no-role'})).status,403);
  assert.equal((await call('/api/admin/state',{token:'valid'})).body.albums.length,3);
  assert.equal((await call('/api/admin/uploads/cleanup',{...json({}),token:'no-role'})).status,403);
 });
 let ticket;
 const ref=randomUUID(),input={first_name:'Jean Pierre',last_name:'Ndiaye Diop',song:'Une chanson',message:'Tous nos vœux',client_ref:ref};
 await t.test('RSVP validates input and rejects cross-origin / oversized forms',async()=>{
  assert.equal((await call('/api/rsvp',json({...input,participants:0}))).status,400);
  assert.equal((await call('/api/rsvp',json({...input,website:'spam'}))).status,400);
  assert.equal((await call('/api/rsvp',{...json(input),headers:{Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await call('/api/rsvp',json({...input,message:'x'.repeat(20000)}))).status,413);
 });
 await t.test('valid RSVP retains ticket/QR contract and concurrent retries use one UUID',async()=>{
  const results=await Promise.all(Array.from({length:4},()=>call('/api/rsvp',json(input))));
  assert.ok(results.every(r=>r.status===200));ticket=results[0].body.ticket;
  assert.ok(results.every(r=>r.body.ticket.qr_token===ticket.qr_token));
  assert.equal(ticket.ticket_number,'AJ-'+ticket.id.slice(0,8).toUpperCase());
  assert.equal(ticket.guest_first_name,'Jean Pierre');assert.equal(ticket.allowed_persons,1);assert.match(ticket.qr_token,/^[A-Za-z0-9_-]{43}$/);
  assert.equal((await pg.query('select count(*)::int n from wedding_rsvps')).rows[0].n,1);
  assert.equal((await pg.query('select count(*)::int n from wedding_messages')).rows[0].n,1);
 });
 await t.test('RSVP update preserves ID, creation date and moderation',async()=>{
  await pg.query('update wedding_messages set hidden=true');
  const result=await call('/api/rsvp',json({...input,song:'Chanson modifiée'}));
  assert.equal(result.body.ticket.id,ticket.id);assert.equal(result.body.ticket.created_at,ticket.created_at);
  assert.equal(result.body.message_published,false);
 });
 const messageRef=randomUUID();let message;
 await t.test('guestbook text is data, idempotent, and public API leaks no RSVP/hash fields',async()=>{
  const body={author:'Camille',body:'<script>alert(1)</script>',client_ref:messageRef};
  const result=await call('/api/messages',json(body));assert.equal(result.status,201);message=result.body;
  const second=await call('/api/messages',json(body));assert.equal(second.body.id,message.id);
  const publicState=await call('/api/souvenirs');
  assert.equal(publicState.body.messages[0].body,body.body);
  const serialized=JSON.stringify(publicState.body);
  for(const value of ['ref_hash','first_name','participants','row_id'])assert.equal(serialized.includes(value),false);
  assert.equal((await call('/api/rsvps')).status,404);
 });
 await t.test('message moderation hides and restores without leaking hidden rows',async()=>{
  const patch=hidden=>call('/api/admin/messages/'+message.id,{method:'PATCH',token:'valid',body:{hidden}});
  assert.equal((await patch(true)).status,200);assert.equal((await call('/api/messages')).body.messages.length,0);
  assert.equal((await patch(false)).status,200);assert.equal((await call('/api/messages')).body.messages.length,1);
 });
 await t.test('albums create/rename/archive/restore and nonexistent album returns 404',async()=>{
  const created=await call('/api/admin/albums',{...json({title:'Les mariés'}),token:'valid'});assert.equal(created.status,201);
  const path='/api/admin/albums/'+created.body.id;
  assert.equal((await call(path,{method:'PATCH',token:'valid',body:{title:'Portraits',hidden:true}})).status,200);
  assert.equal((await call(path,{method:'PATCH',token:'valid',body:{hidden:false,published:true}})).status,200);
  assert.equal((await call('/api/admin/albums/'+randomUUID(),{method:'PATCH',token:'valid',body:{published:true}})).status,404);
 });
 const upload={album_id:ALBUM,client_ref:randomUUID(),filename:'souvenir.png',content_type:'image/png',size:128};
 const authorize=body=>call('/api/admin/uploads/authorize',{...json(body),token:'valid'});
 let intent;
 await t.test('upload denies oversized/type/path/missing or archived album',async()=>{
  assert.equal((await authorize({...upload,size:20971521})).status,413);
  assert.equal((await authorize({...upload,content_type:'image/svg+xml'})).status,415);
  assert.equal((await authorize({...upload,filename:'../evil.png'})).status,400);
  assert.equal((await authorize({...upload,album_id:randomUUID()})).status,404);
  await pg.query('update wedding_albums set hidden=true where id=$1',[ALBUM]);
  assert.equal((await authorize(upload)).status,404);
  await pg.query('update wedding_albums set hidden=false where id=$1',[ALBUM]);
 });
 await t.test('signed authorization uses generated path; repeated authorization has one intent',async()=>{
  intent=(await authorize(upload)).body;assert.ok(intent.path.startsWith('albums/'+ALBUM+'/'));
  assert.equal(intent.path.includes('souvenir'),false);
  const again=await authorize(upload);assert.equal(again.body.id,intent.id);
  assert.equal((await authorize({...upload,size:129})).status,409);
 });
 const finalize=id=>call('/api/admin/uploads/'+id+'/finalize',{...json({}),token:'valid'});
 await t.test('interrupted upload is retryable, finalization is atomic and idempotent',async()=>{
  assert.equal((await finalize(intent.id)).status,409);
  objects.set(intent.id,{path:intent.path});
  const result=await finalize(intent.id);assert.equal(result.status,200);assert.equal(result.body.photo_id,intent.id);
  assert.equal((await finalize(intent.id)).body.photo_id,intent.id);
  assert.equal((await pg.query('select count(*)::int n from wedding_photos')).rows[0].n,1);
  assert.equal((await authorize(upload)).body.status,'complete');
 });
 await t.test('invalid stored file is cancelled; no photo metadata is committed',async()=>{
  const bad=(await authorize({...upload,client_ref:randomUUID()})).body;objects.set(bad.id,'bad');
  assert.equal((await finalize(bad.id)).status,415);
  assert.equal((await pg.query('select status from wedding_api_uploads where id=$1',[bad.id])).rows[0].status,'cancelled');
  assert.equal((await pg.query('select count(*)::int n from wedding_photos')).rows[0].n,1);
 });
 await t.test('publication/date/hidden filters protect list AND individual photo',async()=>{
  const path='/api/photos?album='+ALBUM;
  assert.equal((await call(path)).status,404);
  await pg.query('update wedding_settings set gallery_published=true');await pg.query('update wedding_albums set published=true where id=$1',[ALBUM]);
  assert.equal((await call(path)).status,404);
  await pg.query("update wedding_settings set release_at=now()-interval '1 minute'");
  assert.equal((await call(path)).body.photos.length,1);
  await pg.query('update wedding_photos set hidden=true');
  assert.equal((await call(path)).body.photos.length,0);
  assert.equal((await call('/api/photos/'+intent.id)).status,404);
  await pg.query('update wedding_photos set hidden=false');await pg.query('update wedding_albums set hidden=true where id=$1',[ALBUM]);
  assert.equal((await call(path)).status,404);
  await pg.query('update wedding_albums set hidden=false where id=$1',[ALBUM]);
  await pg.query('update wedding_settings set gallery_published=false');
  assert.deepEqual((await call('/api/souvenirs')).body.albums,[]);
 });
 await t.test('upload concurrency capped and abandoned tokens cleaned only after expiry',async()=>{
  for(let i=0;i<5;i++)assert.equal((await authorize({...upload,client_ref:randomUUID()})).status,200);
  assert.equal((await authorize({...upload,client_ref:randomUUID()})).status,429);
  const clean=()=>call('/api/admin/uploads/cleanup',{...json({}),token:'valid'});
  assert.equal((await clean()).body.cleaned,0);
  await pg.exec("update wedding_api_uploads set cleanup_after=now()-interval '1 minute',expires_at=now()-interval '2 hours' where status<>'complete'");
  assert.ok((await clean()).body.cleaned>=5);
  assert.equal((await pg.query("select count(*)::int n from wedding_api_uploads where status='complete'")).rows[0].n,1);
 });
 await t.test('pagination returns 60/50 rows with correct has_more',async()=>{
  await pg.query('update wedding_settings set gallery_published=true');
  await pg.exec("insert into wedding_photos select gen_random_uuid(),'"+ALBUM+"','fixture/'||n,'Photo',false,now() from generate_series(1,65) n");
  const first=await call('/api/photos?album='+ALBUM);assert.equal(first.body.photos.length,60);assert.equal(first.body.has_more,true);
  const second=await call('/api/photos?album='+ALBUM+'&offset=60');assert.equal(second.body.photos.length,6);assert.equal(second.body.has_more,false);
  await pg.exec("insert into wedding_messages(id,author,body,hidden,created_at) select gen_random_uuid(),'Test','Souvenir',false,now() from generate_series(1,55)");
  assert.equal((await call('/api/messages')).body.messages.length,50);
  assert.equal((await call('/api/admin/messages?offset=50',{token:'valid'})).body.has_more,false);
 });
 await t.test('persistent limits cannot be bypassed by recreating a function instance',async()=>{
  const key=hashRef('rate-test');for(let i=0;i<2;i++)await repo.rpc('rate',{p_key:key,p_limit:2,p_seconds:60});
  await assert.rejects(()=>new Repository(client).rpc('rate',{p_key:key,p_limit:2,p_seconds:60}),e=>e.status===429);
 });
 await t.test('existing RSVP references and UUIDs survive migration/reconfirmation',async()=>{
  const existingRef=randomUUID(),existingId=randomUUID();
  await pg.query('insert into wedding_rsvps(id,ref_hash,first_name,last_name,participants) values($1,$2,$3,$4,1)',[existingId,hashRef(existingRef),'Ancien','Invité']);
  const result=await call('/api/rsvp',json({...input,client_ref:existingRef}));
  assert.equal(result.body.ticket.id,existingId);assert.match(result.body.ticket.qr_token,/^[A-Za-z0-9_-]{43}$/);
 });
 await t.test('table grants block direct reads; authenticated own-role lookup still works',async()=>{
  assert.equal((await pg.query("select has_table_privilege('anon','public.wedding_rsvps','select') ok")).rows[0].ok,false);
  assert.equal((await pg.query("select has_column_privilege('authenticated','public.wedding_staff','role','select') ok")).rows[0].ok,true);
  await pg.exec("set role authenticated;set request.jwt.claim.sub='"+STAFF+"';");
  assert.equal((await pg.query('select role from wedding_staff where user_id=$1',[STAFF])).rows.length,1);
  await pg.exec("set request.jwt.claim.sub='20000000-0000-4000-8000-000000000099';");
  assert.equal((await pg.query('select role from wedding_staff where user_id=$1',[STAFF])).rows.length,0);
  await pg.exec('reset role');
 });
 await t.test('RPCs and coordination tables inaccessible to browser roles; RLS still enabled',async()=>{
  const {rows}=await pg.query("select has_function_privilege('anon','public.wedding_api_admin_state()','execute') a,has_table_privilege('authenticated','public.wedding_api_uploads','select') b");
  assert.equal(rows[0].a,false);assert.equal(rows[0].b,false);
  assert.equal((await pg.query("select bool_and(relrowsecurity) ok from pg_class where relname in ('wedding_rsvps','wedding_api_uploads','wedding_photos')")).rows[0].ok,true);
 });
 }finally{await new Promise(resolve=>server.close(resolve));await pg.close();}
});
