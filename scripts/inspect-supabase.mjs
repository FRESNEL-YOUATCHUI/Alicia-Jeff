import fs from 'node:fs/promises';
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key){console.error('Configuration serveur absente. Renseigner localement SUPABASE_URL et SUPABASE_SECRET_KEY ; ne jamais les coller dans un chat.');process.exitCode=1;}
else{
 try{
  const response=await fetch(new URL('/rest/v1/',url),{headers:{apikey:key,Accept:'application/openapi+json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Metadata HTTP '+response.status);
  const spec=await response.json();
  const names=['wedding_albums','wedding_photos','wedding_settings','wedding_staff','wedding_rsvps','wedding_messages'];
  const definitions=Object.fromEntries(Object.entries(spec.definitions||{}).filter(([name])=>names.includes(name)));
  await fs.mkdir('docs/audit',{recursive:true});
  await fs.writeFile('docs/audit/supabase-openapi.json',JSON.stringify({inspected_at:new Date().toISOString(),read_only:true,definitions},null,2)+'\n');
  console.log('Métadonnées en lecture seule : '+Object.keys(definitions).join(', '));
  console.log('Compléter avec supabase/inspect-readonly.sql pour les contraintes, politiques, grants et le bucket. Aucun enregistrement visiteur lu.');
 }catch(e){console.error('Inspection impossible : '+(e.message.startsWith('Metadata HTTP')?e.message:'vérifier la connexion et la configuration, sans afficher les secrets.'));process.exitCode=1;}
}
