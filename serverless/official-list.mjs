import {createGoogleSheetsAuth} from './google-oidc.mjs';
import {ApiError} from './http.mjs';
export const normalizeGuestName=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/\s+/gu,' ');
export const DEFAULT_SHEET_ID='1mikI1pPvSK0CvslUlUKlwROowJBP5Q9FCzGiZ9ucUB0';
export const DEFAULT_SHEET_RANGE="'Invités'!A2:A";
const unavailable=()=>new ApiError(503,'official_list_unavailable','La liste officielle est indisponible. Aucune entrée autorisée.');
export function officialNames(guest,order='mixed'){
 if(!['first_last','last_first','mixed'].includes(order))throw unavailable();
 const first=normalizeGuestName(guest.first_name+' '+guest.last_name),last=normalizeGuestName(guest.last_name+' '+guest.first_name);
 return [...new Set(order==='mixed'?[first,last]:[order==='first_last'?first:last])];
}
export function inspectOfficialRows(rows,candidates){
 if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw unavailable();
 const accepted=new Set(typeof candidates==='string'?[candidates]:candidates),matches=[];
 for(const row of rows){
  if(!Array.isArray(row)||row.length>1)throw unavailable();
  if(!row.length||row[0]==='')continue;
  if(typeof row[0]!=='string'||row[0].length>200||/[\p{Cc}\p{Cf}]/u.test(row[0]))throw unavailable();
  const name=normalizeGuestName(row[0]);if(accepted.has(name))matches.push(name);
 }
 // Duplicated rows AND both exact orders matching different rows are ambiguous.
 return {status:matches.length>1?'ambiguous':matches.length===1?'recognized':'absent',name:matches.length===1?matches[0]:null};
}
export const matchOfficialRows=(rows,names)=>inspectOfficialRows(rows,names).status;
export class OfficialList {
 constructor({env=process.env,fetchImpl=fetch,authFactory=createGoogleSheetsAuth}={}){
  this.env=env;this.fetch=fetchImpl;this.authFactory=authFactory;
 }
 async match(guest){
  const env=this.env,names=officialNames(guest,env.GUEST_NAME_ORDER||'mixed');
  const id=env.GOOGLE_SHEETS_SPREADSHEET_ID||DEFAULT_SHEET_ID,range=env.GOOGLE_SHEETS_RANGE||DEFAULT_SHEET_RANGE;
  if(!id||!/^[A-Za-z0-9_-]{20,200}$/.test(id)||!range||!/^'[^']{1,100}'!A2:A(?:10001)?$/.test(range))throw unavailable();
  try{
   this.auth??=this.authFactory({env});
   const url='https://sheets.googleapis.com/v4/spreadsheets/'+id+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS';
   const headers=await this.auth.getRequestHeaders(url);
   const response=await this.fetch(url,{headers,signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error'});
   if(!response.ok)throw unavailable();
   if(Number(response.headers.get('content-length')||0)>2*1024*1024)throw unavailable();
   const chunks=[];let bytes=0;
   for await(const chunk of response.body){
    bytes+=chunk.byteLength;if(bytes>2*1024*1024)throw unavailable();chunks.push(chunk);
   }
   const text=Buffer.concat(chunks).toString('utf8');
   const data=JSON.parse(text);
   // Fetch every time. No stale positive result or permanent negative cache.
   return inspectOfficialRows(data.values,names);
  }catch{throw unavailable();}
 }
}
