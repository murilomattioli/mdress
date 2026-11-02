import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Regression: dir= changes are not necessarily accompanied by style/class,
// resize, or scroll events. Overflow arrows must update on their own.
const output='test-results/ux-audit';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:760},reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.evaluate(async()=>{
  const {attachToolbarOverflow}=await import('/toolbar-overflow.js');
  const host=document.createElement('section');
  host.id='ux23-dynamic-dir';host.dir='rtl';host.className='editor-panel';
  host.style.cssText='position:fixed;top:100px;left:12px;width:320px;padding:8px;z-index:2147483640;background:var(--ds-panel,white)';
  const bar=document.createElement('div');
  bar.className='markdown-toolbar';
  bar.style.cssText='direction:inherit;display:flex;flex-wrap:nowrap;overflow-x:auto;width:100%;min-height:58px';
  for(let i=0;i<8;i++){
   const action=document.createElement('button');
   action.type='button';action.textContent='Comando '+(i+1);
   action.style.cssText='flex:0 0 110px;min-width:110px';
   bar.append(action);
  }
  host.append(bar);document.body.append(host);
  window.__ux23DynamicDirDispose=attachToolbarOverflow(bar);
 });
 const host=page.locator('#ux23-dynamic-dir');
 const bar=host.locator('.markdown-toolbar');
 const arrows=host.locator('.toolbar-scroll-button');
 assert.equal(await arrows.count(),2);
 const expectArrows=async(direction,canLeft,canRight)=>{
  await page.waitForFunction(([direction,canLeft,canRight])=>{
   const host=document.querySelector('#ux23-dynamic-dir');
   const bar=host?.querySelector('.markdown-toolbar');
   const [left,right]=host?.querySelectorAll('.toolbar-scroll-button')||[];
   return bar&&left&&right&&getComputedStyle(bar).direction===direction&&
    bar.scrollWidth>bar.clientWidth+2&&
    !left.hidden&&!right.hidden&&left.disabled===!canLeft&&right.disabled===!canRight;
  },[direction,canLeft,canRight],{timeout:3000});
 };
 await expectArrows('rtl',true,false);
 await host.screenshot({path:output+'/toolbar-dir-inherited-rtl-390.png',animations:'disabled'});

 // Focusing the left arrow before a direction switch must not strand focus
 // on a newly disabled button (or on body).
 await arrows.first().focus();
 await host.evaluate(el=>{el.dir='ltr';});
 await expectArrows('ltr',false,true);
 assert.equal(await arrows.last().evaluate(el=>el===document.activeElement),true,
  'Changing ancestor dir must hand focus from disabled left arrow to right arrow');
 await host.screenshot({path:output+'/toolbar-dir-inherited-ltr-390.png',animations:'disabled'});

 await host.evaluate(el=>{el.dir='rtl';});
 await expectArrows('rtl',true,false);
 assert.equal(await arrows.first().evaluate(el=>el===document.activeElement),true,
  'Switching back to RTL must hand focus from disabled right arrow to left arrow');
 await host.screenshot({path:output+'/toolbar-dir-restored-rtl-390.png',animations:'disabled'});

 // Direct dir changes on the toolbar itself must be observed too. The
 // inherited-direction override is removed to let the HTML dir hint apply.
 await bar.evaluate(el=>{el.style.direction='';el.dir='ltr';});
 await expectArrows('ltr',false,true);
 await bar.evaluate(el=>{el.dir='rtl';});
 await expectArrows('rtl',true,false);
 await host.screenshot({path:output+'/toolbar-dir-local-rtl-390.png',animations:'disabled'});

 // A live click still scrolls physically left in RTL after the toggles.
 await arrows.first().click();
 await page.waitForFunction(()=>{
  const bar=document.querySelector('#ux23-dynamic-dir .markdown-toolbar');
  return bar&&bar.scrollLeft < -20;
 },null,{timeout:3000});
 assert.deepEqual(errors,[],'Dynamic direction changes must not cause page errors');
 console.log('Toolbar dynamic dir QA passed: inherited/local dir, focus handoff, physical RTL scrolling; 4 screenshots.');
 await page.evaluate(()=>{window.__ux23DynamicDirDispose?.();document.querySelector('#ux23-dynamic-dir')?.remove();});
}finally{
 await browser.close();
}
