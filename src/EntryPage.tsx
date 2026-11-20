import {useCallback,useEffect,useRef,useState} from 'react';
import {api,ApiFailure} from './lib/api';
import {getPhotographerSession,loginPhotographer,logoutPhotographer} from './lib/photographerAuth';
import {getSupabase} from './lib/supabase';
type Result={status:'valid'|'used'|'absent'|'unknown'|'error';admitted:boolean;guest_full_name?:string;reason?:string};
const labels={valid:'BILLET VALIDE',used:'BILLET DÉJÀ UTILISÉ',absent:'INVITÉ NON RECONNU',unknown:'BILLET NON RECONNU',error:'ERREUR DE VÉRIFICATION'};
export default function EntryPage(){
 const token=new URLSearchParams(window.location.search).get('token')||'';
 const [checking,setChecking]=useState(true),[authenticated,setAuthenticated]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 const started=useRef(false),working=useRef(false);
 useEffect(()=>{let active=true;void getPhotographerSession().then(user=>{if(active)setAuthenticated(Boolean(user));}).catch(()=>{if(active)setError('La connexion ne peut pas être vérifiée. Réessayez.');}).finally(()=>{if(active)setChecking(false);});let unsubscribe=()=>{};
  try{const {data}=getSupabase().auth.onAuthStateChange((_event,session)=>{if(active&&!session){setAuthenticated(false);setResult(null);started.current=false;}});unsubscribe=()=>data.subscription.unsubscribe();}catch{/* Session error is shown above. */}
  return()=>{active=false;unsubscribe();};},[]);
 const verify=useCallback(async()=>{
  if(working.current||!token)return;working.current=true;started.current=true;setBusy(true);setError('');setResult(null);const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  try{const opening=await api<{proof?:string;invalid:boolean}>('/api/tickets/open?token='+encodeURIComponent(token),{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
   if(opening.invalid){setResult({status:'unknown',admitted:false});return;}
   if(!opening.proof)throw Error();
   const value=await api<Result>('/api/tickets/verify',{method:'POST',body:JSON.stringify({token,proof:opening.proof}),signal:controller.signal});
   if(!['valid','used','absent','unknown','error'].includes(value.status)||value.admitted!==(value.status==='valid'))throw Error();setResult(value);
  }catch(e){if(e instanceof ApiFailure&&(e.status===401||(e.status===403&&e.code==='staff_required'))){setAuthenticated(false);started.current=false;setError('Connectez-vous avec un compte du personnel autorisé.');}else setResult({status:'error',admitted:false});}
  finally{clearTimeout(timeout);working.current=false;setBusy(false);}
 },[token]);
 useEffect(()=>{if(!authenticated||!token||started.current)return;let timer:ReturnType<typeof setTimeout>|undefined;const schedule=()=>{clearTimeout(timer);if(!document.hidden&&!(document as Document & {prerendering?:boolean}).prerendering&&document.hasFocus())timer=setTimeout(()=>{if(!started.current)void verify();},300);};schedule();window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',schedule);document.addEventListener('prerenderingchange',schedule);return()=>{clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',schedule);document.removeEventListener('prerenderingchange',schedule);};},[authenticated,token,verify]);
 async function login(e:React.FormEvent){e.preventDefault();if(working.current)return;working.current=true;setBusy(true);setError('');try{await loginPhotographer(email.trim(),password);setPassword('');started.current=false;setAuthenticated(true);}catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{await logoutPhotographer();setAuthenticated(false);setResult(null);started.current=false;}catch{setError('La déconnexion a échoué. Réessayez.');}finally{setBusy(false);}}
 return <div className="entry-page"><header><a href="/">Alicia & Jeff</a><span>Contrôle des invitations</span></header><main aria-busy={busy}>
 {checking?<p role="status">Vérification de la session…</p>:!authenticated?<><h1>Accès du personnel</h1><p>Connectez-vous pour contrôler les billets. Aucun invité ne peut valider lui-même son entrée.</p><form onSubmit={login}><label htmlFor="entry-email">Adresse e-mail<input id="entry-email" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label htmlFor="entry-password">Mot de passe<input id="entry-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button></form></>:<>
 <div className={'entry-result entry-'+(result?.status||'pending')} role="status" aria-live="polite"><h1>{busy?'VÉRIFICATION EN COURS…':result?labels[result.status]:token?'VÉRIFICATION DU BILLET':'Prêt à contrôler les billets'}</h1>{result?.status==='valid'&&<p>{result.guest_full_name}</p>}<p>{busy?'Patientez quelques instants.':result?.status==='valid'?'Première entrée enregistrée. Bienvenue !':result?.status==='used'?'Entrée déjà enregistrée. Ne pas autoriser un second passage.':result?.status==='absent'?'Ce nom ne figure pas sur la liste officielle. Entrée non autorisée.':result?.status==='unknown'?'Ce billet ne correspond à aucune confirmation. Entrée non autorisée.':result?.status==='error'?result.reason==='ambiguous_name'?'Nom ambigu dans la liste. Vérification humaine nécessaire. Entrée non autorisée.':'Vérification indisponible. Aucune entrée autorisée.':'Scannez le QR avec la caméra de ce téléphone et ouvrez le lien dans ce même navigateur.'}</p></div>
 {token&&(!result||result.status==='error')&&<button type="button" className="button" disabled={busy} onClick={()=>void verify()}>{result?'Réessayer':'Vérifier ce billet'}</button>}<button type="button" className="text-link" disabled={busy} onClick={()=>void logout()}>Déconnexion</button></>}{error&&<p role="alert" className="form-error">{error}</p>}
 </main></div>;
}
