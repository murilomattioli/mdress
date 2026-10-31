import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('test-results/ux-audit',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 const toolbar=page.locator('.markdown-toolbar');
 const last=toolbar.locator('[data-md-command="rule"]');
 await last.waitFor();
 const shell=toolbar.locator('..');
 await shell.evaluate(el=>{el.style.width='520px';});
 await last.focus();
 const visible=()=>page.evaluate(()=>{
  const bar=document.querySelector('.markdown-toolbar');
  const control=bar?.querySelector('[data-md-command="rule"]');
  if(!bar||!control)return false;
  const bounds=bar.getBoundingClientRect(),action=control.getBoundingClientRect();
  return document.activeElement===control&&action.left>=bounds.left-8&&action.right<=bounds.right+8;
 });
 await page.waitForFunction(()=>{const bar=document.querySelector('.markdown-toolbar');
  const item=bar?.querySelector('[data-md-command="rule"]');
  if(!bar||!item)return false;
  const b=bar.getBoundingClientRect(),r=item.getBoundingClientRect();
  return r.left>=b.left-8&&r.right<=b.right+8;
 });
 // A responsive resize must keep the *already focused* command visible.
 // Focusin does not fire again when the shell width changes.
 await shell.evaluate(el=>{el.style.width='180px';});
 await page.waitForFunction(()=>{const bar=document.querySelector('.markdown-toolbar');
  const item=bar?.querySelector('[data-md-command="rule"]');
  if(!bar||!item)return false;
  const b=bar.getBoundingClientRect(),r=item.getBoundingClientRect();
  return r.left>=b.left-8&&r.right<=b.right+8;
 },null,{timeout:3000});
 assert.equal(await visible(),true,'Focused command stays visible after responsive resize');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-resized-focused-action.png',animations:'disabled'});
 // Do not force focus visibility during deliberate mouse/trackpad scrolling.
 // A scroll listener that re-centers the focused item would make the toolbar
 // impossible to browse while focus remains on a command.
 await toolbar.evaluate(el=>{el.scrollLeft=0;});
 await page.waitForTimeout(180);
 assert.ok(await toolbar.evaluate(el=>el.scrollLeft)<2,
  'Manual toolbar scrolling must not be overridden by focus recovery');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-manual-scroll-with-focus.png',animations:'disabled'});
 // Splitter-driven changes use a custom resize event even when the window
 // itself does not resize. That event must reveal the focused action again.
 await toolbar.evaluate(()=>document.dispatchEvent(new Event('studio:resized')));
 await page.waitForFunction(()=>{const bar=document.querySelector('.markdown-toolbar');
  const item=bar?.querySelector('[data-md-command="rule"]');
  if(!bar||!item)return false;
  const b=bar.getBoundingClientRect(),r=item.getBoundingClientRect();
  return r.left>=b.left-8&&r.right<=b.right+8;
 },null,{timeout:3000});
 assert.equal(await visible(),true,'Splitter resize event reveals the focused command');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-splitter-focused-action.png',animations:'disabled'});
 // Toolbar actions are replaced during editor mode and permission changes.
 // Removing a focused command must restore focus to its nearest surviving
 // neighbor instead of jumping to the first Markdown action or <body>.
 await toolbar.evaluate(el=>{
  const group=document.createElement('div');group.className='tool-group';
  group.id='ux23-replaced-group';
  for(const name of ['before','removed','after']){
   const button=document.createElement('button');button.type='button';
   button.id='ux23-'+name;button.textContent=name;group.append(button);
  }
  el.append(group);
 });
 await page.locator('#ux23-removed').focus();
 await page.locator('#ux23-removed').evaluate(el=>el.remove());
 await page.waitForFunction(()=>document.activeElement?.id==='ux23-after',null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'ux23-after',
  'Removing a focused action must focus its next surviving neighbor');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-removed-action-focus-recovered.png',animations:'disabled'});
 await page.locator('#ux23-after').evaluate(el=>el.remove());
 await page.waitForFunction(()=>document.activeElement?.id==='ux23-before',null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'ux23-before',
  'Removing the final focused action must focus the preceding neighbor');
 await page.locator('#ux23-before').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.activeElement!==document.body&&
  document.querySelector('.markdown-toolbar')?.contains(document.activeElement)&&
  document.activeElement?.id!=='ux23-before',null,{timeout:3000});
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-disabled-action-focus-recovered.png',animations:'disabled'});
 await toolbar.locator('#ux23-replaced-group').evaluate(el=>el.remove());
 // At large zoom an action may be wider than the whole toolbar viewport.
 // Repeated layout notifications must not alternate between its two edges.
 await toolbar.evaluate(el=>{
  const group=document.createElement('div');group.className='tool-group';group.id='ux23-oversized-group';
  const action=document.createElement('button');action.type='button';action.id='ux23-oversized-action';
  action.textContent='Large action';action.style.cssText='flex:0 0 280px;width:280px;min-width:280px';
  group.append(action);el.append(group);
 });
 await page.locator('#ux23-oversized-action').focus();
 // Oversized targets cannot fit completely, so require a visible portion
 // rather than assuming a particular scroll alignment at the content edge.
 await page.waitForTimeout(180);
 const oversizedGeometry=await page.evaluate(()=>{
  const bar=document.querySelector('.markdown-toolbar');
  const item=document.querySelector('#ux23-oversized-action');
  const b=bar.getBoundingClientRect(),r=item.getBoundingClientRect();
  return {left:r.left,right:r.right,viewportLeft:b.left,viewportRight:b.right,
   scrollLeft:bar.scrollLeft,focused:document.activeElement===item};
 });
 assert.ok(oversizedGeometry.focused&&oversizedGeometry.right>oversizedGeometry.viewportLeft&&
  oversizedGeometry.left<oversizedGeometry.viewportRight,
  'An oversized focused action must remain partly visible: '+JSON.stringify(oversizedGeometry));
 const stableScroll=oversizedGeometry.scrollLeft;
 for(let attempt=0;attempt<3;attempt++){
  await toolbar.evaluate(()=>document.dispatchEvent(new Event('studio:resized')));
  await page.waitForTimeout(80);
  assert.ok(Math.abs(await toolbar.evaluate(el=>el.scrollLeft)-stableScroll)<2,
   'An oversized focused action must not bounce between its clipped edges');
 }
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-oversized-action-stable.png',animations:'disabled'});
 await toolbar.locator('#ux23-oversized-group').evaluate(el=>el.remove());
 console.log('Toolbar resize, manual scroll, splitter and dynamic focus recovery passed.');
}finally{await browser.close();}
