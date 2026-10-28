/** Browser regression for the offline, human-reviewed UX-023 evidence gallery. */
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const html=await readFile('test-results/ux-audit/supervised/index.html','utf8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 // A synthetic local origin enables storage/download tests without an external service.
 // Serve real decodable PNG bytes: an HTML fallback must never count as reviewed evidence.
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64');
 await page.route('http://mdress-qa.test/**',route=>{
  const address=new URL(route.request().url());
  if(address.pathname.endsWith('.png')){
   if(address.pathname.includes('graphite-1440-workspace.png')&&address.pathname.startsWith('/broken/'))
    return route.fulfill({status:404,body:'Missing screenshot'});
   return route.fulfill({status:200,contentType:'image/png',body:pixel});
  }
  return route.fulfill({status:200,contentType:'text/html',body:html});
 });
 await page.goto('http://mdress-qa.test/gallery');
 const status=page.locator('.review-status').first();
 const note=page.locator('.review-note').first();
 assert.equal(await page.locator('.review-status').count(),47);
 assert.match(await page.locator('#review-progress').innerText(),/0\/47 estados aprovados/);
 await status.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.review-status').disabled);
 await status.selectOption('approved');
 await note.fill('Foco, contraste e clipping verificados manualmente neste cenário de teste.');
 assert.match(await page.locator('#review-progress').innerText(),/1\/47 estados aprovados/);
 await page.reload();
 assert.equal(await status.inputValue(),'approved','Review must survive reload in this session');
 assert.match(await note.inputValue(),/Foco, contraste/);
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
 assert.equal(Object.keys(exported.states).length,47);
 assert.ok(exported.sessionId);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#reset-review').click();
 assert.equal(await status.inputValue(),'pending');
 assert.match(await page.locator('#review-progress').innerText(),/0\/47 estados aprovados/);
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
 console.log('Gallery smoke passed: review, persistence, export, missing-PNG guard.');
 await context.close();
}finally{await browser.close();}
