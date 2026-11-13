export function normalizePhone(input: string): string {
 let v=input.trim().replace(/^'/,'');
 if(/^(\+|00)/.test(v))v=v.replace(/\(0\)/g,'');
 v=v.replace(/[\s().-]/g,'');
 if(v.startsWith('00'))v='+'+v.slice(2);
 if(v.startsWith('+'))return v;
 if(/^\d{9}$/.test(v))return '+221'+v;
 if(/^0\d{9}$/.test(v))return '+33'+v.slice(1);
 if(/^\d{11,15}$/.test(v))return '+'+v;
 return v;
}
export function formatDateLong(iso:string|null):string{return iso?new Date(iso).toLocaleDateString('fr-FR',{timeZone:'Africa/Dakar',weekday:'long',day:'numeric',month:'long',year:'numeric'}):''}
export function formatDateShort(iso:string|null):string{return iso?new Date(iso).toLocaleDateString('fr-FR',{timeZone:'Africa/Dakar',day:'numeric',month:'long',year:'numeric'}):''}
export function formatTime(iso:string|null):string{return iso?new Date(iso).toLocaleTimeString('fr-FR',{timeZone:'Africa/Dakar',hour:'2-digit',minute:'2-digit'}):''}
export function getCountdown(target:string|null){const diff=target?Math.max(0,new Date(target).getTime()-Date.now()):0;return{days:Math.floor(diff/86400000),hours:Math.floor(diff%86400000/3600000),minutes:Math.floor(diff%3600000/60000),seconds:Math.floor(diff%60000/1000),passed:diff===0}}
export function classNames(...c:(string|false|null|undefined)[]):string{return c.filter(Boolean).join(' ')}
