import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PhotoStorage,inspectImage} from '../serverless/storage.mjs';
import {serverConfig} from '../serverless/supabase.mjs';
import {rsvpInput,uploadInput} from '../serverless/validation.mjs';
const file=async name=>fs.readFile(new URL('../public/wedding/'+name,import.meta.url));
test('bounded signature/dimensions validation on the actual PNG, JPEG and WebP assets',async()=>{
 for(const [name,mime]of [['invitation.png','image/png'],['couple.jpg','image/jpeg'],['alicia.webp','image/webp']]){
  const data=await file(name),info=inspectImage(data.subarray(0,131072),data.subarray(-12),data.length,mime);
  assert.ok(info.width>0&&info.height>0);
 }
});
test('reject HTML, truncated content, false MIME, broken dimensions and incomplete WebP',async()=>{
 const png=await file('invitation.png');
 for(const [h,t,n,m]of [
  [Buffer.from('<html>bad</html>'),Buffer.from('bad'),30,'image/png'],
  [png.subarray(0,20),png.subarray(-12),png.length,'image/png'],
  [png.subarray(0,100),png.subarray(-12),png.length,'image/jpeg']
 ])assert.throws(()=>inspectImage(h,t,n,m),e=>e.status===415);
 const huge=Buffer.from(png.subarray(0,100));huge.writeUInt32BE(50000,16);
 assert.throws(()=>inspectImage(huge,png.subarray(-12),png.length,'image/png'));
 const webp=await file('alicia.webp');assert.throws(()=>inspectImage(webp.subarray(0,100),webp.subarray(-12),webp.length-1,'image/webp'));
});
test('stored-object metadata is checked and Range downloads stay bounded',async()=>{
 const data=await file('invitation.png');let bytes=0;
 const intent={storage_path:'albums/test.png',size:data.length,content_type:'image/png'};
 let metadata={size:data.length,contentType:'image/png'};
 const bucket={info:async()=>({data:metadata}),createSignedUrl:async()=>({data:{signedUrl:'https://storage.invalid/test'}})};
 const client={storage:{from:()=>bucket,getBucket:async()=>({data:{public:false}})}};
 const ranged=async(_url,{headers})=>{
  const [,start,end]=/bytes=(\d+)-(\d+)/.exec(headers.Range);const part=data.subarray(Number(start),Number(end)+1);bytes+=part.length;
  return new Response(part,{status:206});
 };
 const storage=new PhotoStorage(client,ranged);
 await storage.verify(intent);assert.ok(bytes<=131084);
 metadata={size:data.length+1,contentType:'image/png'};
 await assert.rejects(()=>storage.verify(intent),e=>e.status===415);
 metadata={size:data.length,contentType:'text/html'};
 await assert.rejects(()=>storage.verify(intent),e=>e.status===415);
 metadata={size:data.length,contentType:'image/png'};
 const ignoring=new PhotoStorage(client,async()=>new Response(data,{status:200}));
 await assert.rejects(()=>ignoring.verify(intent),e=>e.status===503);
});
test('public bucket and failed signing are refused without leaking storage paths',async()=>{
 const client={storage:{from:()=>({}),getBucket:async()=>({data:{public:true}})}};
 await assert.rejects(()=>new PhotoStorage(client).privateBucket(),e=>e.code==='private_storage_required');
});
test('missing server secrets fail closed; publishable keys cannot configure the backend',()=>{
 assert.throws(()=>serverConfig({}),e=>e.status===503);
 assert.throws(()=>serverConfig({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_publishable_test'}),e=>e.status===503);
});
test('strict form values and type/size constraints',()=>{
 const ref='12345678-1234-4123-8123-123456789012';
 assert.throws(()=>rsvpInput({first_name:'A',last_name:'B',participants:2,client_ref:ref,admin:true}),e=>e.status===400);
 assert.throws(()=>uploadInput({album_id:ref,client_ref:ref,filename:'a.png',content_type:'image/png',size:Infinity}),e=>e.status===413);
});
