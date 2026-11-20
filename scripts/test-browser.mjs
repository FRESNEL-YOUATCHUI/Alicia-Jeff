import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {fullBrowserFixture} from '../tests/full-browser-fixture.mjs';
const dir='.qa-artifacts/finalisation-20261120';await fs.mkdir(dir,{recursive:true});
const fixture=await fullBrowserFixture(),browser=await chromium.launch({channel:process.env.WEDDING_BROWSER_CHANNEL||'msedge',headless:true});
const report={checked_at:new Date().toISOString(),browser:'real installed Edge/Chromium, headless',isolation:'PGlite real SQL and API; simulated Auth, private Storage transport and official list; no production network',checks:[],responsive:[],errors:[],passed:false};
const user={id:fixture.staff,email:'photographer@example.invalid',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
async function context(){
 const ctx=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'});
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===fixture.url)return route.continue();
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-upsert,cache-control','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS, DELETE'};
  if(req.method()==='OPTIONS')return route.fulfill({status:200,headers:cors,body:''});
  if(u.pathname.startsWith('/auth/v1/')){
   if(u.pathname.endsWith('/token')){const data=req.postDataJSON();if(data.password!=='fixture-password')return route.fulfill({status:400,headers:cors,json:{error:'invalid_grant',error_description:'Invalid login'}});return route.fulfill({headers:cors,json:{access_token:'valid',token_type:'bearer',expires_in:3600,refresh_token:'isolated-refresh',user}});}
   if(u.pathname.endsWith('/user'))return route.fulfill({headers:cors,json:user});
   if(u.pathname.endsWith('/logout'))return route.fulfill({status:204,headers:cors,body:''});
  }
  if(u.pathname==='/rest/v1/wedding_staff')return route.fulfill({headers:cors,json:[{role:'photographer'}]});
  if(u.pathname.startsWith('/storage/v1/object/upload/sign/wedding-photos/')){
   const object=u.pathname.slice('/storage/v1/object/upload/sign/wedding-photos/'.length);
   const response=await fetch(fixture.url+'/test/upload/'+object,{method:'PUT',headers:{'Content-Type':req.headers()['content-type']},body:req.postDataBuffer()});return route.fulfill({status:response.status,headers:cors,json:{Key:object}});
  }
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  report.errors.push('Blocked unexpected external request: '+u.hostname+u.pathname);return route.abort();
 });
 return ctx;
}
function check(name,condition){assert.ok(condition,name);report.checks.push({name,passed:true});}
async function openInvitation(page){await page.goto(fixture.url);await page.getByRole('button',{name:/ouvrir.*enveloppe/i}).click();await page.getByRole('button',{name:'Arrêter le défilement automatique'}).click();}
async function fit(page,label){const metrics=await page.evaluate(()=>({width:globalThis.innerWidth,body:globalThis.document.documentElement.scrollWidth,extent:[...globalThis.document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(),s=globalThis.getComputedStyle(e);return r.width>0&&r.right>globalThis.innerWidth+1&&s.position!=='fixed'&&s.display!=='none';}).map(e=>({tag:e.tagName,cls:e.className?.baseVal??e.className,right:Math.round(e.getBoundingClientRect().right)})).slice(0,14),overflow:[...globalThis.document.querySelectorAll('main button, main input, main select,main h1,main h2,main .button')].filter(e=>{const s=globalThis.getComputedStyle(e),r=e.getBoundingClientRect();return s.position!=='fixed'&&r.width>0&&(r.right>globalThis.innerWidth+1||r.left < -1);}).map(e=>e.tagName+':'+(e.getAttribute('aria-label')||e.textContent||'').slice(0,50))}));assert.ok(metrics.body<=metrics.width+1,label+' horizontal overflow '+JSON.stringify(metrics));assert.deepEqual(metrics.overflow,[],label+' clipped controls');report.responsive.push({page:label,width:metrics.width,passed:true});}
try{
 const ctx=await context(),page=await ctx.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 await openInvitation(page);check('countdown visible',await page.getByLabel('Compte à rebours jusqu’au 18 décembre 2026').isVisible());check('no participant selector',await page.locator('#presence select').count()===0);
 for(const width of [320,375,390,430,768,1024,1280,1440]){await page.setViewportSize({width,height:900});await fit(page,'invitation');await page.screenshot({path:dir+'/invitation-'+width+'.png',fullPage:true});}
 await page.setViewportSize({width:390,height:900});await page.locator('#presence-first').fill('Camille');await page.locator('#presence-last').fill('Test');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Confirmer ma présence'}).click();const card=await download;check('automatic PDF download',card.suggestedFilename().endsWith('.pdf'));await card.saveAs(dir+'/isolated-ticket.pdf');
 check('PDF generated',String(await fs.readFile(dir+'/isolated-ticket.pdf')).startsWith('%PDF'));
 await page.reload();await page.getByRole('button',{name:/ouvrir.*enveloppe/i}).click();await page.getByRole('button',{name:'Arrêter le défilement automatique'}).click();check('confirmation survives reload',await page.getByText('À très bientôt,').isVisible());
 const manual=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger à nouveau le PDF'}).click();await manual;check('manual ticket fallback',true);
 const token=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('aj-invitation-2026')).qr_token);
 const scan=await ctx.newPage();await scan.goto(fixture.url+'/api/tickets/open?token='+token);if(await scan.getByRole('button',{name:'Vérifier ce billet'}).isVisible())await scan.getByRole('button',{name:'Vérifier ce billet'}).click();await scan.getByRole('heading',{name:'BILLET VALIDE',exact:true}).waitFor();check('browser QR verification admits isolated recognized RSVP',true);
 await scan.reload();if(await scan.getByRole('button',{name:'Vérifier ce billet'}).isVisible())await scan.getByRole('button',{name:'Vérifier ce billet'}).click();await scan.getByRole('heading',{name:'BILLET DÉJÀ UTILISÉ',exact:true}).waitFor();check('second browser QR verification denied',true);await scan.close();
 const retryContext=await context(),retryPage=await retryContext.newPage();await openInvitation(retryPage);fixture.failCardOnce();
 await retryPage.locator('#presence-first').fill('Hors');await retryPage.locator('#presence-last').fill('Liste');await retryPage.getByRole('button',{name:'Confirmer ma présence'}).click();
 await retryPage.getByRole('alert').filter({hasText:'téléchargement automatique a échoué'}).waitFor();check('download failure preserves successful RSVP',await retryPage.getByText('À très bientôt,').isVisible());
 const retryDownload=retryPage.waitForEvent('download');await retryPage.getByRole('button',{name:'Télécharger à nouveau le PDF'}).click();await retryDownload;check('manual recovery after automatic download failure',true);
 const absentToken=await retryPage.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('aj-invitation-2026')).qr_token);
 const absentScan=await retryContext.newPage();await absentScan.goto(fixture.url+'/api/tickets/open?token='+absentToken);if(await absentScan.getByRole('button',{name:'Vérifier ce billet'}).isVisible())await absentScan.getByRole('button',{name:'Vérifier ce billet'}).click();await absentScan.getByRole('heading',{name:'INVITÉ NON RECONNU',exact:true}).waitFor();
 check('unlisted RSVP is confirmed but entry remains denied',(await fixture.pg.query('select checked_in_at from wedding_ticket_entries where token=$1',[absentToken])).rows[0].checked_in_at===null);
 await absentScan.goto(fixture.url+'/api/tickets/open?token='+'a'.repeat(43));if(await absentScan.getByRole('button',{name:'Vérifier ce billet'}).isVisible())await absentScan.getByRole('button',{name:'Vérifier ce billet'}).click();await absentScan.getByRole('heading',{name:'BILLET NON RECONNU',exact:true}).waitFor();check('unknown QR denied in browser',true);await retryContext.close();
 await page.goto(fixture.url+'/photographe');await page.getByLabel('Adresse e-mail').fill(user.email);await page.getByLabel('Mot de passe',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.getByRole('alert').filter({hasText:'Identifiants incorrects'}).waitFor();check('bad photographer login refused',true);
 await page.getByLabel('Mot de passe',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.getByLabel('Album à alimenter').waitFor();check('photographer session and dashboard',true);
 await page.getByText('Diagnostics temporaires du propriétaire',{exact:true}).click();
 await page.getByLabel('Autorisation privée du propriétaire').setInputFiles({name:'owner-test-grant.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture.ownerGrant()))});
 await page.getByRole('button',{name:'Vérifier Google Sheets',exact:true}).click();await page.getByRole('status').filter({hasText:'Lecture Google Sheets réussie'}).waitFor();check('owner UI accepts scoped temporary delegation without admin promotion',(await fixture.pg.query('select role from wedding_staff')).rows[0].role==='photographer');
 await page.getByLabel('Créer un album',{exact:true}).fill('Album privé de validation');await page.getByRole('button',{name:'Créer',exact:true}).click();await page.getByRole('status').filter({hasText:'Album créé en privé'}).waitFor();
 check('new album is private by default',(await fixture.pg.query('select published from wedding_albums where title=$1',['Album privé de validation'])).rows[0].published===false);

 for(const width of [320,375,390,430,768,1024,1280,1440]){await page.setViewportSize({width,height:900});await fit(page,'photographe');await page.screenshot({path:dir+'/photographe-'+width+'.png',fullPage:true});}
 await page.getByLabel('Album à alimenter').selectOption('10000000-0000-4000-8000-000000000001');
 const png=new PNG({width:128,height:128});png.data.fill(240);const image=PNG.sync.write(png);
 await page.locator('input[type=file][multiple]').setInputFiles([{name:'souvenir-1.png',mimeType:'image/png',buffer:image},{name:'souvenir-2.png',mimeType:'image/png',buffer:image}]);
 check('staged previews visible before transfer',await page.locator('.staged-grid img').count()===2);check('selection does not upload automatically',(await fixture.pg.query('select count(*)::int n from wedding_photos')).rows[0].n===0);
 await page.getByRole('button',{name:'Importer 2 photographie(s)',exact:true}).click();await page.getByRole('status').filter({hasText:'Import terminé'}).waitFor();check('multiple uploads finalized as drafts',(await fixture.pg.query('select count(*)::int n from wedding_photos where hidden')).rows[0].n===2);
 const publicBefore=await (await fetch(fixture.url+'/api/photos?album=10000000-0000-4000-8000-000000000001')).json();check('drafts not public even in published album',publicBefore.photos.length===0);
 await page.getByRole('button',{name:'Publier les photos (2)',exact:true}).click();await page.getByRole('status').filter({hasText:'2 photographie(s) publiée(s)'}).waitFor();
 const publicAfter=await (await fetch(fixture.url+'/api/photos?album=10000000-0000-4000-8000-000000000001')).json();check('explicit publication persisted and public',publicAfter.photos.length===2);
 for(const width of [320,375,390,430,768,1024,1280,1440]){await page.setViewportSize({width,height:900});await fit(page,'photographe publié');await page.screenshot({path:dir+'/photographe-publie-'+width+'.png',fullPage:true});}
 const visitor=await context(),gallery=await visitor.newPage();await openInvitation(gallery);await gallery.getByRole('button',{name:'Ouvrir nos souvenirs',exact:true}).click();await gallery.getByRole('tab',{name:'Souvenirs · Images',exact:true}).click();await gallery.getByRole('button',{name:/Cérémonie civile/}).click();await gallery.locator('.souvenir-photo-grid img').first().waitFor();check('public gallery renders published images',await gallery.locator('.souvenir-photo-grid img').count()===2);
 await gallery.locator('.souvenir-photo-grid button').first().click();await gallery.getByRole('dialog',{name:'Photographie du mariage en grand format'}).waitFor();await gallery.keyboard.press('Shift+Tab');check('lightbox traps keyboard focus',await gallery.locator('.lightbox-next').evaluate(el=>el===globalThis.document.activeElement));await gallery.keyboard.press('Tab');check('lightbox cycles focus forward',await gallery.locator('.lightbox-close').evaluate(el=>el===globalThis.document.activeElement));await gallery.keyboard.press('Escape');check('lightbox closes with Escape',await gallery.locator('.photo-lightbox').count()===0);check('lightbox restores opener focus',await gallery.locator('.souvenir-photo-grid button').first().evaluate(el=>el===globalThis.document.activeElement));
 await page.getByRole('button',{name:'Masquer la photo'}).first().click();await page.getByRole('status').filter({hasText:'Modification enregistrée'}).waitFor();check('hide removes photo from public API',(await (await fetch(fixture.url+'/api/photos?album=10000000-0000-4000-8000-000000000001')).json()).photos.length===1);
 await gallery.waitForFunction(()=>globalThis.document.querySelectorAll('.souvenir-photo-grid img').length===1,undefined,{timeout:40000});check('open public album updates automatically after moderation',true);
 await page.getByRole('button',{name:'Déconnexion',exact:true}).click();await page.getByRole('button',{name:'Se connecter',exact:true}).waitFor();check('photographer logout',true);check('anonymous admin denied',(await fetch(fixture.url+'/api/admin/state')).status===401);
 await ctx.close();await visitor.close();check('no unhandled browser errors',report.errors.length===0);report.passed=true;
}catch(error){report.failure=error.message;process.exitCode=1;console.error('Browser validation failed: '+error.message);}finally{await browser.close();await fixture.close();await fs.writeFile(dir+'/browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,responsive:report.responsive.length,artifact:dir+'/browser-results.json'}));}
