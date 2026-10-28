import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.locator('#designToggle').click();
 await page.locator('#toast.show').waitFor({state:'hidden'});
 for(const tab of ['style','sections','page','background','ai']){
  await page.locator('[data-inspector-tab="'+tab+'"]').click();
  const groups=page.locator('#inspector-'+tab+' .ds-accordion');
  for(const group of await groups.all())if(await group.locator('button.ds-accordion-toggle').getAttribute('aria-expanded')==='true')await group.locator('button.ds-accordion-toggle').click();
  for(let i=0;i<await groups.count();i++){
   const group=groups.nth(i),toggle=group.locator('button.ds-accordion-toggle');
   await toggle.click();await toggle.scrollIntoViewIfNeeded();
   const geometry=await group.evaluate(el=>{const b=el.querySelector('.ds-accordion-body');return {padding:getComputedStyle(b).paddingTop,gap:getComputedStyle(b).gap,overflow:b.scrollWidth>b.clientWidth+2};});
   assert.equal(geometry.padding,'4px');assert.equal(geometry.gap,'12px');assert.equal(geometry.overflow,false);
   await page.screenshot({path:'test-results/group-'+tab+'-'+i+'.png'});
   await toggle.click();
   assert.ok(await group.evaluate(el=>el.getBoundingClientRect().height<=46));
  }
 }
 assert.equal(await page.locator('#themeRecipeGallery').evaluate(el=>getComputedStyle(el).maxHeight),'none');
 console.log('Every accordion verified open/closed, 4px top inset, 12px gap, no horizontal overflow; gallery has no nested scroll.');
}finally{await browser.close();}
