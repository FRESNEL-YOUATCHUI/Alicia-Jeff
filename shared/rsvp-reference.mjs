// An idempotency key belongs to one immutable submission, never to a browser.
export const isBoundRsvpRef=value=>typeof value==='string'&&/^R3-[a-f0-9]{32}-[a-f0-9]{24}$/.test(value);
const clean=value=>String(value??'').normalize('NFC').trim().replace(/\r\n?/g,'\n');
export function canonicalRsvp(input){return {first_name:clean(input.first_name),last_name:clean(input.last_name),participants:1,song:clean(input.song),message:clean(input.message)};}
async function digest(nonce,input){const fields=canonicalRsvp(input),bytes=new TextEncoder().encode(JSON.stringify([nonce,fields.first_name,fields.last_name,1,fields.song,fields.message]));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);}
export async function createRsvpRef(input){const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');return 'R3-'+nonce+'-'+await digest(nonce,input);}
export async function matchesRsvpRef(ref,input){return isBoundRsvpRef(ref)&&ref.slice(-24)===await digest(ref.slice(3,35),input);}
