import {createClient} from '@supabase/supabase-js';
import {ApiError} from './http.mjs';
let cached;
export function serverConfig(env=process.env) {
  const url=env.SUPABASE_URL, key=env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new ApiError(503,'configuration_required','Le service attend sa configuration serveur.');
  let parsed;try{parsed=new URL(url);}catch{throw new ApiError(503,'configuration_required','Configuration serveur non valide.');}
  if(!['https:','http:'].includes(parsed.protocol)||key.startsWith('sb_publishable_'))throw new ApiError(503,'configuration_required','Configuration serveur non valide.');
  return {url,key};
}
export function getSupabase() {
  if(!cached){const {url,key}=serverConfig();cached=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
  return cached;
}
export function bearerToken(req) {
  const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [^\s]+$/i.test(header))throw new ApiError(401,'authentication_required','Connectez-vous à l’espace photographe.');
  return header.slice(7);
}
export async function requireStaff(req,client) {
  const token=bearerToken(req);
  const {data,error}=await client.auth.getUser(token);
  if(error||!data?.user){
    if(error?.status>=500)throw new ApiError(503,'auth_unavailable','La vérification de session est indisponible.');
    throw new ApiError(401,'invalid_token','Votre session a expiré. Reconnectez-vous.');
  }
  const {data:staff,error:roleError}=await client.from('wedding_staff').select('role').eq('user_id',data.user.id).maybeSingle();
  if(roleError)throw new ApiError(503,'role_unavailable','Les autorisations ne peuvent pas être vérifiées.');
  if(!staff||!['photographer','admin'].includes(staff.role))throw new ApiError(403,'staff_required','Ce compte ne peut pas administrer les souvenirs.');
  return {id:data.user.id,role:staff.role};
}
