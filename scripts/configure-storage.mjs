import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.storage.getBucket('wedding-photos');
if(error||!data||data.public){console.error('Le bucket privé doit être vérifié avant toute opération.');process.exitCode=1;}
else if(!process.argv.includes('--apply'))console.log('Lecture seule : bucket privé='+!data.public+'. Proposition : maximum 20971520 octets ; JPEG, PNG, WebP. --apply modifie le bucket et nécessite l’accord explicite du propriétaire.');
else{
 const result=await client.storage.updateBucket('wedding-photos',{public:false,fileSizeLimit:20971520,allowedMimeTypes:['image/jpeg','image/png','image/webp']});
 if(result.error){console.error('Configuration du bucket non appliquée.');process.exitCode=1;}
 else console.log('Limites du bucket mises à jour ; bucket conservé privé.');
}
