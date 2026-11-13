import {useEffect,useState} from 'react';
import {Camera,Loader2,LogOut,Plus,Upload} from 'lucide-react';
import {api} from '../lib/api';
import {loginPhotographer,logoutPhotographer,getPhotographerSession} from '../lib/photographerAuth';
interface AdminPhoto{id:string;caption:string;url:string;hidden:boolean}
interface AdminAlbum{id:string;title:string;published:boolean;hidden:boolean;photos:AdminPhoto[]}
interface AdminState{albums:AdminAlbum[];settings:{galleryPublished:boolean};messages:{id:string;author:string;body:string;hidden:boolean}[];response_count:number}
export default function PhotographerPanel({onChanged}:{onChanged:()=>void}){
  const [state,setState]=useState<AdminState|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [authenticated,setAuthenticated]=useState(false),[checkingSession,setCheckingSession]=useState(true);
  const [title,setTitle]=useState(''),[album,setAlbum]=useState('');
  useEffect(()=>{
    let active=true;
    void getPhotographerSession()
      .then(user=>{if(active)setAuthenticated(Boolean(user));})
      .catch(()=>{if(active)setAuthenticated(false);})
      .finally(()=>{if(active)setCheckingSession(false);});
    return ()=>{active=false;};
  },[]);
  async function handleLogin(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    await action(async()=>{
      await loginPhotographer(email.trim(),password);
      setPassword('');
      setAuthenticated(true);
      setNotice('Connexion réussie. Les routes administratives doivent encore être migrées vers Vercel.');
    });
  }
  async function handleLogout(){
    await action(async()=>{
      await logoutPhotographer();
      setAuthenticated(false);
      setState(null);
      setEmail('');
    });
  }
  async function refresh(){setState(await api<AdminState>('/api/admin/state'));onChanged();}
  async function action(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const patch=(url:string,body:unknown)=>action(async()=>{await api(url,{method:'PATCH',body:JSON.stringify(body)});await refresh();});
  async function upload(files:File[]){
    await action(async()=>{if(!album)throw new Error('Choisissez d’abord un album.');let count=0;
      for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Chaque image doit être un JPEG, PNG ou WebP de 20 Mo maximum.');
        await api(`/api/admin/albums/${album}/photos`,{method:'POST',headers:{'Content-Type':file.type,'X-Photo-Caption':encodeURIComponent(file.name)},body:file});count++;setNotice(`${count} / ${files.length} photographies importées.`);}
      await refresh();setNotice(`${count} photographie${count>1?'s':''} enregistrée${count>1?'s':''}.`);
    });
  }
  return <div className="photographer-panel"><span className="eyebrow">ESPACE PHOTOGRAPHE</span><h3>Les instants à partager.</h3>
    {checkingSession?<p role="status">Vérification de la session…</p>:
    !authenticated?<form onSubmit={handleLogin}><p>Connectez-vous pour importer et publier les albums.</p><label htmlFor="photographer-email">Adresse e-mail<input id="photographer-email" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label htmlFor="photographer-password">Mot de passe<input id="photographer-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy}>{busy?<Loader2 size={15} className="animate-spin"/>:<Camera size={15}/>} Se connecter</button></form>:
    !state?<div><p>Connexion photographe réussie. La gestion des albums et des photographies sera activée après la migration sécurisée des routes API vers Vercel.</p><button type="button" className="text-link" disabled={busy} onClick={()=>void handleLogout()}><LogOut size={14}/> Déconnexion</button></div>:
    <><div className="photographer-toolbar"><span>{state.response_count} confirmation{state.response_count>1?'s':''} reçue{state.response_count>1?'s':''}</span><button className="text-link" onClick={()=>void handleLogout()}><LogOut size={14}/> Déconnexion</button></div>
      <form className="album-create" onSubmit={e=>{e.preventDefault();action(async()=>{const a=await api<AdminAlbum>('/api/admin/albums',{method:'POST',body:JSON.stringify({title})});setTitle('');setAlbum(a.id);await refresh();});}}><label htmlFor="album-title">Créer un album<input id="album-title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="La cérémonie, les mariés, la soirée…"/></label><button className="button" disabled={busy}><Plus size={15}/> Créer</button></form>
      <div className="upload-photos"><label htmlFor="upload-album">Album à alimenter<select id="upload-album" value={album} onChange={e=>setAlbum(e.target.value)}><option value="">Choisir un album</option>{state.albums.filter(a=>!a.hidden).map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label><label className={`file-button ${busy||!album?'disabled':''}`}><Upload size={16}/> Importer des photographies<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||!album} onChange={e=>{if(e.target.files)upload(Array.from(e.target.files));e.target.value='';}}/></label><p className="field-note">Import multiple · JPEG, PNG ou WebP · 20 Mo par fichier.</p></div>
      <div className="publication-control"><p>Publiez vos albums après la cérémonie. La galerie sera accessible dès votre autorisation, le jour du mariage.</p><button className="button button-outline" disabled={busy} onClick={()=>patch('/api/admin/settings',{galleryPublished:!state.settings.galleryPublished})}>{state.settings.galleryPublished?'Suspendre la galerie publique':'Autoriser la galerie après le mariage'}</button></div>
      {state.albums.map(a=><div className="managed-album" key={a.id}><div className="photographer-toolbar"><input aria-label={`Renommer l’album ${a.title}`} defaultValue={a.title} maxLength={120} onBlur={e=>{const title=e.target.value.trim();if(title&&title!==a.title)patch(`/api/admin/albums/${a.id}`,{title});}}/><span>{a.photos.filter(p=>!p.hidden).length} images</span><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/albums/${a.id}`,{published:!a.published})}>{a.published?'Dépublier':'Publier'}</button><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/albums/${a.id}`,{hidden:!a.hidden})}>{a.hidden?'Restaurer l’album':'Archiver l’album'}</button></div><div className="admin-photo-grid">{a.photos.map(p=><div key={p.id} className={p.hidden?'photo-hidden':''}><img src={p.url} alt={p.caption} loading="lazy"/><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/photos/${p.id}`,{hidden:!p.hidden})}>{p.hidden?'Restaurer':'Masquer'}</button></div>)}</div></div>)}
      <details className="moderate-messages"><summary>Gérer les messages du livre d’or</summary>{state.messages.map(m=><div key={m.id}><strong>{m.author}</strong><p>{m.body}</p><button className="text-link" disabled={busy} onClick={()=>patch(`/api/admin/messages/${m.id}`,{hidden:!m.hidden})}>{m.hidden?'Réafficher ce message':'Masquer ce message'}</button></div>)}</details>
    </>}
    {notice&&<p className="message-sent" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}
