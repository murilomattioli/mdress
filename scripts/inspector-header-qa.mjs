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
 await page.keyboard.press('Escape');
 await dynamicHost.evaluate(el=>el.remove());
 // Large action menus need typeahead, accent-insensitive matching, repeat-key
 // cycling and page navigation without breaking IME composition.
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const host=document.createElement('div');host.id='ux23-typeahead-host';host.className='design-inspector';
  host.style.cssText='position:fixed;top:4px;right:4px;width:220px;z-index:2147483000';
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Menu longo';
  const labels=['Alpha','Árvore','Beta','Bravo','Brisa','Ritmo',...Array.from({length:18},(_,i)=>'Item '+i)];
  host.append(createInspectorHeader({toggle,menuVisibility:'always',menuItems:labels.map(label=>({label,onSelect:()=>{}}))}));
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
