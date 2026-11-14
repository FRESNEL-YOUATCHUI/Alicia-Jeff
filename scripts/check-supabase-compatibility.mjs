import {applyLocalEnvironment} from './lib/environment.mjs';
import {getSupabase} from '../serverless/supabase.mjs';
export async function checkSupabaseCompatibility(){
  applyLocalEnvironment();
  const client=getSupabase();
  const tables={
    wedding_albums:'id,title,published,hidden,created_at',
    wedding_photos:'id,album_id,storage_path,caption,hidden,created_at',
    wedding_settings:'id,gallery_published,release_at',
    wedding_staff:'user_id,role',
    wedding_rsvps:'id,ref_hash,first_name,last_name,participants,song,created_at,updated_at',
    wedding_messages:'id,response_id,ref_hash,author,body,hidden,created_at',
  };
  const results=await Promise.all(Object.entries(tables).map(async([table,columns])=>{
    const {error}=await client.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(10000));
    return{table,columns_checked:columns.split(',').length,read_only_limit:0,compatible:!error,...(error?{code:error.code}:{})};
  }));
  const bucket=await client.storage.getBucket('wedding-photos');
  return{checked_at:new Date().toISOString(),read_only:true,no_visitor_rows_requested:true,tables:results,bucket:bucket.error?{available:false}:{available:true,private:!bucket.data.public,file_size_limit:bucket.data.file_size_limit,allowed_mime_types:bucket.data.allowed_mime_types}};
}
