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
 await page.route('http://mdress-qa.test/**',route=>
  route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto('http://mdress-qa.test/gallery');
 const status=page.locator('.review-status').first();
 const note=page.locator('.review-note').first();
 assert.equal(await page.locator('.review-status').count(),47);
 assert.match(await page.locator('#review-progress').innerText(),/0\/47 estados aprovados/);
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
 console.log('Gallery smoke passed: review, notes, persistence, filtering, export, reset.');
 await context.close();
}finally{await browser.close();}
