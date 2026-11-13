import {useState} from 'react';
import {ArrowUpRight,CheckCircle2,Download,Heart,Loader2} from 'lucide-react';
import {api,persistentId} from '../lib/api';
import {downloadTicket} from '../lib/tickets';
import type {Ticket} from '../lib/types';
const STORAGE='aj-invitation-2026';
function savedTicket():Ticket|null{try{return JSON.parse(localStorage.getItem(STORAGE)||'null');}catch{return null;}}
export default function RsvpSection({onMessagePublished}:{onMessagePublished:()=>void}){
  const [ticket,setTicket]=useState<Ticket|null>(savedTicket);
  const [first,setFirst]=useState(''),[last,setLast]=useState(''),[count,setCount]=useState(1),[song,setSong]=useState(''),[message,setMessage]=useState(''),[website,setWebsite]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[downloading,setDownloading]=useState<'pdf'|'png'|null>(null);
  async function confirm(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const result=await api<{ticket:Ticket;message_published:boolean}>('/api/rsvp',{method:'POST',body:JSON.stringify({first_name:first.trim(),last_name:last.trim(),participants:count,song,message,website,client_ref:persistentId('aj-confirmation-2026')})});
      setTicket(result.ticket);try{localStorage.setItem(STORAGE,JSON.stringify(result.ticket));}catch{/* The confirmation is already safely saved by the server. */}
      if(result.message_published)onMessagePublished();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function download(format:'pdf'|'png'){
    if(!ticket)return;setDownloading(format);setError('');
    try{await downloadTicket(ticket,format);}catch{setError('Le téléchargement a échoué. Réessayez ou choisissez l’autre format.');}finally{setDownloading(null);}
  }
  return <section className="rsvp-inline section" id="presence" aria-labelledby="rsvp-heading">
    <div className="rsvp-intro"><Heart strokeWidth={1}/><span className="eyebrow">UNE PLACE VOUS ATTEND</span><h2 id="rsvp-heading">Et si vous faisiez partie<br/>de ce beau <em>chapitre ?</em></h2><p>Votre présence sera notre plus beau cadeau.<br/>Confirmez ici et recevez votre invitation personnelle.</p><span className="signature">Avec amour, Alicia & Jeff</span></div>
    <div className="rsvp-form-card">
    {ticket?<div className="confirmation-success" role="status"><CheckCircle2 size={35} strokeWidth={1}/><span className="eyebrow">C’EST CONFIRMÉ !</span><h3>À très bientôt,<br/>{ticket.guest_full_name}.</h3><p>Nous vous attendons avec joie le 18 décembre, à Dakar.<br/>{ticket.allowed_persons} personne{ticket.allowed_persons>1?'s':''} · {ticket.ticket_number}</p><div className="download-actions"><button className="button" disabled={!!downloading} onClick={()=>download('pdf')}>{downloading==='pdf'?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Carte PDF complète</button><button className="button button-outline" disabled={!!downloading} onClick={()=>download('png')}>{downloading==='png'?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Image PNG</button></div><small>La carte est intégralement conservée dans les deux formats.</small><button className="text-link" onClick={()=>{const names=ticket.guest_full_name.split(' ');setFirst(ticket.guest_first_name||first||names[0]);setLast(ticket.guest_last_name||last||names.slice(1).join(' '));setCount(ticket.allowed_persons);setTicket(null);}}>Modifier ma confirmation</button></div>:
    <form onSubmit={confirm}>
      <span className="eyebrow">OUI, JE SERAI LÀ</span><h3>Un bonheur à partager.</h3>
      <div className="form-grid"><label htmlFor="presence-first">Prénom<input id="presence-first" required autoComplete="given-name" maxLength={80} value={first} onChange={e=>setFirst(e.target.value)}/></label><label htmlFor="presence-last">Nom<input id="presence-last" required autoComplete="family-name" maxLength={80} value={last} onChange={e=>setLast(e.target.value)}/></label></div>
      <label htmlFor="presence-count">Nombre de personnes, vous compris<select id="presence-count" value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i} value={i+1}>{i+1} personne{i?'s':''}</option>)}</select></label>
      <label htmlFor="presence-song">Une chanson pour la soirée <span>(facultatif)</span><input id="presence-song" maxLength={200} value={song} onChange={e=>setSong(e.target.value)} placeholder="Le titre qui vous fera danser…"/></label>
      <label htmlFor="presence-message">Un petit mot pour les mariés <span>(facultatif)</span><textarea id="presence-message" rows={3} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Vos vœux, un souvenir, quelques mots d’amour…"/></label><p className="field-note">Votre prénom et votre petit mot seront visibles dans « Souvenirs · Messages ».</p>
      <label className="honeypot" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label>
      <button className="button" disabled={busy}>{busy?<><Loader2 size={15} className="animate-spin"/> Enregistrement…</>:<>Confirmer ma présence <ArrowUpRight size={16}/></>}</button>
      <p className="field-note">Votre carte sera disponible juste après la confirmation.</p>
    </form>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}

