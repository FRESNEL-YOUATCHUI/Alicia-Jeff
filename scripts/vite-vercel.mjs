import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const vite=path.join(path.dirname(fileURLToPath(import.meta.resolve('vite/package.json'))),'bin/vite.js');
const child=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',process.env.PORT||'5174','--strictPort'],{stdio:'inherit',windowsHide:true});
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
child.on('exit',code=>process.exit(code??0));
