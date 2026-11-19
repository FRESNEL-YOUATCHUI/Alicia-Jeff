import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
test('real RSVP component renders an individual form with no participant selector',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]},cacheDir:'.qa-artifacts/vite-rsvp-test'});
 try{
  const {default:Rsvp}=await vite.ssrLoadModule('/src/components/RsvpSection.tsx');
  const html=renderToStaticMarkup(React.createElement(Rsvp,{onMessagePublished(){}}));
  assert.match(html,/presence-first/);assert.match(html,/presence-last/);
  assert.match(html,/une seule personne/);assert.match(html,/Confirmer ma présence/);
  assert.doesNotMatch(html,/<select|presence-count|Nombre de personnes|accompagnant/i);
 }finally{await vite.close();}
});
