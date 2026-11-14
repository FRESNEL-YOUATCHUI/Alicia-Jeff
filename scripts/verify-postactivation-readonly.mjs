import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {startLocalApp} from './lib/local-app.mjs';
import {localEnvironment} from './lib/environment.mjs';
const env=localEnvironment();
const server=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const visitor=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const app=await startLocalApp({port:0,logger:{info(){},warn(){}}});
const proof={checked_at:new Date().toISOString(),mode:'actual configured Supabase + unchanged production gateway',agent_hosted_mutations_performed:false,checks:[],limits:['No valid guest submission, album/photo mutation, signed upload or moderation performed.','Staff password sign-in/logout and protected HTTP endpoint with a valid staff JWT are not tested.','Privileged administrative RPC reads do not constitute an authenticated staff HTTP test.']};
async function check(name,action){await action();proof.checks.push({name,passed:true});}
async function request(path,options={}){const response=await fetch(app.url+path,{...options,signal:AbortSignal.timeout(15000)});const body=await response.json();return{status:response.status,body};}
async function rpc(name,args={}){const result=await server.rpc('wedding_api_'+name,args).abortSignal(AbortSignal.timeout(15000));if(result.error)throw Error('RPC read failed: '+name+' ('+result.error.code+').');return result.data;}
async function counts(){const result={};for(const table of ['wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages','wedding_api_limits','wedding_api_uploads']){const r=await server.from(table).select('*',{head:true,count:'exact'}).abortSignal(AbortSignal.timeout(15000));if(r.error)throw Error('Count read failed: '+table);result[table]=r.count;}return result;}
try{
 proof.counts_before=await counts();
 let state,admin;
 await check('public souvenirs returns HTTP 200 from real RPC',async()=>{const r=await request('/api/souvenirs');assert.equal(r.status,200);assert.ok(Array.isArray(r.body.albums));assert.ok(Array.isArray(r.body.messages));assert.equal(r.body.gallery_available,false);assert.equal(r.body.albums.length,0);state=r.body;});
 await check('public guest messages returns HTTP 200 without private columns',async()=>{const r=await request('/api/messages');assert.equal(r.status,200);assert.ok(Array.isArray(r.body.messages));for(const m of r.body.messages)assert.ok(Object.keys(m).every(k=>['id','author','body','created_at'].includes(k)));});
 await check('invalid public pagination refused before SQL',async()=>{assert.equal((await request('/api/messages?offset=100001')).status,400);});
 await check('anonymous administrative state refused with HTTP 401',async()=>{const r=await request('/api/admin/state');assert.equal(r.status,401);assert.equal(r.body.code,'authentication_required');});
 await check('anonymous administrative messages refused with HTTP 401',async()=>{assert.equal((await request('/api/admin/messages')).status,401);});
 await check('invalid JWT refused by real Supabase Auth',async()=>{const r=await request('/api/admin/state',{headers:{Authorization:'Bearer invalid-readonly-test-token'}});assert.equal(r.status,401);assert.equal(r.body.code,'invalid_token');});
 await check('no public RSVP listing route',async()=>{assert.equal((await request('/api/rsvps')).status,404);});
 await check('invalid RSVP rejected before rate or business mutation',async()=>{assert.equal((await request('/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({participants:0})})).status,400);});
 await check('invalid guest message rejected before rate or business mutation',async()=>{assert.equal((await request('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({author:'',body:'',client_ref:'invalid'})})).status,400);});
 await check('server-only admin state RPC reads actual albums/settings/counts',async()=>{admin=await rpc('admin_state');assert.ok(Array.isArray(admin.albums));assert.ok(admin.albums.length>=3);assert.equal(typeof admin.response_count,'number');assert.equal(typeof admin.settings.galleryPublished,'boolean');proof.administrative_read={via:'server service credential RPC; not staff JWT',album_count:admin.albums.length,response_count:admin.response_count};});
 await check('server-only administrative message RPC read',async()=>{const r=await rpc('admin_messages',{p_offset:0});assert.ok(Array.isArray(r.messages));});
 for(let i=0;i<admin.albums.length;i++)await check('server-only administrative photo RPC read for album '+(i+1),async()=>{const r=await rpc('admin_photos',{p_album:admin.albums[i].id,p_offset:0});assert.ok(Array.isArray(r.photos));});
 await check('gallery/date gate protects actual album API',async()=>{assert.equal((await request('/api/photos?album='+admin.albums[0].id)).status,404);});
 await check('individual nonpublished/unavailable photo does not expose a URL',async()=>{assert.equal((await request('/api/photos/'+randomUUID())).status,404);});
 for(const table of ['wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages'])await check('publishable-key direct table read denied: '+table,async()=>{const r=await visitor.from(table).select(table==='wedding_staff'?'user_id':'id').limit(0).abortSignal(AbortSignal.timeout(15000));assert.ok(r.error);assert.ok([401,403].includes(r.status));});
 await check('publishable-key direct admin RPC denied',async()=>{const r=await visitor.rpc('wedding_api_admin_state').abortSignal(AbortSignal.timeout(15000));assert.ok(r.error);assert.ok([401,403,404].includes(r.status));});
 await check('staff role references an existing confirmed Auth account (read only)',async()=>{const staff=await server.from('wedding_staff').select('user_id,role').abortSignal(AbortSignal.timeout(15000));if(staff.error)throw Error('Staff read unavailable');const results=[];for(const s of staff.data){assert.ok(['admin','photographer'].includes(s.role));const r=await server.auth.admin.getUserById(s.user_id);if(r.error||!r.data?.user)throw Error('Staff Auth user unavailable');results.push({exists:true,email_confirmed:Boolean(r.data.user.email_confirmed_at),not_banned:!r.data.user.banned_until||Date.parse(r.data.user.banned_until)<=Date.now()});}assert.ok(results.length>0);assert.ok(results.every(r=>r.email_confirmed&&r.not_banned));proof.staff_accounts={checked:results.length,all_exist:true,all_email_confirmed:true,none_banned:true,password_sign_in_tested:false};});
 await check('updated invitation PNG and envelope assets available',async()=>{for(const name of ['invitation.png','enveloppe-aj.webp']){const r=await fetch(app.url+'/wedding/'+name,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.ok(r.headers.get('content-type')?.startsWith('image/'));await r.body?.cancel();}});
 proof.counts_after=await counts();
 await check('no business or coordination row count changed during read-only checks',async()=>{assert.deepEqual(proof.counts_after,proof.counts_before);});
 proof.public_readiness={souvenirs_http:200,messages_http:200,gallery_available:state.gallery_available,private_photos_not_exposed:true};
 proof.passed=true;
}catch(error){proof.passed=false;proof.failed_check=String(error.message).split('\n')[0];process.exitCode=1;console.error('Post-activation read-only API validation failed; no further mutation will be performed.');}
finally{await app.close();await fs.writeFile(new URL('../docs/audit/postactivation-api-readonly.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));}
