import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/color-picker',{recursive:true});
const browser=await chromium.launch();
try{
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:width===390});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
  await page.locator(await page.locator('#designToggle').isVisible()?'#designToggle':'#railDesign').click();
  const input=page.locator('#accentColor');
  const group=page.locator('.ds-accordion').filter({has:input});
  const toggle=group.locator('.ds-accordion-toggle');if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await input.click();
  const dialog=page.getByRole('dialog',{name:/Cores/});await dialog.waitFor();
  async function assertDescribedError(control){
   const id=await control.getAttribute('aria-errormessage');
   assert.ok(id,'Invalid fields must reference their visible error');
   const message=dialog.locator('[id="'+id+'"]');
   assert.equal(await message.count(),1,'Error reference must resolve uniquely');
   assert.equal(await message.getAttribute('data-error'),'true');
   assert.ok((await message.textContent()).trim());
  }
  // Regression: native Enter/change can both fire, but a semantic no-op
  // must not create a second document edit or history entry.
  await input.evaluate(el=>{
   window.__colorPickerEvents={color:0,opacity:0};
   el.addEventListener('change',()=>window.__colorPickerEvents.color++);
   el.addEventListener('coloropacitychange',()=>window.__colorPickerEvents.opacity++);
  });
  const hexBefore=await input.inputValue();
  const hexEditor=dialog.getByRole('textbox',{name:'Cor hexadecimal',exact:true});
  await hexEditor.fill(hexBefore.toUpperCase());await hexEditor.press('Enter');
  assert.equal(await page.evaluate(()=>window.__colorPickerEvents.color),0,'Reapplying current color must not emit change');
  const distinct=hexBefore.toUpperCase()==='#123456'?'#654321':'#123456';
  await hexEditor.fill(distinct);await hexEditor.press('Enter');
  assert.equal(await page.evaluate(()=>window.__colorPickerEvents.color),1,'One real color edit emits exactly one change');
  await hexEditor.press('Enter');
  assert.equal(await page.evaluate(()=>window.__colorPickerEvents.color),1,'Repeated Enter must not duplicate color edits');
  await page.screenshot({path:`test-results/color-picker/grid-${width}.png`});
  const cell=dialog.locator('.cp-cell').nth(30);await cell.click();
  assert.equal((await input.inputValue()).toUpperCase(),await cell.getAttribute('title'));
  const afterSwatch=await page.evaluate(()=>window.__colorPickerEvents.color);
  await cell.click();
  assert.equal(await page.evaluate(()=>window.__colorPickerEvents.color),afterSwatch,
   'Clicking the already selected swatch must not emit duplicate changes');
  await dialog.getByRole('button',{name:'Salvar cor atual',exact:true}).click();
  const saved=await input.inputValue();
  await dialog.getByRole('tab',{name:'Espectro',exact:true}).click();
  await dialog.locator('.cp-spectrum').click({position:{x:80,y:80}});
  const before=await input.inputValue();await dialog.locator('.cp-spectrum').press('ArrowRight');assert.notEqual(await input.inputValue(),before);
  if(width===390){const rect=await dialog.locator('.cp-spectrum').boundingBox();await page.touchscreen.tap(rect.x+120,rect.y+120);assert.notEqual(await input.inputValue(),before);}
  await page.screenshot({path:`test-results/color-picker/spectrum-${width}.png`});
  await dialog.getByRole('tab',{name:'RGB',exact:true}).click();
  assert.equal(await dialog.getByRole('tab',{name:'RGB',exact:true}).getAttribute('aria-selected'),'true');
  const redChannel=dialog.getByRole('spinbutton',{name:'Vermelho — valor',exact:true});
   await redChannel.fill('999');await redChannel.dispatchEvent('change');
   assert.equal(await redChannel.getAttribute('aria-invalid'),'true');
   await assertDescribedError(redChannel);
   assert.match(await dialog.locator('.cp-status').textContent(),/0 e 255/);
   await redChannel.press('Escape');
   assert.equal(await redChannel.getAttribute('aria-invalid'),null);
   assert.equal(await redChannel.getAttribute('aria-errormessage'),null);
   assert.equal(await dialog.locator('.cp-status').textContent(),'',
    'Cancelling an invalid RGB draft must clear stale error feedback');
   assert.equal(await dialog.isVisible(),true);
   await dialog.getByRole('spinbutton',{name:'Vermelho — valor',exact:true}).fill('255');
  await dialog.getByRole('spinbutton',{name:'Vermelho — valor',exact:true}).press('Tab');
  assert.equal((await input.inputValue()).slice(1,3),'ff');
  const hex=dialog.getByRole('textbox',{name:'Cor hexadecimal',exact:true});
  await hex.fill('bad');await hex.press('Enter');assert.equal(await hex.getAttribute('aria-invalid'),'true');await assertDescribedError(hex);
  await hex.fill('#123456');await hex.press('Enter');assert.equal(await input.inputValue(),'#123456');
  assert.equal(await hex.getAttribute('aria-errormessage'),null,'Valid HEX must clear stale error references');
  await page.screenshot({path:`test-results/color-picker/rgb-${width}.png`});
  assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  const opacity=dialog.getByRole('spinbutton',{name:'Opacidade em porcentagem',exact:true});
   const originalOpacity=await opacity.inputValue();
   await opacity.fill('120');await opacity.dispatchEvent('change');
   assert.equal(await opacity.getAttribute('aria-invalid'),'true');
   await assertDescribedError(opacity);
   assert.match(await dialog.locator('.cp-status').textContent(),/0% e 100%/);
   await opacity.press('Escape');
   assert.equal(await opacity.inputValue(),originalOpacity);
   await opacity.fill('42.5');await opacity.dispatchEvent('change');
   assert.equal(await opacity.getAttribute('aria-invalid'),'true',
    'Fractional opacity is invalid when the native step is one percent');
   await assertDescribedError(opacity);
   await opacity.press('Escape');
   assert.equal(await opacity.getAttribute('aria-invalid'),null);
   assert.equal(await opacity.getAttribute('aria-errormessage'),null);
   assert.equal(await dialog.isVisible(),true,'Escape on invalid opacity should not close the picker');
   await opacity.fill('42');await opacity.dispatchEvent('change');
   assert.equal(await input.getAttribute('data-opacity'),'0.42');
   assert.equal(await opacity.getAttribute('aria-invalid'),null);
   assert.equal(await page.evaluate(()=>window.__colorPickerEvents.opacity),1);
   await opacity.dispatchEvent('change');
   assert.equal(await page.evaluate(()=>window.__colorPickerEvents.opacity),1,
    'Repeated unchanged opacity must not generate extra history events');
   await page.screenshot({path:`test-results/color-picker/opacity-${width}.png`});
   await dialog.getByRole('button',{name:'Fechar seletor de cores',exact:true}).click();
  assert.equal(await input.evaluate(el=>el===document.activeElement),true);
  await input.press('Enter');await dialog.waitFor();await dialog.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');
  await page.reload();
  assert.equal(await input.inputValue(),'#123456');
  await input.evaluate(el=>el.click());await dialog.waitFor();
  assert.ok(await dialog.getByRole('button',{name:'Usar '+saved.toUpperCase(),exact:true}).count());
  await dialog.press('Escape');
  await page.evaluate(()=>{document.body.dataset.theme='graphite';});
  await input.evaluate(el=>el.click());await dialog.waitFor();
  await page.screenshot({path:`test-results/color-picker/dark-${width}.png`});
  assert.equal(await dialog.evaluate(el=>el.matches(':modal')),false);
  await page.mouse.click(5,5);await page.locator('.mdress-color-picker').waitFor({state:'detached'});
  await input.evaluate(el=>el.click());await dialog.waitFor();
  await dialog.locator('.cp-saved-color').last().focus();await page.keyboard.press('Tab');
  await page.locator('.mdress-color-picker').waitFor({state:'detached'});
  await input.evaluate(el=>el.click());await dialog.waitFor();
   await input.evaluate(el=>{el.disabled=true;});
   await page.locator('.mdress-color-picker').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>document.activeElement!==document.body&&document.activeElement?.getClientRects().length>0),true,
    'Disabling the source while its picker is open must restore usable keyboard focus');
   await input.evaluate(el=>el.click());assert.equal(await page.locator('.mdress-color-picker').count(),0);
  await input.evaluate(el=>{el.disabled=false;});
  assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage();await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.locator('#source').waitFor();
 await page.evaluate(()=>{window.EyeDropper=class{async open(){return {sRGBHex:'#ABCDEF'};}};document.getElementById('accentColor').click();});
 let dialog=page.getByRole('dialog',{name:/Cores/});await dialog.getByRole('button',{name:'Capturar cor da tela',exact:true}).click();
 assert.equal(await page.locator('#accentColor').inputValue(),'#abcdef');await dialog.press('Escape');await page.locator('.mdress-color-picker').waitFor({state:'detached'});
 await page.evaluate(()=>{window.EyeDropper=undefined;document.getElementById('accentColor').click();});
 assert.equal(await dialog.getByRole('button',{name:'Capturar cor da tela',exact:true}).isDisabled(),true);await dialog.press('Escape');await page.locator('.mdress-color-picker').waitFor({state:'detached'});
 await page.evaluate(()=>{const kind=document.getElementById('bgKind');kind.value='mesh';kind.dispatchEvent(new Event('change',{bubbles:true}));});
 const mesh=page.locator('#meshPointControls input[type=color]').first();await mesh.waitFor({state:'attached'});await mesh.evaluate(el=>el.click());
 dialog=page.getByRole('dialog',{name:/Cores/});const hex=dialog.getByRole('textbox',{name:'Cor hexadecimal',exact:true});await hex.fill('#13579B');await hex.press('Enter');
 assert.equal(await mesh.inputValue(),'#13579b');await hex.fill('#ABC123');await hex.press('Enter');assert.equal(await mesh.inputValue(),'#abc123');
 await dialog.getByRole('button',{name:'Fechar seletor de cores',exact:true}).click();await page.close();
 console.log('Color picker: palette, spectrum pointer/keyboard, RGB, invalid HEX, persistence, saved colors, Escape/focus and overflow passed at 1440/768/390.');
}finally{await browser.close();}
