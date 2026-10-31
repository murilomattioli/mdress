import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');await page.locator('#designToggle').click();
 await page.locator('[data-inspector-tab=themes]').click();
 for(const button of await page.locator('#inspector-themes .ds-accordion-toggle').all())if(await button.getAttribute('aria-expanded')==='true')await button.click();
 const group=page.locator('.ds-accordion').filter({has:page.locator('#themeRecipeGallery')});
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const old=document.querySelector('#themeRecipeGallery').closest('.ds-accordion').querySelector('.ds-accordion-header');
  old.replaceWith(createInspectorHeader({toggle:old.querySelector('.ds-accordion-toggle'),actions:old.querySelector('.ds-choice-actions'),menuItems:[{label:'Indisponível',disabled:true,onSelect:()=>{}},{label:'Ação de teste',onSelect:()=>window.headerActionCalled=true},{label:'Segunda ação',onSelect:()=>{}},{label:'Terceira ação',onSelect:()=>{}}]}));
 });
 const trigger=group.locator('.ds-header-menu-trigger');
 await page.mouse.move(0,0);assert.equal(await trigger.evaluate(el=>getComputedStyle(el).opacity),'0');
 await trigger.focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ds-header-menu-trigger')).opacity==='1');
 await trigger.press('Enter');await page.getByRole('menu').waitFor();
 assert.equal(await page.getByRole('menuitem',{name:'Indisponível'}).isDisabled(),true);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.headerActionCalled),true);
 await trigger.click();
 const menu=page.getByRole('menu');
 const first=page.getByRole('menuitem',{name:'Ação de teste'});
 const last=page.getByRole('menuitem',{name:'Terceira ação'});
 await page.keyboard.press('End');
 assert.equal(await last.evaluate(el=>el===document.activeElement),true,'End reaches the final enabled item');
 await page.keyboard.press('ArrowDown');
 assert.equal(await first.evaluate(el=>el===document.activeElement),true,'ArrowDown wraps to the first enabled item');
 await page.keyboard.press('ArrowUp');
 assert.equal(await last.evaluate(el=>el===document.activeElement),true,'ArrowUp wraps to the last enabled item');
 await page.keyboard.press('Home');
 assert.equal(await first.evaluate(el=>el===document.activeElement),true,'Home reaches the first enabled item');
 assert.equal(await trigger.getAttribute('aria-controls'),await menu.getAttribute('id'));
 await page.keyboard.press('Escape');
 assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Escape returns focus to the trigger');
 // A menu with no enabled actions must not waste horizontal space or trap focus.
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const toggle=document.createElement('button');toggle.type='button';toggle.setAttribute('aria-label','Sem ações');
  const host=document.createElement('div');host.id='ux23-disabled-menu-host';
  host.append(createInspectorHeader({toggle,menuItems:[{label:'Bloqueada',disabled:true,onSelect:()=>{}}]}));
  document.body.append(host);
 });
 assert.equal(await page.locator('#ux23-disabled-menu-host .ds-header-menu-trigger').isHidden(),true);
 assert.equal(await page.locator('#ux23-disabled-menu-host [role=menu]').isVisible(),false);
 // Live permission updates must not strand keyboard focus or invoke blocked actions.
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const host=document.createElement('div');host.id='ux23-dynamic-menu-host';host.className='design-inspector';
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Permissões dinâmicas';
  host.append(createInspectorHeader({toggle,menuVisibility:'always',menuItems:[
   {label:'Primeira',onSelect:()=>window.dynamicMenuSelected=true},
   {label:'Segunda',onSelect:()=>window.dynamicSecondCalled=true}
  ]}));
  document.body.append(host);
 });
 const dynamicHost=page.locator('#ux23-dynamic-menu-host');
 const dynamicTrigger=dynamicHost.locator('.ds-header-menu-trigger');
 assert.equal(await dynamicTrigger.getAttribute('aria-label'),'Opções de Permissões dinâmicas',
  'Visible toggle text names the menu when aria-label is absent');
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 const dynamicItems=dynamicHost.locator('[role=menuitem]');
 assert.equal(await dynamicItems.nth(0).evaluate(el=>el===document.activeElement),true);
 await dynamicItems.nth(0).evaluate(el=>el.setAttribute('aria-disabled','true'));
 await page.waitForFunction(()=>document.activeElement?.textContent==='Segunda',null,{timeout:3000});
 await dynamicItems.nth(0).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'aria-disabled menuitems cannot invoke callbacks');
 await dynamicItems.nth(1).evaluate(el=>el.disabled=true);
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger')?.hidden===true);
 assert.equal(await dynamicHost.locator('button').first().evaluate(el=>el===document.activeElement),true,
  'Disabling every action closes the popover and restores focus to the section toggle');
 assert.equal(await dynamicHost.getByRole('menu').isVisible(),false);
 await dynamicItems.nth(1).evaluate(el=>el.disabled=false);
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger')?.hidden===false);
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 assert.equal(await dynamicItems.nth(1).evaluate(el=>el===document.activeElement),true,
  'Re-enabled actions are reachable without rebuilding the inspector');
 await page.keyboard.press('Escape');
 // Closing leaves the trigger focused. If the last action becomes unavailable
 // at that point, focus must return to the accordion toggle rather than body.
 assert.equal(await dynamicTrigger.evaluate(el=>el===document.activeElement),true);
 await dynamicItems.nth(1).evaluate(el=>el.disabled=true);
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger')?.hidden===true);
 assert.equal(await dynamicHost.locator('button').first().evaluate(el=>el===document.activeElement),true,
  'A focused trigger becoming unavailable returns focus to its accordion toggle');
 // CSS, aria-hidden and inert permission changes must behave like disabled.
 // These are common when a feature flag or responsive inspector mode changes.
 await page.evaluate(()=>{
  const style=document.createElement('style');
  style.textContent='#ux23-dynamic-menu-host .ux23-hidden-action{display:none}';
  document.head.append(style);
  const items=document.querySelectorAll('#ux23-dynamic-menu-host [role=menuitem]');
  items[0].removeAttribute('aria-disabled');items[1].disabled=false;
 });
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger').hidden);
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 assert.equal(await dynamicItems.nth(0).evaluate(el=>el===document.activeElement),true);
 await dynamicItems.nth(0).evaluate(el=>el.classList.add('ux23-hidden-action'));
 await page.waitForFunction(()=>document.activeElement?.textContent==='Segunda');
 await dynamicItems.nth(0).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'CSS-hidden menu actions cannot dispatch callbacks');
 await page.screenshot({path:'test-results/header-dynamic-css-hidden.png'});
 await dynamicItems.nth(0).evaluate(el=>el.classList.remove('ux23-hidden-action'));
 await dynamicItems.nth(1).evaluate(el=>el.setAttribute('aria-hidden','true'));
 await page.waitForFunction(()=>document.activeElement?.textContent==='Primeira');
 assert.equal(await dynamicItems.nth(1).evaluate(el=>getComputedStyle(el).display),'none',
  'ARIA-hidden actions must also disappear visually, not only from screen readers');
 await dynamicItems.nth(1).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicSecondCalled),undefined,
  'aria-hidden menu actions cannot dispatch callbacks');
 await dynamicItems.nth(0).evaluate(el=>el.setAttribute('inert',''));
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger').hidden);
 assert.equal(await dynamicHost.locator('button').first().evaluate(el=>el===document.activeElement),true,
  'When CSS/ARIA/inert remove all menu actions, keyboard focus returns to the toggle');
 await dynamicItems.nth(0).evaluate(el=>el.removeAttribute('inert'));
 await dynamicItems.nth(1).evaluate(el=>el.removeAttribute('aria-hidden'));
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger').hidden);
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 assert.equal(await dynamicItems.nth(0).evaluate(el=>el===document.activeElement),true,
  'Restored actions remain keyboard reachable without recreating the header');
 await dynamicItems.nth(0).evaluate(el=>el.hidden=true);
 await page.waitForFunction(()=>document.activeElement?.textContent==='Segunda');
 assert.equal(await dynamicItems.nth(0).evaluate(el=>getComputedStyle(el).display),'none',
  'Native hidden must override the menu button display:block styling');
 await dynamicItems.nth(0).evaluate(el=>el.hidden=false);
 // CSS on a parent can hide an action while getComputedStyle(button).display
 // still reports inline-block. This must revoke keyboard and click access,
 // and recover focus without closing a menu that still has other actions.
 await dynamicItems.nth(0).focus();
 await page.evaluate(()=>{
  const style=document.createElement('style');
  style.id='ux23-hidden-wrapper-style';
  style.textContent='#ux23-dynamic-menu-host .ux23-hidden-wrapper{display:none!important}';
  document.head.append(style);
  const first=document.querySelector('#ux23-dynamic-menu-host [role=menuitem]');
  const wrapper=document.createElement('div');
  wrapper.className='ux23-hidden-wrapper';
  first.before(wrapper);wrapper.append(first);
 });
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Segunda');
 assert.equal(await dynamicTrigger.getAttribute('aria-expanded'),'true',
  'Hiding a menuitem wrapper must preserve the open menu when a sibling is available');
 await dynamicItems.nth(0).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'An action hidden by a display:none ancestor must not execute a stale callback');
 await page.screenshot({path:'test-results/header-hidden-menu-wrapper-focus.png'});
 await page.evaluate(()=>{
  document.querySelector('#ux23-dynamic-menu-host .ux23-hidden-wrapper').classList.remove('ux23-hidden-wrapper');
 });
 await page.keyboard.press('Home');
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Primeira');
 assert.equal(await dynamicItems.nth(0).evaluate(el=>el===document.activeElement),true,
  'Restoring the ancestor must restore the action to keyboard navigation');
 // If a parent hides every action, the trigger must disappear and focus must
 // return to the accordion toggle. Restoring the group must reopen normally.
 await page.evaluate(()=>{
  const menu=document.querySelector('#ux23-dynamic-menu-host [role=menu]');
  const group=document.createElement('div');group.className='ux23-hidden-wrapper';
  group.id='ux23-hidden-all-wrapper';
  menu.prepend(group);
  for(const item of [...menu.querySelectorAll('[role=menuitem]')])group.append(item);
 });
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-dynamic-menu-host');
  return host.querySelector('.ds-header-menu-trigger').hidden&&
   !host.querySelector('[role=menu]').matches(':popover-open')&&
   document.activeElement===host.querySelector('button');
 });
 await page.screenshot({path:'test-results/header-hidden-all-menu-actions.png'});
 await page.evaluate(()=>document.querySelector('#ux23-hidden-all-wrapper').classList.remove('ux23-hidden-wrapper'));
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger').hidden);
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Primeira');
 await page.keyboard.press('Escape');
 // Disabled fieldsets propagate native disabled state to descendant buttons.
 // button.disabled alone is false in that case, but :disabled must exclude it.
 await page.evaluate(()=>{
  const host=document.querySelector('#ux23-dynamic-menu-host');
  const menu=host.querySelector('[role=menu]');
  const fieldset=document.createElement('fieldset');fieldset.id='ux23-disabled-fieldset';
  menu.prepend(fieldset);
  for(const item of [...menu.querySelectorAll('[role=menuitem]')])fieldset.append(item);
  fieldset.disabled=true;
 });
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger').hidden);
 assert.equal(await dynamicItems.nth(0).evaluate(el=>el.matches(':disabled')),true,
  'Fieldset-disabled actions must be unavailable even without a disabled attribute');
 await page.evaluate(()=>document.querySelector('#ux23-disabled-fieldset').disabled=false);
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host .ds-header-menu-trigger').hidden);
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Primeira');
 await page.keyboard.press('Escape');
 // A closed popover and a disabled ancestor must never expose actions through
 // delayed synthetic clicks. Popovers are top-layer elements: host visibility
 // and permissions can change without changing the menuitem itself.
 await dynamicItems.nth(0).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'A menuitem in a closed popover must not execute its callback');
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 await dynamicHost.evaluate(el=>el.setAttribute('aria-disabled','true'));
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 await dynamicItems.nth(0).evaluate(el=>el.click());
 await dynamicTrigger.evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'A disabled inspector host must revoke stale menuitem callbacks');
 assert.equal(await dynamicTrigger.getAttribute('aria-expanded'),'false',
  'Programmatic trigger clicks must not reopen a disabled inspector host');
 await dynamicHost.evaluate(el=>el.removeAttribute('aria-disabled'));
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 await dynamicHost.evaluate(el=>el.setAttribute('inert',''));
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 await dynamicItems.nth(0).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'Inert inspector hosts must revoke menu actions even when the popover is top-layer');
 await dynamicHost.evaluate(el=>el.removeAttribute('inert'));
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 // A fieldset can disable the trigger without setting its own disabled attr.
 // The observer must watch host ancestors, not just the menu subtree.
 await dynamicHost.evaluate(host=>{
  const fieldset=document.createElement('fieldset');fieldset.id='ux23-disabled-host-fieldset';
  host.before(fieldset);fieldset.append(host);fieldset.disabled=true;
 });
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 assert.equal(await dynamicTrigger.evaluate(el=>el.matches(':disabled')),true,
  'The inspector trigger inherits disabled state from its host fieldset');
 await dynamicItems.nth(0).evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'Inherited host fieldset disablement must revoke open menu actions');
 await dynamicHost.evaluate(host=>{
  const fieldset=host.parentElement;fieldset.disabled=false;
  fieldset.before(host);fieldset.remove();
 });
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 // CSS-hidden hosts must also dismiss top-layer popovers. Restoration must
 // leave the same component usable, without rebuilding the inspector.
 await dynamicHost.evaluate(el=>el.style.display='none');
 await page.waitForFunction(()=>!document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 await dynamicHost.evaluate(el=>el.style.removeProperty('display'));
 await dynamicTrigger.focus();await dynamicTrigger.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux23-dynamic-menu-host [role=menu]')?.matches(':popover-open'));
 await page.screenshot({path:'test-results/header-host-permissions-restored.png'});
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{
  window.__ux23RemovedHeaderAction=document.querySelector('#ux23-dynamic-menu-host [role=menuitem]');
 });
 await dynamicHost.evaluate(el=>el.remove());
 await page.evaluate(()=>window.__ux23RemovedHeaderAction.click());
 assert.equal(await page.evaluate(()=>window.dynamicMenuSelected),undefined,
  'A menuitem from a removed inspector header must never execute');
 await page.evaluate(()=>delete window.__ux23RemovedHeaderAction);
 await page.locator('#ux23-hidden-wrapper-style').evaluate(el=>el.remove());
 // Feature flags may remove menu actions from the DOM entirely (not merely
 // mark them disabled). A detached item must not remain in keyboard order,
 // trigger callbacks, or strand focus when the final action disappears.
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const host=document.createElement('div');host.id='ux23-detached-menu-host';host.className='design-inspector';
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Ações removíveis';
  host.append(createInspectorHeader({toggle,menuVisibility:'always',menuItems:[
   {label:'Removível A',onSelect:()=>window.__ux23DetachedAction='A'},
   {label:'Removível B',onSelect:()=>window.__ux23DetachedAction='B'},
   {label:'Removível C',onSelect:()=>window.__ux23DetachedAction='C'}
  ]}));
  document.body.append(host);
 });
 const detachedHost=page.locator('#ux23-detached-menu-host');
 const detachedTrigger=detachedHost.locator('.ds-header-menu-trigger');
 await detachedTrigger.focus();await detachedTrigger.press('Enter');
 await page.waitForFunction(()=>document.activeElement?.textContent==='Removível A');
 await page.evaluate(()=>{
  const host=document.querySelector('#ux23-detached-menu-host');
  window.__ux23DetachedButtons=[...host.querySelectorAll('[role=menuitem]')];
  window.__ux23DetachedButtons[0].remove();
 });
 await page.waitForFunction(()=>document.activeElement?.textContent==='Removível B');
 await page.evaluate(()=>window.__ux23DetachedButtons[0].click());
 assert.equal(await page.evaluate(()=>window.__ux23DetachedAction),undefined,
  'A detached menuitem must never execute its stale callback');
 await page.evaluate(()=>window.__ux23DetachedButtons[1].remove());
 await page.waitForFunction(()=>document.activeElement?.textContent==='Removível C');
 await page.screenshot({path:'test-results/header-removed-menu-actions-focus.png'});
 await page.evaluate(()=>window.__ux23DetachedButtons[2].remove());
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-detached-menu-host');
  return host.querySelector('.ds-header-menu-trigger').hidden&&
   document.activeElement===host.querySelector('button')&&
   !host.querySelector('[role=menu]').matches(':popover-open');
 });
 await page.evaluate(()=>{
  const host=document.querySelector('#ux23-detached-menu-host');
  host.querySelector('[role=menu]').append(window.__ux23DetachedButtons[0]);
 });
 await page.waitForFunction(()=>!document.querySelector('#ux23-detached-menu-host .ds-header-menu-trigger').hidden);
 await detachedTrigger.focus();await detachedTrigger.press('Enter');
 await page.waitForFunction(()=>document.activeElement?.textContent==='Removível A');
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>window.__ux23DetachedAction),'A',
  'A reinserted action is available again without recreating the header');
 await detachedHost.evaluate(el=>el.remove());
 await page.evaluate(()=>{delete window.__ux23DetachedButtons;delete window.__ux23DetachedAction;});
 // Large action menus need typeahead, accent-insensitive matching, repeat-key
 // cycling and page navigation without breaking IME composition.
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const host=document.createElement('div');host.id='ux23-typeahead-host';host.className='design-inspector';
  host.style.cssText='position:fixed;top:4px;right:4px;width:220px;z-index:2147483000';
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Menu longo';
  const labels=['Alpha','Árvore','Beta','Bravo','Brisa','Ritmo',...Array.from({length:18},(_,i)=>'Item '+i)];
  host.append(createInspectorHeader({toggle,menuVisibility:'always',menuItems:labels.map(label=>({label,onSelect:()=>{window.__ux23TypeaheadSelected=label;}}))}));
  document.body.append(host);
 });
 await page.setViewportSize({width:390,height:320});
 const typeHost=page.locator('#ux23-typeahead-host');
 const typeTrigger=typeHost.locator('.ds-header-menu-trigger');
 await typeTrigger.focus();await typeTrigger.press('Enter');
 const focusedLabel=()=>page.evaluate(()=>document.activeElement?.textContent?.trim());
 assert.equal(await focusedLabel(),'Alpha');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Beta');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Bravo','Repeated letters cycle matching actions');
 await page.waitForTimeout(750);
 await page.keyboard.press('b');await page.keyboard.press('r');await page.keyboard.press('i');
 assert.equal(await focusedLabel(),'Brisa','Multi-character typeahead selects matching action');
 await page.waitForTimeout(750);
 await page.keyboard.press('a');assert.equal(await focusedLabel(),'Alpha');
 await page.keyboard.press('a');assert.equal(await focusedLabel(),'Árvore','Diacritics do not block typeahead');
 await page.screenshot({path:'test-results/header-typeahead-focused.png'});
 await page.keyboard.press('PageDown');assert.equal(await focusedLabel(),'Item 0');
 await page.keyboard.press('PageUp');assert.equal(await focusedLabel(),'Árvore');
 // Typeahead must restart after explicit keyboard navigation, even within
 // its 700ms timeout. Otherwise "b" + ArrowDown + "r" wrongly finds Brisa.
 await page.waitForTimeout(750);
 await page.keyboard.press('Home');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Beta');
 await page.keyboard.press('ArrowDown');assert.equal(await focusedLabel(),'Bravo');
 await page.keyboard.press('r');assert.equal(await focusedLabel(),'Ritmo',
  'Arrow navigation clears stale typeahead prefixes before the next printable key');
 await page.screenshot({path:'test-results/header-typeahead-after-arrow.png'});
 // Live permission changes must be excluded from typeahead just as they are
 // from Arrow/Home/End navigation and native click dispatch.
 await typeHost.getByRole('menuitem',{name:'Brisa'}).evaluate(el=>el.disabled=true);
 await page.waitForTimeout(750);
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Beta');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Bravo');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Beta',
  'Repeated-key typeahead skips dynamically disabled actions');
 // Keep focus inside the menu without invoking native scrollIntoView,
 // which can scroll the document or an unrelated inspector panel.
 await typeHost.evaluate(host=>{
  for(const item of host.querySelectorAll('[role=menuitem]')){
   item.scrollIntoView=()=>{throw new Error('Menu focus must scroll only its own popover');};
  }
 });
 const outerScrollBefore=await page.evaluate(()=>({
  page:window.scrollY,inspector:document.querySelector('#inspector-themes')?.scrollTop||0
 }));
 await page.keyboard.press('End');assert.equal(await focusedLabel(),'Item 17');
 assert.ok(await typeHost.getByRole('menu').evaluate(el=>el.scrollTop)>0,
  'Keyboard navigation scrolls the focused action into view on a short screen');
 assert.deepEqual(await page.evaluate(()=>({
  page:window.scrollY,inspector:document.querySelector('#inspector-themes')?.scrollTop||0
 })),outerScrollBefore,'Navigating a long menu must not scroll outer panels or the page');
 await page.screenshot({path:'test-results/header-typeahead-scroll-contained.png'});
 // A permission change must keep a keyboard user near their position in a
 // long menu, not unexpectedly return to the first action.
 await typeHost.getByRole('menuitem',{name:'Item 17'}).evaluate(el=>el.disabled=true);
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Item 16');
 assert.equal(await focusedLabel(),'Item 16','Disabling the last action focuses its nearest predecessor');
 await typeHost.getByRole('menuitem',{name:'Item 16'}).evaluate(el=>el.disabled=true);
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Item 15');
 assert.equal(await focusedLabel(),'Item 15','Repeated permission updates preserve the local keyboard position');
 await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
 assert.equal(await focusedLabel(),'Árvore');
 await typeHost.getByRole('menuitem',{name:'Árvore'}).evaluate(el=>el.setAttribute('aria-disabled','true'));
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Beta');
 assert.equal(await focusedLabel(),'Beta','Disabling a middle action focuses the next available action');
 await page.screenshot({path:'test-results/header-typeahead-permission-neighbor-390.png'});
 // High text zoom can make one menu item taller than the scrollport.
 // Home must reveal its leading edge without alternating top/bottom on
 // subsequent keyboard events or layout updates.
 const oversizedMenuItem=typeHost.getByRole('menuitem',{name:'Alpha'});
 await oversizedMenuItem.evaluate(el=>{el.style.height='400px';});
 await page.keyboard.press('Home');
 await page.waitForFunction(()=>{
  const menu=document.querySelector('#ux23-typeahead-host [role=menu]');
  return menu&&menu.scrollTop<2;
 });
 for(let attempt=0;attempt<3;attempt++){
  await page.keyboard.press('Home');
  assert.ok(await typeHost.getByRole('menu').evaluate(el=>el.scrollTop)<2,
   'Oversized menu actions must not oscillate between their top and bottom edges');
 }
 await page.screenshot({path:'test-results/header-typeahead-oversized-action-390.png'});
 await oversizedMenuItem.evaluate(el=>{el.style.height='';});
 assert.equal(await page.evaluate(()=>{
  const focused=document.activeElement;
  focused.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true,isComposing:true}));
  focused.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true,keyCode:229}));
  return document.activeElement===focused;
 }),true,'IME composition must not trigger menu typeahead');
 assert.deepEqual(await page.evaluate(()=>{
  const focused=document.activeElement,menu=focused.closest('[role=menu]');
  for(const key of ['Escape','ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Tab']){
   focused.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,isComposing:true}));
   focused.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,keyCode:229}));
  }
  return {focused:document.activeElement===focused,open:menu.matches(':popover-open')};
 }),{focused:true,open:true},'IME navigation and Escape must not dismiss the menu or move focus');
 // Some browsers emit a plain Escape/Arrow keydown during an active IME
 // session (isComposing=false, keyCode!=229). The lifecycle is authoritative.
 assert.deepEqual(await page.evaluate(()=>{
  const focused=document.activeElement,menu=focused.closest('[role=menu]');
  focused.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'あ'}));
  for(const key of ['Escape','ArrowDown','Home','End','PageDown','PageUp','Tab','b']){
   focused.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
  }
  const state={focused:document.activeElement===focused,open:menu.matches(':popover-open')};
  focused.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'あ'}));
  return state;
 }),{focused:true,open:true},'IME lifecycle protects menu focus even without keydown composition flags');
 // Dispatching synthetic keydown alone cannot prove native browser behavior:
 // Escape dismisses popovers, Tab moves focus, and Enter activates buttons.
 // Exercise real keyboard defaults during an active IME lifecycle.
 await page.evaluate(()=>{
  document.activeElement.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'あ'}));
 });
 for(const key of ['Escape','Tab','Shift+Tab','Enter']){
  await page.keyboard.press(key);
  assert.deepEqual(await page.evaluate(()=>({
   open:document.querySelector('#ux23-typeahead-host [role=menu]')?.matches(':popover-open'),
   focused:document.activeElement?.closest('#ux23-typeahead-host [role=menu]')!==null,
   selected:window.__ux23TypeaheadSelected??null
  })),{open:true,focused:true,selected:null},
  'Real '+key+' during IME must not dismiss, move focus or execute an action');
 }
 await page.screenshot({path:'test-results/header-ime-native-keys-390.png'});
 await page.evaluate(()=>{
  document.activeElement.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'あ'}));
 });
 await page.keyboard.press('Home');assert.equal(await focusedLabel(),'Alpha',
  'Keyboard navigation resumes after compositionend');
 await page.screenshot({path:'test-results/header-typeahead-composition-lifecycle.png'});
 await page.screenshot({path:'test-results/header-typeahead-ime.png'});
 await page.keyboard.press('Escape');
 assert.equal(await typeTrigger.evaluate(el=>el===document.activeElement),true);
 assert.deepEqual(await typeHost.locator('[role=menuitem]').evaluateAll(items=>[...new Set(items.map(item=>item.tabIndex))]),[-1],
  'A menu is one Tab stop: its actions are reached by arrows/typeahead');
 await typeTrigger.focus();await typeTrigger.press('Enter');
 await page.keyboard.press('Shift+Tab');
 assert.equal(await typeHost.locator('button').first().evaluate(el=>el===document.activeElement),true,
  'Shift+Tab exits to the preceding accordion toggle, not another menu action');
 assert.equal(await typeHost.getByRole('menu').isVisible(),false);
 await typeTrigger.focus();await typeTrigger.press('Enter');
 await page.keyboard.press('Tab');
 assert.deepEqual(await page.evaluate(()=>({
  outside:!document.activeElement?.closest('[role=menu]'),
  notBody:document.activeElement!==document.body,
  closed:!document.querySelector('#ux23-typeahead-host [role=menu]').matches(':popover-open')
 })),{outside:true,notBody:true,closed:true},
 'Tab exits the menu to the next page control without stranding focus on body');
 await page.screenshot({path:'test-results/header-typeahead-tab-exit.png'});
 await typeHost.evaluate(el=>el.remove());
 await page.setViewportSize({width:1024,height:900});

 // Exercise the top-layer menu against a genuinely short, mobile viewport.
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const host=document.createElement('div');host.id='ux23-edge-menu-host';host.className='design-inspector';
  host.style.cssText='position:fixed;bottom:4px;right:4px;width:240px;z-index:2147483000;';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='ds-accordion-toggle';
  toggle.setAttribute('aria-label','Ações no limite da tela');toggle.textContent='Limite';
  host.append(createInspectorHeader({toggle,menuVisibility:'always',menuItems:Array.from({length:18},(_,i)=>({label:'Opção '+i,onSelect:()=>{}}))}));
  document.body.append(host);
 });
 for(const viewport of [{width:390,height:320},{width:1024,height:420}]){
  await page.setViewportSize(viewport);
  const edgeTrigger=page.locator('#ux23-edge-menu-host .ds-header-menu-trigger');
  // The app topbar can visually overlap a synthetic fixed fixture at 320px;
  // keyboard activation exercises the actual trigger without a false pointer interception.
  await edgeTrigger.focus();await edgeTrigger.press('Enter');
  // Popover dimensions can settle one frame after a viewport CSS change.
  // Validate the final anchored geometry, not a transient pre-layout rect.
  await page.waitForFunction(()=>{
   const b=document.querySelector('#ux23-edge-menu-host [role=menu]')?.getBoundingClientRect();
   return b&&b.width>0&&b.height>0&&b.top>=7&&b.left>=7&&
    b.bottom<=innerHeight-7&&b.right<=innerWidth-7;
  });
  // ResizeObserver and visualViewport can settle on the next animation
  // frame. Require a stable post-layout rectangle, not a transient pass.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForFunction(()=>{
   const b=document.querySelector('#ux23-edge-menu-host [role=menu]')?.getBoundingClientRect();
   return b&&b.width>0&&b.height>0&&b.top>=7&&b.left>=7&&
    b.bottom<=innerHeight-7&&b.right<=innerWidth-7;
  });
  const bounds=await page.locator('#ux23-edge-menu-host [role=menu]').boundingBox();
  assert.ok(bounds&&bounds.x>=7&&bounds.y>=7&&bounds.x+bounds.width<=viewport.width-7&&bounds.y+bounds.height<=viewport.height-7,
   'Menu must stay within the settled viewport: '+JSON.stringify({viewport,bounds}));
  if(viewport.width===390){
   // Browser chrome may resize a viewport while the popover is still open.
   await page.setViewportSize({width:390,height:250});
   await page.waitForFunction(()=>{
    const b=document.querySelector('#ux23-edge-menu-host [role=menu]')?.getBoundingClientRect();
    return b&&b.top>=7&&b.bottom<=innerHeight-7&&b.left>=7&&b.right<=innerWidth-7;
   });
   await page.screenshot({path:'test-results/header-edge-menu-resized-390.png'});
   await page.setViewportSize(viewport);
  }
  await page.screenshot({path:`test-results/header-edge-menu-${viewport.width}.png`});
  await page.keyboard.press('Escape');
  // Native popover toggle is dispatched asynchronously after hidePopover().
  await page.waitForFunction(()=>document.querySelector('#ux23-edge-menu-host .ds-header-menu-trigger')?.getAttribute('aria-expanded')==='false');
 }

 // Mobile keyboards and pinch zoom change the visual viewport independently
 // from innerHeight. Simulate both a smaller rectangle and its scroll offset.
 await page.setViewportSize({width:390,height:320});
 await page.evaluate(()=>{
  window.__ux23OriginalVisualViewport=Object.getOwnPropertyDescriptor(window,'visualViewport');
  const fake=new EventTarget();
  Object.assign(fake,{offsetLeft:24,offsetTop:28,width:330,height:220});
  Object.defineProperty(window,'visualViewport',{configurable:true,value:fake});
  window.__ux23FakeViewport=fake;
 });
 const visualTrigger=page.locator('#ux23-edge-menu-host .ds-header-menu-trigger');
 await visualTrigger.focus();await visualTrigger.press('Enter');
 const withinVisualViewport=()=>page.waitForFunction(()=>{
  const menu=document.querySelector('#ux23-edge-menu-host [role=menu]');
  const rect=menu?.getBoundingClientRect(),v=window.visualViewport;
  return rect&&menu.matches(':popover-open')&&rect.width>0&&rect.height>0&&
   rect.left>=v.offsetLeft+7&&rect.right<=v.offsetLeft+v.width-7&&
   rect.top>=v.offsetTop+7&&rect.bottom<=v.offsetTop+v.height-7;
 });
 await withinVisualViewport();
 await page.screenshot({path:'test-results/header-edge-menu-visual-390.png'});
 await page.evaluate(()=>{
  const v=window.__ux23FakeViewport;
  Object.assign(v,{offsetLeft:45,offsetTop:60,width:260,height:170});
  v.dispatchEvent(new Event('scroll'));
 });
 await withinVisualViewport();
 await page.screenshot({path:'test-results/header-edge-menu-visual-scrolled-390.png'});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#ux23-edge-menu-host .ds-header-menu-trigger')?.getAttribute('aria-expanded')==='false');
 await page.evaluate(()=>{
  const descriptor=window.__ux23OriginalVisualViewport;
  if(descriptor)Object.defineProperty(window,'visualViewport',descriptor);
  else delete window.visualViewport;
  delete window.__ux23FakeViewport;
  delete window.__ux23OriginalVisualViewport;
 });
 // Synthetic fixed fixture must not intercept the real inspector's hover test.
 await page.locator('#ux23-edge-menu-host').evaluate(el=>el.remove());
 for(const width of [1024,390]){
  await page.setViewportSize({width,height:900});await group.hover();
  const geometry=await group.evaluate(el=>{const title=el.querySelector('.ds-accordion-title').getBoundingClientRect(),actions=el.querySelector('.ds-choice-actions').getBoundingClientRect(),menu=el.querySelector('.ds-header-menu-trigger').getBoundingClientRect(),chevron=el.querySelector('.ds-accordion-chevron').getBoundingClientRect();return {ordered:title.right<=actions.left&&actions.right<=menu.left&&menu.right<=chevron.left,overflow:el.scrollWidth>el.clientWidth};});
  assert.equal(geometry.ordered,true);assert.equal(geometry.overflow,false);
  await page.locator('#toast.show').waitFor({state:'hidden'});
  await page.locator('.design-inspector').first().screenshot({path:`test-results/header-pattern-${width}.png`});
 }
 console.log('Header layout, accessible menu linkage, keyboard/IME, dynamic actions, visual viewport offsets, screenshots and Escape passed.');
}finally{await browser.close();}
