import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';
test('QR contains an opaque HTTPS verification URL without guest data; legacy cards remain readable',async()=>{
 const source=await fs.readFile(new URL('../src/lib/tickets.ts',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('export function ticketQrValue'),source.indexOf('export async function ticketImage'));
 const js=ts.transpileModule(fn,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 const {ticketQrValue}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const token='A'.repeat(43),ticket={qr_token:token,qr_version:2,guest_full_name:'Donnée privée'};
 const url=ticketQrValue(ticket,'https://wedding.example');
 assert.equal(url,'https://wedding.example/api/tickets/open?token='+token);
 assert.equal(url.includes(ticket.guest_full_name),false);
 assert.throws(()=>ticketQrValue(ticket,'http://untrusted.example'));
 assert.throws(()=>ticketQrValue({...ticket,qr_token:'forged'},'https://wedding.example'));
 assert.equal(ticketQrValue({qr_token:'old-id'},'https://wedding.example'),'AJ:old-id');
 const encoded=await QRCode.toBuffer(url,{type:'png'});
 assert.ok(encoded.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 const png=PNG.sync.read(encoded);assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height).data,url);
});

test('client reference stays stable for retries even when localStorage is denied',async()=>{
 const source=await fs.readFile(new URL('../src/lib/api.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source.slice(source.indexOf('const memoryIds')),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace('export function','function');
 const load=new Function('localStorage','crypto',js+';return persistentId;');
 const persistent=load({getItem(){throw Error('Blocked');}},globalThis.crypto);
 assert.equal(persistent('same'),persistent('same'));assert.notEqual(persistent('same'),persistent('other'));
});
