import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const require=createRequire(import.meta.url);
// CLI 65's native Windows builder installer needs symlink privileges.
// The same release also ships the official JavaScript entrypoint.
const packageName=process.platform==='win32'?'@vercel/cli-support':'vercel';
const entry=path.join(path.dirname(require.resolve(packageName+'/package.json')),'dist','vc.js');
const child=spawn(process.execPath,[entry,'dev',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,VERCEL_VC_NATIVE:'0',VERCEL_CLI_MANAGED_BUILDERS:'0'}});
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
child.on('exit',code=>process.exit(code??0));
