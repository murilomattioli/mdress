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
  {name:'id-remount',label:'Shared color',key:null,id:'ux23-stable-color',replacements:1,expectHandoff:true},
   {name:'id-only-gains-key',label:'Mesh A',key:null,id:'ux23-source-a',replacementKey:'point-b',replacements:1,expectHandoff:false},
   {name:'key-only-gains-id',label:'Mesh A',key:'point-a',id:null,replacementId:'ux23-source-b',replacements:1,expectHandoff:false},
   {name:'composite-remount',label:'Mesh A',key:'point-a',id:'ux23-source-a',replacements:1,expectHandoff:true},
   {name:'composite-id-changed',label:'Mesh A',key:'point-a',id:'ux23-source-a',replacementId:'ux23-source-b',replacements:1,expectHandoff:false},
   {name:'composite-key-changed',label:'Mesh A',key:'point-a',id:'ux23-source-a',replacementKey:'point-b',replacements:1,expectHandoff:false},
  {name:'duplicate-key',label:'Shared color',key:'ux23-duplicate',replacements:2,expectHandoff:false},
  {name:'duplicate-id',label:'Shared color',key:null,id:'ux23-duplicate-id',replacements:2,expectHandoff:false}
 ];
 for(const scenario of cases){
  await page.evaluate(async scenario=>{
   const {openColorPicker}=await import('/design-system/color-picker.js');
   const host=document.createElement('div');
   host.id='ux23-color-identity';
   host.style.cssText='position:fixed;left:80px;top:80px;z-index:1000;background:white;padding:16px';
   const make=(value,label,key,id)=>{
    const el=document.createElement('input');
    el.type='color';el.value=value;if(id)el.id=id;
    if(label!==null)el.setAttribute('aria-label',label);
    if(key)el.dataset.mdressSourceKey=key;
    host.append(el);
    return el;
   };
   const original=make('#336699',scenario.label,scenario.key,scenario.id);
   for(let i=0;i<scenario.replacements;i++){
    const replacementLabel=scenario.name==='anonymous-unique-label'?'Different color':scenario.label;
    const key=Object.hasOwn(scenario,'replacementKey')?scenario.replacementKey:scenario.key;
     const id=Object.hasOwn(scenario,'replacementId')?scenario.replacementId:scenario.id;
     make(i?'#445566':'#8899aa',replacementLabel,key,id);
   }
   document.body.append(host);
   openColorPicker(original);
  },scenario);
  const dialog=page.locator('dialog.mdress-color-picker');
  await dialog.waitFor({state:'visible'});
  if(['anonymous-shared-label','keyed-remount','id-only-gains-key','key-only-gains-id','composite-remount'].includes(scenario.name))
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

 // Recycling a connected native input is a different risk from DOM remount:
 // a virtualized Mesh row can change its logical point without ever removing
 // the element. Synthetic events can fire before MutationObserver callbacks.
 for(const scenario of [
  {name:'connected-key-reused',key:'point-a',id:'',mutation:'key',allow:false},
  {name:'connected-id-reused',key:null,id:'point-a',mutation:'id',allow:false},
  {name:'connected-anonymous-gains-key',key:null,id:'',mutation:'key',allow:false},
  {name:'reinserted-key-reused',key:'point-a',id:'',mutation:'reinsert',allow:false},
  {name:'connected-label-change',key:'point-a',id:'',mutation:'label',allow:true}
 ]){
  await page.evaluate(async scenario=>{
   const {openColorPicker}=await import('/design-system/color-picker.js');
   const host=document.createElement('div');host.id='ux23-recycled-source';
   host.style.cssText='position:fixed;left:80px;top:80px;z-index:1000';
   const input=document.createElement('input');input.type='color';input.value='#336699';
   if(scenario.key)input.dataset.mdressSourceKey=scenario.key;
   if(scenario.id)input.id=scenario.id;
   input.setAttribute('aria-label','Mesh point A');
   host.append(input);document.body.append(host);openColorPicker(input);
  },scenario);
  const picker=page.locator('dialog.mdress-color-picker');
  await picker.waitFor({state:'visible'});
  if(scenario.name==='connected-key-reused')
   await page.screenshot({path:'test-results/color-picker/source-identity-connected-before-recycle.png',animations:'disabled'});
  const result=await page.evaluate(scenario=>{
   const host=document.querySelector('#ux23-recycled-source');
   const input=host.querySelector('input[type="color"]');
   const picker=document.querySelector('dialog.mdress-color-picker[open]');
   let changes=0;input.addEventListener('change',()=>changes++);
   if(scenario.mutation==='key')input.dataset.mdressSourceKey='point-b';
   if(scenario.mutation==='id')input.id='point-b';
   if(scenario.mutation==='label')input.setAttribute('aria-label','Mesh point B');
   if(scenario.mutation==='reinsert'){
    input.remove();
    input.dataset.mdressSourceKey='point-b';
    host.append(input);
   }
   const hex=picker.querySelector('.cp-hex');
   hex.value='#123456';hex.dispatchEvent(new Event('change',{bubbles:true}));
   return {value:input.value,changes,stillOpen:picker.open};
  },scenario);
  assert.equal(result.value,scenario.allow?'#123456':'#336699',
   'Recycled connected source must not receive stale picker edits: '+scenario.name+' '+JSON.stringify(result));
  assert.equal(result.changes,scenario.allow?1:0,
   'Recycled source must not dispatch an invalid change: '+scenario.name+' '+JSON.stringify(result));
  assert.equal(result.stillOpen,scenario.allow,
   'Identity change must dismiss the picker immediately: '+scenario.name+' '+JSON.stringify(result));
  if(scenario.allow)await picker.getByRole('button',{name:'Fechar seletor de cores'}).click();
  await picker.waitFor({state:'detached'});
  await page.locator('#ux23-recycled-source').evaluate(el=>el.remove());
 }

 // A→B→A reuse within one task must still revoke a pending native sample:
 // its final attributes look unchanged, but the logical source was replaced.
 for(const {field,remount} of [
  {field:'key',remount:false},{field:'id',remount:false},
  {field:'key',remount:true},{field:'id',remount:true}
 ]){
  await page.evaluate(async field=>{
   const {openColorPicker}=await import('/design-system/color-picker.js');
   const host=document.createElement('div');host.id='ux23-transient-identity';
   host.style.cssText='position:fixed;left:80px;top:80px;z-index:1000';
   const input=document.createElement('input');input.type='color';input.value='#336699';
   if(field==='key')input.dataset.mdressSourceKey='point-a';
   else input.id='point-a';
   host.append(input);document.body.append(host);
   window.__ux23TransientChanges=0;
   input.addEventListener('change',()=>window.__ux23TransientChanges++);
   window.EyeDropper=class {open(){return new Promise(resolve=>{window.__ux23TransientSample=resolve;});}};
   openColorPicker(input);
  },field);
  const picker=page.locator('dialog.mdress-color-picker');
  await picker.waitFor({state:'visible'});
  await picker.getByRole('button',{name:'Capturar cor da tela'}).click();
  await page.waitForFunction(()=>typeof window.__ux23TransientSample==='function');
  await page.evaluate(({field,remount})=>{
   let input=document.querySelector('#ux23-transient-identity input');
   if(remount){
    const replacement=input.cloneNode();
    input.replaceWith(replacement);
    input=replacement;
   }
   if(field==='key'){
    input.dataset.mdressSourceKey='point-b';
    input.dataset.mdressSourceKey='point-a';
   }else{
    input.id='point-b';input.id='point-a';
   }
  },{field,remount});
  await picker.waitFor({state:'detached',timeout:3000});
  const result=await page.evaluate(async()=>{
   window.__ux23TransientSample({sRGBHex:'#FF0000'});
   await Promise.resolve();await Promise.resolve();
   const input=document.querySelector('#ux23-transient-identity input');
   return {value:input.value,changes:window.__ux23TransientChanges};
  });
  assert.deepEqual(result,{value:'#336699',changes:0},
   'Transient '+field+' reuse (remount='+remount+') must revoke an in-flight EyeDropper result');
  await page.evaluate(()=>{
   document.querySelector('#ux23-transient-identity').remove();
   delete window.__ux23TransientSample;delete window.__ux23TransientChanges;
   delete window.EyeDropper;
  });
 }
 assert.deepEqual(errors,[],'No browser errors during color source identity transitions');
 console.log('Color picker source identity QA passed: anonymous, labelled, exact composite-key, ambiguous remounts and connected-node recycling and transient EyeDropper identity changes, including remounts.');
}finally{await browser.close();}
