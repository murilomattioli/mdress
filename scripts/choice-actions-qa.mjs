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
 permissionPage.setDefaultTimeout(15000);
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
 // A header action can be outside the first legend while its native select
 // is inside it. ARIA/inert on the source, or a new disabled ancestor after
 // reparenting, must disable the visible actions and reject synthetic clicks.
 const quickSourceStates=await permissionPage.evaluate(async()=>{
  const {createChoiceActions}=await import('/design-system/choice-actions.js');
  const panel=document.querySelector('#inspector-document');
  const root=document.createElement('fieldset');
  root.id='ux23-quick-source-permissions';
  const legend=document.createElement('legend');legend.textContent='Quick source permissions';
  const source=document.createElement('select');source.id='ux23-quick-native';
  source.add(new Option('Primeiro','a'));source.add(new Option('Segundo','b'));
  legend.append(source);
  const host=document.createElement('div');
  const fallback=document.createElement('button');fallback.type='button';fallback.textContent='Próximo campo';
  root.append(legend,host,fallback);panel.append(root);
  let commits=0;
  const readChoices=()=>[...source.options].map(option=>({
   label:option.label,selected:option.selected,
   apply:()=>{source.value=option.value;commits++;return true;}
  }));
  const group=createChoiceActions({label:'Fonte dinâmica',source,readChoices,
   onUnavailableFocus:()=>fallback.focus({preventScroll:true})});
  host.append(group);
  const next=group.querySelector('[data-action="next"]');
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  const click=()=>next.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  source.setAttribute('aria-disabled','true');click();await tick();
  const sourceAria=commits===0&&next.disabled;
  source.removeAttribute('aria-disabled');await tick();
  const ariaRestored=!next.disabled;
  source.inert=true;click();await tick();
  const sourceInert=commits===0&&next.disabled;
  source.inert=false;await tick();
  source.hidden=true;click();await tick();
  const directlyHidden=commits===0&&next.disabled;
  source.hidden=false;await tick();
  const hiddenRestored=!next.disabled;
  // Enhanced native selects are intentionally aria-hidden because their
  // custom trigger is the accessible control. This must not lock actions.
  source.setAttribute('aria-hidden','true');await tick();
  const nativeAriaProxyAllowed=!next.disabled;
  source.removeAttribute('aria-hidden');await tick();
  legend.setAttribute('aria-disabled','true');click();await tick();
  const ancestorAria=commits===0&&next.disabled;
  legend.removeAttribute('aria-disabled');await tick();
  next.focus();source.setAttribute('aria-disabled','true');await tick();
  const focusHandoff=document.activeElement===fallback&&next.disabled;
  source.removeAttribute('aria-disabled');await tick();
  next.focus();
  document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  next.blur();
  source.setAttribute('aria-disabled','true');await tick();
  const pointerNotStolen=document.activeElement===document.body;
  source.removeAttribute('aria-disabled');await tick();
  root.disabled=true;click();await tick();
  const legendException=source.matches(':disabled')===false&&next.disabled&&commits===0;
  root.disabled=false;await tick();
  const dynamic=document.createElement('fieldset');dynamic.disabled=true;
  dynamic.id='ux23-quick-dynamic';
  dynamic.append(document.createElement('legend'));root.after(dynamic);
  dynamic.append(source);click();await tick();
  const movedDisabled=next.disabled&&commits===0;
  legend.append(source);await tick();
  const movedRestored=!next.disabled;
  source.remove();click();await tick();
  const detachedSource=next.disabled&&commits===0;
  legend.append(source);await tick();
  const reattachedSource=!next.disabled;
  click();const committed=commits===1&&source.value==='b';
  source.setAttribute('aria-disabled','true');await tick();
  return {sourceAria,ariaRestored,sourceInert,directlyHidden,hiddenRestored,
   nativeAriaProxyAllowed,ancestorAria,focusHandoff,pointerNotStolen,
   legendException,movedDisabled,movedRestored,detachedSource,reattachedSource,committed};
 });
 assert.deepEqual(Object.values(quickSourceStates),Array(15).fill(true),
  'Quick actions must synchronize source/ancestor permissions, fieldset legend and reparenting');
 await permissionPage.screenshot({path:'test-results/ux-audit/quick-source-revoked-1024.png',animations:'disabled'});
 await permissionPage.locator('#ux23-quick-native').evaluate(el=>el.removeAttribute('aria-disabled'));
 await permissionPage.waitForFunction(()=>!document.querySelector('#ux23-quick-source-permissions [data-action="next"]').disabled);
 await permissionPage.screenshot({path:'test-results/ux-audit/quick-source-restored-1024.png',animations:'disabled'});
 // Header quick actions must work while the source gallery is inside a
 // collapsed accordion body. Other hidden ancestors still revoke actions.
 const collapsedStates=await permissionPage.evaluate(async()=>{
  const {createChoiceActions}=await import('/design-system/choice-actions.js');
  const panel=document.querySelector('#inspector-document');
  const accordion=document.createElement('section');accordion.className='ds-accordion';
  accordion.id='ux23-collapsed-quick';
  const header=document.createElement('div');header.className='ds-accordion-header';
  const body=document.createElement('div');body.className='ds-accordion-body';body.hidden=true;
  const gallery=document.createElement('div');gallery.id='ux23-collapsed-gallery';
  const choices=['A','B','C'].map((label,index)=>{
   const button=document.createElement('button');button.type='button';
   button.textContent=label;button.setAttribute('aria-pressed',String(index===0));
   gallery.append(button);return button;
  });
  let commits=0;
  const group=createChoiceActions({label:'Galeria recolhida',source:gallery,
   readChoices:()=>choices.map(button=>({
    label:button.textContent,selected:button.getAttribute('aria-pressed')==='true',
    apply:()=>{choices.forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
     commits++;return true;}
   }))});
  header.append(group);body.append(gallery);accordion.append(header,body);panel.append(accordion);
  const next=group.querySelector('[data-action="next"]');
  const click=()=>next.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  click();await tick();
  const collapsedWorks=commits===1&&choices[1].getAttribute('aria-pressed')==='true'&&!next.disabled;
  body.setAttribute('aria-hidden','true');click();await tick();
  const explicitAriaHidden=commits===1&&next.disabled;
  body.removeAttribute('aria-hidden');await tick();
  const restored=!next.disabled;
  gallery.hidden=true;click();await tick();
  const directHidden=commits===1&&next.disabled;
  gallery.hidden=false;await tick();
  const directRestored=!next.disabled;
  gallery.setAttribute('aria-hidden','true');click();await tick();
  const directAriaHidden=commits===1&&next.disabled;
  gallery.removeAttribute('aria-hidden');await tick();
  const directAriaRestored=!next.disabled;
  gallery.style.display='none';click();await tick();
  const cssDisplayHidden=commits===1&&next.disabled;
  gallery.style.display='';await tick();
  const cssDisplayRestored=!next.disabled;
  gallery.style.visibility='hidden';click();await tick();
  const cssVisibilityHidden=commits===1&&next.disabled;
  gallery.style.visibility='';await tick();
  const cssVisibilityRestored=!next.disabled;
  body.style.contentVisibility='hidden';click();await tick();
  const ancestorContentHidden=commits===1&&next.disabled;
  body.style.contentVisibility='';await tick();
  const ancestorContentRestored=!next.disabled;
  // Explicit CSS on the collapsed body is not the normal [hidden] state.
  body.style.display='none';click();await tick();
  const explicitCollapsedDisplayLock=commits===1&&next.disabled;
  body.style.display='';await tick();
  const explicitCollapsedDisplayRestored=!next.disabled;
  const wrapper=document.createElement('div');body.append(wrapper);wrapper.append(gallery);
  // A descendant wrapper hidden by CSS (not [hidden]) must revoke the
  // header actions even while the accordion's own body is collapsed.
  wrapper.style.display='none';click();await tick();
  const nestedCssDisplayHidden=commits===1&&next.disabled;
  wrapper.style.display='';await tick();
  const nestedCssDisplayRestored=!next.disabled;
  wrapper.style.visibility='hidden';click();await tick();
  const nestedCssVisibilityHidden=commits===1&&next.disabled;
  wrapper.style.visibility='';await tick();
  const nestedCssVisibilityRestored=!next.disabled;
  wrapper.hidden=true;click();await tick();
  const nestedHidden=commits===1&&next.disabled;
  body.append(gallery);wrapper.remove();await tick();
  click();await tick();
  const reparentRestored=commits===2&&choices[2].getAttribute('aria-pressed')==='true'&&!next.disabled;
  return {collapsedWorks,explicitAriaHidden,restored,directHidden,directRestored,
   directAriaHidden,directAriaRestored,cssDisplayHidden,cssDisplayRestored,
   cssVisibilityHidden,cssVisibilityRestored,ancestorContentHidden,
   ancestorContentRestored,explicitCollapsedDisplayLock,explicitCollapsedDisplayRestored,
   nestedCssDisplayHidden,nestedCssDisplayRestored,
   nestedCssVisibilityHidden,nestedCssVisibilityRestored,nestedHidden,reparentRestored};
 });
 assert.ok(Object.values(collapsedStates).every(Boolean),
  'Collapsed accordion header must navigate; hidden sources must revoke: '+JSON.stringify(collapsedStates));
 await permissionPage.screenshot({path:'test-results/ux-audit/quick-collapsed-fixture-1024.png',animations:'disabled'});
 // Evidence of the direct source lock, independent of the collapsed body.
 await permissionPage.locator('#ux23-collapsed-gallery').evaluate(el=>el.hidden=true);
 await permissionPage.waitForFunction(()=>document.querySelector('#ux23-collapsed-quick [data-action="next"]')?.disabled);
 await permissionPage.screenshot({path:'test-results/ux-audit/quick-direct-source-hidden-1024.png',animations:'disabled'});
 await permissionPage.locator('#ux23-collapsed-gallery').evaluate(el=>el.hidden=false);
 await permissionPage.locator('#ux23-collapsed-quick').evaluate(el=>el.remove());
 await permissionPage.locator('#ux23-quick-source-permissions').evaluate(el=>el.remove());
 await permissionPage.locator('#ux23-quick-dynamic').evaluate(el=>el.remove());
 await permissionPage.evaluate(()=>[...document.querySelectorAll('#inspector-document fieldset')]
  .filter(el=>el.querySelector('legend')?.textContent==='Quick action QA')
  .forEach(el=>el.remove()));

 }finally{await permissionPage.close();}
 for(const theme of ['graphite','studio']){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   page.setDefaultTimeout(15000);
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
    // Collapsing the body must not turn the visible header's quick actions
    // into silent no-ops. Exercise the actual gallery, not only a fixture.
    await gallery.locator('.ds-accordion-toggle').evaluate(el=>{
     if(el.getAttribute('aria-expanded')==='true')el.click();
    });
    await page.waitForFunction(()=>document.querySelector('.ds-accordion:has(#backgroundGallery) .ds-accordion-body')?.hidden===true);
    const previousPreset=await page.locator('#backgroundGallery button[aria-pressed="true"]').first()
     .getAttribute('aria-label').catch(()=>null);
    await galleryQuick.nth(1).click({timeout:10000});
    await page.waitForFunction(previous=>{
     const selected=document.querySelector('#backgroundGallery button[aria-pressed="true"]');
     return Boolean(selected)&&selected.getAttribute('aria-label')!==previous;
    },previousPreset,{timeout:10000});
    assert.equal(await gallery.locator('.ds-accordion-body').evaluate(el=>el.hidden),true,
     'Header quick action must not expand the accordion');
    await page.screenshot({path:`test-results/ux-audit/quick-gallery-collapsed-${theme}-${width}.png`,animations:'disabled'});
    // The preset gallery lives in the accordion body, but its quick actions
    // live in the header. Revoking the source itself must disable the header
    // buttons, even when the source is not an ancestor of those buttons.
    await page.locator('#backgroundGallery').evaluate(el=>el.setAttribute('aria-disabled','true'));
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-accordion:has(#backgroundGallery) .ds-accordion-actions button')].every(el=>el.disabled));
    await page.screenshot({path:`test-results/ux-audit/quick-gallery-source-aria-${theme}-${width}.png`,animations:'disabled'});
    await page.locator('#backgroundGallery').evaluate(el=>el.removeAttribute('aria-disabled'));
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-accordion:has(#backgroundGallery) .ds-accordion-actions button')].every(el=>!el.disabled));
    await page.locator('#backgroundGallery').evaluate(el=>el.inert=true);
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-accordion:has(#backgroundGallery) .ds-accordion-actions button')].every(el=>el.disabled));
    await page.locator('#backgroundGallery').evaluate(el=>el.inert=false);
    await page.waitForFunction(()=>[...document.querySelectorAll('.ds-accordion:has(#backgroundGallery) .ds-accordion-actions button')].every(el=>!el.disabled));
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
