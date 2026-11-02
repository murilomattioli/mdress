import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('test-results/color-picker',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:420},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.evaluate(async()=>{
  if(document.getElementById('themesView').classList.contains('hidden'))
   document.getElementById('designToggle').click();
  const {revealInspectorControl}=await import('/property-inspector.js');
  revealInspectorControl('accentColor');
 });
 const source=page.locator('#accentColor');
 await source.click();
 const dialog=page.locator('dialog.mdress-color-picker');
 await dialog.waitFor({state:'visible'});
 const hex=dialog.locator('.cp-hex');
 await hex.focus();
 const before=await source.inputValue();
 await hex.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'あ'})));
 // Native Escape/Tab/Shift+Tab have browser defaults; synthetic keydown
 // alone would not detect a dialog dismissal or a lost keyboard focus.
 for(const key of ['Escape','Tab','Shift+Tab','ArrowLeft','Enter']){
  await page.keyboard.press(key);
  assert.equal(await dialog.isVisible(),true,'IME must keep the picker open: '+key);
  assert.equal(await hex.evaluate(el=>document.activeElement===el),true,
   'IME must retain the editing field focus: '+key);
  assert.equal(await source.inputValue(),before,'IME must not commit a color: '+key);
 }
 await page.screenshot({path:'test-results/color-picker/ime-hex-native-390.png',animations:'disabled'});
 await hex.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'あ'})));
 await hex.fill('#123456');await hex.press('Enter');
 assert.equal(await source.inputValue(),'#123456','Editing resumes after compositionend');
 const grade=dialog.getByRole('tab',{name:'Grade',exact:true});
 await grade.focus();
 await grade.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'あ'})));
 await page.keyboard.press('ArrowRight');
 await page.keyboard.press('Enter');
 assert.equal(await grade.getAttribute('aria-selected'),'true',
  'IME arrows and Enter must not switch picker tabs');
 assert.equal(await grade.evaluate(el=>document.activeElement===el),true,
  'IME keeps focus on its current tab');
 await grade.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'あ'})));
 await page.keyboard.press('ArrowRight');
 assert.equal(await dialog.getByRole('tab',{name:'Espectro',exact:true}).getAttribute('aria-selected'),'true',
  'Tab keyboard navigation resumes after compositionend');
 await dialog.getByRole('button',{name:'Fechar seletor de cores'}).click();
 await dialog.waitFor({state:'detached'});

 // The visual viewport can be smaller and offset while layout viewport
 // stays 390x420, as with a virtual keyboard or pinch zoom.
 await page.evaluate(async()=>{
  window.__ux23OriginalPickerViewport=Object.getOwnPropertyDescriptor(window,'visualViewport');
  const fake=new EventTarget();
  Object.assign(fake,{offsetLeft:20,offsetTop:30,width:320,height:260});
  Object.defineProperty(window,'visualViewport',{configurable:true,value:fake});
  window.__ux23PickerViewport=fake;
  const {openColorPicker}=await import('/design-system/color-picker.js');
  openColorPicker(document.getElementById('accentColor'));
 });
 await dialog.waitFor({state:'visible'});
 const within=()=>page.waitForFunction(()=>{
  const picker=document.querySelector('dialog.mdress-color-picker');
  const r=picker?.getBoundingClientRect(),v=window.visualViewport;
  return r&&picker.open&&r.width>0&&r.height>0&&
   r.left>=v.offsetLeft+11&&r.right<=v.offsetLeft+v.width-11&&
   r.top>=v.offsetTop+11&&r.bottom<=v.offsetTop+v.height-11;
 });
 await within();
 await page.screenshot({path:'test-results/color-picker/visual-viewport-390.png',animations:'disabled'});
 await page.evaluate(()=>{
  const v=window.__ux23PickerViewport;
  Object.assign(v,{offsetLeft:60,offsetTop:70,width:240,height:150});
  v.dispatchEvent(new Event('scroll'));
 });
 await within();
 assert.equal(await dialog.evaluate(el=>el.scrollHeight>el.clientHeight),true,
  'Picker contents must remain scrollable inside a short visual viewport');
 await page.screenshot({path:'test-results/color-picker/visual-viewport-keyboard-390.png',animations:'disabled'});
 await page.evaluate(()=>{
  const v=window.__ux23PickerViewport;
  Object.assign(v,{offsetLeft:35,offsetTop:55,width:280,height:210});
  v.dispatchEvent(new Event('resize'));
 });
 await within();
 await page.screenshot({path:'test-results/color-picker/visual-viewport-resized-390.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'Fechar seletor de cores'}).click();
 await dialog.waitFor({state:'detached'});
 await page.evaluate(()=>{
  const original=window.__ux23OriginalPickerViewport;
  if(original)Object.defineProperty(window,'visualViewport',original);
  else delete window.visualViewport;
  delete window.__ux23OriginalPickerViewport;
  delete window.__ux23PickerViewport;
 });
 assert.deepEqual(errors,[],'No browser errors during IME or visual viewport transitions');
 console.log('Color picker IME and visual viewport QA passed (native keys, keyboard resize/scroll, screenshots).');
}finally{await browser.close();}
