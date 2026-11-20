import {useCallback,useEffect,useRef,useState} from 'react';
import {Camera,ChevronLeft,ChevronRight,Download,Heart,Image as ImageIcon,Loader2,MessageCircle,Send,X} from 'lucide-react';
import {api} from '../lib/api';
interface Message{id:string;author:string;body:string;created_at:string}
interface Album{id:string;title:string;count:number;cover:string|null}
interface Photo{id:string;caption:string;url:string;download_url:string}
interface Memories{messages:Message[];message_count:number;gallery_available:boolean;release_at:string;albums:Album[]}
export default function Souvenirs({open,onOpen,revision}:{open:boolean;onOpen:()=>void;revision:number}){
  const dialog=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|null>(null);
  const [tab,setTab]=useState<'messages'|'images'>('messages');
  const [data,setData]=useState<Memories|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [author,setAuthor]=useState(''),[body,setBody]=useState(''),[website,setWebsite]=useState(''),[sending,setSending]=useState(false),[sent,setSent]=useState(false),[reference,setReference]=useState(()=>crypto.randomUUID());
  const [album,setAlbum]=useState<Album|null>(null),[photos,setPhotos]=useState<Photo[]>([]),[more,setMore]=useState(false),[photoIndex,setPhotoIndex]=useState<number|null>(null),[moreMessages,setMoreMessages]=useState(false);
  const refresh=useCallback(async()=>{setError('');setLoading(true);try{const result=await api<Memories>('/api/souvenirs');setData(result);setMoreMessages(result.message_count>result.messages.length);}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
  useEffect(()=>{if(!open)return;refresh();const timer=setInterval(refresh,30_000);return()=>clearInterval(timer);},[open,revision,refresh]);
  useEffect(()=>{
    if(!data)return;
    if(!data.gallery_available||(album&&!data.albums.some(a=>a.id===album.id))){setAlbum(null);setPhotos([]);setPhotoIndex(null);}
    else if(album){const latest=data.albums.find(a=>a.id===album.id);if(latest&&(latest.count!==album.count||latest.title!==album.title))setAlbum(latest);}
  },[data,album]);
  useEffect(()=>{
    if(!open||!album)return;
    let active=true;
    const renew=async()=>{
      try{
        const refreshed:Photo[]=[];let hasMore=false;
        for(let offset=0;offset<Math.max(photos.length,1);offset+=60){
          const page=await api<{photos:Photo[];has_more:boolean}>('/api/photos?album='+album.id+'&offset='+offset);
          refreshed.push(...page.photos);hasMore=page.has_more;if(!hasMore)break;
        }
        if(active){setPhotos(refreshed);setMore(hasMore);setPhotoIndex(index=>index!==null&&index>=refreshed.length?null:index);}
      }catch{if(active){setPhotos([]);setPhotoIndex(null);setAlbum(null);void refresh();}}
    };
    void renew();
    const timer=setInterval(()=>void renew(),8*60_000);
    const visible=()=>{if(!document.hidden)void renew();};
    document.addEventListener('visibilitychange',visible);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[open,album,photos.length,refresh]);
  const move=useCallback((delta:number)=>setPhotoIndex(i=>i===null?null:(i+delta+photos.length)%photos.length),[photos.length]);
  const photoOpen=photoIndex!==null;
  useEffect(()=>{if(!photoOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();const listener=(e:KeyboardEvent)=>{if(e.key==='Escape')setPhotoIndex(null);if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1);if(e.key==='Tab'){const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')??[]);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',listener);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',listener);opener.current?.focus();};},[photoOpen,move]);
  async function post(event:React.FormEvent){
    event.preventDefault();setSending(true);setError('');setSent(false);
    try{await api('/api/messages',{method:'POST',body:JSON.stringify({author:author.trim(),body:body.trim(),website,client_ref:reference})});setBody('');setReference(crypto.randomUUID());setSent(true);await refresh();}
    catch(e){setError((e as Error).message);}finally{setSending(false);}
  }
  async function viewAlbum(selected:Album,append=false){
    setLoading(true);setError('');try{const result=await api<{photos:Photo[];has_more:boolean}>(`/api/photos?album=${selected.id}&offset=${append?photos.length:0}`);setAlbum(selected);setPhotos(previous=>append?[...previous,...result.photos]:result.photos);setMore(result.has_more);}
    catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  async function loadMessages(){if(!data)return;setLoading(true);try{const result=await api<{messages:Message[];has_more:boolean}>(`/api/messages?offset=${data.messages.length}`);setData({...data,messages:[...data.messages,...result.messages]});setMoreMessages(result.has_more);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  function showMessages(){setTab('messages');onOpen();requestAnimationFrame(()=>document.getElementById('message-form')?.scrollIntoView({behavior:'smooth',block:'center'}));}
  const photo=photoIndex===null?null:photos[photoIndex];
  return <section className="souvenirs-section section" id="souvenirs" aria-labelledby="souvenirs-heading">
    <div className="memories-heading"><span className="eyebrow">LES PETITS INSTANTS, LES GRANDS SOUVENIRS</span><h2 id="souvenirs-heading">Les souvenirs passent.<br/><em>Les émotions restent.</em></h2><p>Vos mots d’aujourd’hui et nos images de demain,<br/>réunis au même endroit, pour longtemps.</p><div className="memory-actions"><button className="button" aria-expanded={open} aria-controls="souvenirs-content" onClick={onOpen}><Heart size={16}/> {open?'Nos souvenirs':'Ouvrir nos souvenirs'}</button><button className="text-link" onClick={showMessages}><MessageCircle size={16}/> Laisser un message</button></div></div>
    {open&&<div className="memories-content" id="souvenirs-content">
      <div className="memory-tabs" role="tablist" aria-label="Nos souvenirs" onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'messages':e.key==='End'?'images':tab==='messages'?'images':'messages';setTab(next);document.getElementById(next+'-tab')?.focus();}}}><button role="tab" id="messages-tab" aria-controls="messages-panel" aria-selected={tab==='messages'} tabIndex={tab==='messages'?0:-1} onClick={()=>setTab('messages')}><MessageCircle size={18}/> Souvenirs · Messages {data&&<small>{data.message_count}</small>}</button><button role="tab" id="images-tab" aria-controls="images-panel" aria-selected={tab==='images'} tabIndex={tab==='images'?0:-1} onClick={()=>setTab('images')}><Camera size={18}/> Souvenirs · Images</button></div>
      {error&&<p className="form-error" role="alert">{error} <button className="text-link" onClick={refresh}>Réessayer</button></p>}
      {tab==='messages'&&<div role="tabpanel" id="messages-panel" aria-labelledby="messages-tab" className="messages-layout"><div className="message-wall" aria-live="polite">
        {loading&&!data&&<p className="empty-memory"><Loader2 className="animate-spin" size={20}/> Ouverture du livre d’or…</p>}
        {data&&!data.messages.length&&<div className="empty-memory"><Heart size={30} strokeWidth={1}/><h3>Le premier mot sera le vôtre.</h3><p>Une pensée, un souvenir, des vœux…<br/>Chaque mot est un cadeau que nous garderons.</p></div>}
        {data?.messages.map(message=><article className="guest-message" key={message.id}><span className="quote-mark" aria-hidden="true">“</span><p>{message.body}</p><footer><span>{message.author}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleDateString('fr-FR',{timeZone:'Africa/Dakar',day:'numeric',month:'long'})}</time></footer></article>)}
        {moreMessages&&<button className="text-link" disabled={loading} onClick={loadMessages}>Lire les messages précédents</button>}
      </div><form className="message-form" id="message-form" onSubmit={post}><span className="eyebrow">LE LIVRE D’OR</span><h3>Quelques mots pour nous.</h3><label htmlFor="message-author">Votre prénom<input id="message-author" required autoComplete="given-name" maxLength={80} value={author} onChange={e=>setAuthor(e.target.value)}/></label><label htmlFor="message-body">Votre message<textarea id="message-body" required rows={5} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Un petit mot qui restera…"/></label><p className="field-note">Votre prénom et votre message seront visibles par les visiteurs dans ce livre d’or.</p><label className="honeypot" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label><button className="button" disabled={sending}>{sending?<Loader2 className="animate-spin" size={15}/>:<Send size={15}/>} Publier mon petit mot</button>{sent&&<p className="message-sent" role="status">Merci ! Votre message a rejoint nos souvenirs.</p>}</form></div>}
      {tab==='images'&&<div role="tabpanel" id="images-panel" aria-labelledby="images-tab" className="image-memories">
        {!data?.gallery_available?<div className="empty-memory"><ImageIcon size={35} strokeWidth={1}/><h3>Nos images viendront après le grand oui.</h3><p>Après la cérémonie, notre photographe déposera ici<br/>les plus beaux instants du mariage.</p><small>Les albums apparaîtront après la cérémonie, dès leur publication.</small></div>:<>
          {album?<><button className="text-link" onClick={()=>{setAlbum(null);setPhotos([]);}}><ChevronLeft size={15}/> Tous les albums</button><h3 className="album-heading">{album.title}</h3>{!photos.length&&!loading&&<p className="empty-memory">Les photographies de cet album seront bientôt disponibles.</p>}<div className="souvenir-photo-grid">{photos.map((p,i)=><button key={p.id} onClick={e=>{opener.current=e.currentTarget;setPhotoIndex(i);}} aria-label={`Agrandir ${p.caption||'la photographie'}`}><img src={p.url} alt={p.caption||'Souvenir du mariage'} loading="lazy"/></button>)}</div>{more&&<button className="text-link" onClick={()=>viewAlbum(album,true)} disabled={loading}>Voir d’autres photographies</button>}</>:<div className="album-grid">{data.albums.map(a=><button className="album-cover" key={a.id} onClick={()=>viewAlbum(a)}>{a.cover?<img src={a.cover} alt={a.title} loading="lazy"/>:<Camera strokeWidth={1} size={40}/>}<span>{a.title}<small>{a.count} photographie{a.count>1?'s':''}</small></span></button>)}{!data.albums.length&&<p className="empty-memory">Notre photographe prépare les premiers albums. Revenez bientôt.</p>}</div>}
        </>}
        <a className="photographer-toggle text-link" href="/photographe"><Camera size={14}/> Espace photographe</a>
      </div>}
    </div>}
    {photo&&<div className="photo-lightbox" ref={dialog} role="dialog" aria-modal="true" aria-label="Photographie du mariage en grand format" onClick={()=>setPhotoIndex(null)}><button className="lightbox-close" aria-label="Fermer la photographie" autoFocus onClick={()=>setPhotoIndex(null)}><X/></button><button className="lightbox-prev" aria-label="Photo précédente" onClick={e=>{e.stopPropagation();move(-1);}}><ChevronLeft/></button><figure onClick={e=>e.stopPropagation()}><img src={photo.url} alt={photo.caption||'Souvenir du mariage'}/><figcaption>{photo.caption}<a className="button" href={photo.download_url} download><Download size={15}/> Télécharger</a></figcaption></figure><button className="lightbox-next" aria-label="Photo suivante" onClick={e=>{e.stopPropagation();move(1);}}><ChevronRight/></button></div>}
  </section>;
}
