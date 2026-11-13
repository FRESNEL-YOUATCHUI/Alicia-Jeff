import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const args=['-c','safe.directory=C:/Users/Hp EliteBook/Downloads/alicia-jeff-site-local-v3'];
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
try{process.loadEnvFile('.env.wedding.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const names=execFileSync('git',[...args,'diff','--cached','--name-only','--diff-filter=ACMR'],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const secrets=['SUPABASE_SECRET_KEY','WEDDING_ADMIN_PASSWORD','WEDDING_SESSION_SECRET','CRON_SECRET'].map(name=>process.env[name]).filter(v=>v&&v.length>=16);
for(const file of names){
 if(/^\.env(?:\.|$)/.test(file)&&file!=='.env.example')throw Error('Private environment file staged: '+file);
 const content=await fs.readFile(file);
 if(secrets.some(value=>content.includes(Buffer.from(value))))throw Error('Private credential found in staged source: '+file);
}
console.log('Staged credential check passed: '+names.length+' files, no configured private value present.');
