import {getSupabase} from './supabase';
// Optional read-only diagnostic. Never log identities, tokens or complete rows.
export async function testSupabase(){
  const {count,error}=await getSupabase().from('wedding_albums').select('id',{head:true,count:'exact'});
  if(error)throw new Error('La lecture des albums n’est pas disponible pour cette session.');
  return {albumCount:count};
}
