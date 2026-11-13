import type {CSSProperties} from 'react';
import {Heart} from 'lucide-react';
function Flower({rose=false}:{rose?:boolean}){
 if(rose)return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5C14 2 4 12 8 22C0 34 15 46 25 40C39 48 49 29 40 22C45 9 34 0 24 5Z" fill="#efa18b" stroke="#bf705e" strokeWidth="1"/><path d="M15 18C18 7 37 12 33 25C31 36 14 36 14 24C13 13 31 15 28 25C25 31 19 24 24 21M9 25C14 40 36 41 40 22M25 7C40 14 39 31 29 37" fill="none" stroke="#fff4e9" strokeWidth="2" strokeLinecap="round"/></svg>;
 return <svg viewBox="0 0 48 48" aria-hidden="true">{[0,60,120,180,240,300].map((r,i)=><ellipse key={r} cx="24" cy="13" rx="7" ry="12" transform={`rotate(${r} 24 24)`} fill={i%2?'#fff9f1':'#efad98'} stroke="#d5917b" strokeWidth=".5"/>)}<circle cx="24" cy="24" r="5" fill="#d6ad89"/></svg>;
}
export function FloatingFlowers({opening=false}:{opening?:boolean}){
 return <div className={`floating-flowers ${opening?'opening-flowers':''}`} aria-hidden="true">{Array.from({length:opening?18:12},(_,i)=><span key={i} style={{'--left':`${(i*31+7)%100}%`,'--duration':`${15+i%5*3}s`,'--delay':`${-i*2.3}s`,'--turn':`${i%2?280:-250}deg`,'--size':`${18+i%4*6}px`} as CSSProperties}>{i%3===0?<Heart fill={i%2?'#fff5ef':'#efad98'} stroke="#c58470" strokeWidth={1}/>:<Flower rose={i%3===1}/>}</span>)}</div>;
}
export function CelebrationBurst(){
 return <div className="celebration-burst" aria-hidden="true">{Array.from({length:54},(_,i)=>{const angle=(i*137.5)*Math.PI/180,distance=150+(i%8)*65;return <span key={i} style={{'--x':`${Math.cos(angle)*distance}px`,'--y':`${Math.sin(angle)*distance-120}px`,'--rotation':`${i*47}deg`,'--delay':`${i%5*.035}s`,'--size':`${20+i%5*7}px`} as CSSProperties}>{i%4===0?<Heart fill={i%2?'#fff9f2':'#efa18b'} stroke="#c58470" strokeWidth={1}/>:<Flower rose={i%2===1}/>}</span>;})}</div>;
}
