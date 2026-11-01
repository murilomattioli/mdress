/** UX-023: a portalled color editor must obey its original source permissions. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('test-results/color-picker',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
 await page.locator('#designToggle').click();
 await page.evaluate(()=>{
  const panel=document.querySelector('#inspector-document');
  if(!panel)throw Error('Inspector document panel unavailable');
  const fieldset=document.createElement('fieldset');
  fieldset.id='ux23-color-permissions';
  const legend=document.createElement('legend');legend.textContent='QA permissões de cor';
  const label=document.createElement('label');label.textContent='Cor de teste';
  const input=document.createElement('input');input.type='color';input.value='#336699';
  input.id='ux23-color-source';input.setAttribute('aria-label','Cor de teste');
  label.append(input);fieldset.append(legend,label);panel.append(fieldset);
  window.__ux23ColorEdits=0;
  input.addEventListener('change',()=>window.__ux23ColorEdits++);
 });
 const check=async(name,setup,restore)=>{
  const result=await page.evaluate(async({setup,restore})=>{
   const {openColorPicker}=await import('/design-system/color-picker.js');
   const fieldset=document.getElementById('ux23-color-permissions');
   const input=document.getElementById('ux23-color-source');
   const apply=Function('fieldset','input',setup),reset=Function('fieldset','input',restore);
   input.value='#336699';apply(fieldset,input);
   openColorPicker(input);
   const blocked=!document.querySelector('dialog.mdress-color-picker[open]');
   const detail={blocked,computed:getComputedStyle(input).visibility,inline:input.style.cssText,
    rects:input.getClientRects().length,disabled:input.matches(':disabled')};
   reset(fieldset,input);
   return detail;
  },{setup,restore});
  assert.ok(result.blocked,'Picker must refuse an unavailable source: '+name+' '+JSON.stringify(result));
 };
 await check('disabled fieldset','fieldset.disabled=true','fieldset.disabled=false');
 await check('ARIA disabled','fieldset.setAttribute("aria-disabled","true")','fieldset.removeAttribute("aria-disabled")');
 await check('inert','fieldset.inert=true','fieldset.inert=false');
 await check('hidden','fieldset.hidden=true','fieldset.hidden=false');
 await check('display none','fieldset.style.display="none"','fieldset.style.display=""');
 await check('content visibility','fieldset.style.contentVisibility="hidden"','fieldset.style.contentVisibility=""');
 await check('effective CSS visibility','input.style.setProperty("visibility","hidden","important")','input.style.removeProperty("visibility")');
 const revokeCases=[
  ['disabled fieldset','fieldset.disabled=true'],
  ['ARIA disabled','fieldset.setAttribute("aria-disabled","true")'],
  ['inert','fieldset.inert=true'],
  ['hidden','fieldset.hidden=true'],
  ['display none','fieldset.style.display="none"'],
  ['content visibility','fieldset.style.contentVisibility="hidden"'],
  ['CSS visibility','input.style.setProperty("visibility","hidden","important")'],
  ['detached source','input.remove()'],
  ['root ARIA permission','document.documentElement.setAttribute("aria-disabled","true")']
 ];
 for(const [name,revoke] of revokeCases){
  await page.evaluate(async()=>{
   const {openColorPicker}=await import('/design-system/color-picker.js');
   const fieldset=document.getElementById('ux23-color-permissions');
   fieldset.disabled=false;fieldset.inert=false;fieldset.hidden=false;
   fieldset.removeAttribute('aria-disabled');fieldset.style.cssText='';
   let input=document.getElementById('ux23-color-source');
   if(!input){
    input=document.createElement('input');input.type='color';input.id='ux23-color-source';
    input.setAttribute('aria-label','Cor de teste');fieldset.querySelector('label').append(input);
    input.addEventListener('change',()=>window.__ux23ColorEdits++);
   }
   input.style.cssText='';input.value='#336699';openColorPicker(input);
  });
  const opened=await page.evaluate(()=>{
   const input=document.getElementById('ux23-color-source');
   return {dialog:Boolean(document.querySelector('dialog.mdress-color-picker[open]')),
    connected:input?.isConnected,rects:input?.getClientRects().length,
    visibility:input&&getComputedStyle(input).visibility,
    fieldsetDisabled:document.getElementById('ux23-color-permissions').disabled,
    inline:input?.style.cssText};
  });
  assert.ok(opened.dialog,'Color fixture must open before '+name+': '+JSON.stringify(opened));
  const dialog=page.locator('dialog.mdress-color-picker');
  await dialog.waitFor({state:'visible'});
  if(name==='disabled fieldset')await page.screenshot({path:'test-results/color-picker/permissions-before-revoke.png',animations:'disabled'});
  const outcome=await page.evaluate(revoke=>{
   const fieldset=document.getElementById('ux23-color-permissions');
   const input=document.getElementById('ux23-color-source');
   const dialog=document.querySelector('dialog.mdress-color-picker[open]');
   const edits=window.__ux23ColorEdits;
   Function('fieldset','input',revoke)(fieldset,input);
   const hex=dialog.querySelector('.cp-hex');
   hex.value='#112233';hex.dispatchEvent(new Event('change',{bubbles:true}));
   const opacity=dialog.querySelector('.cp-opacity input[type="number"]');
   opacity.value='21';opacity.dispatchEvent(new Event('change',{bubbles:true}));
   return {value:input.value,opacity:input.dataset.opacity??null,edits:window.__ux23ColorEdits-edits};
  },revoke);
  assert.equal(outcome.value,'#336699',name+' must not commit stale HEX');
  assert.equal(outcome.opacity,null,name+' must not commit stale opacity');
  assert.equal(outcome.edits,0,name+' must not dispatch native change');
  await dialog.waitFor({state:'detached'});
  if(name==='root ARIA permission')await page.evaluate(()=>document.documentElement.removeAttribute('aria-disabled'));
  if(name==='disabled fieldset'){
   await page.screenshot({path:'test-results/color-picker/focus-after-revoke.png',animations:'disabled'});
   assert.equal(await page.evaluate(()=>document.activeElement===document.body),false,
    'Revoked dialog must recover keyboard focus outside disabled fieldset');
  }
 }
 // A native disabled fieldset preserves the first-legend exception.
 await page.evaluate(async()=>{
  const {openColorPicker}=await import('/design-system/color-picker.js');
  const fieldset=document.getElementById('ux23-color-permissions');
  fieldset.disabled=true;fieldset.inert=false;fieldset.hidden=false;
  fieldset.removeAttribute('aria-disabled');fieldset.style.cssText='';
  const input=document.getElementById('ux23-color-source');
  input.style.cssText='';input.value='#336699';
  fieldset.querySelector('legend').append(input);
  openColorPicker(input);
 });
 const dialog=page.locator('dialog.mdress-color-picker');
 await dialog.waitFor({state:'visible'});
 await dialog.locator('.cp-hex').fill('#112233');
 await dialog.locator('.cp-hex').dispatchEvent('change');
 assert.equal(await page.locator('#ux23-color-source').inputValue(),'#112233',
  'The first legend remains interactive under a disabled fieldset');
 await page.screenshot({path:'test-results/color-picker/first-legend-allowed.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'Fechar seletor de cores'}).click();
 await dialog.waitFor({state:'detached'});
 // A pending native EyeDropper result must not resurrect a revoked editor.
 await page.evaluate(async()=>{
  const {openColorPicker}=await import('/design-system/color-picker.js');
  const fieldset=document.getElementById('ux23-color-permissions');
  fieldset.disabled=false;
  const input=document.getElementById('ux23-color-source');
  input.value='#336699';
  window.EyeDropper=class {open(){return new Promise(resolve=>{window.__ux23ResolveSample=resolve;});}};
  openColorPicker(input);
 });
 await dialog.waitFor({state:'visible'});
 await dialog.getByRole('button',{name:'Capturar cor da tela'}).click();
 await page.waitForFunction(()=>typeof window.__ux23ResolveSample==='function');
 await page.evaluate(()=>{
  const fieldset=document.getElementById('ux23-color-permissions');
  fieldset.setAttribute('aria-disabled','true');
  window.__ux23ResolveSample({sRGBHex:'#FF0000'});
 });
 await dialog.waitFor({state:'detached'});
 assert.equal(await page.locator('#ux23-color-source').inputValue(),'#336699',
  'Late EyeDropper results must not change a revoked source');
 // Detached swatches and inputs retain event handlers after close. Neither
 // those handlers nor callbacks from a superseded picker may edit a document.
 const stale=await page.evaluate(async()=>{
  const {openColorPicker}=await import('/design-system/color-picker.js');
  const fieldset=document.getElementById('ux23-color-permissions');
  fieldset.disabled=false;fieldset.removeAttribute('aria-disabled');
  const source=document.getElementById('ux23-color-source');source.value='#010203';
  const beforeSaved=localStorage.getItem('mdress.saved-colors.v1');
  openColorPicker(source);
  const old=document.querySelector('dialog.mdress-color-picker[open]');
  const cell=old.querySelector('.cp-cell');
  const opacity=old.querySelector('.cp-opacity input[type="number"]');
  const add=old.querySelector('.cp-saved-title button');
  old.close();
  cell.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  opacity.value='17';opacity.dispatchEvent(new Event('change',{bubbles:true}));
  add.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const afterClose={color:source.value,opacity:source.dataset.opacity??null,
   saved:localStorage.getItem('mdress.saved-colors.v1')};
  const other=document.createElement('input');other.type='color';other.value='#0A0B0C';
  other.setAttribute('aria-label','Outra cor');fieldset.querySelector('legend').append(other);
  openColorPicker(source);
  const superseded=document.querySelector('dialog.mdress-color-picker[open]');
  const oldCell=superseded.querySelector('.cp-cell');
  openColorPicker(other);
  oldCell.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const afterSwitch={original:source.value,replacement:other.value};
  document.querySelector('dialog.mdress-color-picker[open]')?.close();
  return {beforeSaved,afterClose,afterSwitch};
 });
 assert.equal(stale.afterClose.color,'#010203','Closed picker swatches must not edit native color');
 assert.equal(stale.afterClose.opacity,null,'Closed picker opacity controls must not edit native opacity');
 assert.equal(stale.afterClose.saved,stale.beforeSaved,'Closed picker cannot save a stale swatch');
 assert.deepEqual(stale.afterSwitch,{original:'#010203',replacement:'#0a0b0c'},
  'A superseded picker cannot edit either native source');
 await page.waitForFunction(()=>document.querySelectorAll('dialog.mdress-color-picker').length===0);
 // Responsive CSS can revoke a source without any attribute mutation.
 // The resize path must dismiss the portalled editor before a stale commit.
 const responsiveStyle=await page.addStyleTag({content:
  '@media (max-width: 700px) { #ux23-color-source { visibility:hidden !important; } }'});
 await page.evaluate(async()=>{
  const {openColorPicker}=await import('/design-system/color-picker.js');
  openColorPicker(document.getElementById('ux23-color-source'));
 });
 await dialog.waitFor({state:'visible'});
 await page.setViewportSize({width:600,height:900});
 await dialog.waitFor({state:'detached'});
 assert.equal(await page.locator('#ux23-color-source').inputValue(),'#010203',
  'Responsive hiding must close the picker without changing the source');
 await responsiveStyle.evaluate(el=>el.remove());
 await page.setViewportSize({width:1024,height:900});
 assert.deepEqual(errors,[],'No runtime errors while revoking the portalled picker');
 console.log('Color picker permission guards passed: 7 blocked openings, 9 revocations, legend, async sample and stale callbacks and responsive hiding');
}finally{await browser.close();}
