/** Browser regression for the offline, human-reviewed UX-023 evidence gallery. */
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {deflateSync} from 'node:zlib';

const html=await readFile('test-results/ux-audit/supervised/index.html','utf8');
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
 await page.route('http://mdress-qa.test/**',route=>{
  const address=new URL(route.request().url());
  if(address.pathname.endsWith('.png')){
   if(address.pathname.includes('graphite-1440-workspace.png')&&
      (address.pathname.startsWith('/broken/')||(breakFreshReview&&address.searchParams.has('mdress-verify'))))
    return route.fulfill({status:404,body:'Missing screenshot'});
   const width=Number(address.pathname.match(/-(1440|1024|768)-/)?.[1]);
   const wrongSize=wrongViewport&&address.pathname.includes('graphite-1440-workspace.png')&&
    address.searchParams.has('mdress-verify');
   return route.fulfill({status:200,contentType:'image/png',body:wrongSize?pixel:fixtures.get(width)});
  }
  return route.fulfill({status:200,contentType:'text/html',body:html});
 });
 await page.goto('http://mdress-qa.test/gallery');
 const status=page.locator('.review-status').first();
 const note=page.locator('.review-note').first();
 assert.equal(await page.locator('.review-status').count(),50);
 assert.match(await page.locator('#review-progress').innerText(),/0\/50 estados aprovados/);
 await status.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.review-status').disabled);
 await status.selectOption('approved');
 await note.fill('Foco, contraste e clipping verificados manualmente neste cenário de teste.');
 assert.match(await page.locator('#review-progress').innerText(),/1\/50 estados aprovados/);
 await page.reload();
 assert.equal(await status.inputValue(),'approved','Review must survive reload in this session');
 assert.match(await note.inputValue(),/Foco, contraste/);
 // The modal supports keyboard comparison and restores focus to its trigger.
 const firstImage=page.locator('.state').first().locator('figure a').first();
 await firstImage.click();
 const viewer=page.locator('#image-viewer');
 assert.equal(await viewer.isVisible(),true);
 assert.match(await page.locator('#viewer-label').innerText(),/1\/6/);
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
 assert.equal(Object.keys(exported.states).length,50);
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
 assert.equal(await status.isDisabled(),false,
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
  await page.waitForFunction(()=>!document.querySelector('.review-status').disabled);
 assert.equal(await status.isDisabled(),false);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#reset-review').click();
 assert.equal(await status.inputValue(),'pending');
 assert.match(await page.locator('#review-progress').innerText(),/0\/50 estados aprovados/);
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
 console.log('Gallery smoke passed: review, modal keyboard, persistence, fresh export revalidation, missing/wrong-size PNG guards.');
 await context.close();
}finally{await browser.close();}
