import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import QRCode from 'qrcode';
test('unchanged invitation renderer uses the same opaque AJ:UUID QR and can encode it',async()=>{
 const source=await fs.readFile(new URL('../src/lib/tickets.ts',import.meta.url),'utf8');
 assert.ok(source.includes('AJ:${ticket.qr_token}'));
 const encoded=await QRCode.toBuffer('AJ:30000000-0000-4000-8000-000000000001',{type:'png'});
 assert.ok(encoded.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 // This checks the QR payload/encoder, not a browser PDF/PNG download or an admission service.
});
