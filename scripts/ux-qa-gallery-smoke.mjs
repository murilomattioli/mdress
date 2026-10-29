/** Browser regression for the offline, human-reviewed UX-023 evidence gallery. */
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {deflateSync} from 'node:zlib';
import {UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';

const html=await readFile('test-results/ux-audit/supervised/index.html','utf8');
const stateCount=UX_QA_REQUIRED_SCREENSHOTS.length;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 // A synthetic local origin enables storage/download tests without an external service.
 // Serve real decodable PNG bytes: an HTML fallback must never count as reviewed evidence.
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64');
 // Generate small, decodable full-viewport PNGs to exercise dimension checks.
 const pngChunk=(type,data)=>{
  const name=Buffer.from(type,'ascii'),length=Buffer.alloc(4),crcBytes=Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc=0xffffffff;
  for(const byte of Buffer.concat([name,data])){
   crc^=byte;
   for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  crcBytes.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,name,data,crcBytes]);
 };
 const viewportPng=width=>{
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(900,4);
  ihdr[8]=8;ihdr[9]=2;
  return Buffer.concat([
   Buffer.from('89504e470d0a1a0a','hex'),
   pngChunk('IHDR',ihdr),
   pngChunk('IDAT',deflateSync(Buffer.alloc((width*3+1)*900))),
   pngChunk('IEND',Buffer.alloc(0))
  ]);
 };
 const fixtures=new Map([1440,1024,768].map(width=>[width,viewportPng(width)]));
 let breakFreshReview=false,wrongViewport=false;
 const workspaceRequests=[];
 await page.route('http://mdress-qa.test/**',route=>{
  const address=new URL(route.request().url());
  if(address.pathname.endsWith('.png')){
   if(address.pathname.includes('graphite-1440-workspace.png')&&address.searchParams.has('mdress-verify'))
    workspaceRequests.push({query:address.search,breakFreshReview,wrongViewport});
   if(address.pathname.includes('graphite-1440-workspace.png')&&
      (address.pathname.startsWith('/broken/')||(breakFreshReview&&address.searchParams.has('mdress-verify'))))
    return route.fulfill({status:404,headers:{'cache-control':'no-store'},body:'Missing screenshot'});
   const width=Number(address.pathname.match(/-(1440|1024|768)-/)?.[1]);
   const wrongSize=wrongViewport&&address.pathname.includes('graphite-1440-workspace.png')&&
    address.searchParams.has('mdress-verify');
   return route.fulfill({status:200,headers:{'cache-control':'no-store'},contentType:'image/png',body:wrongSize?pixel:fixtures.get(width)});
  }
  return route.fulfill({status:200,contentType:'text/html',body:html});
 });
 await page.goto('http://mdress-qa.test/gallery');
 const status=page.locator('.review-status').first();
 const note=page.locator('.review-note').first();
 assert.equal(await page.locator('.review-status').count(),stateCount);
 assert.match(await page.locator('#review-progress').innerText(),new RegExp('0/'+stateCount+' estados aprovados'));
 await status.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.review-status').disabled);
 await status.selectOption('approved');
 await note.fill('Foco, contraste e clipping verificados manualmente neste cenário de teste.');
 assert.match(await page.locator('#review-progress').innerText(),new RegExp('1/'+stateCount+' estados aprovados'));
 await page.reload();
 assert.equal(await status.inputValue(),'approved','Review must survive reload in this session');
 assert.match(await note.inputValue(),/Foco, contraste/);
 // The modal supports keyboard comparison and restores focus to its trigger.
 const firstImage=page.locator('.state').first().locator('figure a').first();
 await firstImage.click();
 const viewer=page.locator('#image-viewer');
 assert.equal(await viewer.isVisible(),true);
 assert.match(await page.locator('#viewer-label').innerText(),/1\/6/);
 // State navigation must not overflow the review dialog on narrow layouts.
 for(const width of [768,390]){
  await page.setViewportSize({width,height:900});
  const geometry=await page.evaluate(()=>{
   const dialog=document.querySelector('#image-viewer').getBoundingClientRect();
   const nav=document.querySelector('.viewer-state-nav').getBoundingClientRect();
   const buttons=[...document.querySelectorAll('.viewer-state-nav button')].map(el=>el.getBoundingClientRect());
   return {dialog:{left:dialog.left,right:dialog.right},nav:{left:nav.left,right:nav.right},
    buttons:buttons.map(rect=>({left:rect.left,right:rect.right}))};
  });
  assert.ok(geometry.nav.left>=geometry.dialog.left-1&&geometry.nav.right<=geometry.dialog.right+1,
   'State navigation must fit inside the '+width+'px dialog: '+JSON.stringify(geometry));
  assert.ok(geometry.buttons.every(rect=>rect.left>=geometry.nav.left-1&&rect.right<=geometry.nav.right+1),
   'Navigation buttons must not clip at '+width+'px: '+JSON.stringify(geometry));
 }
 await page.setViewportSize({width:1280,height:720});
 const viewerStatus=page.locator('#viewer-status');
 const viewerNote=page.locator('#viewer-note');
 await page.waitForFunction(()=>!document.querySelector('#viewer-status').disabled);
 assert.equal(await viewerStatus.inputValue(),'approved','The viewer mirrors the saved state verdict');
 assert.match(await viewerNote.inputValue(),/Foco, contraste/);
 await viewerStatus.selectOption('rejected');
 assert.equal(await status.inputValue(),'rejected','Rejecting inside the viewer updates the state');
 await viewerStatus.selectOption('approved');
 await viewerNote.fill('Foco, contraste, clipping e teclado verificados no visualizador.');
 assert.match(await note.inputValue(),/teclado verificados/,'Viewer notes persist in the state');
 await viewerNote.press('ArrowRight');
 assert.match(await page.locator('#viewer-label').innerText(),/1\/6/,
  'Arrow keys editing notes must not navigate screenshots');
 await viewer.locator('#viewer-next-state').click();
 assert.match(await page.locator('#viewer-label').innerText(),/toolbar/,
  'Next state navigation must load a different six-image matrix');
 assert.match(await page.locator('#viewer-state-position').innerText(),new RegExp('Estado 2/'+stateCount));
 await viewer.locator('#viewer-prev-state').click();
 assert.match(await page.locator('#viewer-label').innerText(),/workspace/,
  'Previous state navigation must return to the earlier matrix');
 assert.match(await page.locator('#viewer-state-position').innerText(),new RegExp('Estado 1/'+stateCount));
 await viewer.locator('#viewer-next-state').click();
 await page.waitForFunction(()=>!document.querySelector('#viewer-status').disabled);
 assert.equal(await viewerStatus.inputValue(),'pending','Next state starts pending, never auto-approved');
 await viewerStatus.selectOption('rejected');
 assert.equal(await page.locator('.review-status').nth(1).inputValue(),'rejected');
 await viewerStatus.selectOption('pending');
 await viewer.locator('#viewer-close').click();
 assert.equal(await viewer.isVisible(),false);
 const secondImage=page.locator('.state').nth(1).locator('figure a').first();
 await page.waitForFunction(()=>document.activeElement===document.querySelectorAll('.state')[1]?.querySelector('figure a'),null,{timeout:3000});
 assert.equal(await secondImage.evaluate(el=>document.activeElement===el),true,
  'Closing after state navigation restores focus to the current image');
 await firstImage.click();
 await page.keyboard.press('ArrowRight');
 assert.match(await page.locator('#viewer-label').innerText(),/2\/6/);
 await page.keyboard.press('Escape');
 assert.equal(await viewer.isVisible(),false);
 assert.equal(await firstImage.evaluate(el=>document.activeElement===el),true);
 await page.locator('#only-pending').click();
 assert.equal(await page.locator('.state').first().isVisible(),false,'Approved states can be hidden');
 await page.locator('#only-pending').click();
 const pendingDownload=page.waitForEvent('download');
 await page.locator('#export-review').click();
 const download=await pendingDownload;
 assert.equal(download.suggestedFilename(),'mdress-ux023-review.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.schema,1);
 assert.equal(exported.states.workspace.status,'approved');
 assert.match(exported.states.workspace.note,/Foco, contraste/);
 assert.equal(Object.keys(exported.states).length,stateCount);
 assert.ok(exported.sessionId);
 // Regression: the reviewer approved this state, then one PNG disappeared.
 // A cached img.decode() must NOT allow an approval to survive export.
 breakFreshReview=true;
 const staleDownload=page.waitForEvent('download');
 await page.locator('#export-review').click();
 const stale=JSON.parse(await readFile(await (await staleDownload).path(),'utf8'));
 assert.equal(stale.states.workspace.status,'pending','Fresh validation must revoke stale approval');
 assert.equal(await status.isDisabled(),true);
 assert.equal(await page.locator('.state').first().locator('.image-warning').isVisible(),true);
 breakFreshReview=false;
 const restoredDownload=page.waitForEvent('download');
 await page.locator('#export-review').click();
 const restored=JSON.parse(await readFile(await (await restoredDownload).path(),'utf8'));
 assert.equal(restored.states.workspace.status,'pending','Restoring evidence must not auto-approve UX');
 const restoredDisabled=await status.isDisabled();
 if(restoredDisabled)console.error('Restored evidence requests:',JSON.stringify(workspaceRequests.slice(-20)));
 assert.equal(restoredDisabled,false,
  'Reviewer can inspect restored evidence again: '+await page.locator('.state').first().locator('.image-warning').innerText());
 await status.selectOption('approved');
 wrongViewport=true;
 const resizedDownload=page.waitForEvent('download');
 await page.locator('#export-review').click();
 const resized=JSON.parse(await readFile(await (await resizedDownload).path(),'utf8'));
 assert.equal(resized.states.workspace.status,'pending','Wrong-size PNG must revoke prior approval');
 assert.equal(await status.isDisabled(),true);
 wrongViewport=false;
 const repairedDownload=page.waitForEvent('download');
 await page.locator('#export-review').click();
 const repaired=JSON.parse(await readFile(await (await repairedDownload).path(),'utf8'));
 assert.equal(repaired.states.workspace.status,'pending','Repair cannot silently approve a state');
 const repairedDisabled=await status.isDisabled();
 if(repairedDisabled)console.error('Repaired evidence requests:',JSON.stringify(workspaceRequests.slice(-20)));
 assert.equal(repairedDisabled,false,
  'Restored dimensions must re-enable review: '+await page.locator('.state').first().locator('.image-warning').innerText());
 // Race regression: a slow old success cannot override a newer failed
 // evidence validation or silently re-enable the approval control.
 await status.selectOption('approved');
 const race=await page.evaluate(async()=>{
  const section=document.querySelector('.state');
  const originalFetch=window.fetch.bind(window);
  let intercepted=0,releaseSlow;
  window.fetch=async (...args)=>{
   const address=String(args[0]);
   if(address.includes('graphite-1440-workspace.png')&&address.includes('mdress-verify')){
    intercepted++;
    if(intercepted===1)await new Promise(resolve=>{releaseSlow=resolve;});
    if(intercepted===2)return new Response('Missing screenshot',{status:404});
   }
   return originalFetch(...args);
  };
  try{
   const oldCheck=verifyImages(section,{fresh:true});
   for(let i=0;i<100&&!releaseSlow;i++)await new Promise(resolve=>setTimeout(resolve,10));
   if(!releaseSlow)throw Error('First verification did not reach the slow image');
   const newestResult=await verifyImages(section,{fresh:true});
   releaseSlow();
   const staleResult=await oldCheck;
   return {newestResult,staleResult,disabled:section.querySelector('.review-status').disabled,
    warning:!section.querySelector('.image-warning').hidden,
    status:section.querySelector('.review-status').value};
  }finally{
   if(releaseSlow)releaseSlow();
   window.fetch=originalFetch;
  }
 });
 assert.equal(race.newestResult,false,'The latest missing image must fail');
 assert.equal(race.staleResult,false,'Superseded image checks cannot claim success');
 assert.equal(race.disabled,true,'Stale success cannot re-enable approval');
 assert.equal(race.warning,true,'Latest evidence failure remains visible');
 assert.equal(race.status,'pending','Latest failure revokes prior approval');
 // A subsequent successful check restores the ability to review, but never
 // the revoked approval itself.
 const raceRecovered=await page.evaluate(()=>verifyImages(document.querySelector('.state'),{fresh:true}));
 assert.equal(raceRecovered,true);
 assert.equal(await status.isDisabled(),false);
 assert.equal(await status.inputValue(),'pending');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#reset-review').click();
 assert.equal(await status.inputValue(),'pending');
 assert.match(await page.locator('#review-progress').innerText(),new RegExp('0/'+stateCount+' estados aprovados'));
 // An absent image must block a previously approved state from being signed
 // off. The exported record is downgraded to pending, never approved.
 await page.goto('http://mdress-qa.test/broken/gallery');
 const missing=page.locator('.state').first();
 await missing.locator('.image-warning').waitFor({state:'visible'});
 assert.equal(await missing.locator('.review-status').isDisabled(),true);
 const brokenDownload=page.waitForEvent('download');
 await page.locator('#export-review').click();
 const broken=JSON.parse(await readFile(await (await brokenDownload).path(),'utf8'));
 assert.equal(broken.states.workspace.status,'pending');
 assert.match(await missing.locator('.image-warning').innerText(),/seis capturas/);
 console.log('Gallery smoke passed: review, bidirectional state navigation, modal keyboard, persistence, concurrent fresh checks, missing/wrong-size PNG guards.');
 await context.close();
}finally{await browser.close();}
