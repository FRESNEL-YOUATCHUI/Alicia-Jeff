import {cpSync,mkdirSync} from 'node:fs';
const files=['alicia.webp','couple.jpg','favicon.svg','invitation.png','jeff-decor.webp','enveloppe-aj.webp','music.mp4'];
mkdirSync('dist/wedding',{recursive:true});
for(const name of files)cpSync(`public/wedding/${name}`,`dist/wedding/${name}`);
