import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// An oversized focused action must reveal its logical leading edge in RTL,
// and keep the same scroll position after repeated splitter/resize events.
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
  host.id='ux23-oversized-rtl';host.className='editor-panel';
  host.style.cssText='position:fixed;top:110px;left:12px;width:220px;padding:8px;z-index:2147483640;background:var(--ds-panel,white)';
  const bar=document.createElement('div');
  bar.className='markdown-toolbar';
  bar.style.cssText='direction:rtl;display:flex;flex-wrap:nowrap;overflow-x:auto;width:100%;min-height:58px';
  for(let i=0;i<5;i++){
   const action=document.createElement('button');
   action.type='button';action.textContent='Action '+i;
   action.style.cssText='flex:0 0 110px;min-width:110px';
   bar.append(action);
  }
  const oversized=document.createElement('button');
  oversized.type='button';oversized.id='ux23-oversized-rtl-action';
  oversized.textContent='Wide focused action';
  oversized.style.cssText='flex:0 0 280px;width:280px;min-width:280px';
  bar.append(oversized);host.append(bar);document.body.append(host);
  window.__ux23OversizedRtlDispose=attachToolbarOverflow(bar);
 });
 const host=page.locator('#ux23-oversized-rtl');
 const bar=host.locator('.markdown-toolbar');
 const oversized=host.locator('#ux23-oversized-rtl-action');
 await oversized.evaluate(el=>el.focus({preventScroll:true}));
 const resetAndReveal=async(direction)=>{
  await bar.evaluate((el,dir)=>{
   el.style.direction=dir;
   el.scrollLeft=0;
   document.dispatchEvent(new Event('studio:resized'));
  },direction);
  await page.waitForFunction(dir=>{
   const bar=document.querySelector('#ux23-oversized-rtl .markdown-toolbar');
   const action=document.querySelector('#ux23-oversized-rtl-action');
   if(!bar||!action||document.activeElement!==action)return false;
   const viewport=bar.getBoundingClientRect(),rect=action.getBoundingClientRect();
   return getComputedStyle(bar).direction===dir&&
    (dir==='rtl'?Math.abs(rect.right-(viewport.right-6))<=3:
     Math.abs(rect.left-(viewport.left+6))<=3);
  },direction,{timeout:4000});
 };
 const geometry=()=>bar.evaluate(el=>{
  const item=document.querySelector('#ux23-oversized-rtl-action');
  const r=item.getBoundingClientRect(),v=el.getBoundingClientRect();
  return {scrollLeft:el.scrollLeft,rect:{left:r.left,right:r.right},
   viewport:{left:v.left,right:v.right},direction:getComputedStyle(el).direction};
 });
 await resetAndReveal('rtl');
 const rtl=await geometry();
 assert.ok(rtl.scrollLeft < -100,'RTL focused oversized action must scroll toward the left: '+JSON.stringify(rtl));
 await host.screenshot({path:output+'/toolbar-oversized-leading-rtl-390.png',animations:'disabled'});
 for(let i=0;i<3;i++){
  await bar.evaluate(()=>document.dispatchEvent(new Event('studio:resized')));
  await page.waitForTimeout(60);
  assert.ok(Math.abs((await geometry()).scrollLeft-rtl.scrollLeft)<2,
   'RTL oversized focus must not oscillate after resize notifications');
 }
 await resetAndReveal('ltr');
 const ltr=await geometry();
 assert.ok(ltr.scrollLeft>100,'LTR oversized action must reveal its left edge: '+JSON.stringify(ltr));
 await host.screenshot({path:output+'/toolbar-oversized-leading-ltr-390.png',animations:'disabled'});
 await resetAndReveal('rtl');
 await host.screenshot({path:output+'/toolbar-oversized-restored-rtl-390.png',animations:'disabled'});
 assert.deepEqual(errors,[],'No browser errors while revealing oversized RTL/LTR controls');
 console.log('Toolbar oversized RTL QA passed: logical leading edge, direction switching, stable resize; 3 screenshots.');
 await page.evaluate(()=>{
  window.__ux23OversizedRtlDispose?.();
  document.querySelector('#ux23-oversized-rtl')?.remove();
 });
}finally{await browser.close();}
