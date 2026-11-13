import {useEffect,useRef,useState} from 'react';
export const IDLE_DELAY=7000;
export function canAutoScroll(input:{enabled:boolean;blocked:boolean;pointerDown:boolean;focusedField:boolean;hidden:boolean;idleMs:number}){
 return input.enabled&&!input.blocked&&!input.pointerDown&&!input.focusedField&&!input.hidden&&input.idleMs>=IDLE_DELAY;
}
export default function useGuidedScroll(blocked:boolean){
 const [enabled,setEnabled]=useState(true),[paused,setPaused]=useState(false);
 const lastAction=useRef(0),held=useRef(false),blockedRef=useRef(blocked),enabledRef=useRef(enabled);
 blockedRef.current=blocked;enabledRef.current=enabled;
 useEffect(()=>{
  let frame=0,previous=0,previousPaused=false,position=window.scrollY;
  const interact=()=>{lastAction.current=performance.now();};
  const down=()=>{held.current=true;interact();},up=()=>{held.current=false;};
  const events=['wheel','touchstart','touchmove','keydown'];
  events.forEach(name=>window.addEventListener(name,interact,{passive:true,capture:true}));
  window.addEventListener('pointerdown',down,{passive:true,capture:true});window.addEventListener('pointerup',up,{passive:true,capture:true});window.addEventListener('pointercancel',up,{passive:true,capture:true});
  const onVisibility=()=>{previous=0;if(!document.hidden)interact();};document.addEventListener('visibilitychange',onVisibility);
  function tick(time:number){
   const focusedField=Boolean(document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'));
   const running=canAutoScroll({enabled:enabledRef.current,blocked:blockedRef.current||Boolean(document.querySelector('.photo-lightbox')),pointerDown:held.current,focusedField,hidden:document.hidden,idleMs:time-lastAction.current});
   const nextPaused=enabledRef.current&&!blockedRef.current&&!running;
   if(nextPaused!==previousPaused){previousPaused=nextPaused;setPaused(nextPaused);}
   if(previous&&running){const delta=Math.min(time-previous,50);const speed=window.innerWidth<650?20:26;const max=document.documentElement.scrollHeight-window.innerHeight;
    if(position<max-1){position=Math.min(max,position+speed*delta/1000);window.scrollTo({top:position,behavior:'instant' as ScrollBehavior});}
   }
   if(!running)position=window.scrollY;previous=time;frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);events.forEach(name=>window.removeEventListener(name,interact,true));window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);document.removeEventListener('visibilitychange',onVisibility);};
 },[]);
 return {enabled,paused,start:()=>{lastAction.current=-Infinity;held.current=false;setEnabled(true);},toggle:()=>{if(!enabled){lastAction.current=-Infinity;held.current=false;}setEnabled(value=>!value);},pauseForInteraction:()=>{lastAction.current=performance.now();}};
}


