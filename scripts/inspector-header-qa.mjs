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
  const labels=['Alpha','Árvore','Beta','Bravo','Brisa','Omega',...Array.from({length:18},(_,i)=>'Item '+i)];
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
 // Live permission changes must be excluded from typeahead just as they are
 // from Arrow/Home/End navigation and native click dispatch.
 await typeHost.getByRole('menuitem',{name:'Brisa'}).evaluate(el=>el.disabled=true);
 await page.waitForTimeout(750);
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Beta');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Bravo');
 await page.keyboard.press('b');assert.equal(await focusedLabel(),'Beta',
  'Repeated-key typeahead skips dynamically disabled actions');
 await page.keyboard.press('End');assert.equal(await focusedLabel(),'Item 17');
 assert.ok(await typeHost.getByRole('menu').evaluate(el=>el.scrollTop)>0,
  'Keyboard navigation scrolls the focused action into view on a short screen');
 assert.equal(await page.evaluate(()=>{
  const focused=document.activeElement;
  focused.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true,isComposing:true}));
  focused.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true,keyCode:229}));
  return document.activeElement===focused;
 }),true,'IME composition must not trigger menu typeahead');
 await page.keyboard.press('Escape');
 assert.equal(await typeTrigger.evaluate(el=>el===document.activeElement),true);
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
  const bounds=await page.locator('#ux23-edge-menu-host [role=menu]').boundingBox();
  assert.ok(bounds&&bounds.x>=7&&bounds.y>=7&&bounds.x+bounds.width<=viewport.width-7&&bounds.y+bounds.height<=viewport.height-7,
   'Menu must stay within the viewport: '+JSON.stringify({viewport,bounds}));
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

 // Synthetic fixed fixture must not intercept the real inspector's hover test.
 await page.locator('#ux23-edge-menu-host').evaluate(el=>el.remove());
 for(const width of [1024,390]){
  await page.setViewportSize({width,height:900});await group.hover();
  const geometry=await group.evaluate(el=>{const title=el.querySelector('.ds-accordion-title').getBoundingClientRect(),actions=el.querySelector('.ds-choice-actions').getBoundingClientRect(),menu=el.querySelector('.ds-header-menu-trigger').getBoundingClientRect(),chevron=el.querySelector('.ds-accordion-chevron').getBoundingClientRect();return {ordered:title.right<=actions.left&&actions.right<=menu.left&&menu.right<=chevron.left,overflow:el.scrollWidth>el.clientWidth};});
  assert.equal(geometry.ordered,true);assert.equal(geometry.overflow,false);
  await page.locator('#toast.show').waitFor({state:'hidden'});
  await page.locator('.design-inspector').first().screenshot({path:`test-results/header-pattern-${width}.png`});
 }
 console.log('Header layout, accessible menu linkage, keyboard wrap, empty actions, viewport bounds, screenshots and Escape passed.');
}finally{await browser.close();}
