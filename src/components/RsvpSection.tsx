import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,CheckCircle2,Download,Heart,Loader2} from 'lucide-react';
import {api,persistentId} from '../lib/api';
import {downloadTicket} from '../lib/tickets';
import type {Ticket} from '../lib/types';
const STORAGE='aj-invitation-2026';
function savedTicket():Ticket|null{try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null');return value&&typeof value.guest_full_name==='string'&&typeof value.qr_token==='string'?value:null;}catch{return null;}}
export default function RsvpSection({onMessagePublished}:{onMessagePublished:()=>void}){
  const [ticket,setTicket]=useState<Ticket|null>(savedTicket);
  const [first,setFirst]=useState(''),[last,setLast]=useState(''),[song,setSong]=useState(''),[message,setMessage]=useState(''),[website,setWebsite]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[downloading,setDownloading]=useState<'pdf'|'png'|null>(null);
  const submitting=useRef(false);
  const [downloadStatus,setDownloadStatus]=useState<'idle'|'started'|'failed'>('idle');
  useEffect(()=>{
    let active=true;
    let ref:string|null=null;try{ref=localStorage.getItem('aj-confirmation-2026');}catch{/* Local storage is optional. */}
    if(ref)void api<{ticket:Ticket}>('/api/rsvp/ticket',{method:'POST',body:JSON.stringify({client_ref:ref})})
      .then(result=>{if(!active)return;setTicket(result.ticket);try{localStorage.setItem(STORAGE,JSON.stringify(result.ticket));}catch{/* Already saved on the server. */}})
      .catch(()=>{/* A temporary retrieval failure never erases a previously saved confirmation. */});
    return()=>{active=false;};
  },[]);
  async function confirm(event:React.FormEvent){
    event.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError('');setDownloadStatus('idle');
    let result:{ticket:Ticket;message_published:boolean};
    try{
      result=await api('/api/rsvp',{method:'POST',body:JSON.stringify({first_name:first.trim(),last_name:last.trim(),song,message,website,client_ref:persistentId('aj-confirmation-2026')})});
    }catch(e){setError((e as Error).message);submitting.current=false;setBusy(false);return;}
    setTicket(result.ticket);try{localStorage.setItem(STORAGE,JSON.stringify(result.ticket));}catch{/* The confirmation remains safely saved by the server. */}
    if(result.message_published)try{onMessagePublished();}catch{/* Guestbook refresh must not prevent ticket download. */}
    setDownloading('png');
    try{await downloadTicket(result.ticket,'png');setDownloadStatus('started');}
    catch{setDownloadStatus('failed');setError('Votre présence est confirmée. Le téléchargement automatique a échoué : utilisez un bouton ci-dessous pour réessayer.');}
    finally{setDownloading(null);submitting.current=false;setBusy(false);}
  }
  async function download(format:'pdf'|'png'){
    if(!ticket)return;setDownloading(format);setError('');
    try{await downloadTicket(ticket,format);setDownloadStatus('started');}catch{setDownloadStatus('failed');setError('Le téléchargement a échoué. Réessayez ou choisissez l’autre format.');}finally{setDownloading(null);}
  }
  return <section className="rsvp-inline section" id="presence" aria-labelledby="rsvp-heading">
    <div className="rsvp-intro"><Heart strokeWidth={1}/><span className="eyebrow">UNE PLACE VOUS ATTEND</span><h2 id="rsvp-heading">Et si vous faisiez partie<br/>de ce beau <em>chapitre&nbsp;?</em></h2><p>Votre présence sera notre plus beau cadeau.<br/>Confirmez ici et recevez votre invitation personnelle.</p><span className="signature">Avec amour, Alicia & Jeff</span></div>
    <div className="rsvp-form-card">
    {ticket?<div className="confirmation-success" role="status"><CheckCircle2 size={35} strokeWidth={1}/><span className="eyebrow">C’EST CONFIRMÉ !</span><h3>À très bientôt,<br/>{ticket.guest_full_name}.</h3><p>Nous vous attendons avec joie le 18 décembre, à Dakar.<br/>{ticket.ticket_number}</p><p role="status">{downloading?'Votre carte est en préparation…':downloadStatus==='started'?'Le téléchargement de votre billet a été lancé. Vous pouvez le télécharger à nouveau ci-dessous.':downloadStatus==='failed'?'Votre confirmation est enregistrée. Votre billet reste disponible ci-dessous.':'Votre confirmation est enregistrée et votre billet reste disponible.'}</p><div className="download-actions"><button className="button" disabled={!!downloading} onClick={()=>download('pdf')}>{downloading==='pdf'?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Télécharger à nouveau le PDF</button><button className="button button-outline" disabled={!!downloading} onClick={()=>download('png')}>{downloading==='png'?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Télécharger à nouveau le PNG</button></div><small>La carte est intégralement conservée dans les deux formats.</small><button className="text-link" disabled={busy} onClick={()=>{const names=ticket.guest_full_name.split(' ');setFirst(ticket.guest_first_name||first||names[0]);setLast(ticket.guest_last_name||last||names.slice(1).join(' '));setTicket(null);}}>Modifier ma confirmation</button></div>:
    <form onSubmit={confirm}>
      <span className="eyebrow">OUI, JE SERAI LÀ</span><h3>Un bonheur à partager.</h3>
      <div className="form-grid"><label htmlFor="presence-first">Prénom<input id="presence-first" required autoComplete="given-name" maxLength={80} value={first} onChange={e=>setFirst(e.target.value)}/></label><label htmlFor="presence-last">Nom<input id="presence-last" required autoComplete="family-name" maxLength={80} value={last} onChange={e=>setLast(e.target.value)}/></label></div>
      <label htmlFor="presence-song">Une chanson pour la soirée <span>(facultatif)</span><input id="presence-song" maxLength={200} value={song} onChange={e=>setSong(e.target.value)} placeholder="Le titre qui vous fera danser…"/></label>
      <label htmlFor="presence-message">Un petit mot pour les mariés <span>(facultatif)</span><textarea id="presence-message" rows={3} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Vos vœux, un souvenir, quelques mots d’amour…"/></label><p className="field-note">Votre prénom et votre petit mot seront visibles dans « Souvenirs · Messages ».</p>
      <label className="honeypot" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label>
      <button className="button" disabled={busy}>{busy?<><Loader2 size={15} className="animate-spin"/> Enregistrement…</>:<>Confirmer ma présence <ArrowUpRight size={16}/></>}</button>
      <p className="field-note">Un billet nominatif pour une seule personne. Votre carte sera téléchargée automatiquement après la confirmation.</p>
    </form>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}

