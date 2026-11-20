import {api,ApiFailure} from './api';
export interface UploadJob{file:File;reference:string;album:string;intent?:string;done?:boolean;photoId?:string}
interface Authorization{id:string;status:string;photo_id?:string;bucket?:string;path?:string;token?:string}
const wait=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Import annulé.','AbortError'));return;}
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Import annulé.','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});
});
async function retry<T>(fn:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  for(let attempt=0;;attempt++){
    try{return await fn();}catch(error){
      if(signal.aborted||attempt>=2||!(error instanceof ApiFailure)||![0,409,500,502,503,504].includes(error.status))throw error;
      await wait(700*(attempt+1),signal);
    }
  }
}
export async function uploadPhoto(job:UploadJob,signal:AbortSignal){
  const file=job.file;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<1||file.size>20*1024*1024)throw new Error('Chaque image doit être un JPEG, PNG ou WebP de 20 Mo maximum.');
  const authorization=await retry(()=>api<Authorization>('/api/admin/uploads/authorize',{method:'POST',signal,body:JSON.stringify({album_id:job.album,client_ref:job.reference,filename:file.name,content_type:file.type,size:file.size})}),signal);
  job.intent=authorization.id;
  if(authorization.status==='complete'){job.photoId=authorization.photo_id;job.done=true;return;}
  const finalize=()=>api<{photo_id:string}>('/api/admin/uploads/'+authorization.id+'/finalize',{method:'POST',body:'{}',signal});
  // A prior interrupted request may already have stored/finalized this exact intent.
  try{const result=await finalize();job.photoId=result.photo_id;job.done=true;return;}catch(error){if(!(error instanceof ApiFailure)||error.code!=='upload_incomplete')throw error;}
  if(!authorization.bucket||!authorization.path||!authorization.token)throw new Error('Autorisation d’import incomplète.');
  const url=new URL(import.meta.env.VITE_SUPABASE_URL+'/storage/v1/object/upload/sign/'+authorization.bucket+'/'+authorization.path.split('/').map(encodeURIComponent).join('/'));
  url.searchParams.set('token',authorization.token);
  let transferError:Error|undefined;
  try{
    const response=await fetch(url,{method:'PUT',signal,headers:{'Content-Type':file.type,'x-upsert':'false','Cache-Control':'max-age=60',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:file});
    if(!response.ok)transferError=new Error('Le transfert a été interrompu. Réessayez les imports restants.');
  }catch(error){if(signal.aborted)throw error;transferError=new Error('Le transfert a été interrompu. Réessayez les imports restants.');}
  // A duplicate object or a lost response is resolved by idempotent finalization.
  try{const result=await retry(finalize,signal);job.photoId=result.photo_id;}catch(error){throw transferError??error;}
  job.done=true;
}
export async function uploadBatch(jobs:UploadJob[],signal:AbortSignal,onProgress:(done:number,total:number)=>void){
  let next=0,stop=false;const failures:unknown[]=[];
  const worker=async()=>{while(next<jobs.length&&!signal.aborted&&!stop){const job=jobs[next++];if(job.done)continue;try{await uploadPhoto(job,signal);onProgress(jobs.filter(j=>j.done).length,jobs.length);}catch(error){failures.push(error);if(error instanceof ApiFailure&&[401,403,429].includes(error.status))stop=true;}}};
  await Promise.all([worker(),worker()]);
  if(failures.length)throw failures[0];
  if(signal.aborted)throw new DOMException('Import annulé.','AbortError');
}
export async function cancelUploads(jobs:UploadJob[]){
  await Promise.allSettled(jobs.filter(j=>j.intent&&!j.done).map(j=>api('/api/admin/uploads/'+j.intent+'/cancel',{method:'POST',body:'{}'})));
}
