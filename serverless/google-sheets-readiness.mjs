import {OfficialList,DEFAULT_SHEET_ID,DEFAULT_SHEET_RANGE} from './official-list.mjs';
import {oidcRequestDiagnostic} from './google-oidc.mjs';

export const GOOGLE_SHEETS_READINESS_HEADERS=Object.freeze({
  'Cache-Control':'private, no-store, max-age=0',
  'CDN-Cache-Control':'no-store',
  'Vercel-CDN-Cache-Control':'no-store',
  Pragma:'no-cache',Expires:'0',Vary:'Authorization'
});
const INTERVAL_MS=60_000;
const result=(status,code)=>({status,body:{ready:status===200,sheets_readable:status===200,...(code?{code}:{})}});

function enabled(env,now){
  if(env.GOOGLE_SHEETS_READINESS_ENABLED!=='true'||typeof env.GOOGLE_SHEETS_READINESS_UNTIL!=='string'
    ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(env.GOOGLE_SHEETS_READINESS_UNTIL))return false;
  const until=Date.parse(env.GOOGLE_SHEETS_READINESS_UNTIL);
  return Number.isFinite(until)&&until>now;
}
async function readOfficialSheet(env){
  // Pin this temporary probe to the existing official sheet and requested readonly range.
  // Do not accept a sheet/range/name from the HTTP request or return the reader's result.
  const list=new OfficialList({env:{...env,GOOGLE_SHEETS_SPREADSHEET_ID:DEFAULT_SHEET_ID,
    GOOGLE_SHEETS_RANGE:DEFAULT_SHEET_RANGE,GUEST_NAME_ORDER:'mixed'}});
  await list.match({first_name:'Healthcheck',last_name:'No-admission-probe'});
  return true;
}

// This cooldown and single-flight guard are per warm instance, not a distributed quota.
// No user identifiers, tokens, sheet content, cached result or Supabase counters are stored.
export function createGoogleSheetsReadiness({env=process.env,now=Date.now,checkOidc=oidcRequestDiagnostic,readSheet=readOfficialSheet}={}){
  let nextAllowedAt=0,inFlight=false;
  return async function googleSheetsReadiness(req){
    if(!enabled(env,now()))return result(404,'diagnostic_disabled');
    try{
      if(!checkOidc(req,{env}).ready)return result(503,'google_sheets_unavailable');
      if(inFlight||now()<nextAllowedAt)return {...result(429,'diagnostic_rate_limited'),
        headers:{'Retry-After':String(Math.max(1,Math.ceil((nextAllowedAt-now())/1000)))}};
      // Reserve synchronously before any await; failed Google attempts also consume the cooldown.
      nextAllowedAt=now()+INTERVAL_MS;inFlight=true;
      try{
        if(await readSheet(env)!==true)throw Error();
        if(!enabled(env,now()))return result(404,'diagnostic_disabled');
        return result(200);
      }finally{inFlight=false;}
    }catch{
      // Never expose error messages/bodies, names, row counts, assertions or access tokens.
      return result(503,'google_sheets_unavailable');
    }
  };
}
export const googleSheetsReadiness=createGoogleSheetsReadiness();
