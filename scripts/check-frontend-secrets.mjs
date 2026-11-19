import fs from 'node:fs/promises';
import path from 'node:path';
let files=0;
async function scan(dir){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const p=path.join(dir,entry.name);
  if(entry.isDirectory())await scan(p);
  else if(/\.(js|html|css|json|map)$/.test(entry.name)){
   const content=await fs.readFile(p,'utf8');files++;
   if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content))throw Error('Private signing key in built frontend: '+p);
   if(/sb_secret_[A-Za-z0-9_-]+/.test(content)||/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/.test(content)||content.includes('"role":"service_role"'))throw Error('Potential privileged credential in built frontend: '+p);
   for(const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){
    try{if(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).role==='service_role')throw Error('Privileged credential found');}catch(e){if(e.message==='Privileged credential found')throw e;}
   }
  }
 }
}
await scan('dist');console.log('Frontend secret scan passed: '+files+' text artifacts; no privileged Supabase key detected.');
