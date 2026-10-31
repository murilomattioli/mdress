import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/inspector-entities',{recursive:true});
const browser=await chromium.launch();
const mapping={document:['fontChoice','fontSize','lineHeight','titleScale','accentColor','textColor','backgroundColor','bgKind','bgSecondary','bgAngle','bgPatternSize','bgOpacity','meshControls','backgroundGallery'],content:['sectionStyleTarget','bottomSectionEnabled','selectedSectionBreak','sectionStyleGallery','markdownElementTarget','previewPropertyPanel','sectionGapEm','sectionRule'],page:['paperSize','marginMm','showPageGuides'],themes:['resumeTheme','themeRecipeGallery','savedThemePicker','shuffleTheme','shuffleColors','agentBrief','agentJSON','applyAgentTheme','resetResumeTheme']};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4174');await page.locator('#designToggle').click();
 assert.deepEqual(await page.locator('[data-inspector-tab]').evaluateAll(tabs=>tabs.map(t=>t.dataset.inspectorTab)),Object.keys(mapping));
 for(const [tab,ids] of Object.entries(mapping))for(const id of ids){assert.equal(await page.locator('#'+id).count(),1);assert.equal(await page.locator('#inspector-'+tab+' #'+id).count(),1,id);}
 await page.locator('[data-inspector-tab=document]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-inspector-tab=content]').getAttribute('aria-selected'),'true');
 const select=page.locator('#sectionStyleTarget');await select.evaluate(el=>{el.value=[...el.options].find(o=>o.value!=='all'&&!o.value.startsWith('level:')).value;el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await page.locator('#bottomSectionTarget').inputValue(),await select.inputValue());assert.equal(await page.locator('#bottomSectionEnabled').isDisabled(),false);
 await page.locator('#selectedSectionBreak').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
 const sectionId=await select.inputValue();assert.equal(await page.locator('#pageBreakList button').filter({has:page.locator('span')}).evaluateAll((items,id)=>items.find(x=>x.dataset.sectionBreakId===id)?.getAttribute('aria-pressed'),sectionId),'true');
 await select.evaluate(el=>{el.value='all';el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await page.locator('#bottomSectionEnabled').isDisabled(),true);
 const element=page.locator('#pageStack h1[data-md-element-id]').first();await element.evaluate(el=>el.click());
 assert.equal(await page.locator('[data-inspector-tab=content]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#previewPropertyPanel').isVisible(),true);
 const size=page.locator('[data-element-property=fontSize]');await size.fill('28');await size.dispatchEvent('change');assert.equal(await element.evaluate(el=>el.style.fontSize),'28px');
 await page.screenshot({path:'test-results/inspector-entities/element-context.png'});
 await page.locator('[data-composer-mode=section]').click();
 for(const kind of ['solid','gradient','mesh']){
  await page.locator('[data-inspector-tab=document]').click();
  await page.locator('#bgKind').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},kind);
  const angleVisible=await page.locator('#bgAngle').evaluate(el=>!el.closest('.property-row').classList.contains('hidden'));
  assert.equal(angleVisible,kind==='gradient');
 }
 await page.locator('#bgKind').evaluate(el=>{el.value='solid';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('#toast.show').waitFor({state:'hidden'});
 for(const theme of ['mdress','graphite'])for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await page.evaluate(value=>document.body.dataset.theme=value,theme);
  for(const tab of Object.keys(mapping)){
   await page.locator('[data-inspector-tab='+tab+']').click();
   await page.locator('.inspector-scroll').evaluate(el=>el.scrollTop=0);
   assert.equal(await page.locator('#inspector-'+tab).evaluate(el=>el.scrollWidth>el.clientWidth+2),false,tab+' overflow');
   await page.screenshot({path:`test-results/inspector-entities/${theme}-${width}-${tab}.png`});
  }
 }
 await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Salvo localmente');await page.reload();await page.waitForFunction(()=>document.querySelector('#pageStack h1')?.style.fontSize==='28px');
 assert.deepEqual(errors,[]);
 console.log('Four entity tabs, unique field ownership, keyboard navigation, section context/breaks, inline element properties, conditional backgrounds, persistence and 24 responsive captures passed.');
}finally{await browser.close();}
