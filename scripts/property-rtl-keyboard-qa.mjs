import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const output='test-results/ux-audit';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.evaluate(async()=>{
  const {enhancePropertyControls}=await import('/design-system/property-controls.js');
  const host=document.createElement('section');
  host.id='ux23-rtl-keyboard';
  host.className='design-inspector';
  host.style.cssText='position:fixed;left:12px;top:70px;width:340px;max-width:calc(100vw - 24px);padding:12px;display:block;direction:ltr;background:var(--ds-panel,white);color:var(--ds-text,#222);z-index:2147483640';
  const binary=document.createElement('label');
  binary.className='property-row';
  binary.append(document.createTextNode('Posicionamento '));
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.id='ux23-rtl-binary';
  binary.append(checkbox);
  const segmented=document.createElement('label');
  segmented.className='property-row';
  segmented.append(document.createTextNode('Divisória '));
  const select=document.createElement('select');
  select.id='sectionRule';
  for(const [value,label] of [['line','Linha'],['none','Nenhum'],['block','Bloco']]){
   const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);
  }
  segmented.append(select);
  const color=document.createElement('input');
  color.id='ux23-rtl-color';color.type='color';color.value='#336699';
  color.setAttribute('aria-label','Cor RTL');
  host.append(binary,segmented,color);document.body.append(host);
  enhancePropertyControls(document);
 });
 const host=page.locator('#ux23-rtl-keyboard');
 const binary=host.locator('.ds-binary-group button');
 const segment=host.locator('.ds-segment-buttons button');
 const binaryValue=()=>host.locator('#ux23-rtl-binary').evaluate(el=>el.checked);
 const segmentValue=()=>host.locator('#sectionRule').evaluate(el=>el.value);
 assert.equal(await binary.count(),2,'Binary fixture must be enhanced');
 assert.equal(await segment.count(),3,'Segment fixture must be enhanced');

 // LTR baseline: right advances, left returns.
 await binary.nth(0).focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await binaryValue(),true);
 assert.equal(await binary.nth(1).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('ArrowLeft');
 assert.equal(await binaryValue(),false);
 await segment.nth(0).focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await segmentValue(),'none');
 await page.keyboard.press('ArrowLeft');
 assert.equal(await segmentValue(),'line');
 await host.screenshot({path:output+'/property-keyboard-ltr-390.png',animations:'disabled'});

 // Switching direction must take effect immediately without remounting.
 await host.evaluate(el=>el.style.direction='rtl');
 assert.equal(await segment.nth(0).evaluate(el=>getComputedStyle(el.parentElement).direction),'rtl');
 await binary.nth(0).focus();
 await page.keyboard.press('ArrowLeft');
 assert.equal(await binaryValue(),true,'RTL left moves from first to second binary option');
 await page.keyboard.press('ArrowRight');
 assert.equal(await binaryValue(),false,'RTL right returns to first binary option');
 await segment.nth(0).focus();
 await page.keyboard.press('ArrowLeft');
 assert.equal(await segmentValue(),'none','RTL left advances in DOM order');
 await page.keyboard.press('ArrowRight');
 assert.equal(await segmentValue(),'line','RTL right returns in DOM order');
 await segment.nth(0).focus();
 await page.keyboard.press('End');
 assert.equal(await segmentValue(),'block','End retains last DOM endpoint');
 await page.keyboard.press('Home');
 assert.equal(await segmentValue(),'line','Home retains first DOM endpoint');
 await host.locator('#sectionRule option[value="none"]').evaluate(el=>el.disabled=true);
 await page.waitForFunction(()=>document.querySelector('#ux23-rtl-keyboard .ds-segment-buttons button:nth-child(2)')?.disabled);
 await segment.nth(0).focus();
 await page.keyboard.press('ArrowLeft');
 assert.equal(await segmentValue(),'block','RTL arrows skip a disabled middle option');
 assert.equal(await segment.nth(2).evaluate(el=>el===document.activeElement),true);
 await host.screenshot({path:output+'/property-keyboard-rtl-390.png',animations:'disabled'});

 // The portalled color picker must follow its own rendered direction.
 await page.evaluate(async()=>{
  const {openColorPicker}=await import('/design-system/color-picker.js');
  openColorPicker(document.querySelector('#ux23-rtl-color'));
  document.querySelector('.mdress-color-picker').style.direction='rtl';
 });
 const dialog=page.locator('.mdress-color-picker');
 const tabs=dialog.getByRole('tab');
 assert.equal(await tabs.count(),3);
 assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
 await tabs.nth(0).focus();
 await page.keyboard.press('ArrowLeft');
 assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true',
  'RTL left must move to the next visual tab');
 assert.equal(await tabs.nth(1).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('ArrowRight');
 assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
 await page.keyboard.press('End');
 assert.equal(await tabs.nth(2).getAttribute('aria-selected'),'true');
 await page.keyboard.press('Home');
 assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
 assert.equal(await dialog.locator('[role="tab"][tabindex="0"]').count(),1,
  'Exactly one color-picker tab must be reachable by Tab');
 await dialog.screenshot({path:output+'/color-picker-tabs-rtl-390.png',animations:'disabled'});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('.mdress-color-picker'));
 assert.deepEqual(errors,[],'RTL keyboard QA must not produce page errors');
 console.log('RTL keyboard QA passed: binary, segmented, disabled options, color-picker tabs; 3 screenshots.');
}finally{
 await browser.close();
}
