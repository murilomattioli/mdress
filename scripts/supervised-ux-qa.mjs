/**
 * UX-023 — supervised inspector/toolbar review.
 * Usage: pnpm dev (another terminal), then pnpm qa:supervised
 * CI: node scripts/supervised-ux-qa.mjs --auto --headless
 * ENTER=continue; m=manual inspection then ENTER; q=stop.
 * Reports and screenshots stay in ignored test-results/.
 */
import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {summarizeUxCoverage,parseHumanReviewChoice} from './ux-qa-coverage.mjs';

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
let stopped=false,humanReview='not-reviewed';
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
 await page.screenshot({path,animations:'disabled'});
 screenshots.push({theme,width,state:name,path});
 await checkpoint(theme+'/'+width+'/'+name);
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
 const color=page.locator('.ds-property-color').filter({has:page.locator('#accentColor')});
 const hex=color.locator('.ds-color-hex');
 await color.scrollIntoViewIfNeeded();
 await hex.focus();await capture(page,theme,width,'color-focus');
 const originalColor=await page.locator('#accentColor').inputValue();
 await hex.fill('#BAD');await hex.dispatchEvent('change');
 assert.equal(await hex.getAttribute('aria-invalid'),'true');
 assert.equal(await color.locator('..').locator('.ds-prop-error').isVisible(),true);
 assert.equal(await page.locator('#accentColor').inputValue(),originalColor);
 await capture(page,theme,width,'color-invalid');
 await hex.press('Escape');
 assert.equal(await hex.getAttribute('aria-invalid'),null);
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
  option.value='qa-temporary';option.textContent='QA temporary';
  el.querySelector('optgroup').append(option);
 });
 const injected=page.locator('.ds-select-popover [data-value="qa-temporary"]');
 await injected.waitFor({state:'visible'});
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
 const scrolled=await inspectorScroll.evaluate(el=>{
  el.scrollTop=el.scrollHeight;
  el.dispatchEvent(new Event('scroll'));
  return el.scrollTop;
 });
 assert.ok(scrolled>0,'Inspector must be scrollable for the focus-handoff regression');
 await page.waitForFunction(()=>document.querySelector('#fontChoice')?.closest('.ds-property-select')
  ?.querySelector('.ds-select-trigger')?.getAttribute('aria-expanded')==='false');
 const scrollFocus=await page.evaluate(()=>{
  const el=document.activeElement,rect=el.getBoundingClientRect();
  return {inInspector:Boolean(el.closest('.design-inspector')),isBody:el===document.body,
   disabled:Boolean(el.disabled),visible:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth};
 });
 assert.ok(scrollFocus.inInspector&&!scrollFocus.isBody&&!scrollFocus.disabled&&scrollFocus.visible,
  'Scrolling a portalled option away must hand focus to a visible inspector control: '+JSON.stringify(scrollFocus));
 await trigger.scrollIntoViewIfNeeded();
 await capture(page,theme,width,'select-scroll-focus-handoff');
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
 const binary=page.locator('.ds-property-binary').filter({has:page.locator('#showPageGuides')});
 const native=page.locator('#showPageGuides');
 await native.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#showPageGuides')?.closest('.ds-property-binary')?.querySelectorAll('button')||[]].every(b=>b.disabled));
 const binaryOpacity=await binary.locator('.ds-binary-option').first().evaluate(el=>Number(getComputedStyle(el).opacity));
 assert.ok(binaryOpacity>=0.7,'Disabled binary label must remain readable: '+binaryOpacity);
 await binary.scrollIntoViewIfNeeded();
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
 await nativeSegment.selectOption(originalSegment);
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
}
await mkdir(directory,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless,slowMo:automated?0:120,args:['--no-sandbox']});
 for(const theme of ['graphite','studio']){
  for(const width of [1440,1024,768]){
   if(stopped)break;
   const context=await browser.newContext({viewport:{width,height:900}});
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
 // A successful functional matrix never implies that someone inspected the
 // screenshots. Record an explicit verdict only in an interactive session.
 if(io&&!stopped&&summarizeUxCoverage(coverage,findings,stopped).status==='passed'){
  try{
   const choice=await io.question('Revisão visual humana: a=aprovar | r=reprovar | ENTER=pendente | q=parar > ');
   if(choice.trim().toLowerCase()==='q')stopped=true;
   else humanReview=parseHumanReviewChoice(choice);
  }catch(e){error('human-review','global',0,e);}
 }
 io?.close();
 const summary=summarizeUxCoverage(coverage,findings,stopped);
 const report={schema:3,generatedAt:new Date().toISOString(),url,mode:automated?'automatic':'supervised',headless,stopped,summary,
  humanReview:{status:automated?'not-applicable':humanReview,requiresExplicitApproval:true},
  coverage,screenshots,traces,findings};
 await writeFile('test-results/supervised-ux-qa.json',JSON.stringify(report,null,2)+'\n');
 console.log('[UX QA] report: test-results/supervised-ux-qa.json | status: '+summary.status+' | human review: '+report.humanReview.status+' | scenarios: '+summary.passing+'/'+summary.expected+' | screenshots: '+screenshots.length+' | findings: '+findings.length);
 if(summary.status!=='passed'||humanReview==='rejected')process.exitCode=1;
}
