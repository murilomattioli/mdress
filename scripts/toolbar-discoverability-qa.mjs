import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const output='test-results/ux-audit';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const theme of ['graphite','studio'])for(const width of [1440,1024,768,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
   await page.evaluate(async theme=>{
    document.body.dataset.theme=theme;
    const {attachToolbarOverflow}=await import('/toolbar-overflow.js');
    const host=document.createElement('section');
    host.id='ux23-discoverability';host.className='editor-panel';
    host.style.cssText='position:fixed;top:120px;left:12px;width:min(620px,calc(100vw - 24px));z-index:100000;background:var(--ds-panel);padding:8px';
    const bar=document.createElement('div');bar.className='markdown-toolbar';
    bar.style.cssText='display:flex;flex-wrap:nowrap;overflow-x:auto;width:100%;min-height:58px';
    for(let i=0;i<8;i++){
     const action=document.createElement('button');action.type='button';
     action.dataset.ux23Action=String(i);
     action.textContent='Ferramenta '+(i+1);
     action.style.cssText='flex:0 0 110px;min-width:110px';
     bar.append(action);
    }
    host.append(bar);document.body.append(host);
    window.__ux23DiscoverabilityDispose=attachToolbarOverflow(bar);
   },theme);
   const host=page.locator('#ux23-discoverability');
   const bar=host.locator('.markdown-toolbar');
   const arrows=host.locator('.toolbar-scroll-button');
   await page.waitForFunction(()=>{
    const host=document.querySelector('#ux23-discoverability');
    const bar=host?.querySelector('.markdown-toolbar');
    const arrows=host?.querySelectorAll('.toolbar-scroll-button');
    return bar&&arrows?.length===2&&bar.scrollWidth>bar.clientWidth+2&&
     !arrows[0].hidden&&!arrows[1].hidden&&arrows[0].disabled&&!arrows[1].disabled;
   });
   const a11y=await host.evaluate(el=>{
    const bar=el.querySelector('.markdown-toolbar');
    return [...el.querySelectorAll('.toolbar-scroll-button')].map(arrow=>({
     label:arrow.getAttribute('aria-label'),controls:arrow.getAttribute('aria-controls'),
     target:document.getElementById(arrow.getAttribute('aria-controls'))===bar,
     width:arrow.getBoundingClientRect().width,height:arrow.getBoundingClientRect().height
    }));
   });
   assert.ok(a11y.every(arrow=>arrow.label&&arrow.target),
    'Both overflow arrows must have valid accessible names and aria-controls: '+JSON.stringify({theme,width,a11y}));
   await host.screenshot({path:`${output}/toolbar-discoverability-start-${theme}-${width}.png`,animations:'disabled'});
   const actions=host.locator('[data-ux23-action]');
   await actions.first().focus();
   for(let i=0;i<8;i++){
    if(i)await page.keyboard.press('Tab');
    const state=await page.evaluate(index=>{
     const bar=document.querySelector('#ux23-discoverability .markdown-toolbar');
     const action=bar.querySelector('[data-ux23-action="'+index+'"]');
     const a=action.getBoundingClientRect(),b=bar.getBoundingClientRect();
     return {focused:document.activeElement===action,
      visible:a.right>b.left+4&&a.left<b.right-4,
      scrollLeft:bar.scrollLeft};
    },i);
    assert.ok(state.focused&&state.visible,
     'Keyboard Tab must reach and reveal every toolbar action: '+JSON.stringify({theme,width,index:i,state}));
   }
   await host.screenshot({path:`${output}/toolbar-discoverability-keyboard-${theme}-${width}.png`,animations:'disabled'});
   await bar.evaluate(el=>{el.scrollLeft=0;});
   await page.waitForFunction(()=>{
    const bar=document.querySelector('#ux23-discoverability .markdown-toolbar');
    return bar?.scrollLeft<2;
   });
   await arrows.last().focus();
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>
    document.querySelector('#ux23-discoverability .markdown-toolbar')?.scrollLeft>20);
   const arrowStep=await bar.evaluate(el=>el.scrollLeft);
   assert.ok(arrowStep>20,'Enter on the next arrow must scroll the toolbar');
   for(let i=0;i<20;i++){
    const atEnd=await arrows.last().evaluate(el=>el.disabled);
    if(atEnd)break;
    await arrows.last().click();
    await page.waitForTimeout(25);
   }
   await page.waitForFunction(()=>{
    const host=document.querySelector('#ux23-discoverability');
    const bar=host?.querySelector('.markdown-toolbar');
    const [previous,next]=host?.querySelectorAll('.toolbar-scroll-button')||[];
    return bar&&previous&&!previous.disabled&&next?.disabled&&
     Math.abs(bar.scrollWidth-bar.clientWidth-bar.scrollLeft)<2;
   });
   await host.screenshot({path:`${output}/toolbar-discoverability-end-${theme}-${width}.png`,animations:'disabled'});
   assert.deepEqual(errors,[],'No browser errors in toolbar discoverability scenario');
   results.push({theme,width,actionsReached:8,arrowStep,arrowLabels:a11y.map(x=>x.label),
    screenshots:[`toolbar-discoverability-start-${theme}-${width}.png`,
     `toolbar-discoverability-keyboard-${theme}-${width}.png`,
     `toolbar-discoverability-end-${theme}-${width}.png`]});
   await page.evaluate(()=>{
    window.__ux23DiscoverabilityDispose?.();
    document.getElementById('ux23-discoverability')?.remove();
    delete window.__ux23DiscoverabilityDispose;
   });
  }finally{await page.close();}
 }
 await writeFile(`${output}/toolbar-discoverability.json`,JSON.stringify({schema:1,scenarios:results.length,
  note:'Automated reachability is not visual UX approval; inspect all screenshots and scrollable-toolbar warnings.',results},null,2)+'\n');
 console.log(`Toolbar discoverability QA passed: ${results.length} theme/viewport scenarios, ${results.length*8} keyboard-reachable actions, ${results.length*3} screenshots. Human review remains required.`);
}finally{await browser.close();}
