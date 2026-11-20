import {createHmac,createHash,randomUUID,timingSafeEqual} from 'node:crypto';
const scope='/api/admin/google-sheets-readiness',aud='alicia-jeff-owner-probe-v1';
const digest=value=>createHash('sha256').update(value).digest('hex');
function signature(secret,payload){return createHmac('sha256',secret).update(aud+':'+payload).digest('base64url');}
function key(secret){if(typeof secret!=='string'||secret.length<32||secret.startsWith('sb_publishable_'))throw Error('Clé serveur locale requise, sans affichage de sa valeur.');}
export function mintOwnerProbeGrant(userId,secret,{now=Date.now(),minutes=10}={}){
 key(secret);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(userId)||!Number.isInteger(minutes)||minutes<1||minutes>15)throw Error('Identifiant local ou durée non valide.');
 const claims={aud,scope,subject_hash:digest(userId.toLowerCase()),iat:Math.floor(now/1000),exp:Math.floor(now/1000)+minutes*60,jti:randomUUID()};
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return {grant:payload+'.'+signature(secret,payload),expires_at:new Date(claims.exp*1000).toISOString(),audit_id:claims.jti};
}
export function checkOwnerProbeGrant(req,staff,secret,now=Date.now()){
 try{
  key(secret);const token=req.headers['x-aj-owner-probe'];if(typeof token!=='string'||token.length>2048)return null;
  const [payload,sig,...extra]=token.split('.');if(extra.length||!payload||!sig||!/^[A-Za-z0-9_-]+$/.test(payload+sig))return null;
  const expected=Buffer.from(signature(secret,payload)),actual=Buffer.from(sig);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
  const c=JSON.parse(Buffer.from(payload,'base64url'));
  if(c.aud!==aud||c.scope!==scope||c.subject_hash!==digest(String(staff.id).toLowerCase())||!Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.exp)
   ||c.iat>Math.floor(now/1000)||c.exp<=Math.floor(now/1000)||c.exp<=c.iat||c.exp-c.iat>900||typeof c.jti!=='string'||!/^[a-f0-9-]{36}$/.test(c.jti))return null;
  return {audit_id:c.jti};
 }catch{return null;}
}
