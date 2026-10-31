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
 for(const tab of ['document','content','page','themes']){
  await page.locator('[data-inspector-tab="'+tab+'"]').click();
  const groups=page.locator('#inspector-'+tab+' .ds-accordion');
  for(const group of await groups.all())if(await group.locator('button.ds-accordion-toggle').getAttribute('aria-expanded')==='true')await group.locator('button.ds-accordion-toggle').click();
  for(let i=0;i<await groups.count();i++){
   const group=groups.nth(i),toggle=group.locator('button.ds-accordion-toggle');
   await toggle.click();await toggle.scrollIntoViewIfNeeded();
   const geometry=await group.evaluate(el=>{const b=el.querySelector('.ds-accordion-body');return {padding:getComputedStyle(b).paddingTop,gap:getComputedStyle(b).gap,overflow:b.scrollWidth>b.clientWidth+2};});
   assert.equal(geometry.padding,'4px');assert.equal(geometry.gap,'8px');assert.equal(geometry.overflow,false);
   await page.screenshot({path:'test-results/group-'+tab+'-'+i+'.png'});
   await toggle.click();
   assert.ok(await group.evaluate(el=>el.getBoundingClientRect().height<=38));
  }
 }
 assert.equal(await page.locator('#themeRecipeGallery').evaluate(el=>getComputedStyle(el).maxHeight),'none');
 for(const [tab,id] of [['themes','themeRecipeGallery'],['document','backgroundGallery']]){
  await page.locator('[data-inspector-tab="'+tab+'"]').click();
  const group=page.locator('.ds-accordion').filter({has:page.locator('#'+id)}),toggle=group.locator('.ds-accordion-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  const selected=()=>page.locator('#'+id+' button[aria-pressed=true]').first().getAttribute('aria-label');
  await group.locator('[data-action=next]').click();const first=await selected();
  await group.locator('[data-action=next]').click();assert.notEqual(await selected(),first);
  await group.locator('[data-action=previous]').click();assert.equal(await selected(),first);
  await group.locator('[data-action=random]').click();assert.notEqual(await selected(),first);
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 }
 await page.locator('[data-inspector-tab=document]').click();
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  for(const title of ['Tipografia','Cores e fundo']){const toggle=page.getByRole('button',{name:title,exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();}
  const font=page.locator('#fontChoice'),actions=page.getByRole('group',{name:'Alternar Fonte',exact:true});
  const previous=await font.inputValue();
  await actions.locator('[data-action=next]').click();assert.notEqual(await font.inputValue(),previous);
  await actions.locator('[data-action=previous]').click();assert.equal(await font.inputValue(),previous);
  await actions.locator('[data-action=random]').focus();await page.keyboard.press('Enter');assert.notEqual(await font.inputValue(),previous);
  await font.evaluate(el=>el.disabled=true);await page.waitForFunction(()=>document.querySelector('.ds-property-select--quick .ds-quick-action').disabled);
  assert.equal(await actions.locator('button:disabled').count(),3);await font.evaluate(el=>el.disabled=false);
  await page.waitForFunction(()=>!document.querySelector('.ds-property-select--quick .ds-quick-action').disabled);
  assert.equal(await font.evaluate(el=>{
   const field=el.closest('.ds-property-select'),label=field.querySelector('.ds-prop-name').getBoundingClientRect(),actions=field.querySelector('.ds-choice-actions').getBoundingClientRect(),trigger=field.querySelector('.ds-select-trigger').getBoundingClientRect();
   return label.right<=actions.left&&Math.max(label.bottom,actions.bottom)<=trigger.top&&trigger.right<=field.getBoundingClientRect().right;
  }),true);
  await page.locator('.inspector-scroll').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:'test-results/compact-inspector-'+width+'.png'});
  const geometry=await page.locator('#inspector-document').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+2,rows:[...el.querySelectorAll('.ds-property-range')].map(row=>row.getBoundingClientRect().height)}));
  assert.equal(geometry.overflow,false);assert.ok(geometry.rows.every(h=>h<=64));
 }
 console.log('Compact groups and fields, all four tabs, closed-header previous/next/random and responsive screenshots passed.');
}finally{await browser.close();}
