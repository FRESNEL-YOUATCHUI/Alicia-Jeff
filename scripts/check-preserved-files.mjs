import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const files=['src/index.css','src/lib/tickets.ts','src/components/RsvpSection.tsx','src/components/EnvelopeOpening.tsx','src/components/Celebration.tsx','src/lib/useGuidedScroll.ts','server/index.mjs','server/server.test.mjs',...['alicia.webp','couple.jpg','favicon.svg','invitation.png','jeff-decor.webp','enveloppe-aj.webp','music.mp4'].map(f=>'public/wedding/'+f)];
const digest=data=>createHash('sha256').update(data).digest('hex'),result=[];
for(const file of files){
 const before=execFileSync('git',['-c','safe.directory=C:/Users/Hp EliteBook/Downloads/alicia-jeff-site-local-v3','show','7c40378:'+file],{maxBuffer:16*1024*1024,windowsHide:true});
 const after=await fs.readFile(file),text=/\.(css|ts|tsx|mjs|svg)$/.test(file);
 const canonical=data=>text?Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n')):data;
 result.push({file,comparison:text?'text with LF line endings':'binary',sha256:digest(canonical(after)),unchanged:digest(canonical(before))===digest(canonical(after))});
}
await fs.writeFile('docs/audit/preserved-files.json',JSON.stringify({baseline:'7c40378',files:result},null,2)+'\n');
if(result.some(r=>!r.unchanged))throw Error('A preserved file changed');
console.log(result.length+' visual/experience/legacy files unchanged (text line endings normalized) to the initial commit.');
