export class ApiFailure extends Error {
  constructor(message:string,public status:number,public code:string){super(message);}
}
export async function api<T>(route:string,options:RequestInit={}):Promise<T>{
  const headers=new Headers(options.headers);
  if(typeof options.body==='string'&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const admin=route.startsWith('/api/admin/')||route.startsWith('/api/tickets/');
  async function token(refresh=false){
    const {getSupabase}=await import('./supabase');
    const auth=getSupabase().auth;
    const {data,error}=await (refresh?auth.refreshSession():auth.getSession());
    if(error||!data.session)throw new ApiFailure('Veuillez vous connecter avec un compte du personnel autorisé.',401,'authentication_required');
    headers.set('Authorization','Bearer '+data.session.access_token);
  }
  if(admin)await token();
  let response:Response;
  try{
    response=await fetch(route,{...options,credentials:'same-origin',headers});
    if(admin&&response.status===401){await token(true);response=await fetch(route,{...options,credentials:'same-origin',headers});}
  }catch(error){
    if(error instanceof ApiFailure||(error instanceof DOMException&&error.name==='AbortError'))throw error;
    throw new ApiFailure('La connexion est interrompue. Réessayez.',0,'network_error');
  }
  let data:unknown;
  try{data=await response.json();}catch{throw new ApiFailure('Le service est momentanément indisponible.',response.status,'invalid_response');}
  if(!response.ok){
    const body=data as {error?:unknown;code?:unknown};
    throw new ApiFailure(typeof body?.error==='string'?body.error:'Votre demande a échoué.',response.status,typeof body?.code==='string'?body.code:'request_failed');
  }
  return data as T;
}
const memoryIds=new Map<string,string>();
export function persistentId(key:string):string{
  if(memoryIds.has(key))return memoryIds.get(key)!;
  let value:string;try{value=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,value);}catch{value=crypto.randomUUID();}
  memoryIds.set(key,value);return value;
}
