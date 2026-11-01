/** UX-023: quick navigation must retain keyboard focus when choices disappear. */
import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const url=process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173';
await mkdir('test-results/ux-audit',{recursive:true});
async function reveal(page,id){
 await page.evaluate(async controlId=>{
  if(document.getElementById('themesView').classList.contains('hidden'))
   document.getElementById('designToggle').click();
  const {revealInspectorControl}=await import('/property-inspector.js');
  revealInspectorControl(controlId);
 },id);
}
async function assertHandoff(page,description){
 const focus=await page.evaluate(()=>{
  const el=document.activeElement,rect=el?.getBoundingClientRect();
  return {
   inside:Boolean(el?.closest('.design-inspector')),
   interactive:Boolean(el?.matches('button,input,select,textarea,[role="combobox"]')),
   enabled:Boolean(el&&!el.disabled&&el.tabIndex>=0),
   visible:Boolean(rect?.width&&rect?.height&&rect.bottom>0&&rect.top<innerHeight),
   body:el===document.body,
   label:el?.getAttribute('aria-label')||el?.id
  };
 });
 assert.ok(focus.inside&&focus.interactive&&focus.enabled&&focus.visible&&!focus.body,
  description+': '+JSON.stringify(focus));
}
try{
 const permissionPage=await browser.newPage({viewport:{width:1024,height:900}});
 try{
  await permissionPage.goto(url,{waitUntil:'networkidle'});
  await permissionPage.locator('#designToggle').click();
 // A synthetic click may race with inherited disabled/ARIA/inert/CSS
 // permissions or target a detached action. Quick actions must not run the
 // adapter or announce an uncommitted selection in those states.
 const quickGuards=await permissionPage.evaluate(async()=>{
  const {createChoiceActions}=await import('/design-system/choice-actions.js');
  const panel=document.querySelector('#inspector-document');
  const fixtures=[];
  const make=(firstLegend=false)=>{
   const fieldset=document.createElement('fieldset');
   const legend=document.createElement('legend');legend.textContent='Quick action QA';
   const container=document.createElement('div');
   const source=document.createElement('select');
   source.add(new Option('Primeiro','first'));source.add(new Option('Segundo','second'));
   let edits=0,accept=true;
   const readChoices=()=>[...source.options].map(option=>({
    label:option.label,selected:option.selected,
    apply:()=>{if(!accept)return false;source.value=option.value;edits++;return true;}
   }));
   container.append(source);
   const group=createChoiceActions({label:'QA',source,readChoices});
   container.append(group);
   if(firstLegend){legend.append(container);fieldset.append(legend);}
   else fieldset.append(legend,container);
   panel.append(fieldset);fixtures.push(fieldset);
   return {fieldset,source,group,button:group.querySelector('[data-action="next"]'),
    edits:()=>edits,reject:()=>{accept=false;}};
  };
  const click=btn=>btn.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const item=make(),b=item.button;
  item.fieldset.disabled=true;click(b);
  const disabled=item.edits()===0;
  item.fieldset.disabled=false;
  item.fieldset.setAttribute('aria-disabled','true');click(b);
  const aria=item.edits()===0;
  item.fieldset.removeAttribute('aria-disabled');
  item.fieldset.inert=true;click(b);
  const inert=item.edits()===0;
  item.fieldset.inert=false;
  item.fieldset.hidden=true;click(b);
  const hidden=item.edits()===0;
  item.fieldset.hidden=false;
  item.fieldset.style.contentVisibility='hidden';click(b);
  const contentHidden=item.edits()===0;
  item.fieldset.style.contentVisibility='';
  item.reject();click(b);
  const declined=item.edits()===0&&item.group.querySelector('[role="status"]').textContent==='';
  item.group.remove();click(b);
  const detached=item.edits()===0;
  const legend=make(true);legend.fieldset.disabled=true;click(legend.button);
  const legendAllowed=legend.edits()===1&&legend.source.value==='second';
  return {disabled,aria,inert,hidden,contentHidden,declined,detached,legendAllowed};
 });
 assert.deepEqual(Object.values(quickGuards),Array(8).fill(true),
  'Quick actions must respect live permissions, detached callbacks and declined native commits');
 await permissionPage.screenshot({path:'test-results/ux-audit/quick-synthetic-permissions.png',animations:'disabled'});
 await permissionPage.evaluate(()=>[...document.querySelectorAll('#inspector-document fieldset')]
  .filter(el=>el.querySelector('legend')?.textContent==='Quick action QA')
  .forEach(el=>el.remove()));

 }finally{await permissionPage.close();}
 for(const theme of ['graphite','studio']){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   try{
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('#source').waitFor();
    await page.locator('body').evaluate((el,value)=>el.dataset.theme=value,theme);
    await reveal(page,'fontChoice');
    const font=page.locator('.ds-property-select--quick').filter({has:page.locator('#fontChoice')});
    const quick=font.locator('.ds-choice-actions button');
    assert.equal(await quick.count(),3,'Font picker exposes previous/next/random');
    await quick.nth(1).focus();
    assert.equal(await quick.nth(1).evaluate(el=>el===document.activeElement),true);
    await page.locator('#fontChoice').evaluate(el=>{el.disabled=true;});
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-property-select--quick .ds-choice-actions button')].length===3&&
     [...document.querySelectorAll('.ds-property-select--quick .ds-choice-actions button')].every(el=>el.disabled));
    await assertHandoff(page,'Disabled font choices must move focus to an available inspector control');
    await page.screenshot({path:`test-results/ux-audit/quick-font-focus-${theme}-${width}.png`,animations:'disabled'});
    await page.locator('#fontChoice').evaluate(el=>{el.disabled=false;});
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-property-select--quick .ds-choice-actions button')].every(el=>!el.disabled));
    const previous=await page.locator('#fontChoice').inputValue();
    await quick.nth(1).click();
    assert.notEqual(await page.locator('#fontChoice').inputValue(),previous,
     'Quick navigation must still select an enabled option after reactivation');

    await reveal(page,'bgKind');
    const gallery=page.locator('.ds-accordion').filter({has:page.locator('#backgroundGallery')});
    const galleryQuick=gallery.locator('.ds-accordion-actions .ds-quick-action');
    await page.waitForFunction(()=>document.querySelectorAll('#backgroundGallery button').length>1);
    assert.equal(await galleryQuick.count(),3,'Background presets expose three quick actions');
    await gallery.locator('.ds-accordion-header').scrollIntoViewIfNeeded();
    await galleryQuick.nth(0).focus();
    assert.equal(await galleryQuick.nth(0).evaluate(el=>el===document.activeElement),true);
    await page.locator('#backgroundGallery button').evaluateAll(items=>items.forEach(el=>{el.disabled=true;}));
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-accordion:has(#backgroundGallery) .ds-accordion-actions button')].every(el=>el.disabled));
    await assertHandoff(page,'Disabled gallery choices must not strand keyboard focus');
    await page.screenshot({path:`test-results/ux-audit/quick-gallery-focus-${theme}-${width}.png`,animations:'disabled'});
    if(width===390){
     const targets=await page.locator('.design-inspector .ds-quick-action:visible').evaluateAll(elements=>
      elements.map(el=>({label:el.getAttribute('aria-label'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
     assert.ok(targets.length>=3,'Expected mobile quick actions to audit');
     assert.ok(targets.every(target=>target.width>=43.5&&target.height>=43.5),
      'Mobile quick actions require 44x44px touch targets: '+JSON.stringify(targets));
    }
    assert.deepEqual(errors,[],'No runtime errors in quick-action focus and touch checks');
    console.log('Quick actions passed: '+theme+'/'+width);
   }finally{await page.close();}
  }
 }
}finally{await browser.close();}
