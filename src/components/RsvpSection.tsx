import {useRef,useState} from 'react';
import {ArrowUpRight,CheckCircle2,Download,Heart,Loader2} from 'lucide-react';
import {api,ApiFailure} from '../lib/api';
import {downloadTicket} from '../lib/tickets';
import {discardPendingReceipt,receipts,saveReceipt,selectReceipt,selectedReceipt,type Receipt} from '../lib/rsvpSessions';
import {canonicalRsvp,createRsvpRef} from '../../shared/rsvp-reference.mjs';
import type {Ticket} from '../lib/types';
export default function RsvpSection({onMessagePublished}:{onMessagePublished:()=>void}){
  const [initial]=useState(selectedReceipt);
  const [ticket,setTicket]=useState<Ticket|null>(initial?.ticket||null);
  const [attempt,setAttempt]=useState<Receipt|null>(initial?.ticket?null:initial);
  const [first,setFirst]=useState(initial?.payload?.first_name||''),[last,setLast]=useState(initial?.payload?.last_name||''),[song,setSong]=useState(initial?.payload?.song||''),[message,setMessage]=useState(initial?.payload?.message||''),[website,setWebsite]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[downloading,setDownloading]=useState<'pdf'|'png'|null>(null),[recovery,setRecovery]=useState('');
  const submitting=useRef(false);
  const [downloadStatus,setDownloadStatus]=useState<'idle'|'started'|'failed'>('idle');
  function newGuest(){if(submitting.current)return;selectReceipt(null);setTicket(null);setAttempt(null);setFirst('');setLast('');setSong('');setMessage('');setWebsite('');setRecovery('');setError('');setDownloadStatus('idle');}
  async function confirm(event:React.FormEvent){
    event.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError('');setDownloadStatus('idle');
    let result:{ticket:Ticket;message_published:boolean};let current=attempt;
    try{
      if(!current){const payload=canonicalRsvp({first_name:first,last_name:last,song,message});if(!payload.first_name||!payload.last_name)throw Error('Indiquez votre prénom et votre nom.');current={ref:await createRsvpRef(payload),payload};saveReceipt(current);setAttempt(current);}
      result=await api('/api/rsvp',{method:'POST',body:JSON.stringify({...current.payload,website,client_ref:current.ref})});
    }catch(e){if(e instanceof ApiFailure&&e.status===400&&current){discardPendingReceipt(current.ref);setAttempt(null);}setError((e as Error).message);submitting.current=false;setBusy(false);return;}
    setTicket(result.ticket);saveReceipt({ref:current.ref,ticket:result.ticket});setAttempt(null);
    if(result.message_published)try{onMessagePublished();}catch{/* Guestbook refresh must not prevent ticket download. */}
    setDownloading('png');
    try{await downloadTicket(result.ticket,'png');setDownloadStatus('started');}
    catch{setDownloadStatus('failed');setError('Votre présence est confirmée. Le téléchargement automatique a échoué : utilisez un bouton ci-dessous pour réessayer.');}
    finally{setDownloading(null);submitting.current=false;setBusy(false);}
  }
  async function recover(receipt?:Receipt){
    if(submitting.current)return;submitting.current=true;setBusy(true);setError('');
    try{
      if(receipt?.payload&&!receipt.ticket){selectReceipt(receipt.ref);setAttempt(receipt);setTicket(null);setFirst(receipt.payload.first_name);setLast(receipt.payload.last_name);setSong(receipt.payload.song||'');setMessage(receipt.payload.message||'');return;}
      const value=recovery.trim();let body: {client_ref:string}|{qr_token:string};
      if(receipt)body=receipt.ticket?{qr_token:receipt.ticket.qr_token}:{client_ref:receipt.ref};
      else if(/^R3-[a-f0-9-]+$/.test(value))body={client_ref:value};
      else {let token=value;if(/^https?:\/\//i.test(value))token=new URL(value).searchParams.get('token')||'';body={qr_token:token};}
      const result=await api<{ticket:Ticket}>('/api/rsvp/ticket',{method:'POST',body:JSON.stringify(body)});
      saveReceipt({ref:receipt?.ref||result.ticket.qr_token,ticket:result.ticket});setTicket(result.ticket);setAttempt(null);setDownloadStatus('idle');setRecovery('');
    }catch(e){setError((e as Error).message);}finally{submitting.current=false;setBusy(false);}
  }
  async function download(format:'pdf'|'png'){
    if(!ticket)return;setDownloading(format);setError('');
    try{await downloadTicket(ticket,format);setDownloadStatus('started');}catch{setDownloadStatus('failed');setError('Le téléchargement a échoué. Réessayez ou choisissez l’autre format.');}finally{setDownloading(null);}
  }
  return <section className="rsvp-inline section" id="presence" aria-labelledby="rsvp-heading">
    <div className="rsvp-intro"><Heart strokeWidth={1}/><span className="eyebrow">UNE PLACE VOUS ATTEND</span><h2 id="rsvp-heading">Et si vous faisiez partie<br/>de ce beau <em>chapitre&nbsp;?</em></h2><p>Votre présence sera notre plus beau cadeau.<br/>Confirmez ici et recevez votre invitation personnelle.</p><span className="signature">Avec amour, Alicia & Jeff</span></div>
    <div className="rsvp-form-card">
    {ticket?<div className="confirmation-success" role="status"><CheckCircle2 size={35} strokeWidth={1}/><span className="eyebrow">C’EST CONFIRMÉ !</span><h3>À très bientôt,<br/>{ticket.guest_full_name}.</h3><p>Nous vous attendons avec joie le 18 décembre, à Dakar.<br/>{ticket.ticket_number}</p><p role="status">{downloading?'Votre carte est en préparation…':downloadStatus==='started'?'Le téléchargement de votre billet a été lancé. Vous pouvez le télécharger à nouveau ci-dessous.':downloadStatus==='failed'?'Votre confirmation est enregistrée. Votre billet reste disponible ci-dessous.':'Votre confirmation est enregistrée et votre billet reste disponible.'}</p><div className="download-actions"><button className="button" disabled={!!downloading} onClick={()=>download('pdf')}>{downloading==='pdf'?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Télécharger à nouveau le PDF</button><button className="button button-outline" disabled={!!downloading} onClick={()=>download('png')}>{downloading==='png'?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} Télécharger à nouveau le PNG</button></div><small>La carte est intégralement conservée dans les deux formats.</small><label htmlFor="ticket-recovery-code">Code personnel de récupération<input id="ticket-recovery-code" readOnly value={ticket.qr_token} onFocus={e=>e.target.select()}/></label><small>Conservez ce code ou le lien de votre QR pour retrouver ce billet sur un autre appareil. Ne le partagez pas.</small><button className="text-link" disabled={busy||!!downloading} onClick={newGuest}>Confirmer pour une autre personne</button></div>:
    <form onSubmit={confirm}>
      <fieldset disabled={busy||!!attempt} style={{border:0,padding:0,margin:0,minWidth:0}}>
      <span className="eyebrow">OUI, JE SERAI LÀ</span><h3>Un bonheur à partager.</h3>
      <div className="form-grid"><label htmlFor="presence-first">Prénom<input id="presence-first" required autoComplete="given-name" maxLength={80} value={first} onChange={e=>setFirst(e.target.value)}/></label><label htmlFor="presence-last">Nom<input id="presence-last" required autoComplete="family-name" maxLength={80} value={last} onChange={e=>setLast(e.target.value)}/></label></div>
      <label htmlFor="presence-song">Une chanson pour la soirée <span>(facultatif)</span><input id="presence-song" maxLength={200} value={song} onChange={e=>setSong(e.target.value)} placeholder="Le titre qui vous fera danser…"/></label>
      <label htmlFor="presence-message">Un petit mot pour les mariés <span>(facultatif)</span><textarea id="presence-message" rows={3} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Vos vœux, un souvenir, quelques mots d’amour…"/></label><p className="field-note">Votre prénom et votre petit mot seront visibles dans « Souvenirs · Messages ».</p>
      <label className="honeypot" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label>
      </fieldset>
      <button className="button" disabled={busy}>{busy?<><Loader2 size={15} className="animate-spin"/> Enregistrement…</>:<>Confirmer ma présence <ArrowUpRight size={16}/></>}</button>
      <p className="field-note">Un billet nominatif pour une seule personne. Votre carte sera téléchargée automatiquement après la confirmation.</p>
      {attempt&&<><p className="field-note">Cette demande est conservée. Réessayez pour récupérer le même billet, même si la réponse précédente a été interrompue.</p><button type="button" className="text-link" disabled={busy} onClick={newGuest}>Confirmer pour une autre personne</button></>}
    </form>}
    {!busy&&<details className="rsvp-recovery"><summary>Déjà confirmé ? Récupérer un billet</summary><p className="field-note">Utilisez votre code personnel ou le lien du QR. Le nom seul ne permet pas de distinguer les homonymes.</p><form onSubmit={e=>{e.preventDefault();void recover();}}><label htmlFor="recover-ticket">Code personnel ou lien du QR<input id="recover-ticket" required value={recovery} onChange={e=>setRecovery(e.target.value)} autoComplete="off" spellCheck={false}/></label><button className="button button-outline" disabled={busy}>Récupérer mon billet</button></form><p className="field-note">Confirmations conservées sur cet appareil partagé :</p>{receipts().map(r=><button key={r.ref} className="text-link" type="button" disabled={busy} onClick={()=>void recover(r)}>{r.ticket?r.ticket.guest_full_name+' · '+r.ticket.ticket_number:r.payload?'Reprendre '+r.payload.first_name+' '+r.payload.last_name:'Récupérer une ancienne confirmation'}</button>)}<p className="field-note">Sans code ni confirmation conservée, contactez les mariés. Aucune recherche par nom ne remplace un billet existant.</p></details>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}

