import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {ApiError} from './http.mjs';
export const isTicketToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
const hmac=(secret,value)=>createHmac('sha256',secret).update('aj-ticket-navigation-v1:'+value).digest('base64url');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function isPreview(req){
 return /prefetch|prerender/i.test(String(req.headers['sec-purpose']||'')+' '+String(req.headers.purpose||'')+' '+String(req.headers['x-purpose']||''))
 ||/bot|crawler|spider|facebookexternalhit|whatsapp|slack|telegram|twitter|discord|preview|headless/i.test(String(req.headers['user-agent']||''));
}
export function scanChallenge(token,secret,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({ticket:digest(token),nonce:randomBytes(24).toString('base64url'),expires:now+90000})).toString('base64url');
 return {proof:payload+'.'+hmac(secret,payload),nonce:JSON.parse(Buffer.from(payload,'base64url')).nonce};
}
export function requireScanProof(req,body,secret,now=Date.now()){
 if(isPreview(req)||!req.headers.origin||req.headers['sec-fetch-site']!=='same-origin')
  throw new ApiError(403,'scan_navigation_required','Ouvrez le billet directement dans votre navigateur.');
 const proof=body.proof;
 if(typeof proof!=='string'||proof.length>800)throw new ApiError(403,'scan_navigation_required','Rouvrez le lien du billet.');
 const [payload,signature,...extra]=proof.split('.');
 if(extra.length||!payload||!signature||!equal(signature,hmac(secret,payload)))
  throw new ApiError(403,'scan_navigation_required','Rouvrez le lien du billet.');
 let value;try{value=JSON.parse(Buffer.from(payload,'base64url'));}catch{throw new ApiError(403,'scan_navigation_required','Rouvrez le lien du billet.');}
 const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('aj_ticket_scan='))?.slice(15);
 if(!cookie||typeof value.nonce!=='string'||!equal(cookie,value.nonce)||value.ticket!==digest(body.token)
 ||!Number.isFinite(value.expires)||value.expires<now||value.expires>now+90000)
  throw new ApiError(403,'scan_navigation_required','L’ouverture a expiré. Rouvrez le lien du billet.');
}
export function ticketResult(status,extra={}){
 const labels={valid:'BILLET VALIDE',absent:'INVITÉ NON RECONNU',unknown:'BILLET NON RECONNU',used:'BILLET DÉJÀ UTILISÉ',error:'ERREUR DE VÉRIFICATION'};
 return {status,label:labels[status]||labels.error,admitted:status==='valid',...extra};
}
export function sendTicketPage(req,res,{token,secret,invalid=false,failed=false}){
 const blocked=isPreview(req),challenge=!blocked&&!invalid&&!failed?scanChallenge(token,secret):null,nonce=randomBytes(18).toString('base64');
 const automatic=!blocked&&!failed&&req.headers['sec-fetch-user']==='?1'&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
 const input=JSON.stringify({token,proof:challenge?.proof,automatic,invalid,blocked,failed});
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive',
 'Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
 if(challenge)headers['Set-Cookie']='aj_ticket_scan='+challenge.nonce+'; Path=/api/tickets; HttpOnly; SameSite=Strict; Max-Age=90'+(req.headers['x-forwarded-proto']==='https'||req.socket?.encrypted?'; Secure':'');
 const script=[
 "const input="+input+";",
 "const title=document.getElementById('result'),detail=document.getElementById('detail'),name=document.getElementById('name'),action=document.getElementById('action');",
 "let started=false;",
 "async function verify(){if(started||document.visibilityState!=='visible'||document.prerendering)return;started=true;action.hidden=true;title.textContent='VÉRIFICATION EN COURS…';detail.textContent='Patientez quelques instants.';",
 "try{const response=await fetch('/api/tickets/verify',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:input.token,proof:input.proof}),signal:AbortSignal.timeout(20000)});const data=await response.json();",
 "if(!response.ok||!['valid','absent','unknown','used','error'].includes(data.status))throw Error();",
 "title.textContent=data.label;document.body.dataset.result=data.status;name.textContent=data.guest_full_name||'';",
 "detail.textContent=data.status==='valid'?'Première entrée enregistrée. Bienvenue !':data.status==='used'?'Entrée déjà enregistrée. Ne pas autoriser une seconde entrée.':data.status==='absent'?'Ce nom ne figure pas sur la liste officielle. Entrée non autorisée.':data.status==='unknown'?'Ce billet ne correspond à aucune confirmation. Entrée non autorisée.':data.reason==='ambiguous_name'?'Nom identique présent plusieurs fois dans la liste. Vérification humaine nécessaire. Entrée non autorisée.':'Vérification impossible. Entrée non autorisée.';",
 "}catch{title.textContent='ERREUR DE VÉRIFICATION';detail.textContent='Vérification impossible. Entrée non autorisée. Rouvrez le lien pour réessayer.';document.body.dataset.result='error';}}",
 "if(input.failed){title.textContent='ERREUR DE VÉRIFICATION';detail.textContent='Service indisponible. Aucune entrée autorisée.';action.hidden=true;}else if(input.invalid){title.textContent='BILLET NON RECONNU';detail.textContent='Identifiant invalide. Entrée non autorisée.';action.hidden=true;}",
 "else if(input.blocked){title.textContent='APERÇU DU BILLET';detail.textContent='Aucune entrée enregistrée. Ouvrez le lien dans votre navigateur.';action.hidden=true;}",
 "else{action.addEventListener('click',event=>{if(event.isTrusted)void verify();});",
 "if(input.automatic){let timer;const resume=()=>{clearTimeout(timer);if(document.visibilityState==='visible'&&!document.prerendering&&document.hasFocus())timer=setTimeout(()=>void verify(),700);};document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);document.addEventListener('prerenderingchange',resume);resume();}}"
 ].join('\n');
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Vérification du billet · Alicia & Jeff</title><style nonce="'+nonce+'">body{margin:0;background:#fff9f5;color:#43352f;font:17px Arial,sans-serif;display:grid;min-height:100dvh;place-items:center}main{box-sizing:border-box;width:min(92vw,520px);padding:42px 24px;background:white;border:1px solid #eec9bc;border-radius:24px;text-align:center}h1{font:28px Georgia,serif;line-height:1.35;overflow-wrap:anywhere}p{line-height:1.6}small{color:#946451}button{border:0;border-radius:28px;background:#d98f78;color:#fff;padding:16px 24px;font:inherit;cursor:pointer}body[data-result=valid] h1{color:#21704b}body[data-result=used] h1,body[data-result=absent] h1,body[data-result=unknown] h1{color:#a33125}#name{font-weight:bold;overflow-wrap:anywhere}</style></head><body><main aria-live="polite"><small>ALICIA & JEFF · 18 DÉCEMBRE 2026</small><h1 id="result">VÉRIFICATION DU BILLET</h1><p id="name"></p><p id="detail">Ouvrez le contrôle pour vérifier l’entrée.</p><button id="action" type="button">Vérifier ce billet</button><noscript><p>JavaScript est nécessaire. Aucune entrée autorisée.</p></noscript></main><script nonce="'+nonce+'">'+script+'</script></body></html>';
 res.writeHead(failed?503:200,headers);res.end(html);
}
