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
 console.log('Toolbar responsive focus visibility, manual scroll independence and splitter event passed.');
}finally{await browser.close();}
