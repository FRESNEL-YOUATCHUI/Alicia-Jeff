import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/rsvpSessions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const store=()=>{const data=new Map();return{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const load=(localStorage,sessionStorage)=>{const exports={};new Function('exports','localStorage','sessionStorage',source)(exports,localStorage,sessionStorage);return exports;};
const record=(ref,name)=>({ref,ticket:{qr_token:ref,guest_full_name:name,ticket_number:'AJ-'+ref}});
test('receipts belong to confirmations; two tabs do not replace or select each other’s guests',()=>{
 const local=store(),tab1=store(),tab2=store(),a=load(local,tab1),b=load(local,tab2);
 a.saveReceipt(record('first','Mamadou'));b.saveReceipt(record('second','Fatou'));
 assert.equal(a.selectedReceipt().ticket.guest_full_name,'Mamadou');assert.equal(b.selectedReceipt().ticket.guest_full_name,'Fatou');assert.equal(a.receipts().length,2);
 a.selectReceipt(null);assert.equal(a.selectedReceipt(),null);assert.equal(a.receipts().length,2);
 assert.equal(load(local,tab2).selectedReceipt().ticket.guest_full_name,'Fatou');
});
test('pending payload survives reload; confirmation cannot be downgraded by a late retry',()=>{
 const local=store(),session=store(),a=load(local,session);a.saveReceipt({ref:'pending',payload:{first_name:'Ibrahima',last_name:'Recette'}});
 const reloaded=load(local,session);assert.equal(reloaded.selectedReceipt().payload.first_name,'Ibrahima');reloaded.saveReceipt(record('pending','Ibrahima'));a.saveReceipt({ref:'pending',payload:{first_name:'Ibrahima',last_name:'Recette'}});assert.ok(a.selectedReceipt().ticket);
 a.discardPendingReceipt('pending');assert.ok(a.selectedReceipt().ticket);
});
test('denied storage does not create a browser-wide identity or block the next guest',()=>{
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');},removeItem(){throw Error('Denied');},get length(){throw Error('Denied');}};
 const a=load(denied,denied);a.saveReceipt(record('one','Même Nom'));a.selectReceipt(null);a.saveReceipt(record('two','Même Nom'));assert.equal(a.receipts().length,2);assert.equal(a.selectedReceipt().ref,'two');
});
test('legacy global reference is recovery only and is not selected as a new submission',()=>{
 const local=store(),session=store();local.setItem('aj-confirmation-2026','old-reference');const a=load(local,session);assert.equal(a.selectedReceipt(),null);assert.deepEqual(a.receipts(),[{ref:'old-reference'}]);
 local.setItem('aj-invitation-2026',JSON.stringify(record('old-token','Ancien Invité').ticket));assert.equal(a.receipts()[0].ticket.guest_full_name,'Ancien Invité');assert.equal(a.selectedReceipt(),null);
});
test('definitive validation failure discards only its uncommitted attempt',()=>{
 const a=load(store(),store());a.saveReceipt(record('confirmed','Confirmé'));a.saveReceipt({ref:'invalid',payload:{first_name:'Test',last_name:'Recette'}});a.discardPendingReceipt('invalid');assert.equal(a.receipts().length,1);assert.ok(a.receipts()[0].ticket);assert.equal(a.selectedReceipt(),null);
});
