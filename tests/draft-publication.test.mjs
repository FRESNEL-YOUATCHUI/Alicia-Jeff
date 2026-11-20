import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {database,clientFor,ALBUM,STAFF} from './database.mjs';
import {Repository} from '../serverless/repository.mjs';
test('005 adds only draft functions, is idempotent and leaves existing rows/functions/RLS intact',async()=>{
 const {pg}=await database();
 try{
  const previous=(await pg.query("select pg_get_functiondef('wedding_api_upload_complete(uuid,uuid,uuid)'::regprocedure) body")).rows[0].body;
  const data=(await pg.query('select jsonb_agg(to_jsonb(a) order by id) d from wedding_albums a')).rows[0].d;
  const sql=await fs.readFile(new URL('../supabase/migrations/005_draft_uploads.sql',import.meta.url),'utf8');await pg.exec(sql);await pg.exec(sql);
  assert.equal((await pg.query("select pg_get_functiondef('wedding_api_upload_complete(uuid,uuid,uuid)'::regprocedure) body")).rows[0].body,previous);
  assert.deepEqual((await pg.query('select jsonb_agg(to_jsonb(a) order by id) d from wedding_albums a')).rows[0].d,data);
  for(const role of ['anon','authenticated']){await pg.exec('set role '+role);await assert.rejects(pg.query('select wedding_api_upload_draft_ready()'),/permission denied/);await pg.exec('reset role');}
  const procs=(await pg.query("select prosecdef,proconfig from pg_proc where proname in ('wedding_api_upload_complete_draft','wedding_api_upload_draft_ready')")).rows;
  assert.equal(procs.length,2);assert.ok(procs.every(p=>!p.prosecdef&&p.proconfig.includes('search_path=pg_catalog, pg_temp')));
 }finally{await pg.close();}
});
test('new upload completes hidden even in published/open album; explicit publish is required; missing 005 fails closed',async()=>{
 const {pg}=await database(),repo=new Repository(clientFor(pg)),staff={id:STAFF,role:'photographer'};
 try{
  await pg.exec("update wedding_settings set gallery_published=true,release_at=now()-interval '1 hour';update wedding_albums set published=true;");
  const u=await repo.reserve({album_id:ALBUM,client_ref:randomUUID(),filename:'test.png',content_type:'image/png',size:100},staff),claim=await repo.claim(u.id,staff);
  const photo=await repo.complete(u.id,claim.nonce,staff);assert.equal(photo.photo_id,u.id);
  assert.equal((await pg.query('select hidden from wedding_photos where id=$1',[u.id])).rows[0].hidden,true);
  assert.equal((await repo.publicPhotos(ALBUM,0)).photos.length,0);assert.equal(await repo.publicPhoto(u.id),null);
  await repo.mutate('photo',u.id,{hidden:false},staff);assert.equal((await repo.publicPhotos(ALBUM,0)).photos.length,1);
  const before=(await pg.query('select count(*)::int n from wedding_api_uploads')).rows[0].n;
  await pg.exec(await fs.readFile(new URL('../supabase/activation/rollback-draft-uploads.sql',import.meta.url),'utf8'));
  await assert.rejects(repo.reserve({album_id:ALBUM,client_ref:randomUUID(),filename:'other.png',content_type:'image/png',size:100},staff),e=>e.code==='draft_uploads_required');
  assert.equal((await pg.query('select count(*)::int n from wedding_api_uploads')).rows[0].n,before);
  assert.equal((await pg.query('select count(*)::int n from wedding_photos')).rows[0].n,1);
 }finally{await pg.close();}
});
