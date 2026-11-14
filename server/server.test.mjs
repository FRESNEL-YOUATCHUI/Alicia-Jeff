import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createWeddingServer} from './index.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'.qa-artifacts');
await fs.mkdir(base,{recursive:true});
const directory=await fs.mkdtemp(path.join(base,'server-test-'));
const password='photographer-test-password-only';
let currentTime=Date.parse('2026-11-13T16:00:00Z');
const options={dataDir:directory,distDir:path.join(root,'dist'),adminPassword:password,sessionSecret:'a-long-private-test-session-secret-123456789',now:()=>currentTime,allowLocalPreview:true};
let server=await createWeddingServer(options);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let origin=`http://127.0.0.1:${server.address().port}`;
async function request(route,{method='GET',body,cookie,headers={}}={}){
 const response=await fetch(origin+route,{method,headers:{...(body&&!(body instanceof Uint8Array)?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?(body instanceof Uint8Array?body:JSON.stringify(body)):undefined});
 const value=await response.json().catch(()=>null);return{response,value};
}
try{
 await test('Une confirmation est ouverte sans liste et les répétitions ne créent pas de doublon',async()=>{
  const ref=randomUUID();const body={first_name:'Invité',last_name:'DE TEST LOCAL',participants:2,client_ref:ref,message:'Message de test isolé',song:''};
  const first=await request('/api/rsvp',{method:'POST',body});assert.equal(first.response.status,200);assert.equal(first.value.ticket.guest_full_name,'Invité DE TEST LOCAL');assert.equal(first.value.ticket.allowed_persons,2);
  const second=await request('/api/rsvp',{method:'POST',body:{...body,participants:3}});assert.equal(second.value.ticket.id,first.value.ticket.id);assert.equal(second.value.ticket.allowed_persons,3);
  const saved=JSON.parse(await fs.readFile(path.join(directory,'souvenirs.json'),'utf8'));assert.equal(saved.responses.length,1);assert.equal(saved.messages.length,1);
 });
 await test('Les erreurs de saisie et les requêtes d’une autre origine sont refusées',async()=>{
  const invalid=await request('/api/rsvp',{method:'POST',body:{first_name:'',last_name:'Test',participants:-1,client_ref:randomUUID()}});assert.equal(invalid.response.status,400);
  const crossOrigin=await request('/api/messages',{method:'POST',body:{author:'test',body:'hello',client_ref:randomUUID()},headers:{Origin:'https://untrusted.example'}});assert.equal(crossOrigin.response.status,403);
 });
 await test('Les messages sont partagés et ne révèlent pas les confirmations ni les jetons privés',async()=>{
  const body={author:'Ami de test',body:'<script>message affiché comme texte</script>',client_ref:randomUUID()};
  await request('/api/messages',{method:'POST',body});await request('/api/messages',{method:'POST',body});
  const {value}=await request('/api/souvenirs');assert.equal(value.message_count,2);assert.equal(value.messages.find(m=>m.author==='Ami de test').body,body.body);assert.equal('responses' in value,false);assert.equal(JSON.stringify(value).includes('ref_hash'),false);
 });
 let cookie,albumId,photoId;
 await test('L’espace photographe requiert un vrai mot de passe et un cookie signé',async()=>{
  assert.equal((await request('/api/admin/state')).response.status,401);
  assert.equal((await request('/api/admin/login',{method:'POST',body:{password:'wrong'}})).response.status,401);
  const login=await request('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];assert.ok(login.response.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await request('/api/admin/state',{cookie})).response.status,200);
  assert.equal((await request('/api/admin/state',{cookie:cookie+'corrupted'})).response.status,401);
 });
 await test('Les photos restent protégées jusqu’après la cérémonie et publication explicite',async()=>{
  const album=await request('/api/admin/albums',{method:'POST',cookie,body:{title:'Album de test'}});albumId=album.value.id;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  const upload=await request(`/api/admin/albums/${albumId}/photos`,{method:'POST',cookie,headers:{'Content-Type':'image/png','X-Photo-Caption':'Photo%20de%20test'},body:png});assert.equal(upload.response.status,201);photoId=upload.value.id;
  await request(`/api/admin/albums/${albumId}`,{method:'PATCH',cookie,body:{published:true}});await request('/api/admin/settings',{method:'PATCH',cookie,body:{galleryPublished:true}});
  assert.equal((await fetch(origin+'/api/photos/'+photoId)).status,404);
  assert.equal((await fetch(origin+'/api/photos/'+photoId,{headers:{Cookie:cookie}})).status,200);
  assert.equal((await request('/api/souvenirs')).value.albums.length,0);
  currentTime=Date.parse('2026-12-19T00:01:00Z');
  assert.equal((await request('/api/souvenirs')).value.albums.length,1);
  const photo=await fetch(origin+'/api/photos/'+photoId);assert.equal(photo.status,200);assert.equal(photo.headers.get('Content-Type'),'image/png');
 });
 // The earlier session expires across the simulated month: sign in again for further changes.
 await test('La suspension de la galerie et la modération prennent effet côté serveur',async()=>{
  const login=await request('/api/admin/login',{method:'POST',body:{password}});cookie=login.response.headers.get('set-cookie').split(';')[0];
  await request('/api/admin/settings',{method:'PATCH',cookie,body:{galleryPublished:false}});assert.equal((await fetch(origin+'/api/photos/'+photoId)).status,404);
  const state=(await request('/api/admin/state',{cookie})).value;await request('/api/admin/messages/'+state.messages[0].id,{method:'PATCH',cookie,body:{hidden:true}});assert.equal((await request('/api/souvenirs')).value.message_count,1);
  assert.equal((await fetch(origin+'/.env.wedding.local')).status,404);
 });
 await test('Les messages et confirmations restent présents après un redémarrage',async()=>{
  await new Promise(resolve=>server.close(resolve));server=await createWeddingServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  const result=await request('/api/souvenirs');assert.equal(result.value.message_count,1);assert.equal(result.value.gallery_available,false);
 });
}finally{
 await new Promise(resolve=>server.close(resolve));
 const relative=path.relative(base,directory);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Refus de supprimer un dossier en dehors des tests.');
 await fs.rm(directory,{recursive:true,force:true});
}
