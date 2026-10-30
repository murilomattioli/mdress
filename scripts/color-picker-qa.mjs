import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/color-picker',{recursive:true});
const browser=await chromium.launch();
try{
 for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:width<=390});
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
  // Keyboard users should land on the currently selected swatch on reopening,
  // rather than always having to traverse the palette from its first cell.
  const selectedSwatchColor=await cell.getAttribute('title');
  await dialog.getByRole('button',{name:'Fechar seletor de cores',exact:true}).click();
  await input.click();await dialog.waitFor();
  await page.keyboard.press('Tab');
  const selectedTabStop=dialog.locator('.cp-cell[tabindex="0"]');
  assert.equal(await selectedTabStop.count(),1,'Palette exposes exactly one keyboard Tab stop');
  assert.equal(await selectedTabStop.getAttribute('title'),selectedSwatchColor,
   'The selected swatch is the palette entry point');
  assert.equal(await selectedTabStop.evaluate(el=>document.activeElement===el),true,
   'Tab from the palette tab must focus the selected swatch');
  await page.keyboard.press('ArrowRight');
  assert.equal(await dialog.locator('.cp-cell[tabindex="0"]').count(),1,
   'Arrow navigation preserves exactly one Tab stop');
  assert.equal(await dialog.locator('.cp-cell[tabindex="0"]').evaluate(el=>document.activeElement===el),true,
   'Arrow navigation moves both focus and the roving Tab stop');
  await page.keyboard.press('Home');
  assert.equal(await dialog.locator('.cp-cell').first().getAttribute('tabindex'),'0',
   'Home moves the palette Tab stop to its first color');
  if(width<=390){
   await page.keyboard.press('ArrowDown');
   const columns=width<=360?5:6;
   assert.equal(await dialog.locator('.cp-cell').nth(columns).getAttribute('tabindex'),'0',
    'Down arrow follows the responsive palette column count');
   await page.keyboard.press('Home');
   for(const selector of ['.cp-cell','.cp-header .cp-button','.cp-tabs .cp-button']){
    const box=await dialog.locator(selector).first().boundingBox();
    assert.ok(box&&box.width>=43.5&&box.height>=43.5,
     'Mobile picker touch target must be at least 44px: '+selector+' '+JSON.stringify(box));
   }
  }
  await dialog.getByRole('button',{name:'Salvar cor atual',exact:true}).click();
  if(width<=390){
   const box=await dialog.locator('.cp-saved-color').first().boundingBox();
   assert.ok(box&&box.width>=43.5&&box.height>=43.5,
    'Saved colors need mobile touch targets: '+JSON.stringify(box));
  }
  const saved=await input.inputValue();
  await dialog.getByRole('tab',{name:'Espectro',exact:true}).click();
  if(width<=390){
   const box=await dialog.locator('.cp-hue').boundingBox();
   assert.ok(box&&box.height>=43.5,'Mobile hue slider needs a 44px touch target');
  }
  await dialog.locator('.cp-spectrum').click({position:{x:80,y:80}});
  const before=await input.inputValue();await dialog.locator('.cp-spectrum').press('ArrowRight');assert.notEqual(await input.inputValue(),before);
  if(width<=390){const rect=await dialog.locator('.cp-spectrum').boundingBox();await page.touchscreen.tap(rect.x+120,rect.y+120);assert.notEqual(await input.inputValue(),before);}
  await page.screenshot({path:`test-results/color-picker/spectrum-${width}.png`});
  await dialog.getByRole('tab',{name:'RGB',exact:true}).click();
  assert.equal(await dialog.getByRole('tab',{name:'RGB',exact:true}).getAttribute('aria-selected'),'true');
  if(width<=390){
   for(const selector of ['.cp-channel input[type=range]','.cp-opacity input[type=range]']){
    const box=await dialog.locator(selector).first().boundingBox();
    assert.ok(box&&box.height>=43.5,'Mobile channel/opacity slider needs a 44px touch target: '+selector);
   }
  }
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
  // A shared error status has exactly one ARIA owner. Switching from HEX to
  // RGB must remove the old invalid state before describing the new field.
  await redChannel.fill('999');await redChannel.dispatchEvent('change');
  assert.equal(await hex.getAttribute('aria-invalid'),null,'Previous HEX error owner must be cleared');
  assert.equal(await hex.getAttribute('aria-errormessage'),null,'Previous HEX error IDREF must be removed');
  assert.equal(await redChannel.getAttribute('aria-invalid'),'true');
  await assertDescribedError(redChannel);
  assert.equal(await dialog.locator('.cp-status').getAttribute('aria-live'),'assertive');
  await page.screenshot({path:`test-results/color-picker/error-handoff-${width}.png`});
  await redChannel.press('Escape');
  assert.equal(await dialog.locator('.cp-status').textContent(),'');
  await hex.fill('bad');await hex.dispatchEvent('change');
  await redChannel.press('Escape');
  assert.equal(await hex.getAttribute('aria-invalid'),'true',
   'Cancelling an unrelated RGB field must not erase the active HEX error');
  await assertDescribedError(hex);
  const validationBeforeSave=await dialog.locator('.cp-status').textContent();
  await dialog.getByRole('button',{name:'Salvar cor atual',exact:true}).click();
  assert.equal(await dialog.locator('.cp-status').textContent(),validationBeforeSave,
   'Saving the committed color must not overwrite an active HEX validation error');
  await assertDescribedError(hex);
  await page.screenshot({path:`test-results/color-picker/error-owner-${width}.png`});
  await hex.fill('#123456');await hex.press('Enter');assert.equal(await input.inputValue(),'#123456');
  assert.equal(await dialog.locator('.cp-status').textContent(),'','Successful edit clears the shared error');
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
  // A scripted/keyboard switch has no outside pointerdown. The previous
  // close event must not steal focus from the replacement picker.
  await input.evaluate(el=>el.click());await dialog.waitFor();
  const duplicatePickerIds=await page.evaluate(()=>{
   document.getElementById('textColor').click();
   const ids=[...document.querySelectorAll('.mdress-color-picker [id]')].map(el=>el.id);
   return ids.filter((id,index)=>ids.indexOf(id)!==index);
  });
  assert.deepEqual(duplicatePickerIds,[],'Overlapping pickers need unique ARIA IDs');
  await page.waitForFunction(()=>document.querySelectorAll('.mdress-color-picker').length===1);
  assert.match(await dialog.getAttribute('aria-label'),/Texto/);
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,
   'A superseded picker must not steal focus from its replacement');
  await page.screenshot({path:`test-results/color-picker/switch-text-${width}.png`});
  await input.evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelectorAll('.mdress-color-picker').length===1);
  assert.match(await dialog.getAttribute('aria-label'),/Destaque/);
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,
   'Switching back must preserve focus in the active picker');
  await page.screenshot({path:`test-results/color-picker/switch-back-${width}.png`});
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
 // Deferred native eyedropper: repeated clicks must not start competing
 // requests, and a completion after dismissal must not edit a new picker.
 await page.evaluate(()=>{
  window.__qaDropperCalls=0;
  window.EyeDropper=class{open(){
   window.__qaDropperCalls++;
   return new Promise((resolve,reject)=>{window.__qaDropperResolve=resolve;window.__qaDropperReject=reject;});
  }};
  document.getElementById('accentColor').click();
 });
 dialog=page.getByRole('dialog',{name:/Cores/});
 const asyncDropper=dialog.getByRole('button',{name:'Capturar cor da tela',exact:true});
 await asyncDropper.click();
 await asyncDropper.dispatchEvent('click');
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),1,
  'Concurrent eyedropper clicks must share one pending native request');
 assert.equal(await asyncDropper.getAttribute('aria-busy'),'true',
  'Pending native eyedropper must announce its busy state');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-pending.png',animations:'disabled'});
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#13579B'}));
 await page.waitForFunction(()=>document.getElementById('accentColor').value==='#13579b');
 assert.equal(await asyncDropper.getAttribute('aria-busy'),null,
  'The busy state must clear after native eyedropper completes');
 // Manual HEX edits made while the native picker is open must win the race.
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),2);
 const pendingHex=dialog.getByRole('textbox',{name:'Cor hexadecimal',exact:true});
 await pendingHex.fill('#2468AC');await pendingHex.press('Enter');
 assert.equal(await page.locator('#accentColor').inputValue(),'#2468ac');
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#FF00FF'}));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await page.locator('#accentColor').inputValue(),'#2468ac',
  'An obsolete sample must not overwrite a newer manual HEX edit');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-manual-edit-preserved.png',animations:'disabled'});
 // Document updates may bypass the picker controls entirely. The native
 // source value must be checked at resolution, not only the local revision.
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),3);
 await page.locator('#accentColor').evaluate(el=>{
  el.value='#ABC123';el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#C0FFEE'}));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await page.locator('#accentColor').inputValue(),'#abc123',
  'An obsolete sample must not overwrite an external document edit');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-external-edit-preserved.png',animations:'disabled'});
 // The source can change away and back to its original HEX (ABA). Value
 // equality alone would wrongly accept that older screen sample.
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),4);
 await page.locator('#accentColor').evaluate(el=>{
  for(const value of ['#000000','#ABC123']){
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#010203'}));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await page.locator('#accentColor').inputValue(),'#abc123',
  'ABA source changes must invalidate a pending sample even when HEX matches again');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-aba-edit-preserved.png',animations:'disabled'});
 // A disabled→enabled transition in one task is still an invalidation,
 // even when the dialog remains open at the end of that task.
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),5);
 await page.locator('#accentColor').evaluate(el=>{el.disabled=true;el.disabled=false;});
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#BADA55'}));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await page.locator('#accentColor').inputValue(),'#abc123',
  'Rapid disable/re-enable must not revive a pending sample');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-reenabled-stale.png',animations:'disabled'});
 // Changing opacity is also an intentional edit and invalidates a pending
 // sample even when the HEX color itself remains unchanged.
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),6);
 const pendingOpacity=dialog.getByRole('spinbutton',{name:'Opacidade em porcentagem',exact:true});
 await pendingOpacity.fill('41');await pendingOpacity.dispatchEvent('change');
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#FACADE'}));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await page.locator('#accentColor').inputValue(),'#abc123',
  'A pending sample must not overwrite a newer opacity edit');
 assert.equal(await page.locator('#accentColor').getAttribute('data-opacity'),'0.41');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-opacity-edit-preserved.png',animations:'disabled'});
 // Rejected native samples are also asynchronous: obsolete failures must
 // not replace validation messages or invent errors after a newer edit.
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),7);
 await pendingHex.fill('#2468AC');await pendingHex.press('Enter');
 await page.evaluate(()=>window.__qaDropperReject(new Error('Native device unavailable')));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await page.locator('#accentColor').inputValue(),'#2468ac');
 assert.equal(await dialog.locator('.cp-status').textContent(),'','A stale native failure must not interrupt a newer HEX edit');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-stale-failure-ignored.png',animations:'disabled'});
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),8);
 await pendingHex.fill('bad');await pendingHex.dispatchEvent('change');
 const errorRef=await pendingHex.getAttribute('aria-errormessage');
 assert.ok(errorRef,'Invalid HEX needs an accessible error reference');
 const validationBeforeReject=await dialog.locator('.cp-status').textContent();
 await page.evaluate(()=>window.__qaDropperReject(new Error('Native device unavailable')));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await dialog.locator('.cp-status').textContent(),validationBeforeReject,
  'Native rejection must not overwrite the active field validation error');
 assert.equal(await pendingHex.getAttribute('aria-errormessage'),errorRef);
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-error-owner-preserved.png',animations:'disabled'});
 await pendingHex.fill('#2468AC');await pendingHex.press('Enter');
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),9);
 await page.evaluate(()=>window.__qaDropperReject(new Error('Native device unavailable')));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.match(await dialog.locator('.cp-status').textContent(),/Não foi possível capturar/,
  'A current native rejection must still report its failure');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-current-failure.png',animations:'disabled'});
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),10);
 await page.evaluate(()=>window.__qaDropperReject(Object.assign(new Error('Cancelled'),{name:'AbortError'})));
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker .cp-header [aria-busy="true"]'));
 assert.equal(await dialog.locator('.cp-status').textContent(),'','Cancellation must not show an error');
 await asyncDropper.click();
 assert.equal(await page.evaluate(()=>window.__qaDropperCalls),11);
 const beforeDismissal=await page.locator('#accentColor').inputValue();
 await dialog.press('Escape');
 await page.locator('.mdress-color-picker').waitFor({state:'detached'});
 await page.evaluate(()=>document.getElementById('accentColor').click());
 dialog=page.getByRole('dialog',{name:/Cores/});
 await dialog.waitFor();
 await page.evaluate(()=>window.__qaDropperResolve({sRGBHex:'#FF00FF'}));
 assert.equal(await page.locator('#accentColor').inputValue(),beforeDismissal,
  'A stale eyedropper result must not mutate the document after dismissal');
 assert.equal(await dialog.isVisible(),true,
  'A stale eyedropper result must not dismiss the replacement dialog');
 await dialog.screenshot({path:'test-results/color-picker/eyedropper-stale-ignored.png',animations:'disabled'});
 await dialog.press('Escape');
 await page.locator('.mdress-color-picker').waitFor({state:'detached'});
 await page.evaluate(()=>{window.EyeDropper=undefined;document.getElementById('accentColor').click();});
 assert.equal(await dialog.getByRole('button',{name:'Capturar cor da tela',exact:true}).isDisabled(),true);await dialog.press('Escape');await page.locator('.mdress-color-picker').waitFor({state:'detached'});
 await page.evaluate(()=>{const kind=document.getElementById('bgKind');kind.value='mesh';kind.dispatchEvent(new Event('change',{bubbles:true}));});
 const mesh=page.locator('#meshPointControls input[type=color]').first();await mesh.waitFor({state:'attached'});await mesh.evaluate(el=>el.click());
 dialog=page.getByRole('dialog',{name:/Cores/});const hex=dialog.getByRole('textbox',{name:'Cor hexadecimal',exact:true});await hex.fill('#13579B');await hex.press('Enter');
 assert.equal(await mesh.inputValue(),'#13579b');await hex.fill('#ABC123');await hex.press('Enter');assert.equal(await mesh.inputValue(),'#abc123');
 await dialog.getByRole('button',{name:'Fechar seletor de cores',exact:true}).click();await page.close();
 console.log('Color picker: palette, spectrum pointer/keyboard, RGB, invalid HEX, persistence, saved colors, Escape/focus and overflow passed at 1440/768/390/320.');
}finally{await browser.close();}
