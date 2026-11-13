
import { supabase } from './supabase';

export async function testSupabase() {
  const { data, error } = await supabase
    .from('wedding_albums')
    .select('id, title, published');

  if (error) {
    console.error('Erreur Supabase :', error.message);
    return;
  }

  console.log('Albums accessibles :', data);
}
