import {getVercelOidcToken,getVercelOidcTokenSync} from '@vercel/oidc';
import {ApiError} from './http.mjs';

export const SHEETS_READONLY_SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const CLOUD_PLATFORM_SCOPE='https://www.googleapis.com/auth/cloud-platform';
const ACCESS_TOKEN_TYPE='urn:ietf:params:oauth:token-type:access_token';
const JWT_TOKEN_TYPE='urn:ietf:params:oauth:token-type:jwt';
const STS_URL='https://sts.googleapis.com/v1/token';
const AUTH_RESPONSE_LIMIT=64*1024;
const GOOGLE_TOKEN_LIFETIME_SECONDS=600;

// Verified resource IDs, never display names. This module is server-only.
export const GOOGLE_IDENTITY=Object.freeze({
  GCP_PROJECT_ID:'alicia-jeff-mariage',
  GCP_PROJECT_NUMBER:'691833411750',
  GCP_WORKLOAD_IDENTITY_POOL_ID:'alicia-jeff-vercel',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:'vercel-alicia-jeff',
  GCP_SERVICE_ACCOUNT_EMAIL:'alicia-jeff-invites@alicia-jeff-mariage.iam.gserviceaccount.com'
});
export const VERCEL_IDENTITY=Object.freeze({
  issuer:'https://oidc.vercel.com/dev-full1',
  audience:'https://vercel.com/dev-full1',
  subject:'owner:dev-full1:project:alicia-jeff:environment:production'
});
const unavailable=()=>new ApiError(503,'official_list_unavailable','La liste officielle est indisponible. Aucune entrée autorisée.');

export function googleOidcConfiguration(env=process.env){
  const config={};
  for(const [name,verified] of Object.entries(GOOGLE_IDENTITY)){
    const value=env[name]??verified;
    if(value!==verified)throw unavailable();
    config[name]=value;
  }
  const provider='projects/'+config.GCP_PROJECT_NUMBER+'/locations/global/workloadIdentityPools/'
    +config.GCP_WORKLOAD_IDENTITY_POOL_ID+'/providers/'+config.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  return Object.freeze({
    provider,stsAudience:'//iam.googleapis.com/'+provider,
    impersonationUrl:'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'
      +config.GCP_SERVICE_ACCOUNT_EMAIL+':generateAccessToken'
  });
}
export function googleOidcReadiness(env=process.env){
  const conflicts=Object.entries(GOOGLE_IDENTITY).filter(([name,value])=>env[name]!==undefined&&env[name]!==value).map(([name])=>name);
  return {
    mode:'vercel-oidc',configuration_valid:conflicts.length===0,conflicting_variables:conflicts,
    production_runtime:env.VERCEL==='1'&&env.VERCEL_ENV==='production',
    legacy_private_key_ignored:Boolean(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  };
}

// Read-only request probe. The synchronous SDK cannot refresh tokens, read a token file,
// contact Google, or persist credentials. Never accept an environment-token fallback
// as proof of access to this request's token. Authentication is enforced by the handler.
export function oidcRequestDiagnostic(req,{env=process.env,tokenProvider=getVercelOidcTokenSync,now=Date.now}={}){
  const requestToken=req.headers?.['x-vercel-oidc-token'];
  const result={
    vercel_variable_present:typeof env.VERCEL==='string',
    vercel_flag_valid:env.VERCEL==='1',
    vercel_env_variable_present:typeof env.VERCEL_ENV==='string',
    production_environment:env.VERCEL_ENV==='production',
    google_configuration_valid:googleOidcReadiness(env).configuration_valid,
    request_oidc_token_present:typeof requestToken==='string'&&requestToken.length>0,
    sdk_token_accessible:false,
    identity_claims_match:false,
    ready:false
  };
  // Preserve the Production restriction. Do not ask the SDK for local/Preview identities.
  if(!result.vercel_flag_valid||!result.production_environment||!result.request_oidc_token_present)return result;
  try{
    const token=tokenProvider();
    if(typeof token!=='string'||token!==requestToken)return result;
    result.sdk_token_accessible=true;
    validateAssertion(token,now());
    result.identity_claims_match=true;
    result.ready=result.google_configuration_valid;
  }catch{
    // Neither SDK errors nor token claims/values are included in the response or logs.
  }
  return result;
}

// These checks only reject unusable assertions early. Google STS verifies the signature.
function validateAssertion(token,now){
  if(typeof token!=='string'||token.length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw unavailable();
  const parts=token.split('.');
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(header.alg!=='RS256'||claims.iss!==VERCEL_IDENTITY.issuer||claims.aud!==VERCEL_IDENTITY.audience
    ||claims.sub!==VERCEL_IDENTITY.subject||claims.environment!=='production'
    ||!Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.nbf)
    ||claims.iat*1000>now||claims.nbf*1000>now||claims.iat>=claims.exp||claims.nbf>=claims.exp
    ||claims.exp*1000<=now+1000)throw unavailable();
  return claims.exp*1000;
}
function accessToken(value){
  if(typeof value!=='string'||!value||value.length>16384||!/^[A-Za-z0-9._~+/-]+=*$/.test(value))throw unavailable();
  return value;
}
async function readAuthResponse(response,signal){
  signal.throwIfAborted();
  if(!response.ok||Number(response.headers.get('content-length')||0)>AUTH_RESPONSE_LIMIT){
    await response.body?.cancel();throw unavailable();
  }
  const chunks=[];let bytes=0;
  for await(const chunk of response.body){
    signal.throwIfAborted();bytes+=chunk.byteLength;
    if(bytes>AUTH_RESPONSE_LIMIT)throw unavailable();
    chunks.push(chunk);
  }
  signal.throwIfAborted();
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!body||typeof body!=='object'||Array.isArray(body))throw unavailable();
  return body;
}

export class GoogleSheetsOidcAuth {
  constructor({env=process.env,fetchImpl=fetch,tokenProvider=getVercelOidcToken,now=Date.now,deadlineMs=7000}={}){
    this.env=env;this.fetch=fetchImpl;this.tokenProvider=tokenProvider;this.now=now;this.deadlineMs=deadlineMs;
  }
  async getRequestHeaders(){
    const controller=new AbortController(),signal=controller.signal;
    const timer=setTimeout(()=>controller.abort(),this.deadlineMs);
    let onAbort;
    const aborted=new Promise((_,reject)=>{
      onAbort=()=>reject(unavailable());signal.addEventListener('abort',onAbort,{once:true});
    });
    try{
      if(this.env.VERCEL!=='1'||this.env.VERCEL_ENV!=='production')throw unavailable();
      const config=googleOidcConfiguration(this.env);
      const operation=(async()=>{
        // Called in the current Vercel request context, never at module initialization.
        // Do not supply a custom audience: the provider trusts the default Vercel audience.
        const assertion=await this.tokenProvider();
        signal.throwIfAborted();
        const assertionExpiresAt=validateAssertion(assertion,this.now());
        const stsStartedAt=this.now();
        const sts=await readAuthResponse(await this.fetch(STS_URL,{
          method:'POST',redirect:'error',cache:'no-store',signal,
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams({
            grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',
            requested_token_type:ACCESS_TOKEN_TYPE,subject_token_type:JWT_TOKEN_TYPE,
            audience:config.stsAudience,scope:CLOUD_PLATFORM_SCOPE,subject_token:assertion
          })
        }),signal);
        if(sts.issued_token_type!==ACCESS_TOKEN_TYPE||String(sts.token_type).toLowerCase()!=='bearer'
          ||!Number.isSafeInteger(sts.expires_in)||sts.expires_in<=0||sts.expires_in>3600
          ||stsStartedAt+sts.expires_in*1000<=this.now())throw unavailable();
        const federatedToken=accessToken(sts.access_token);
        const impersonated=await readAuthResponse(await this.fetch(config.impersonationUrl,{
          method:'POST',redirect:'error',cache:'no-store',signal,
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+federatedToken},
          body:JSON.stringify({scope:[SHEETS_READONLY_SCOPE],lifetime:GOOGLE_TOKEN_LIFETIME_SECONDS+'s'})
        }),signal);
        const expiresAt=Date.parse(impersonated.expireTime),current=this.now();
        if(!Number.isFinite(expiresAt)||expiresAt<=current+1000
          ||expiresAt>current+(GOOGLE_TOKEN_LIFETIME_SECONDS+60)*1000||assertionExpiresAt<=current)throw unavailable();
        signal.throwIfAborted();
        return new Headers({Authorization:'Bearer '+accessToken(impersonated.accessToken)});
      })();
      return await Promise.race([operation,aborted]);
    }catch{
      // Never return Google's error body, request headers, assertions or access tokens.
      throw unavailable();
    }finally{
      clearTimeout(timer);signal.removeEventListener('abort',onAbort);controller.abort();
    }
  }
}
export const createGoogleSheetsAuth=options=>new GoogleSheetsOidcAuth(options);
