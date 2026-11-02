import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4174');
 await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');
 const markdown=await page.locator('#source').inputValue();
 const click=id=>page.locator(id.startsWith('[')?id:'#'+id).evaluate(el=>el.click());
 async function respond(accept,pattern){
  const dialog=page.getByRole('alertdialog');await dialog.waitFor({state:'visible'});
  if(pattern)assert.match(await dialog.textContent(),pattern);
  await dialog.locator(accept?'[data-alert-confirm]':'[data-alert-cancel]').click();
  await dialog.waitFor({state:'detached'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }
 async function confirmAction(id,accept,pattern){await click(id);await respond(accept,pattern);}
 await page.locator('#accentColor').evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await confirmAction('resetResumeTheme',false,/Redefinir/);assert.equal(await page.locator('#accentColor').inputValue(),'#123456');
 await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');await page.reload();
 await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');assert.equal(await page.locator('#accentColor').inputValue(),'#123456');
 await confirmAction('resetResumeTheme',true,/Redefinir/);assert.notEqual(await page.locator('#accentColor').inputValue(),'#123456');
 assert.equal(await page.locator('#source').inputValue(),markdown);
 const code=await page.evaluate(async()=>{const {themeCode,defaults}=await import('/resume-themes.js');return themeCode({...defaults,accent:'#654321'});});
 for(const accept of [false,true]){
  const previous=await page.locator('#accentColor').inputValue();
  await click('importTheme');await page.getByRole('textbox',{name:'Código do tema'}).fill(code);await page.locator('[data-alert-confirm]').click();await page.getByRole('alertdialog',{name:'Atenção'}).waitFor();await respond(accept);
  assert.equal(await page.locator('#accentColor').inputValue(),accept?'#654321':previous);
 }
 await click('saveThemePreset');await page.getByRole('textbox',{name:'Nome do tema'}).fill('Tema de QA');await respond(true);
 const picker=page.locator('#savedThemePicker');await picker.locator('option',{hasText:'Tema de QA'}).waitFor({state:'attached'});const count=await picker.locator('option').count();
 await confirmAction('deleteThemePreset',false,/Excluir tema salvo/);assert.equal(await picker.locator('option').count(),count);
 await confirmAction('deleteThemePreset',true,/Excluir tema salvo/);await page.waitForFunction(n=>document.querySelectorAll('#savedThemePicker option').length===n,count-1);
 await page.locator('#bgKind').evaluate(el=>{el.value='mesh';el.dispatchEvent(new Event('change',{bubbles:true}));});
 const points=page.locator('.mesh-point'),before=await points.count();assert.ok(before>2);
 for(const accept of [false,true]){
  await points.first().locator('button[aria-label="Remover ponto 1"]').evaluate(el=>el.click());await respond(accept,/Remover o ponto/);
  assert.equal(await points.count(),accept?before-1:before);
 }
 await confirmAction('sectionStyleReset',false,/Restaurar/);await confirmAction('sectionStyleReset',true,/Restaurar/);
 for(const selector of ['[data-preview-property-reset]','[data-preview-style-reset]']){
  const element=page.locator('#pageStack h1[data-md-element-id]').first();await element.evaluate(el=>el.click());
  await page.locator('[data-element-property="fontSize"]').evaluate(el=>{el.value='24';el.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await element.evaluate(el=>el.style.fontSize),'24px');
  await confirmAction(selector,false,/elemento/);assert.equal(await element.evaluate(el=>el.style.fontSize),'24px');
  await confirmAction(selector,true,/elemento/);assert.equal(await element.evaluate(el=>el.style.fontSize),'');
 }
 console.log('Destructive actions: cancellation preserves document and element styling; confirmed resets/import/deletion apply. Persistence after cancellation and Markdown preservation passed.');
}finally{await browser.close();}
