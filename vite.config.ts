import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
export default defineConfig(({command})=>({
 plugins:[react()],
 publicDir:command==='build'?false:'public',
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 server:{proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:true}}},
 optimizeDeps:{exclude:['lucide-react']}
}));
