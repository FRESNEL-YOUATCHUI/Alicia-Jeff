import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
export default defineConfig(({command})=>({
 plugins:[react()],
 publicDir:command==='build'?false:'public',
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 // vercel dev owns /api. A proxy is enabled only by the standalone local scripts.
 server:{
  ...(process.env.WEDDING_DEV_API?{proxy:{'/api':{target:process.env.WEDDING_DEV_API,changeOrigin:true}}}:{}),
  fs:{deny:['**/.env*','**/*.{crt,pem}','**/.git/**','**/.vercel/**','**/.wedding-data/**','**/docs/**','**/supabase/**','**/server/**','**/serverless/**','**/scripts/**']}
 },
 optimizeDeps:{exclude:['lucide-react']}
}));
