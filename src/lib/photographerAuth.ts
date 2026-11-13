import {getSupabase} from './supabase';
export async function loginPhotographer(email:string,password:string){
  const supabase=getSupabase();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error||!data.user)throw new Error('Identifiants incorrects.');
  const {data:staff,error:roleError}=await supabase.from('wedding_staff').select('role').eq('user_id',data.user.id).maybeSingle();
  if(roleError||!staff||!['photographer','admin'].includes(staff.role)){
    await supabase.auth.signOut();throw new Error('Ce compte ne peut pas gérer les photos.');
  }
  return data.user;
}
export async function logoutPhotographer(){const {error}=await getSupabase().auth.signOut();if(error)throw new Error('Impossible de terminer la session.');}
export async function getPhotographerSession(){
  const supabase=getSupabase();
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)return null;
  const {data:staff,error:roleError}=await supabase.from('wedding_staff').select('role').eq('user_id',data.user.id).maybeSingle();
  return !roleError&&staff&&['photographer','admin'].includes(staff.role)?data.user:null;
}
