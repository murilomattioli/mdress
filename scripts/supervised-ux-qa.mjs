/**
 * UX-023 — supervised inspector/toolbar review.
 * Usage: pnpm dev (another terminal), then pnpm qa:supervised
 * CI: node scripts/supervised-ux-qa.mjs --auto --headless
 * ENTER=continue; m=manual inspection then ENTER; q=stop.
 * Reports and screenshots stay in ignored test-results/.
 */
import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {summarizeUxCoverage,summarizeScreenshotCoverage,parseHumanReviewChoice,validateHumanReviewEvidence,validateScreenshotViewport,UX_QA_VIEWPORT_HEIGHT} from './ux-qa-coverage.mjs';
import {renderUxQaGallery} from './ux-qa-gallery.mjs';

const args=new Set(process.argv.slice(2));
const automated=args.has('--auto');
if(!automated&&!stdin.isTTY){
 console.error('[UX QA] O modo supervisionado exige um terminal interativo. Use --auto --headless para CI.');
 process.exit(2);
}
const headless=args.has('--headless');
const url=process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173';
const directory='test-results/ux-audit/supervised';
const findings=[],screenshots=[],traces=[],coverage=[];
let stopped=false,humanReview='not-reviewed',humanReviewEvidence=null;
const reviewSessionId=randomUUID();
class ReviewStopped extends Error {constructor(){super('Interrompido pelo revisor');this.name='ReviewStopped';}}
const io=!automated?createInterface({input:stdin,output:stdout}):null;
async function checkpoint(label){
 console.log('[UX QA] '+label);
 if(!io)return;
 while(true){
  const choice=(await io.question('ENTER=continuar | m=inspecionar | q=parar > ')).trim().toLowerCase();
  if(choice==='q'){stopped=true;throw new ReviewStopped();}
  if(choice==='m'){
   console.log('Inspecione e interaja no navegador. Volte aqui quando terminar.');
   const resume=(await io.question('ENTER=retomar | q=parar > ')).trim().toLowerCase();
   if(resume==='q'){stopped=true;throw new ReviewStopped();}
   return;
  }
  return;
 }
}
async function capture(page,theme,width,name){
 const path=directory+'/'+theme+'-'+width+'-'+name+'.png';
 const png=await page.screenshot({path,animations:'disabled'});
 // Evidence must be an actual nonempty PNG, not only a reached checkpoint.
 assert.ok(validateScreenshotViewport(png,width),
  'PNG evidence must match the full '+width+'×'+UX_QA_VIEWPORT_HEIGHT+' viewport: '+path);
 screenshots.push({theme,width,state:name,path});
 // Interactive review pauses once per viewport, not once per PNG.
}
async function assertInspectorFocusHandoff(page,description){
 const focus=await page.evaluate(()=>{
  const active=document.activeElement,rect=active?.getBoundingClientRect();
  const scroll=active?.closest('.inspector-scroll')?.getBoundingClientRect();
  return {
   tag:active?.tagName,inside:Boolean(active?.closest('.design-inspector')),
   interactive:Boolean(active?.matches('button,input,select,textarea,[role="combobox"]')),
   body:active===document.body,disabled:Boolean(active?.disabled),
   visible:Boolean(rect?.width&&rect?.height&&rect.bottom>0&&rect.top<innerHeight&&
    rect.right>0&&rect.left<innerWidth&&(!scroll||rect.bottom>scroll.top&&rect.top<scroll.bottom))
  };
 });
 assert.ok(focus.inside&&focus.interactive&&!focus.body&&!focus.disabled&&focus.visible,
  description+': '+JSON.stringify(focus));
}
function error(phase,theme,width,e){
 findings.push({severity:'error',phase,theme,width,message:e?.stack||String(e)});
 console.error('[UX QA] '+phase+': '+(e?.message||e));
}
async function revealInspector(page,tab){
 const target=page.locator('[data-inspector-tab="'+tab+'"]');
 if(!(await target.isVisible())){
  const toggle=page.locator('#designToggle');
  if(await toggle.isVisible())await toggle.click();
  else {
   const rail=page.locator('#railDesign');
   if(await rail.isVisible())await rail.click();
  }
 }
 await target.waitFor({state:'visible',timeout:8000});
 await target.click();
}
async function exercise(page,theme,width){
 await revealInspector(page,'style');
 const labelReadability=await page.locator('.design-inspector .ds-property-row .ds-prop-name:visible').evaluateAll(labels=>
  labels.map(el=>({fontSize:parseFloat(getComputedStyle(el).fontSize),text:el.textContent,title:el.title})));
 assert.ok(labelReadability.length>0&&labelReadability.every(item=>item.fontSize>=12&&item.title===item.text),
  'Property labels must remain readable and expose untruncated text: '+JSON.stringify(labelReadability));
 const range=page.locator('.ds-property-range').filter({has:page.locator('#fontSize')});
 const precise=range.locator('.ds-prop-number');
 await range.scrollIntoViewIfNeeded();
 await capture(page,theme,width,'range-normal');
 await range.hover();await capture(page,theme,width,'range-hover');
 await precise.focus();
 assert.equal(await precise.evaluate(el=>el===document.activeElement),true);
 await capture(page,theme,width,'range-focus');
 const originalRange=await page.locator('#fontSize').inputValue();
 await precise.fill('9999');await precise.dispatchEvent('change');
 assert.equal(await precise.getAttribute('aria-invalid'),'true');
 assert.equal(await range.locator('..').locator('.ds-prop-error').isVisible(),true);
 assert.equal(await page.locator('#fontSize').inputValue(),originalRange,'Invalid range must not mutate the document');
 await capture(page,theme,width,'range-invalid');
 await precise.press('Escape');
 assert.equal(await precise.getAttribute('aria-invalid'),null);
 assert.equal(await precise.evaluate(el=>el===document.activeElement),true,
  'Cancelling an invalid precision draft must preserve keyboard focus');
 assert.equal(await precise.inputValue(),originalRange,'Escape restores native range value');
 await capture(page,theme,width,'range-escape-focused');
 // Dragging the real slider must override an abandoned invalid numeric draft.
 await precise.fill('9999');
 await page.locator('#fontSize').evaluate(el=>{
  el.value=el.value===el.max?el.min:el.max;
  el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.equal(await precise.inputValue(),await page.locator('#fontSize').inputValue());
 assert.equal(await precise.getAttribute('aria-invalid'),null,'Native slider must clear stale numeric errors');
 await capture(page,theme,width,'range-native-override');
 await page.locator('#fontSize').evaluate((el,value)=>{
  el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
 },originalRange);
 // Valid drafts must commit through the native range (source of truth).
 const nextRange=originalRange==='12.5'?'11.5':'12.5';
 await precise.fill(nextRange);await precise.dispatchEvent('change');
 assert.equal(await page.locator('#fontSize').inputValue(),nextRange);
 await capture(page,theme,width,'range-valid');
 await precise.fill(originalRange);await precise.dispatchEvent('change');
 assert.equal(await page.locator('#fontSize').inputValue(),originalRange);
 await page.locator('#fontSize').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('.ds-property-range .ds-prop-number')?.disabled===true);
 await capture(page,theme,width,'range-disabled');
 await page.locator('#fontSize').evaluate(el=>{el.disabled=false;});
 await precise.focus();
 await page.locator('#fontSize').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#fontSize')?.closest('.ds-property-range')?.querySelector('.ds-prop-number')?.disabled);
 await assertInspectorFocusHandoff(page,'Disabling a focused range precision draft must preserve inspector keyboard focus');
 await capture(page,theme,width,'range-disabled-focus-handoff');
 await page.locator('#fontSize').evaluate(el=>{el.disabled=false;});
 // Inspect live native range constraints in every theme and viewport, using
 // an isolated fixture that never touches persisted document settings.
 await page.evaluate(async()=>{
  const label=document.createElement('label');
  label.className='property-row';label.textContent='QA faixa dinâmica';
  const input=document.createElement('input');
  input.id='qaSupervisedRange';input.type='range';
  input.min='0';input.max='10';input.step='2';input.value='4';
  label.append(input);document.querySelector('#fontSize').closest('label').after(label);
  const {enhancePropertyControls}=await import('/design-system/property-controls.js');
  enhancePropertyControls();
 });
 const liveNative=page.locator('#qaSupervisedRange');
 const liveRow=page.locator('.ds-property-range').filter({has:liveNative});
 const livePrecision=liveRow.locator('.ds-prop-number');
 await liveNative.evaluate(el=>{el.min='2';el.max='14';el.step='3';});
 await page.waitForFunction(()=>document.querySelector('#qaSupervisedRange')?.closest('.ds-property-range')?.querySelector('.ds-prop-number')?.step==='3');
 await livePrecision.fill('8');await livePrecision.dispatchEvent('change');
 assert.equal(await liveNative.inputValue(),'8');
 await liveRow.scrollIntoViewIfNeeded();
 await capture(page,theme,width,'range-live-valid');
 await livePrecision.fill('9');await livePrecision.dispatchEvent('change');
 assert.equal(await livePrecision.getAttribute('aria-invalid'),'true');
 assert.equal(await liveNative.inputValue(),'8');
 await capture(page,theme,width,'range-live-invalid');
 await liveNative.evaluate(el=>{el.step='any';});
 await page.waitForFunction(()=>document.querySelector('#qaSupervisedRange')?.closest('.ds-property-range')?.querySelector('.ds-prop-number')?.step==='any');
 await livePrecision.fill('9.25');await livePrecision.dispatchEvent('change');
 assert.equal(await liveNative.inputValue(),'9.25');
 await capture(page,theme,width,'range-live-any');
 await liveNative.evaluate(el=>{el.disabled=true;});
 assert.equal(await livePrecision.isDisabled(),true);
 await capture(page,theme,width,'range-live-disabled');
 await liveNative.evaluate(el=>el.closest('label').remove());
 const color=page.locator('.ds-property-color').filter({has:page.locator('#accentColor')});
 const hex=color.locator('.ds-color-hex');
 await color.scrollIntoViewIfNeeded();
 await hex.focus();await capture(page,theme,width,'color-focus');
 const colorPickerName=await page.locator('#accentColor').getAttribute('aria-label');
 assert.ok(colorPickerName?.includes('seletor de cor'),
  'The native color swatch needs an accessible name distinct from the hex text field');
 const nativeSwatch=page.locator('#accentColor');
 await nativeSwatch.focus();
 assert.equal(await nativeSwatch.evaluate(el=>el===document.activeElement),true,
  'The native color picker must remain keyboard-focusable');
 await capture(page,theme,width,'color-swatch-focus');
 await hex.focus();
 const originalColor=await nativeSwatch.inputValue();
 await hex.fill('#BAD');await hex.dispatchEvent('change');
 assert.equal(await hex.getAttribute('aria-invalid'),'true');
 assert.equal(await color.locator('..').locator('.ds-prop-error').isVisible(),true);
 assert.equal(await page.locator('#accentColor').inputValue(),originalColor);
 await capture(page,theme,width,'color-invalid');
 // A redraw/sync of the inspector must not erase the draft the user is
 // correcting or clear the aria-live validation message.
 await page.evaluate(async()=>{
  const {syncPropertyControls}=await import('/design-system/property-controls.js');
  syncPropertyControls();
 });
 assert.equal(await hex.inputValue(),'#BAD','Inspector sync must preserve an uncommitted hex draft');
 assert.equal(await hex.getAttribute('aria-invalid'),'true');
 assert.equal(await page.locator('#accentColor').inputValue(),originalColor);
 await capture(page,theme,width,'color-draft-sync');
 await hex.press('Escape');
 assert.equal(await hex.getAttribute('aria-invalid'),null);
 assert.equal(await hex.evaluate(el=>el===document.activeElement),true,
  'Cancelling an invalid hex draft must preserve keyboard focus');
 assert.equal((await hex.inputValue()).toLowerCase(),originalColor.toLowerCase());
 await capture(page,theme,width,'color-escape-focused');
 const nextColor=originalColor.toLowerCase()==='#abcdef'?'#123456':'#abcdef';
 await hex.fill(nextColor);await hex.dispatchEvent('change');
 assert.equal(await page.locator('#accentColor').inputValue(),nextColor);
 await capture(page,theme,width,'color-valid');
 await hex.fill(originalColor);await hex.dispatchEvent('change');
 assert.equal(await page.locator('#accentColor').inputValue(),originalColor);
 await page.locator('#accentColor').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('.ds-property-color .ds-color-hex')?.disabled===true);
 await capture(page,theme,width,'color-disabled');
 await page.locator('#accentColor').evaluate(el=>{el.disabled=false;});
 await hex.focus();
 await page.locator('#accentColor').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#accentColor')?.closest('.ds-property-color')?.querySelector('.ds-color-hex')?.disabled);
 await assertInspectorFocusHandoff(page,'Disabling a focused color hex draft must preserve inspector keyboard focus');
 await capture(page,theme,width,'color-disabled-focus-handoff');
 await page.locator('#accentColor').evaluate(el=>{el.disabled=false;});
 await nativeSwatch.focus();
 await nativeSwatch.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#accentColor')?.disabled===true);
 await assertInspectorFocusHandoff(page,'Disabling a focused native color swatch must preserve inspector keyboard focus');
 await capture(page,theme,width,'color-swatch-disabled-focus-handoff');
 await nativeSwatch.evaluate(el=>{el.disabled=false;});
 const select=page.locator('.ds-property-select').filter({has:page.locator('#fontChoice')});
 const trigger=select.locator('.ds-select-trigger');
 await trigger.scrollIntoViewIfNeeded();await trigger.hover();await capture(page,theme,width,'select-hover');
 await trigger.focus();await trigger.press('ArrowDown');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 const popupBounds=await page.locator('.ds-select-popover').evaluate(el=>{
  const box=el.getBoundingClientRect();
  return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:innerWidth,height:innerHeight};
 });
 assert.ok(popupBounds.left>=7&&popupBounds.right<=popupBounds.width-7&&
  popupBounds.top>=7&&popupBounds.bottom<=popupBounds.height-7,
  'Open combobox must remain inside the viewport: '+JSON.stringify(popupBounds));
 await capture(page,theme,width,'select-open');
 // Truncated selected values need a tooltip and a live accessible
 // description without replacing the stable combobox label.
 const selectedLabel=await page.locator('#fontChoice').evaluate(el=>
  el.selectedOptions[0]?.label||el.selectedOptions[0]?.textContent);
 assert.equal(await trigger.getAttribute('title'),selectedLabel);
 const describedBy=await trigger.getAttribute('aria-describedby');
 assert.equal(await page.locator('#'+describedBy).textContent(),selectedLabel);
 // An optgroup's disabled state must propagate to every enhanced option,
 // including when the native select changes while its popup is open.
 const firstGroup=page.locator('#fontChoice optgroup').first();
 await firstGroup.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelectorAll('.ds-select-popover [data-value]')]
  .filter(item=>['system','arial','verdana','trebuchet','tahoma'].includes(item.dataset.value))
  .every(item=>item.disabled));
 assert.equal(await page.locator('.ds-select-popover [data-value="system"]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>document.activeElement?.matches('.ds-select-popover [role="option"]:not(:disabled)')),true,'Focus must move to an enabled popup option');
 // Collision regression: typeahead must skip a disabled option even when it
 // precedes the first enabled match. Restore labels before visual capture.
 const enabledOptions=page.locator('.ds-select-popover [role="option"]:not([disabled])');
 assert.ok(await enabledOptions.count()>1,'Typeahead regression needs two enabled options');
 const firstEnabled=enabledOptions.first(),lastEnabled=enabledOptions.last();
 const disabledLabel=page.locator('.ds-select-popover [data-value="system"] .ds-option-label');
 const enabledLabel=firstEnabled.locator('.ds-option-label');
 const originalDisabledLabel=await disabledLabel.textContent();
 const originalEnabledLabel=await enabledLabel.textContent();
 await disabledLabel.evaluate(el=>{el.textContent='Z blocked';});
 await enabledLabel.evaluate(el=>{el.textContent='Z eligible';});
 await lastEnabled.focus();
 await page.keyboard.press('z');
 assert.equal(await firstEnabled.evaluate(el=>el===document.activeElement),true,'Typeahead must skip disabled matching options');
 await disabledLabel.evaluate((el,text)=>{el.textContent=text;},originalDisabledLabel);
 await enabledLabel.evaluate((el,text)=>{el.textContent=text;},originalEnabledLabel);
 await capture(page,theme,width,'select-group-disabled');
 await firstGroup.evaluate(el=>{el.disabled=false;});
 await page.waitForFunction(()=>document.querySelector('.ds-select-popover [data-value="system"]')?.disabled===false);
 // Multi-character typeahead should narrow to "Verdana", not jump to the
 // first option starting with the last typed letter.
 await page.locator('.ds-select-popover [data-value="serif"]').focus();
 await page.keyboard.type('ver',{delay:45});
 assert.equal(await page.locator('.ds-select-popover [data-value="verdana"]').evaluate(el=>el===document.activeElement),
  true,'Typing a prefix must focus the matching enabled option');
 await capture(page,theme,width,'select-typeahead-prefix');
 // The native select is the source of truth even while the portalled listbox
 // is open: adding, hiding and removing options must not strand keyboard focus.
 await page.locator('#fontChoice').evaluate(el=>{
  const option=document.createElement('option');
  option.value='qa-temporary';
  option.textContent='ÁrvoreTipográficaExtremamenteLongaSemEspaçosParaTestarOverflowDoCombobox';
  el.querySelector('optgroup').append(option);
 });
 const injected=page.locator('.ds-select-popover [data-value="qa-temporary"]');
 await injected.waitFor({state:'visible'});
 // A long, unbroken label must never widen the portalled listbox beyond
 // the viewport. Ellipsis is allowed only if the full text is discoverable.
 await page.locator('.ds-select-popover [data-value="serif"]').focus();
 await page.keyboard.type('arv',{delay:45});
 assert.equal(await injected.evaluate(el=>el===document.activeElement),true,
  'Typing arv must focus Árvore even without its accent');
 const longOption=await injected.evaluate(el=>{
  const popup=el.closest('.ds-select-popover'),label=el.querySelector('.ds-option-label');
  return {popupOverflow:popup.scrollWidth-popup.clientWidth,
   optionOverflow:el.scrollWidth-el.clientWidth,
   clipped:label.scrollWidth>label.clientWidth,
   title:el.title,label:label.textContent};
 });
 assert.ok(longOption.popupOverflow<=1&&longOption.optionOverflow<=1&&
  longOption.clipped&&longOption.title===longOption.label,
  'Long option must be ellipsized without clipping the popup or hiding its full tooltip: '+JSON.stringify(longOption));
 await capture(page,theme,width,'select-long-option');
 await injected.focus();
 assert.equal(await injected.evaluate(el=>el===document.activeElement),true);
 // A live native value change must update data-value and preserve focus on
 // the same option. Otherwise the portal can commit stale option values.
 await page.locator('#fontChoice option[value="qa-temporary"]').evaluate(el=>{el.value='qa-renamed';});
 const renamed=page.locator('.ds-select-popover [data-value="qa-renamed"]');
 await renamed.waitFor({state:'visible'});
 assert.equal(await renamed.evaluate(el=>el===document.activeElement),true,
  'Renaming the focused option value must preserve keyboard focus');
 assert.equal(await page.locator('.ds-select-popover [data-value="qa-temporary"]').count(),0,
  'The stale popup value must be removed');
 await capture(page,theme,width,'select-live-value');
 await page.locator('#fontChoice option[value="qa-renamed"]').evaluate(el=>{el.value='qa-temporary';});
 await injected.waitFor({state:'visible'});
 const serifOption=page.locator('#fontChoice option[value="serif"]');
 await serifOption.evaluate(el=>{el.hidden=true;});
 await page.waitForFunction(()=>!document.querySelector('.ds-select-popover [data-value="serif"]'));
 await serifOption.evaluate(el=>{el.hidden=false;});
 await page.locator('.ds-select-popover [data-value="serif"]').waitFor({state:'visible'});
 const originalGroupLabel=await firstGroup.getAttribute('label');
 await firstGroup.evaluate(el=>{el.label='QA group';});
 await page.waitForFunction(()=>[...document.querySelectorAll('.ds-select-popover .ds-select-group-label')]
  .some(el=>el.textContent==='QA group'));
 await capture(page,theme,width,'select-live-options');
 await firstGroup.evaluate((el,value)=>{el.label=value;},originalGroupLabel);
 await page.locator('#fontChoice option[value="qa-temporary"]').evaluate(el=>el.remove());
 await page.waitForFunction(()=>!document.querySelector('.ds-select-popover [data-value="qa-temporary"]'));
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>document.activeElement?.matches('.ds-select-popover [role="option"]:not(:disabled)')),true,
  'Removing a focused native option must restore focus inside the refreshed listbox');
 await capture(page,theme,width,'select-live-options-removed');
 // A hidden native optgroup must not leak its options into the portalled UI.
 await firstGroup.evaluate(el=>{el.hidden=true;});
 await page.waitForFunction(()=>!document.querySelector('.ds-select-popover [data-value="system"]'));
 assert.equal(await page.locator('.ds-select-popover [data-value="serif"]').count(),1,
  'Visible groups must remain navigable when another group is hidden');
 await capture(page,theme,width,'select-hidden-optgroup');
 await firstGroup.evaluate(el=>{el.hidden=false;});
 await page.locator('.ds-select-popover [data-value="system"]').waitFor({state:'visible'});
 // Disabling every option while the popup is open must close it and restore
 // keyboard focus to the trigger, never to a detached or disabled button.
 await page.locator('#fontChoice').evaluate(el=>{
  for(const option of el.options)option.disabled=true;
 });
 await page.waitForFunction(()=>document.querySelector('.ds-select-trigger[aria-label="Fonte"]')?.getAttribute('aria-expanded')==='false'
  || document.querySelector('#fontChoice')?.closest('.ds-property-select')?.querySelector('.ds-select-trigger')?.getAttribute('aria-expanded')==='false');
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,
  'Disabling all options must restore focus to the combobox');
 await capture(page,theme,width,'select-all-disabled');
 await page.locator('#fontChoice').evaluate(el=>{
  for(const option of el.options)option.disabled=false;
 });
 await page.waitForFunction(()=>[...document.querySelector('#fontChoice').options].every(o=>!o.disabled));
 await trigger.press('ArrowDown');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 // Browser resizing closes the portalled listbox; keyboard focus must land
 // on its trigger rather than silently falling back to document.body.
 await page.setViewportSize({width:width-1,height:900});
 // Chromium may deliver resize on the next rendering task after setViewportSize.
 await page.waitForFunction(()=>document.querySelector('#fontChoice')?.closest('.ds-property-select')
  ?.querySelector('.ds-select-trigger')?.getAttribute('aria-expanded')==='false');
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,
  'Resize must restore focus from detached popup option to combobox trigger');
 await page.setViewportSize({width,height:900});
 await capture(page,theme,width,'select-resize-focus');
 // Scrolling an inspector control out of view must dismiss its portalled
 // listbox without dropping focus onto document.body (keyboard trap).
 await trigger.scrollIntoViewIfNeeded();
 await trigger.focus();await trigger.press('ArrowDown');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 const inspectorScroll=page.locator('.inspector-scroll');
 await inspectorScroll.evaluate(el=>el.dispatchEvent(new Event('scroll')));
 assert.equal(await trigger.getAttribute('aria-expanded'),'true',
  'Scrolling while the trigger remains visible must preserve the popup');
 // On tall desktop viewports, the middle-of-panel font picker can stay
 // visible even at maximum scroll. Constrain the scroll container temporarily
 // to reproduce a genuinely clipped inspector (small-window regression).
 const scrolled=await inspectorScroll.evaluate(el=>{
  const original={height:el.style.height,maxHeight:el.style.maxHeight,flex:el.style.flex};
  el.style.height='180px';el.style.maxHeight='180px';el.style.flex='0 0 180px';
  el.scrollTop=el.scrollHeight;
  const anchor=el.querySelector('#fontChoice')?.closest('.ds-property-select')?.querySelector('.ds-select-trigger');
  const rect=anchor.getBoundingClientRect(),viewport=el.getBoundingClientRect();
  const offscreen=rect.bottom<=viewport.top||rect.top>=viewport.bottom;
  el.dispatchEvent(new Event('scroll'));
  return {original,offset:el.scrollTop,offscreen};
 });
 assert.ok(scrolled.offset>0&&scrolled.offscreen,
  'QA setup must actually scroll the select outside the inspector viewport: '+JSON.stringify(scrolled));
 await page.waitForFunction(()=>document.querySelector('#fontChoice')?.closest('.ds-property-select')
  ?.querySelector('.ds-select-trigger')?.getAttribute('aria-expanded')==='false',null,{timeout:5000});
 const scrollFocus=await page.evaluate(()=>{
  const el=document.activeElement,rect=el.getBoundingClientRect();
  return {inInspector:Boolean(el.closest('.design-inspector')),isBody:el===document.body,
   disabled:Boolean(el.disabled),visible:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth};
 });
 assert.ok(scrollFocus.inInspector&&!scrollFocus.isBody&&!scrollFocus.disabled&&scrollFocus.visible,
  'Scrolling a portalled option away must hand focus to a visible inspector control: '+JSON.stringify(scrollFocus));
 await inspectorScroll.evaluate((el,original)=>{
  el.style.height=original.height;el.style.maxHeight=original.maxHeight;el.style.flex=original.flex;
 },scrolled.original);
 await capture(page,theme,width,'select-scroll-focus-handoff');
 await trigger.scrollIntoViewIfNeeded();
 await trigger.focus();await trigger.press('ArrowDown');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');
 // A portalled listbox must preserve normal document tab order when closed.
 // Test both directions: the next/previous inspector control must receive
 // focus, rather than body or the detached listbox option.
 for(const key of ['Tab','Shift+Tab']){
  await trigger.focus();
  await trigger.press('ArrowDown');
  assert.equal(await trigger.getAttribute('aria-expanded'),'true');
  await page.keyboard.press(key);
  assert.equal(await trigger.getAttribute('aria-expanded'),'false','Tab must close the listbox');
  const focusState=await page.evaluate(()=>({
   inInspector:Boolean(document.activeElement?.closest('.design-inspector')),
   isTrigger:document.activeElement?.classList.contains('ds-select-trigger'),
   isBody:document.activeElement===document.body
  }));
  assert.ok(focusState.inInspector&&!focusState.isTrigger&&!focusState.isBody,
   key+' from portalled listbox must follow inspector tab order: '+JSON.stringify(focusState));
  await capture(page,theme,width,key==='Tab'?'select-tab-forward':'select-tab-backward');
 }
 await trigger.focus();await trigger.press('ArrowDown');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 await page.locator('#fontChoice').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#fontChoice')?.closest('.ds-property-select')?.querySelector('.ds-select-trigger')?.disabled);
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 const disabledFocus=await page.evaluate(()=>({
  inInspector:Boolean(document.activeElement?.closest('.design-inspector')),
  isBody:document.activeElement===document.body,
  disabled:Boolean(document.activeElement?.disabled)
 }));
 assert.ok(disabledFocus.inInspector&&!disabledFocus.isBody&&!disabledFocus.disabled,
  'Disabling an open select must hand focus to an enabled inspector control: '+JSON.stringify(disabledFocus));
 await capture(page,theme,width,'select-disabled-focus-handoff');
 await capture(page,theme,width,'select-disabled');
 // A closed combobox can own focus too. Disabling it must not strand
 // keyboard users on document.body.
 await page.locator('#fontChoice').evaluate(el=>{el.disabled=false;});
 await page.waitForFunction(()=>!document.querySelector('#fontChoice')?.closest('.ds-property-select')?.querySelector('.ds-select-trigger')?.disabled);
 await trigger.focus();
 assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
 await page.locator('#fontChoice').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#fontChoice')?.closest('.ds-property-select')?.querySelector('.ds-select-trigger')?.disabled);
 const closedDisabledFocus=await page.evaluate(()=>{
  const el=document.activeElement,rect=el.getBoundingClientRect();
  const scroller=el.closest('.inspector-scroll'),bounds=scroller?.getBoundingClientRect();
  return {inInspector:Boolean(el.closest('.design-inspector')),isBody:el===document.body,
   disabled:Boolean(el.disabled),visible:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth&&
    (!bounds||rect.bottom>bounds.top&&rect.top<bounds.bottom)};
 });
 assert.ok(closedDisabledFocus.inInspector&&!closedDisabledFocus.isBody&&
  !closedDisabledFocus.disabled&&closedDisabledFocus.visible,
  'Disabling a focused closed combobox must hand focus to a visible enabled inspector control: '+JSON.stringify(closedDisabledFocus));
 await capture(page,theme,width,'select-disabled-trigger-focus-handoff');
 await page.locator('#fontChoice').evaluate(el=>{el.disabled=false;});
 await revealInspector(page,'page');
 const number=page.locator('.ds-property-number').filter({has:page.locator('#marginMm')});
 const input=page.locator('#marginMm');
 await input.scrollIntoViewIfNeeded();
 await input.focus();await capture(page,theme,width,'number-focus');
 const originalNumber=await input.inputValue();
 await input.fill('9999');await input.dispatchEvent('change');
 assert.equal(await input.getAttribute('aria-invalid'),'true');
 assert.equal(await number.locator('..').locator('.ds-prop-error').isVisible(),true);
 const numberGeometry=await input.evaluate(el=>({
  inputWidth:el.getBoundingClientRect().width,
  rowWidth:el.closest('.ds-property-number')?.getBoundingClientRect().width,
  actionsWidth:el.closest('.ds-number-actions')?.getBoundingClientRect().width
 }));
 assert.ok(numberGeometry.inputWidth>=52,'Numeric drafts need a readable multi-digit field: '+JSON.stringify(numberGeometry));
 await capture(page,theme,width,'number-invalid');
 await input.press('Escape');
 assert.equal(await input.inputValue(),originalNumber);
 assert.equal(await input.getAttribute('aria-invalid'),null);
 const nextNumber=originalNumber==='18'?'19':'18';
 await input.fill(nextNumber);await input.dispatchEvent('change');
 assert.equal(await input.inputValue(),nextNumber);
 await capture(page,theme,width,'number-valid');
 await input.fill(originalNumber);await input.dispatchEvent('change');
 assert.equal(await input.inputValue(),originalNumber);
 assert.match(await input.getAttribute('aria-label'),/margens/i,'Numeric control must preserve its existing accessible name');
 await input.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#marginMm')?.closest('.ds-property-number')?.querySelectorAll('.ds-number-step')||[]].every(b=>b.disabled));
 await capture(page,theme,width,'number-disabled');
 await input.evaluate(el=>{el.disabled=false;});
 await input.focus();
 await input.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#marginMm')?.closest('.ds-property-number')?.querySelectorAll('.ds-number-step')||[]].every(b=>b.disabled));
 await assertInspectorFocusHandoff(page,'Disabling a focused native number must preserve inspector keyboard focus');
 await capture(page,theme,width,'number-disabled-focus-handoff');
 await input.evaluate(el=>{el.disabled=false;});
 const increment=number.locator('.ds-number-step').last();
 await increment.focus();
 assert.equal(await increment.evaluate(el=>el===document.activeElement),true,'Number stepper must be keyboard focusable');
 await input.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#marginMm')?.closest('.ds-property-number')?.querySelectorAll('.ds-number-step')||[]].every(b=>b.disabled));
 await assertInspectorFocusHandoff(page,'Disabling a focused number stepper must preserve inspector keyboard focus');
 await capture(page,theme,width,'number-stepper-disabled-focus-handoff');
 await input.evaluate(el=>{el.disabled=false;});
 const binary=page.locator('.ds-property-binary').filter({has:page.locator('#showPageGuides')});
 const native=page.locator('#showPageGuides');
 await binary.scrollIntoViewIfNeeded();
 await binary.locator('.ds-binary-option').first().focus();
 await native.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#showPageGuides')?.closest('.ds-property-binary')?.querySelectorAll('button')||[]].every(b=>b.disabled));
 const binaryFocus=await page.evaluate(()=>{
  const el=document.activeElement,rect=el.getBoundingClientRect();
  const scroller=el.closest('.inspector-scroll'),bounds=scroller?.getBoundingClientRect();
  return {
   inInspector:Boolean(el.closest('.design-inspector')),isBody:el===document.body,
   disabled:Boolean(el.disabled),
   visible:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth&&
    (!bounds||rect.bottom>bounds.top&&rect.top<bounds.bottom)
  };
 });
 assert.ok(binaryFocus.inInspector&&!binaryFocus.isBody&&!binaryFocus.disabled&&binaryFocus.visible,
  'Disabling a focused binary button must hand focus to an enabled inspector control: '+JSON.stringify(binaryFocus));
 await capture(page,theme,width,'binary-disabled-focus-handoff');
 const binaryOpacity=await binary.locator('.ds-binary-option').first().evaluate(el=>Number(getComputedStyle(el).opacity));
 assert.ok(binaryOpacity>=0.7,'Disabled binary label must remain readable: '+binaryOpacity);
 await capture(page,theme,width,'binary-disabled');
 await native.evaluate(el=>{el.disabled=false;});
 const originalBinary=await native.isChecked();
 await binary.locator('.ds-binary-option').nth(originalBinary?0:1).click();
 assert.equal(await native.isChecked(),!originalBinary,'Binary buttons must update native checkbox');
 await capture(page,theme,width,'binary-toggled');
 await binary.locator('.ds-binary-option').nth(originalBinary?1:0).click();
 assert.equal(await native.isChecked(),originalBinary);
 // Keyboard users must be able to switch the two-state control without
 // relying on a pointer, and the focused button must match the new value.
 const offButton=binary.locator('.ds-binary-option').first();
 const onButton=binary.locator('.ds-binary-option').last();
 await offButton.focus();await page.keyboard.press('ArrowRight');
 assert.equal(await native.isChecked(),true,'Binary ArrowRight must enable the native checkbox');
 assert.equal(await onButton.evaluate(el=>el===document.activeElement),true);
 assert.equal(await onButton.getAttribute('aria-pressed'),'true');
 await capture(page,theme,width,'binary-keyboard-on');
 await page.keyboard.press('ArrowLeft');
 assert.equal(await native.isChecked(),false,'Binary ArrowLeft must disable the native checkbox');
 assert.equal(await offButton.evaluate(el=>el===document.activeElement),true);
 assert.equal(await offButton.getAttribute('aria-pressed'),'true');
 await capture(page,theme,width,'binary-keyboard-off');
 if(originalBinary)await onButton.click();
 assert.equal(await native.isChecked(),originalBinary);
 // Segmented selects must skip disabled options and preserve focus when
 // an active option becomes unavailable while the inspector remains open.
 const segment=page.locator('.ds-property-segment').filter({has:page.locator('#sectionRule')});
 await segment.scrollIntoViewIfNeeded();
 const nativeSegment=page.locator('#sectionRule');
 const originalSegment=await nativeSegment.inputValue();
 await nativeSegment.selectOption('line');
 const line=segment.locator('[data-value="line"]');
 const none=segment.locator('[data-value="none"]');
 const block=segment.locator('[data-value="block"]');
 await nativeSegment.locator('option[value="none"]').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#sectionRule')?.closest('.ds-property-segment')?.querySelector('[data-value="none"]')?.disabled===true);
 await line.focus();await page.keyboard.press('ArrowRight');
 assert.equal(await nativeSegment.inputValue(),'block','ArrowRight must skip a disabled segment');
 assert.equal(await block.evaluate(el=>el===document.activeElement),true);
 await nativeSegment.locator('option[value="block"]').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.activeElement?.matches('.ds-property-segment [data-value="line"]'));
 assert.equal(await none.isDisabled(),true);
 assert.equal(await block.isDisabled(),true);
 const segmentOpacity=await none.evaluate(el=>Number(getComputedStyle(el).opacity));
 assert.ok(segmentOpacity>=0.7,'Disabled segment label must remain readable: '+segmentOpacity);
 await capture(page,theme,width,'segment-disabled-focus');
 await nativeSegment.locator('option').evaluateAll(options=>options.forEach(option=>{option.disabled=false;}));
 await line.focus();
 await capture(page,theme,width,'segment-keyboard-focus');
 await page.keyboard.press('End');
 assert.equal(await nativeSegment.inputValue(),'block','End must select the last enabled segment');
 assert.equal(await block.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Home');
 assert.equal(await nativeSegment.inputValue(),'line','Home must select the first enabled segment');
 assert.equal(await line.evaluate(el=>el===document.activeElement),true);
 // Native option mutations must update segmented buttons without
 // rebuilding the inspector or losing focus on a detached button.
 const blockOption=nativeSegment.locator('option[value="block"]');
 const originalBlockText=await blockOption.textContent();
 await blockOption.evaluate(el=>{el.textContent='Bloco personalizado';});
 await page.waitForFunction(()=>document.querySelector('#sectionRule')?.closest('.ds-property-segment')
  ?.querySelector('[data-value="block"]')?.textContent==='Bloco personalizado');
 assert.equal(await block.getAttribute('title'),'Bloco personalizado');
 await nativeSegment.evaluate(el=>{
  const option=document.createElement('option');
  option.value='qa-temporary';option.textContent='Temporário QA';
  el.append(option);
 });
 const temporary=segment.locator('[data-value="qa-temporary"]');
 await temporary.waitFor({state:'visible'});
 assert.equal(await temporary.getAttribute('title'),'Temporário QA');
 await capture(page,theme,width,'segment-live-options');
 await nativeSegment.locator('option[value="none"]').evaluate(el=>{el.hidden=true;});
 await page.waitForFunction(()=>!document.querySelector('#sectionRule')?.closest('.ds-property-segment')
  ?.querySelector('[data-value="none"]'));
 await temporary.focus();
 assert.equal(await temporary.evaluate(el=>el===document.activeElement),true);
 await nativeSegment.locator('option[value="qa-temporary"]').evaluate(el=>el.remove());
 await page.waitForFunction(()=>!document.querySelector('#sectionRule')?.closest('.ds-property-segment')
  ?.querySelector('[data-value="qa-temporary"]'));
 const segmentFocus=await page.evaluate(()=>{
  const active=document.activeElement;
  return {inside:Boolean(active?.closest('.ds-segment-buttons')),enabled:!active?.disabled,
   attached:document.contains(active),isBody:active===document.body};
 });
 assert.ok(segmentFocus.inside&&segmentFocus.enabled&&segmentFocus.attached&&!segmentFocus.isBody,
  'Removing a focused segment must transfer focus to an existing enabled option: '+JSON.stringify(segmentFocus));
 await capture(page,theme,width,'segment-live-focus-handoff');
 await nativeSegment.locator('option[value="none"]').evaluate(el=>{el.hidden=false;});
 await blockOption.evaluate((el,text)=>{el.textContent=text;},originalBlockText);
 await page.waitForFunction(()=>document.querySelector('#sectionRule')?.closest('.ds-property-segment')
  ?.querySelectorAll('.ds-segment-option').length===3);
 await nativeSegment.selectOption(originalSegment);
 await line.focus();
 await nativeSegment.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#sectionRule')?.closest('.ds-property-segment')
  ?.querySelectorAll('.ds-segment-option')||[]].every(button=>button.disabled));
 const segmentDisabledFocus=await page.evaluate(()=>{
  const active=document.activeElement,rect=active.getBoundingClientRect();
  const scroller=active.closest('.inspector-scroll'),bounds=scroller?.getBoundingClientRect();
  return {inInspector:Boolean(active.closest('.design-inspector')),
   inDisabledGroup:Boolean(active.closest('.ds-segment-buttons')),disabled:Boolean(active.disabled),
   isBody:active===document.body,visible:rect.bottom>0&&rect.top<innerHeight&&
    (!bounds||rect.bottom>bounds.top&&rect.top<bounds.bottom)};
 });
 assert.ok(segmentDisabledFocus.inInspector&&!segmentDisabledFocus.inDisabledGroup&&
  !segmentDisabledFocus.disabled&&!segmentDisabledFocus.isBody&&segmentDisabledFocus.visible,
  'Disabling a focused segmented select must hand focus to a visible enabled inspector control: '+JSON.stringify(segmentDisabledFocus));
 await capture(page,theme,width,'segment-disabled-focus-handoff');
 await nativeSegment.evaluate(el=>{el.disabled=false;});
 const boxes=await page.locator('.design-inspector .ds-property-row').evaluateAll(rows=>rows.filter(el=>{
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return r.width>0&&s.display!=='none'&&el.scrollWidth>el.clientWidth+3;
 }).map(el=>({text:el.textContent.trim().slice(0,60),overflow:el.scrollWidth-el.clientWidth})));
 assert.deepEqual(boxes,[],'Inspector property rows must not overflow');
}
async function toolbarAudit(page,theme,width){
 const toolbar=page.locator('.markdown-toolbar');
 await toolbar.waitFor({state:'visible'});
 const rows=await toolbar.locator('.tool-group').evaluateAll(groups=>groups.map(el=>Math.round(el.getBoundingClientRect().top)));
 assert.ok(rows.length>1,'Expected multiple toolbar groups');
 assert.ok(rows.every(y=>y===rows[0]),'Toolbar must not wrap to a second row');
 const hasOverflow=await toolbar.evaluate(el=>el.scrollWidth>el.clientWidth+2);
 if(hasOverflow){
  const next=page.getByRole('button',{name:'Rolar ferramentas para a direita'});
  await next.waitFor({state:'visible'});
  assert.equal(await next.isDisabled(),false);
 }
 await capture(page,theme,width,'toolbar');
 const focus=toolbar.locator('button:not([disabled]),select:not([disabled])').first();
 await focus.focus();
 const outline=await focus.evaluate(el=>getComputedStyle(el).outlineStyle);
 if(outline==='none')findings.push({severity:'warning',phase:'toolbar-focus',theme,width,message:'First toolbar control has no own outline; inspect focus-within feedback'});
 await capture(page,theme,width,'toolbar-focus');
 // The first toolbar action is always visible. Exercise keyboard reachability
 // of the last action even when the toolbar is horizontally scrollable.
 const last=toolbar.locator('button:visible:not([disabled]),select:visible:not([disabled])').last();
 await toolbar.evaluate(el=>{el.scrollLeft=0;});
 await last.focus();
 await page.waitForFunction(()=>{
  const bar=document.querySelector('.markdown-toolbar'),active=document.activeElement;
  if(!bar?.contains(active))return false;
  const item=active.getBoundingClientRect(),viewport=bar.getBoundingClientRect();
  return item.left>=viewport.left-2&&item.right<=viewport.right+2;
 },null,{timeout:4000});
 assert.equal(await last.evaluate(el=>el===document.activeElement),true,
  'Focusing the last toolbar action must preserve keyboard focus');
 await capture(page,theme,width,'toolbar-last-focus');
}
await mkdir(directory,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless,slowMo:automated?0:120,args:['--no-sandbox']});
 for(const theme of ['graphite','studio']){
  for(const width of [1440,1024,768]){
   if(stopped)break;
   const context=await browser.newContext({viewport:{width,height:UX_QA_VIEWPORT_HEIGHT}});
   const page=await context.newPage();
   await context.tracing.start({screenshots:true,snapshots:true,sources:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let toolbarPassed=false,inspectorPassed=false,scenarioPassed=false;
   try{
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('#source').waitFor();
    // The initial "Documento criado" toast obscures inspector controls in QA screenshots.
    // Wait for its normal dismissal; do not suppress subsequent error feedback.
    await page.locator('#toast.show').waitFor({state:'hidden',timeout:6500});
    await page.locator('body').evaluate((el,value)=>el.dataset.theme=value,theme);
    await capture(page,theme,width,'workspace');
    try{await toolbarAudit(page,theme,width);toolbarPassed=true;}catch(e){if(e instanceof ReviewStopped)throw e;error('toolbar',theme,width,e);}
    try{await exercise(page,theme,width);inspectorPassed=true;}catch(e){if(e instanceof ReviewStopped)throw e;error('inspector',theme,width,e);}
    // Keep the headed browser available for inspection between viewports.
    // Six checkpoints replace 282 interruptions while preserving m/q/ENTER.
    await checkpoint(theme+'/'+width+' — capturas concluídas; m=inspecionar, ENTER=próxima largura');
    for(const message of errors)findings.push({severity:'error',phase:'runtime',theme,width,message});
    scenarioPassed=toolbarPassed&&inspectorPassed&&errors.length===0;
   }catch(e){if(e instanceof ReviewStopped)stopped=true;else error('scenario',theme,width,e);}
   finally{
    // Keep traces only for failures/interrupted reviews to avoid bloating CI artifacts.
    try{
     if(!scenarioPassed){
      const path=directory+'/'+theme+'-'+width+'-trace.zip';
      await context.tracing.stop({path});traces.push({theme,width,path});
     }else await context.tracing.stop();
    }catch(e){error('trace',theme,width,e);}
    coverage.push({theme,width,scenario:scenarioPassed,inspector:inspectorPassed,toolbar:toolbarPassed,errors:errors.length});
    await context.close();
   }
   if(stopped)break;
  }
  if(stopped)break;
 }
}catch(e){if(!stopped)error('browser','global',0,e);}
finally{
 await browser?.close();
 // Incomplete visual evidence must block the reviewer approval prompt.
 const screenshotCoverage=summarizeScreenshotCoverage(screenshots);
 const missingFiles=[];
 for(const entry of screenshots){
  try{
   // Validate bytes again after capture: files may be truncated, replaced
   // or corrupted before the final report and human review are generated.
   const png=await readFile(entry.path);
   if(!validateScreenshotViewport(png,entry.width))missingFiles.push(entry.path);
  }catch{missingFiles.push(entry.path);}
 }
 if(missingFiles.length)findings.push({severity:'error',phase:'screenshot-files',theme:'all',width:0,
  message:'Missing, corrupt or wrong-size PNG evidence: '+missingFiles.join(', ')});
 if(!stopped&&(screenshotCoverage.missing.length||screenshotCoverage.duplicates.length||
  screenshotCoverage.unexpected.length||screenshotCoverage.invalidPaths.length)){
  findings.push({severity:'error',phase:'screenshot-coverage',theme:'all',width:0,
   message:'Missing: '+screenshotCoverage.missing.join(', ')+
    '; duplicates: '+screenshotCoverage.duplicates.join(', ')+
    '; unexpected: '+screenshotCoverage.unexpected.join(', ')+
    '; invalid paths: '+screenshotCoverage.invalidPaths.join(', ')});
 }
 // Build a local, offline comparison gallery before asking for a human
 // verdict. Six side-by-side screenshots per state are easier to inspect
 // than hundreds of unrelated filenames in an artifact ZIP.
 let galleryPath=null;
 try{
  const path=directory+'/index.html';
  await writeFile(path,renderUxQaGallery(screenshots,screenshotCoverage,reviewSessionId));
  galleryPath=path;
  console.log('[UX QA] Galeria visual offline: '+path);
 }catch(e){error('gallery','global',0,e);}
 // A successful functional matrix never implies that someone inspected the
 // screenshots. Record an explicit verdict only in an interactive session.
 if(io&&!stopped&&summarizeUxCoverage(coverage,findings,stopped).status==='passed'){
  try{
   const choice=await io.question('Revisão visual humana: a=aprovar | r=reprovar | ENTER=pendente | q=parar > ');
   if(choice.trim().toLowerCase()==='q')stopped=true;
   else {
    humanReview=parseHumanReviewChoice(choice);
    if(humanReview==='approved'){
     const reviewPath=(await io.question('Caminho completo do JSON exportado pela galeria > ')).trim().replace(/^["']|["']$/g,'');
     try{
      const review=JSON.parse(await readFile(reviewPath,'utf8'));
      const validation=validateHumanReviewEvidence(review,reviewSessionId);
      humanReviewEvidence={file:reviewPath,...validation};
      if(!validation.valid){
       humanReview='not-reviewed';
       console.error('[UX QA] Aprovação recusada: sessão incorreta ou estados pendentes/reprovados. '+JSON.stringify(validation));
      }
     }catch(e){
      humanReview='not-reviewed';
      humanReviewEvidence={file:reviewPath,valid:false,error:e.message};
      console.error('[UX QA] Não foi possível validar a revisão exportada: '+e.message);
     }
    }
   }
  }catch(e){error('human-review','global',0,e);}
 }
 io?.close();
 const summary=summarizeUxCoverage(coverage,findings,stopped);
 const report={schema:5,reviewSessionId,generatedAt:new Date().toISOString(),url,mode:automated?'automatic':'supervised',headless,stopped,summary,screenshotCoverage,
  humanReview:{status:automated?'not-applicable':humanReview,requiresExplicitApproval:true,evidence:humanReviewEvidence},
  gallery:galleryPath,coverage,screenshots,traces,findings};
 await writeFile('test-results/supervised-ux-qa.json',JSON.stringify(report,null,2)+'\n');
 console.log('[UX QA] report: test-results/supervised-ux-qa.json | status: '+summary.status+' | human review: '+report.humanReview.status+' | scenarios: '+summary.passing+'/'+summary.expected+' | screenshots: '+screenshots.length+' | findings: '+findings.length);
 if(summary.status!=='passed'||humanReview==='rejected')process.exitCode=1;
}
