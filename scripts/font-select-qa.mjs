import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/font-select',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4174');await page.locator('#designToggle').click();
 const reveal=()=>page.evaluate(async()=>{const {revealInspectorControl}=await import('/property-inspector.js');revealInspectorControl('fontChoice');});
 await reveal();
 const trigger=page.locator('.ds-property-select').filter({has:page.locator('#fontChoice')}).locator('.ds-select-trigger');
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await reveal();await trigger.click();
  const search=page.getByRole('searchbox',{name:'Buscar fonte'});
  await search.fill('zzz');assert.equal(await page.getByRole('status').filter({hasText:'Nenhuma fonte'}).isVisible(),true);
  await search.fill('mono');assert.equal(await page.locator('.ds-select-option:visible').count(),3);
  await search.fill('');
  const box=await page.locator('.ds-select-popover').boundingBox();assert.ok(box.width>=300&&box.x>=0&&box.x+box.width<=width);
  await page.screenshot({path:`test-results/font-select/${width}.png`});
  await search.fill('verd');await search.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#fontChoice').inputValue(),'verdana');
  assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  await trigger.click();await page.getByRole('searchbox').press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 }
 await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');
 await page.reload();assert.equal(await page.locator('#fontChoice').inputValue(),'verdana');
 console.log('Font search, groups, empty state, keyboard, focus, persistence and three viewport screenshots passed.');
}finally{await browser.close();}
