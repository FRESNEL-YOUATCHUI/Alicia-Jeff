import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpRight,CalendarDays,Heart,Leaf,MapPin,Menu,Music2,Pause,Play,RotateCcw,Volume2,VolumeX,X,Wine,Landmark,Utensils} from 'lucide-react';
import {getCountdown} from './lib/utils';
import useGuidedScroll from './lib/useGuidedScroll';
import {CelebrationBurst,FloatingFlowers} from './components/Celebration';
import EnvelopeOpening from './components/EnvelopeOpening';
import RsvpSection from './components/RsvpSection';
import Souvenirs from './components/Souvenirs';



const DATE='2026-12-18T15:00:00Z';
const STORY='Notre histoire avec Alicia a commencé en 2007, portée par une rencontre, des rêves et des sentiments qui ont traversé les années. Malgré le temps, les épreuves et les chemins parfois difficiles, nos cœurs ont toujours su retrouver le chemin l’un vers l’autre. Aujourd’hui, après presque 20 ans, notre amour écrit un nouveau chapitre : celui d’un engagement pour la vie, parce que certaines histoires ne sont pas faites pour se terminer, mais pour durer';
const map=(q:string)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
function Botanical({className=''}:{className?:string}){
 return <svg className={`botanical ${className}`} viewBox="0 0 160 240" fill="none" aria-hidden="true"><path d="M30 235C75 170 80 91 134 8" stroke="currentColor" strokeWidth="1.4"/>{[[57,181,-40],[75,145,30],[84,112,-35],[104,76,32],[120,41,-30]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="13" ry="32" transform={`rotate(${r} ${x} ${y})`} fill="currentColor" opacity=".65"/>)}</svg>;
}
export default function App(){
 const [opening,setOpening]=useState(true),[unsealing,setUnsealing]=useState(false),[burst,setBurst]=useState(false),[menu,setMenu]=useState(false);
 const [count,setCount]=useState(()=>getCountdown(DATE)),[musicPlaying,setMusicPlaying]=useState(false),[muted,setMuted]=useState(false),[musicError,setMusicError]=useState('');
 const [memoriesOpen,setMemoriesOpen]=useState(false),[revision,setRevision]=useState(0);
 const audio=useRef<HTMLAudioElement>(null),burstTimer=useRef<ReturnType<typeof setTimeout>>(),openingTimer=useRef<ReturnType<typeof setTimeout>>();
 const scroll=useGuidedScroll(opening||menu);
 useEffect(()=>{const timer=setInterval(()=>setCount(getCountdown(DATE)),1000);return()=>{clearInterval(timer);clearTimeout(burstTimer.current);clearTimeout(openingTimer.current);};},[]);
 useEffect(()=>{document.body.style.overflow=opening?'hidden':'';if(opening)window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});return()=>{document.body.style.overflow='';};},[opening]);
 async function playMusic(){
  if(!audio.current)return;setMusicError('');audio.current.volume=.45;
  try{await audio.current.play();}catch{setMusicError('Touchez la note de musique pour démarrer le son.');}
 }
 function enter(){
  if(unsealing)return;setUnsealing(true);setBurst(true);void playMusic();
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:620;
  openingTimer.current=setTimeout(()=>{setOpening(false);setUnsealing(false);scroll.start();},duration);
  clearTimeout(burstTimer.current);burstTimer.current=setTimeout(()=>setBurst(false),2800);
 }
 function navigateTo(id:string){
  setMenu(false);scroll.pauseForInteraction();if(id==='souvenirs')setMemoriesOpen(true);
  if(id==='accueil')window.scrollTo({top:0,behavior:'smooth'});
  else requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function toggleMusic(){if(audio.current?.paused)void playMusic();else audio.current?.pause();}
 const calendar=()=>{
  const contents='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:alicia-jeff-20261218\r\nDTSTAMP:20261113T000000Z\r\nDTSTART:20261218T150000Z\r\nDTEND:20261218T230000Z\r\nSUMMARY:Mariage Alicia Lamba et Jeff Essissima\r\nLOCATION:Ambassade du Cameroun - 157-159 Rue Joseph Gomis - Dakar\r\nDESCRIPTION:Mairie à 15h puis vin d’honneur. Soirée dès 19h au Fun Time Bourguiba.\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const url=URL.createObjectURL(new Blob([contents],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='Mariage-Alicia-et-Jeff.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <>
 <audio ref={audio} src="/wedding/music.mp4" preload="auto" loop playsInline onPlaying={()=>setMusicPlaying(true)} onPause={()=>setMusicPlaying(false)} onError={()=>setMusicError('La musique n’a pas pu être chargée. Réessayez avec le bouton musique.')}/>
 {opening&&<EnvelopeOpening unsealing={unsealing} onOpen={enter}/>}
 {burst&&<CelebrationBurst/>}
 {!opening&&<FloatingFlowers/>}
 <div className={`invitation-page ${opening?'awaiting-opening':'has-entered'}`} {...(opening?{inert:''}:{})} aria-hidden={opening||undefined}>
 <header className="site-header"><a className="monogram" href="#accueil" onClick={e=>{e.preventDefault();navigateTo('accueil');}} aria-label="Alicia et Jeff, début de l’invitation">A<span>&</span>J<span className="monogram-leaf"><Leaf size={18}/></span></a><nav aria-label="Navigation dans l’invitation" className={menu?'nav-open':''}>{[['histoire','Notre histoire'],['programme','Le programme'],['lieux','Les lieux'],['souvenirs','Souvenirs']].map(([id,label])=><a key={id} href={`#${id}`} onClick={e=>{e.preventDefault();navigateTo(id);}}>{label}</a>)}</nav><button className="menu-toggle" aria-expanded={menu} aria-label={menu?'Fermer le menu':'Ouvrir le menu'} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></header>
 <main>
 <section className="hero" id="accueil"><div className="hero-copy"><span className="eyebrow"><span className="tiny-line"/> NOUS NOUS DISONS OUI</span><h1>Alicia <span>&</span><br/>Jeff</h1><p className="hero-subtitle">Presque vingt ans d’amour.<br/><em>Et toute une vie devant nous.</em></p><div className="hero-date"><span>VENDREDI</span><strong>18 <i>/</i> 12 <i>/</i> 2026</strong><span><MapPin size={13}/> DAKAR, SÉNÉGAL</span></div><p className="hero-footnote">Un jour précieux, encore plus beau avec vous.</p><div className="hero-countdown" aria-label="Compte à rebours jusqu’au 18 décembre 2026">{[[count.days,"Jours"],[count.hours,"Heures"],[count.minutes,"Minutes"],[count.seconds,"Secondes"]].map(([n,label])=><div key={label}><strong>{String(n).padStart(2,"0")}</strong><span>{label}</span></div>)}</div></div><div className="hero-visual"><div className="arch-outline"/><div className="hero-photo"><img src="/wedding/couple.jpg" alt="Alicia et Jeff, réunis pour célébrer leur amour" loading="eager"/></div><Botanical className="hero-leaf"/><div className="photo-caption"><span>Le début de notre toujours</span><Heart size={17}/></div><span className="vertical-note">DEPUIS 2007 · POUR TOUJOURS</span></div><a href="#bienvenue" onClick={e=>{e.preventDefault();navigateTo("bienvenue");}} className="discover"><span>DÉCOUVRIR NOTRE INVITATION</span><ArrowDown size={17}/></a></section>
 <section className="welcome section" id="bienvenue"><Leaf className="section-leaf" strokeWidth={1}/><span className="eyebrow">À CEUX QUI COMPTENT POUR NOUS</span><h2>Le bonheur n’est complet<br/>que lorsqu’il est <em>partagé.</em></h2><p>Chères familles, chers amis, chers proches,<br/>c’est avec une immense joie que nous vous invitons à célébrer notre union.<br/>Votre présence fera de cette journée un souvenir inoubliable.</p><span className="signature">Alicia & Jeff</span></section>
 <section className="countdown" id="compte-a-rebours"><div><span className="eyebrow">LE GRAND JOUR APPROCHE</span><h2>Chaque seconde nous<br/>rapproche de <em>vous.</em></h2></div><div className="countdown-values" aria-label="Compte à rebours du mariage">{[[count.days,'JOURS'],[count.hours,'HEURES'],[count.minutes,'MINUTES'],[count.seconds,'SECONDES']].map(([value,label])=><div key={label}><strong>{String(value).padStart(2,'0')}</strong><span>{label}</span></div>)}</div><button onClick={calendar} className="text-link"><CalendarDays size={16}/> Ajouter à mon agenda</button></section>
 <section className="story section" id="histoire"><div className="story-portraits"><div className="portrait alicia"><img src="/wedding/alicia.webp" alt="Alicia Lamba" loading="lazy"/><span>Alicia</span></div><span className="portrait-amp">&</span><div className="portrait jeff portrait-new"><img src="/wedding/jeff-decor.webp" alt="Jeff Essissima" loading="lazy"/><span>Jeff</span></div><span className="since">notre histoire, depuis 2007</span></div><div className="story-copy"><span className="eyebrow">IL ÉTAIT UNE FOIS… NOUS</span><h2>Les années passent.<br/><em>L’amour reste.</em></h2><p>{STORY}</p><div className="story-end"><span>2007</span><span className="story-line"/><Heart size={16}/><span className="story-line"/><span>2026</span></div></div></section>
 <section className="program section" id="programme"><span className="eyebrow">VENDREDI 18 DÉCEMBRE 2026</span><h2>Une journée pour <em>nous réunir.</em></h2><p className="section-intro">Des émotions, des éclats de rire et beaucoup d’amour.</p><div className="timeline">{[{time:'15 h 00',title:'Le grand oui',subtitle:'La cérémonie civile',text:'Retrouvons-nous à l’Ambassade du Cameroun au Sénégal pour le début de notre nouvelle vie.',icon:Landmark},{time:'Après la cérémonie',title:'À notre bonheur',subtitle:'Le vin d’honneur',text:'Prolongeons l’émotion de la cérémonie autour d’un verre et de beaux moments partagés.',icon:Wine},{time:'Dès 19 h 00',title:'Place à la fête',subtitle:'La soirée de mariage',text:'Rendez-vous au Fun Time, à Bourguiba, pour célébrer, dîner et danser ensemble.',icon:Utensils}].map((event,i)=><article key={event.title}><div className="timeline-icon"><event.icon size={28} strokeWidth={1}/></div><span className="event-time">{event.time}</span><span className="event-number">0{i+1}</span><h3>{event.title}</h3><h4>{event.subtitle}</h4><p>{event.text}</p></article>)}</div><p className="time-note">Tous les horaires sont indiqués à l’heure de Dakar (GMT).</p></section>
 <section className="venues section" id="lieux"><div className="section-heading"><div><span className="eyebrow">RENDEZ-VOUS À DAKAR</span><h2>Les lieux de notre <em>bonheur.</em></h2></div><MapPin strokeWidth={1} size={38}/></div><div className="venue-grid"><article className="venue-card embassy"><div className="venue-art"><Landmark strokeWidth={.6}/><span>DAKAR · PLATEAU</span><Botanical/></div><div className="venue-body"><span className="eyebrow">LA CÉRÉMONIE · 15 H 00</span><h3>Ambassade du Cameroun<br/>au Sénégal</h3><p>157–159, rue Joseph Gomis<br/>Dakar, Sénégal · MH77+7R</p><a className="text-link" href={map('Ambassade du Cameroun 157 159 Rue Joseph Gomis Dakar Sénégal MH77+7R')} target="_blank" rel="noreferrer">Voir l’itinéraire <ArrowUpRight size={17}/></a></div></article><article className="venue-card funtime"><div className="venue-art"><Wine strokeWidth={.6}/><span>DAKAR · BOURGUIBA</span><Botanical/></div><div className="venue-body"><span className="eyebrow">LA SOIRÉE · DÈS 19 H 00</span><h3>Fun Time<br/>à Bourguiba</h3><p>Avenue du Président Habib Bourguiba<br/>Dakar, Sénégal · PG5R+GC</p><a className="text-link" href={map('FunTime Dakar Senegal Avenue Président Habib Bourguiba PG5R+GC')} target="_blank" rel="noreferrer">Voir l’itinéraire <ArrowUpRight size={17}/></a></div></article></div></section>
 <section className="details section"><div><span className="eyebrow">SIMPLE & ÉLÉGANT</span><h2>Une touche de <em>douceur.</em></h2><p>Une tenue de fête, votre plus beau sourire et, si le cœur vous en dit, une touche de nos couleurs.</p><div className="swatches">{[['#e9a18f','Saumon'],['#fff','Blanc']].map(([c,n])=><div key={n}><span style={{background:c}}/>{n}</div>)}</div></div><div className="gift-note"><Heart strokeWidth={1}/><span className="eyebrow">LE PLUS BEAU DES CADEAUX</span><h3>Vous, à nos côtés.</h3><p>Votre présence et votre affection sont ce qui rendra cette journée si précieuse.</p></div></section>

 <RsvpSection onMessagePublished={()=>setRevision(n=>n+1)}/>
 <Souvenirs open={memoriesOpen} onOpen={()=>setMemoriesOpen(true)} revision={revision}/>
 </main>
 <footer className="site-footer" id="fin"><a className="footer-names" href="#accueil" onClick={e=>{e.preventDefault();navigateTo('accueil');}}>Alicia <i>&</i> Jeff</a><span>18 DÉCEMBRE 2026 · DAKAR, SÉNÉGAL</span><p>Avec vous, notre bonheur sera encore plus grand.</p><div><button onClick={()=>{scroll.pauseForInteraction();setOpening(true);}}><RotateCcw size={12}/> Revoir l’enveloppe</button><button onClick={()=>navigateTo('accueil')}><ArrowUp size={12}/> Revenir au début</button></div></footer>
 </div>
 {!opening&&<div className="experience-controls" aria-label="Musique et lecture de l’invitation">
 <div className="music-controls"><button onClick={toggleMusic} aria-label={musicPlaying?'Mettre la musique en pause':'Démarrer la musique'} title={musicPlaying?'Musique en cours':'Démarrer la musique'}><Music2 size={17} className={musicPlaying?'music-playing':''}/>{musicPlaying?<Pause size={11}/>:<Play size={11}/>}</button><button aria-label={muted?'Rétablir le son':'Couper le son'} onClick={()=>{if(audio.current)audio.current.muted=!muted;setMuted(!muted);}}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button></div>
 <div className="scroll-controls"><button onClick={()=>navigateTo('accueil')} aria-label="Revenir au début" title="Revenir au début"><ArrowUp size={16}/></button><button onClick={scroll.toggle} aria-label={scroll.enabled?'Arrêter le défilement automatique':'Reprendre le défilement automatique'} title={scroll.enabled?'Arrêter le défilement automatique':'Reprendre le défilement automatique'}>{scroll.enabled?<Pause size={15}/>:<Play size={15}/>}</button><button onClick={()=>navigateTo('fin')} aria-label="Aller à la fin" title="Aller à la fin"><ArrowDown size={16}/></button></div>
 <span className="scroll-hint" role="status">{!scroll.enabled?'Lecture libre':scroll.paused?'Reprise après 7 s sans action':'Laissez-vous guider'}</span>
 </div>}
 {!opening&&musicError&&<p className="music-notice" role="status">{musicError}</p>}
 </>;
}

