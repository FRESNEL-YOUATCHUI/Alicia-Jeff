import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {localEnvironment,projectRoot} from './lib/environment.mjs';
import {mintOwnerProbeGrant} from '../serverless/owner-probe-grant.mjs';
const args=process.argv.slice(2),user=args[args.indexOf('--user-id')+1];
try{
 if(!args.includes('--user-id'))throw Error('Usage : npm run owner:grant -- --user-id UUID_DU_COMPTE_PROPRIETAIRE');
 const file=path.join(projectRoot,'.qa-artifacts','private','owner-google-probe.json');
 execFileSync('git',['check-ignore','--quiet','--',file],{cwd:projectRoot,stdio:'ignore'});
 const grant=mintOwnerProbeGrant(user,localEnvironment().SUPABASE_SECRET_KEY);
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(grant,null,2)+'\n',{mode:0o600});
 console.log('Autorisation privée : '+file+' ; expiration UTC : '+grant.expires_at+' ; référence d’audit : '+grant.audit_id+'. Aucun jeton affiché.');
}catch{console.error('Autorisation non créée. Vérifier --user-id, la clé serveur locale et l’exclusion Git de .qa-artifacts. Ne transmettre aucune valeur secrète.');process.exitCode=1;}
