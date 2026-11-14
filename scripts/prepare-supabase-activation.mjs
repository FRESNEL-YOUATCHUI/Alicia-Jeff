import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources=['001_serverless.sql','002_api_only_access.sql'];
const chunks=[];
for(const name of sources){
 const raw=await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
 const body=raw.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
 if(body===raw||/^commit;\s*$/m.test(body)||/^begin;\s*$/m.test(body))throw Error('Unexpected transaction structure in '+name);
 chunks.push('-- Source: '+name+' | SHA256 '+createHash('sha256').update(raw.replace(/\r\n/g,'\n')).digest('hex')+'\n'+body.trim());
}
const output='-- LOCAL PREPARATION ONLY. Hosted execution requires explicit owner approval.\n-- Atomic activation of 001 + 002. No Storage policies/configuration or existing business rows are changed.\n-- The optional Storage hardening 003 is deliberately excluded.\nbegin;\n'+chunks.join('\n\n')+'\ncommit;\n';
await fs.writeFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),output);
console.log('Atomic activation file prepared locally: 001 + 002; no SQL executed.');
