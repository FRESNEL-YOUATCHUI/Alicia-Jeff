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
const output='-- LOCAL PREPARATION ONLY. Hosted execution requires explicit owner approval.\n-- Atomic activation of 001 + 002. No Storage policies/configuration or existing business rows are changed.\n-- The optional Storage hardening 003 is deliberately excluded.\nbegin;\nset local lock_timeout=\'5s\';\nset local statement_timeout=\'120s\';\nselect pg_advisory_xact_lock(7812471901126);\nlock table public.wedding_albums,public.wedding_photos,public.wedding_settings,public.wedding_staff,public.wedding_rsvps,public.wedding_messages in share row exclusive mode;\n'+chunks.join('\n\n')+'\ncommit;\n';
await fs.writeFile(new URL('../supabase/activation/activate-serverless.sql',import.meta.url),output);
console.log('Atomic activation file prepared locally: 001 + 002; no SQL executed.');
