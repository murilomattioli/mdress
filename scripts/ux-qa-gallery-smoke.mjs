/** Browser regression for the offline, human-reviewed UX-023 evidence gallery. */
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {deflateSync} from 'node:zlib';
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';

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
 const fixtures=new Map([1440,1024,768,390].map(width=>[width,viewportPng(width)]));
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
   const width=Number(address.pathname.match(/-(1440|1024|768|390)-/)?.[1]);
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
 assert.equal(await page.locator('.state').first().locator('.badge').getAttribute('aria-label'),'Revisão aprovada',
  'Screen readers must hear the actual persisted verdict');
 // A failed localStorage write must remain visible even when the review
 // counter refreshes. A subsequent successful save clears the warning.
 await page.evaluate(()=>{
  window.__qaOriginalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(){throw Error('QuotaExceededError');};
 });
 await note.fill('Foco, contraste e clipping — salvamento indisponível.');
 assert.match(await page.locator('#review-warning').innerText(),/Armazenamento indisponível/,
  'Notes must warn immediately when they cannot be persisted');
 await status.selectOption('rejected');
 assert.match(await page.locator('#review-warning').innerText(),/Armazenamento indisponível/,
  'Verdict refresh must not overwrite the storage failure warning');
 assert.equal(await page.locator('.state').first().locator('.badge').getAttribute('aria-label'),'Revisão reprovada');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__qaOriginalSetItem;});
 await status.selectOption('approved');
 await note.fill('Foco, contraste e clipping verificados manualmente neste cenário de teste.');
 assert.doesNotMatch(await page.locator('#review-warning').innerText(),/Armazenamento indisponível/,
  'A successful save must clear the storage failure warning');
 // The modal supports keyboard comparison and restores focus to its trigger.
 const firstImage=page.locator('.state').first().locator('figure a').first();
 await firstImage.click();
 const viewer=page.locator('#image-viewer');
 assert.equal(await viewer.isVisible(),true);
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('1/'+UX_QA_MATRIX.length));
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
 assert.equal(await page.locator('.state').first().locator('.badge').getAttribute('aria-label'),'Revisão reprovada');
 await viewerStatus.selectOption('approved');
 await viewerNote.fill('Foco, contraste, clipping e teclado verificados no visualizador.');
 assert.match(await note.inputValue(),/teclado verificados/,'Viewer notes persist in the state');
 await viewerNote.press('ArrowRight');
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('1/'+UX_QA_MATRIX.length),
  'Arrow keys editing notes must not navigate screenshots');
 await viewerNote.press('Shift+ArrowRight');
 assert.match(await page.locator('#viewer-label').innerText(),/workspace/,
  'Shift+ArrowRight while editing notes must not change states');
 // Comparing control states must retain the same theme/viewport, including
 // when using the keyboard shortcut, instead of silently returning to the first variant.
 await viewer.locator('#viewer-next').click();
 await viewer.locator('#viewer-next').click();
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('3/'+UX_QA_MATRIX.length));
 await viewer.locator('#viewer-next-state').click();
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('3/'+UX_QA_MATRIX.length+'.*toolbar'),
  'Next state preserves the selected screenshot variant');
 await viewer.locator('#viewer-prev-state').click();
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('3/'+UX_QA_MATRIX.length+'.*workspace'),
  'Previous state preserves the selected screenshot variant');
 await viewer.locator('#viewer-close').focus();
 await page.keyboard.press('Shift+ArrowRight');
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('3/'+UX_QA_MATRIX.length+'.*toolbar'),
  'Shift+Right compares the same viewport in the next state');
 await page.keyboard.press('Shift+ArrowLeft');
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('3/'+UX_QA_MATRIX.length+'.*workspace'),
  'Shift+Left compares the same viewport in the previous state');
 await viewer.locator('#viewer-prev').click();
 await viewer.locator('#viewer-prev').click();
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('1/'+UX_QA_MATRIX.length));
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
 await viewer.locator('#viewer-next').click();
 await viewer.locator('#viewer-next').click();
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('3/'+UX_QA_MATRIX.length));
 await viewer.locator('#viewer-close').click();
 const thirdImage=page.locator('.state').first().locator('figure a').nth(2);
 await page.waitForFunction(()=>document.activeElement===document.querySelector('.state')?.querySelectorAll('figure a')[2],null,{timeout:3000});
 assert.equal(await thirdImage.evaluate(el=>document.activeElement===el),true,
  'Closing after button navigation restores focus to the displayed variant');
 await firstImage.click();
 await page.keyboard.press('ArrowRight');
 assert.match(await page.locator('#viewer-label').innerText(),new RegExp('2/'+UX_QA_MATRIX.length));
 await page.keyboard.press('Escape');
 assert.equal(await viewer.isVisible(),false);
 const secondVariant=page.locator('.state').first().locator('figure a').nth(1);
 await page.waitForFunction(()=>document.activeElement===document.querySelector('.state')?.querySelectorAll('figure a')[1],null,{timeout:3000});
 assert.equal(await secondVariant.evaluate(el=>document.activeElement===el),true,
  'Closing after keyboard navigation restores focus to the displayed variant');
 await page.locator('#only-pending').click();
 assert.equal(await page.locator('.state').first().isVisible(),false,'Approved states can be hidden');
 await page.locator('#only-pending').click();
 // A reviewer who hides approved states can still move to the next pending
 // state after approving the current one inside the modal.
 await firstImage.click();
 await page.evaluate(()=>document.querySelector('#only-pending').click());
 assert.equal(await page.locator('.state').first().isVisible(),false);
 assert.equal(await viewer.locator('#viewer-state-position').innerText(),'Estado filtrado',
  'A filter change while the dialog is open must update its position immediately');
 assert.equal(await viewer.locator('#viewer-next-state').isDisabled(),false,
  'Next state must remain reachable when the current state is filtered out');
 await viewer.locator('#viewer-next-state').click();
 assert.match(await page.locator('#viewer-label').innerText(),/toolbar/,
  'Filtered current state must not trap the modal navigation');
 await viewer.locator('#viewer-close').click();
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
 // A session-bound exported draft can recover decisions after storage loss,
 // but foreign sessions and malformed state maps must never overwrite them.
 const uploadReview=async data=>{
  await page.locator('#import-review').setInputFiles({
   name:'mdress-ux023-review.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(data))
  });
  // setInputFiles dispatches a change event, but the handler awaits file.text()
  // and may still be validating when the Playwright call resolves. The gallery
  // clears the input only in finally; wait for that completion signal.
  await page.waitForFunction(()=>{
   const input=document.querySelector('#import-review');
   return input.value===''&&!document.querySelector('#import-review-button').disabled;
  });
 };
 await status.selectOption('rejected');
 await note.fill('Rascunho que será substituído pela importação.');
 page.once('dialog',dialog=>dialog.accept());
 await uploadReview(exported);
 await page.waitForFunction(()=>document.querySelector('#review-import-status')?.textContent.includes('Revisão recuperada'));
 assert.equal(await status.inputValue(),'approved','Valid same-session import restores verdict');
 assert.match(await note.inputValue(),/Foco, contraste/,'Valid import restores notes');
 await uploadReview({...exported,sessionId:'foreign-session'});
 assert.match(await page.locator('#review-import-status').innerText(),/Importação recusada/);
 assert.equal(await status.inputValue(),'approved','Foreign sessions must not overwrite verdicts');
 await uploadReview({...exported,states:{...exported.states,unknown:{status:'approved',note:''}}});
 assert.match(await page.locator('#review-import-status').innerText(),/Importação recusada/);
 assert.equal(await status.inputValue(),'approved','Unexpected states must not overwrite verdicts');
 breakFreshReview=true;
 page.once('dialog',dialog=>dialog.accept());
 await uploadReview(exported);
 await page.waitForFunction(()=>document.querySelector('#review-import-status')?.textContent.includes('Capturas inválidas'));
 assert.equal(await status.inputValue(),'pending','Invalid PNG must revoke even a previously approved imported state');
 breakFreshReview=false;
 assert.equal(await page.evaluate(()=>verifyImages(document.querySelector('.state'),{fresh:true})),true);
 await status.selectOption('approved');
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
 // An open review dialog must immediately revoke its approval controls
 // when a newer screenshot verification detects missing evidence.
 await status.selectOption('approved');
 await firstImage.click();
 assert.equal(await viewer.isVisible(),true);
 breakFreshReview=true;
 const modalInvalid=await page.evaluate(()=>verifyImages(document.querySelector('.state'),{fresh:true}));
 assert.equal(modalInvalid,false);
 assert.equal(await viewerStatus.isDisabled(),true,'Invalid evidence disables modal approval');
 assert.equal(await viewerStatus.inputValue(),'pending','Invalid evidence clears the modal verdict');
 breakFreshReview=false;
 const modalRestored=await page.evaluate(()=>verifyImages(document.querySelector('.state'),{fresh:true}));
 assert.equal(modalRestored,true);
 assert.equal(await viewerStatus.isDisabled(),false,'Restored evidence re-enables modal review');
 assert.equal(await viewerStatus.inputValue(),'pending','Restored evidence never auto-approves');
 await viewer.locator('#viewer-close').click();
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
 assert.match(await missing.locator('.image-warning').innerText(),new RegExp(UX_QA_MATRIX.length+' capturas'));
 console.log('Gallery smoke passed: review, bidirectional state navigation, modal keyboard, persistence, concurrent fresh checks, missing/wrong-size PNG guards.');
 await context.close();
}finally{await browser.close();}
