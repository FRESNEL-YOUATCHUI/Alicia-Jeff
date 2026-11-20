import type {Ticket} from './types';
import type {RsvpFields} from '../../shared/rsvp-reference.mjs';
const PREFIX='aj-rsvp-v3:',SELECTED='aj-rsvp-selected-v3';
export type Receipt={ref:string;payload?:RsvpFields;ticket?:Ticket;};
const memory=new Map<string,Receipt>();let selected:string|null=null;
function valid(value:unknown):value is Receipt {const r=value as Receipt;return !!r&&typeof r.ref==='string'&&!!(r.ticket?.qr_token||r.payload?.first_name);}
export function receipts():Receipt[]{
 const rows=new Map(memory);
 try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(PREFIX))continue;try{const value=JSON.parse(localStorage.getItem(key)||'null');if(valid(value))rows.set(value.ref,value);}catch{/* One damaged receipt must not hide others. */}}}catch{/* Optional storage. */}
 // Legacy browser references are recovery capabilities only, never new identities.
 try{const ticket=JSON.parse(localStorage.getItem('aj-invitation-2026')||'null'),ref=localStorage.getItem('aj-confirmation-2026');if(ref&&!rows.has(ref))rows.set(ref,ticket?.qr_token?{ref,ticket}:{ref});}catch{/* Optional legacy receipt. */}
 return [...rows.values()];
}
export function selectedReceipt():Receipt|null{try{selected=sessionStorage.getItem(SELECTED);}catch{/* Memory fallback. */}return receipts().find(r=>r.ref===selected)||null;}
export function selectReceipt(ref:string|null){selected=ref;try{if(ref)sessionStorage.setItem(SELECTED,ref);else sessionStorage.removeItem(SELECTED);}catch{/* Optional storage. */}}
export function saveReceipt(receipt:Receipt){const previous=receipts().find(r=>r.ref===receipt.ref);const value=previous?.ticket&&!receipt.ticket?previous:receipt;memory.set(receipt.ref,value);try{localStorage.setItem(PREFIX+receipt.ref,JSON.stringify(value));}catch{/* The server confirmation remains authoritative. */}selectReceipt(receipt.ref);}

// Only a definitive 400 response may discard an uncommitted local attempt.
export function discardPendingReceipt(ref:string){if(receipts().find(r=>r.ref===ref)?.ticket)return;memory.delete(ref);try{localStorage.removeItem(PREFIX+ref);}catch{/* Optional storage. */}selectReceipt(null);}
