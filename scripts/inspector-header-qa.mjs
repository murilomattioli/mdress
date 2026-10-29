import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4174');await page.locator('#designToggle').click();
 await page.locator('[data-inspector-tab=themes]').click();
 for(const button of await page.locator('#inspector-themes .ds-accordion-toggle').all())if(await button.getAttribute('aria-expanded')==='true')await button.click();
 const group=page.locator('.ds-accordion').filter({has:page.locator('#themeRecipeGallery')});
 await page.evaluate(async()=>{
  const {createInspectorHeader}=await import('/design-system/inspector-header.js');
  const old=document.querySelector('#themeRecipeGallery').closest('.ds-accordion').querySelector('.ds-accordion-header');
  old.replaceWith(createInspectorHeader({toggle:old.querySelector('.ds-accordion-toggle'),actions:old.querySelector('.ds-choice-actions'),menuItems:[{label:'Indisponível',disabled:true,onSelect:()=>{}},{label:'Ação de teste',onSelect:()=>window.headerActionCalled=true}]}));
 });
 const trigger=group.locator('.ds-header-menu-trigger');
 await page.mouse.move(0,0);assert.equal(await trigger.evaluate(el=>getComputedStyle(el).opacity),'0');
 await trigger.focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ds-header-menu-trigger')).opacity==='1');
 await trigger.press('Enter');await page.getByRole('menu').waitFor();
 assert.equal(await page.getByRole('menuitem',{name:'Indisponível'}).isDisabled(),true);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.headerActionCalled),true);
 await trigger.click();await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
 for(const width of [1024,390]){
  await page.setViewportSize({width,height:900});await group.hover();
  const geometry=await group.evaluate(el=>{const title=el.querySelector('.ds-accordion-title').getBoundingClientRect(),actions=el.querySelector('.ds-choice-actions').getBoundingClientRect(),menu=el.querySelector('.ds-header-menu-trigger').getBoundingClientRect(),chevron=el.querySelector('.ds-accordion-chevron').getBoundingClientRect();return {ordered:title.right<=actions.left&&actions.right<=menu.left&&menu.right<=chevron.left,overflow:el.scrollWidth>el.clientWidth};});
  assert.equal(geometry.ordered,true);assert.equal(geometry.overflow,false);
  await page.locator('#toast.show').waitFor({state:'hidden'});
  await page.locator('.design-inspector').screenshot({path:`test-results/header-pattern-${width}.png`});
 }
 console.log('Header order, optional menu, hover/focus, disabled item, keyboard selection and Escape passed.');
}finally{await browser.close();}
