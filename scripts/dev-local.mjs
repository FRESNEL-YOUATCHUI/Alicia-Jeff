import {startLocalApp,cliPort} from './lib/local-app.mjs';
let app;
try{
  app=await startLocalApp({port:cliPort()});
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;await app.close();};
  process.once('SIGINT',()=>void stop());
  process.once('SIGTERM',()=>void stop());
}catch(error){
  console.error(error.code==='EADDRINUSE'?error.message:'Le démarrage local a échoué. '+(error.code?'Code : '+error.code+'.':'Exécutez npm run diagnose pour le détail vérifiable.'));
  process.exitCode=1;
}
