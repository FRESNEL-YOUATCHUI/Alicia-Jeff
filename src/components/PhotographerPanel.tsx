import {useCallback,useEffect,useRef,useState} from 'react';
import {Camera,Loader2,LogOut,Plus,Upload} from 'lucide-react';
import {api,ApiFailure} from '../lib/api';
import {getSupabase} from '../lib/supabase';
import {cancelUploads,uploadBatch,type UploadJob} from '../lib/uploads';
import {loginPhotographer,logoutPhotographer,getPhotographerSession} from '../lib/photographerAuth';
interface AdminPhoto{id:string;caption:string;url:string;hidden:boolean}
interface AdminAlbum{id:string;title:string;published:boolean;hidden:boolean;photos:AdminPhoto[];has_more:boolean}
interface AdminState{albums:AdminAlbum[];settings:{galleryPublished:boolean};messages:{id:string;author:string;body:string;hidden:boolean}[];response_count:number;messages_has_more:boolean}
export default function PhotographerPanel({onChanged}:{onChanged:()=>void}){
  const [state,setState]=useState<AdminState|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [authenticated,setAuthenticated]=useState(false),[checkingSession,setCheckingSession]=useState(true);
  const [title,setTitle]=useState(''),[album,setAlbum]=useState('');
  const jobs=useRef<UploadJob[]>([]),controller=useRef<AbortController|null>(null);
  const [pending,setPending]=useState(false),[uploading,setUploading]=useState(false);
  const refresh=useCallback(async()=>{setState(await api<AdminState>('/api/admin/state'));onChanged();},[onChanged]);
  useEffect(()=>{
    let active=true;
    void getPhotographerSession().then(user=>{if(active)setAuthenticated(Boolean(user));}).catch(e=>{if(active)setError((e as Error).message);}).finally(()=>{if(active)setCheckingSession(false);});
    let unsubscribe=()=>{};
    try{const {data}=getSupabase().auth.onAuthStateChange((_event,session)=>{if(active&&!session){setAuthenticated(false);setState(null);controller.current?.abort();}});unsubscribe=()=>data.subscription.unsubscribe();}catch{/* Public invitation remains usable without Auth config. */}
    return()=>{active=false;unsubscribe();controller.current?.abort();};
  },[]);
  useEffect(()=>{
    if(!authenticated)return;
    let active=true;
    const load=()=>refresh().catch(e=>{if(active){setError((e as Error).message);if(e instanceof ApiFailure&&[401,403].includes(e.status)){setState(null);setAuthenticated(false);}}});
    void load();const timer=setInterval(load,8*60_000);
    return()=>{active=false;clearInterval(timer);};
  },[authenticated,refresh]);
  async function handleLogin(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    await action(async()=>{
      await loginPhotographer(email.trim(),password);
      setPassword('');
      setAuthenticated(true);
      setNotice('Connexion réussie. Chargement des albums…');
    });
  }
  async function handleLogout(){
    await action(async()=>{
      controller.current?.abort();jobs.current=[];setPending(false);
      await logoutPhotographer();
      setAuthenticated(false);
      setState(null);
      setEmail('');
    });
  }
  async function action(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const patch=(url:string,body:unknown)=>action(async()=>{await api(url,{method:'PATCH',body:JSON.stringify(body)});await refresh();});
  async function upload(files?:File[]){
    if(files){jobs.current=files.map(file=>({file,album,reference:crypto.randomUUID()}));}
    setUploading(true);controller.current=new AbortController();
    await action(async()=>{
      try{
        if(!album)throw new Error('Choisissez d’abord un album.');
        await uploadBatch(jobs.current,controller.current!.signal,(done,total)=>setNotice(done+' / '+total+' photographies importées.'));
        setPending(false);await refresh();setNotice('Les photographies ont été enregistrées.');jobs.current=[];
      }finally{setPending(jobs.current.some(j=>!j.done));}
    });
    controller.current=null;setUploading(false);
  }
  async function cancel(){
    controller.current?.abort();
    await cancelUploads(jobs.current);jobs.current=[];setPending(false);setNotice('Import arrêté. Les fichiers incomplets seront nettoyés après expiration de leur autorisation.');
  }
  async function morePhotos(a:AdminAlbum){
    await action(async()=>{const page=await api<{photos:AdminPhoto[];has_more:boolean}>('/api/admin/albums/'+a.id+'/photos?offset='+a.photos.length);setState(previous=>previous?{...previous,albums:previous.albums.map(item=>item.id===a.id?{...item,photos:[...item.photos,...page.photos],has_more:page.has_more}:item)}:previous);});
  }
  async function moreMessages(){
    if(!state)return;
    await action(async()=>{const page=await api<{messages:AdminState['messages'];has_more:boolean}>('/api/admin/messages?offset='+state.messages.length);setState(previous=>previous?{...previous,messages:[...previous.messages,...page.messages],messages_has_more:page.has_more}:previous);});
  }
  return <div className="photographer-panel"><span className="eyebrow">ESPACE PHOTOGRAPHE</span><h3>Les instants à partager.</h3>
    {checkingSession?<p role="status">Vérification de la session…</p>:
    !authenticated?<form onSubmit={handleLogin}><p>Connectez-vous pour importer et publier les albums.</p><label htmlFor="photographer-email">Adresse e-mail<input id="photographer-email" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label htmlFor="photographer-password">Mot de passe<input id="photographer-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy}>{busy?<Loader2 size={15} className="animate-spin"/>:<Camera size={15}/>} Se connecter</button></form>:
    !state?<div><p>Chargement de vos albums et photographies…</p><button type="button" className="text-link" disabled={busy} onClick={()=>void action(refresh)}>Réessayer le chargement</button> <button type="button" className="text-link" disabled={busy} onClick={()=>void handleLogout()}><LogOut size={14}/> Déconnexion</button></div>:
    <><div className="photographer-toolbar"><span>{state.response_count} confirmation{state.response_count>1?'s':''} reçue{state.response_count>1?'s':''}</span><button className="text-link" onClick={()=>void handleLogout()}><LogOut size={14}/> Déconnexion</button></div>
      <form className="album-create" onSubmit={e=>{e.preventDefault();action(async()=>{const a=await api<AdminAlbum>('/api/admin/albums',{method:'POST',body:JSON.stringify({title})});setTitle('');setAlbum(a.id);await refresh();});}}><label htmlFor="album-title">Créer un album<input id="album-title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="La cérémonie, les mariés, la soirée…"/></label><button className="button" disabled={busy}><Plus size={15}/> Créer</button></form>
      <div className="upload-photos"><label htmlFor="upload-album">Album à alimenter<select id="upload-album" value={album} onChange={e=>setAlbum(e.target.value)}><option value="">Choisir un album</option>{state.albums.filter(a=>!a.hidden).map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label><label className={`file-button ${busy||!album?'disabled':''}`}><Upload size={16}/> Importer des photographies<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||!album} onChange={e=>{if(e.target.files)upload(Array.from(e.target.files));e.target.value='';}}/></label><p className="field-note">Import multiple · JPEG, PNG ou WebP · 20 Mo par fichier.</p>{uploading&&<button className="text-link" onClick={()=>void cancel()}>Arrêter les imports</button>}{pending&&!busy&&<button className="text-link" onClick={()=>void upload()}>Réessayer les imports restants</button>}<button className="text-link" disabled={busy} onClick={()=>void action(async()=>{const result=await api<{cleaned:number}>("/api/admin/uploads/cleanup",{method:"POST",body:"{}"});setNotice(result.cleaned+" import(s) expiré(s) nettoyé(s).");})}>Nettoyer les imports interrompus</button></div>
      <div className="publication-control"><p>Publiez vos albums après la cérémonie. La galerie sera accessible dès votre autorisation, le jour du mariage.</p><button className="button button-outline" disabled={busy} onClick={()=>patch('/api/admin/settings',{galleryPublished:!state.settings.galleryPublished})}>{state.settings.galleryPublished?'Suspendre la galerie publique':'Autoriser la galerie après le mariage'}</button></div>
      {state.albums.map(a=><div className="managed-album" key={a.id}><div className="photographer-toolbar"><input aria-label={`Renommer l’album ${a.title}`} defaultValue={a.title} maxLength={120} onBlur={e=>{const title=e.target.value.trim();if(title&&title!==a.title)patch(`/api/admin/albums/${a.id}`,{title});}}/><span>{a.photos.filter(p=>!p.hidden).length} images</span><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/albums/${a.id}`,{published:!a.published})}>{a.published?'Dépublier':'Publier'}</button><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/albums/${a.id}`,{hidden:!a.hidden})}>{a.hidden?'Restaurer l’album':'Archiver l’album'}</button></div><div className="admin-photo-grid">{a.photos.map(p=><div key={p.id} className={p.hidden?'photo-hidden':''}><img src={p.url} alt={p.caption} loading="lazy"/><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/photos/${p.id}`,{hidden:!p.hidden})}>{p.hidden?'Restaurer':'Masquer'}</button></div>)}</div>{a.has_more&&<button className="text-link" disabled={busy} onClick={()=>void morePhotos(a)}>Voir les photographies suivantes</button>}</div>)}
      <details className="moderate-messages"><summary>Gérer les messages du livre d’or</summary>{state.messages.map(m=><div key={m.id}><strong>{m.author}</strong><p>{m.body}</p><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/messages/${m.id}`,{hidden:!m.hidden})}>{m.hidden?'Réafficher ce message':'Masquer ce message'}</button></div>)}{state.messages_has_more&&<button className="text-link" disabled={busy} onClick={()=>void moreMessages()}>Voir les messages suivants</button>}</details>
    </>}
    {notice&&<p className="message-sent" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}
