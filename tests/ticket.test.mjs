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
 assert.equal(ticketQrValue(ticket),'https://alicia-jeff.vercel.app/api/tickets/open?token='+token);
 assert.equal(url.includes(ticket.guest_full_name),false);
 assert.throws(()=>ticketQrValue(ticket,'http://untrusted.example'));
 assert.throws(()=>ticketQrValue({...ticket,qr_token:'forged'},'https://wedding.example'));
 const legacy='30000000-0000-4000-8000-000000000001';
 assert.equal(ticketQrValue({qr_token:legacy},'https://wedding.example'),'https://wedding.example/api/tickets/open?token='+legacy);
 assert.throws(()=>ticketQrValue({qr_token:'old-id'},'https://wedding.example'));
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

test('the actual PDF generator embeds a clickable verification URI over its QR',async()=>{
 const source=await fs.readFile(new URL('../src/lib/tickets.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source.slice(source.indexOf('export async function downloadTicket')),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  .replace('export async function','async function').replace("await import('jspdf')",'await loadPdf()');
 const {jsPDF}=await import('jspdf');
 const png=new PNG({width:1800,height:1403});png.data.fill(255);
 const image='data:image/png;base64,'+PNG.sync.write(png).toString('base64');
 const url='https://wedding.example/api/tickets/open?token='+'A'.repeat(43);let contents,link;
 function CapturePDF(options){
  const pdf=new jsPDF(options),original=pdf.link;
  pdf.link=(x,y,w,h,opts)=>{link={x,y,w,h,opts};original.call(pdf,x,y,w,h,opts);};
  pdf.save=async()=>{contents=pdf.output();};return pdf;
 }
 const load=new Function('ticketImage','ticketQrValue','loadPdf',code+';return downloadTicket;');
 await load(async()=>image,()=>url,async()=>({jsPDF:CapturePDF}))({ticket_number:'TEST'},'pdf');
 assert.match(contents,/\/Subtype \/Link/);assert.ok(contents.includes('/URI ('+url+')'));
 assert.equal(link.opts.url,url);assert.ok(link.x>0&&link.y>0&&link.x+link.w<297&&link.y+link.h<210);
});
