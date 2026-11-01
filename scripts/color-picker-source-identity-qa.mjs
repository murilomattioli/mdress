/** UX-023: color picker remount must require a stable, unambiguous source identity. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('test-results/color-picker',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1024,height:800},reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 const cases=[
  {name:'anonymous-unlabelled',label:null,key:null,replacements:1,expectHandoff:false},
  {name:'anonymous-shared-label',label:'Shared color',key:null,replacements:1,expectHandoff:false},
  {name:'anonymous-unique-label',label:'Original only',key:null,replacements:1,expectHandoff:false},
  {name:'keyed-remount',label:'Shared color',key:'ux23-logical-color',replacements:1,expectHandoff:true},
  {name:'duplicate-key',label:'Shared color',key:'ux23-duplicate',replacements:2,expectHandoff:false}
 ];
 for(const scenario of cases){
  await page.evaluate(async scenario=>{
   const {openColorPicker}=await import('/design-system/color-picker.js');
   const host=document.createElement('div');
   host.id='ux23-color-identity';
   host.style.cssText='position:fixed;left:80px;top:80px;z-index:1000;background:white;padding:16px';
   const make=(value,label,key)=>{
    const el=document.createElement('input');
    el.type='color';el.value=value;
    if(label!==null)el.setAttribute('aria-label',label);
    if(key)el.dataset.mdressSourceKey=key;
    host.append(el);
    return el;
   };
   const original=make('#336699',scenario.label,scenario.key);
   for(let i=0;i<scenario.replacements;i++){
    const replacementLabel=scenario.name==='anonymous-unique-label'?'Different color':scenario.label;
    make(i?'#445566':'#8899aa',replacementLabel,scenario.key);
   }
   document.body.append(host);
   openColorPicker(original);
  },scenario);
  const dialog=page.locator('dialog.mdress-color-picker');
  await dialog.waitFor({state:'visible'});
  if(scenario.name==='anonymous-shared-label'||scenario.name==='keyed-remount')
   await page.screenshot({path:`test-results/color-picker/source-identity-${scenario.name}.png`,animations:'disabled'});
  const outcome=await page.evaluate(scenario=>{
   const host=document.querySelector('#ux23-color-identity');
   const inputs=[...host.querySelectorAll('input[type="color"]')];
   const original=inputs.shift();
   const picker=document.querySelector('dialog.mdress-color-picker[open]');
   let edits=0;
   for(const input of inputs)input.addEventListener('change',()=>edits++);
   original.remove();
   // Run before the MutationObserver closes the old picker: a stale event
   // must never target an anonymous or ambiguous replacement.
   const hex=picker.querySelector('.cp-hex');
   hex.value='#123456';
   hex.dispatchEvent(new Event('change',{bubbles:true}));
   const values=inputs.map(input=>input.value);
   const stillOpen=picker.open;
   return {values,edits,stillOpen};
  },scenario);
  const expected=scenario.replacements===2?['#8899aa','#445566']:['#8899aa'];
  if(scenario.expectHandoff)expected[0]='#123456';
  assert.deepEqual(outcome.values,expected,
   'Detached picker must commit only to a unique, stable source: '+scenario.name+' '+JSON.stringify(outcome));
  assert.equal(outcome.edits,scenario.expectHandoff?1:0,
   'Unexpected replacement change events: '+scenario.name+' '+JSON.stringify(outcome));
  if(!scenario.expectHandoff)
   assert.equal(outcome.stillOpen,false,'Unsafe source handoff must dismiss the picker: '+scenario.name);
  else{
   assert.equal(outcome.stillOpen,true,'Valid logical remount keeps the picker usable');
   await dialog.getByRole('button',{name:'Fechar seletor de cores'}).click();
  }
  await dialog.waitFor({state:'detached'});
  await page.locator('#ux23-color-identity').evaluate(el=>el.remove());
 }
 // An anonymous input is still editable while its original DOM node exists.
 await page.evaluate(async()=>{
  const {openColorPicker}=await import('/design-system/color-picker.js');
  const host=document.createElement('div');host.id='ux23-color-identity';
  host.style.cssText='position:fixed;left:80px;top:80px;z-index:1000';
  const input=document.createElement('input');input.type='color';input.value='#336699';
  host.append(input);document.body.append(host);openColorPicker(input);
 });
 const dialog=page.locator('dialog.mdress-color-picker');
 await dialog.waitFor({state:'visible'});
 await dialog.locator('.cp-hex').fill('#123456');
 await dialog.locator('.cp-hex').press('Enter');
 assert.equal(await page.locator('#ux23-color-identity input').inputValue(),'#123456',
  'Anonymous color source remains editable while connected');
 await dialog.getByRole('button',{name:'Fechar seletor de cores'}).click();
 await dialog.waitFor({state:'detached'});
 await page.locator('#ux23-color-identity').evaluate(el=>el.remove());
 assert.deepEqual(errors,[],'No browser errors during color source identity transitions');
 console.log('Color picker source identity QA passed: anonymous, labelled, keyed and ambiguous remounts.');
}finally{await browser.close();}
