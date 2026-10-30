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
  const bounds=await page.locator('#ux23-edge-menu-host [role=menu]').boundingBox();
  assert.ok(bounds&&bounds.x>=7&&bounds.y>=7&&bounds.x+bounds.width<=viewport.width-7&&bounds.y+bounds.height<=viewport.height-7,
   'Menu must stay within the viewport: '+JSON.stringify({viewport,bounds}));
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
