import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
await mkdir('test-results',{recursive:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.getElementById('weightBadge').textContent.includes('KiB'));
  const badge=page.locator('#weightBadge');
  const before=await badge.textContent();
  await badge.click();
  assert.equal(await page.locator('[data-inspector-tab="page"]').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#weightDetails').isVisible(),true);
  const rect=await badge.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width);
  await page.screenshot({path:'test-results/pdf-weight-'+width+'.png'});
  await page.evaluate(async()=>{const {revealInspectorControl}=await import('/property-inspector.js');revealInspectorControl('sectionStyleGallery');document.getElementById('sectionStyleGallery').showPopover();});
  await page.locator('[data-section-preset="glass"]').click();
  await page.waitForFunction(initial=>document.getElementById('weightBadge').textContent!==initial,before);
  const after=await badge.textContent();
  await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(value=>document.getElementById('weightBadge').textContent===value,after);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PDF weight QA passed: responsive badge, detail navigation, live updates and persistence.');
}finally{await browser.close();}
