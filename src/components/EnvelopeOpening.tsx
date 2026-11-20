import {ChevronUp} from 'lucide-react';
export default function EnvelopeOpening({unsealing,onOpen}:{unsealing:boolean;onOpen:()=>void}){
 return <div className={`envelope-opening ${unsealing?'is-unsealing':''}`} role="dialog" aria-modal="true" aria-label="L’invitation d’Alicia et Jeff">
   <div className="envelope-ambient" aria-hidden="true"/>
   <button className="envelope-panel" onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();e.currentTarget.focus();}}} onClick={onOpen} disabled={unsealing} aria-label="Ouvrir l’enveloppe d’Alicia et Jeff et démarrer la musique" autoFocus>
     <span className="envelope-half envelope-half-left" aria-hidden="true"/>
     <span className="envelope-half envelope-half-right" aria-hidden="true"/>
     <span className="envelope-wax" aria-hidden="true"/>
     <span className="envelope-caption"><ChevronUp size={19} strokeWidth={1}/><span>TOUCHEZ POUR OUVRIR</span></span>
   </button>
 </div>;
}
