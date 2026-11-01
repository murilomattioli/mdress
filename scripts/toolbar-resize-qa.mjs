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
 // content-visibility:hidden keeps a layout rectangle but must never be
 // selected as the recovery target for a removed keyboard-focused action.
 await toolbar.evaluate(el=>{
  const group=document.createElement('div');group.className='tool-group';group.id='ux23-visibility-group';
  for(const id of ['visible-before','css-hidden','focused','visible-after']){
   const action=document.createElement('button');action.type='button';action.id='ux23-'+id;
   action.textContent=id;group.append(action);
  }
  el.append(group);
 });
 await page.locator('#ux23-css-hidden').evaluate(el=>{el.style.contentVisibility='hidden';});
 await page.locator('#ux23-focused').focus();
 await page.locator('#ux23-focused').evaluate(el=>el.remove());
 await page.waitForFunction(()=>document.activeElement?.id==='ux23-visible-after',null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'ux23-visible-after',
  'Focus recovery must skip an action hidden by content-visibility');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-content-visibility-focus-recovered.png',animations:'disabled'});
 await page.locator('#ux23-visible-after').evaluate(el=>el.remove());
 await page.waitForFunction(()=>document.activeElement?.id==='ux23-visible-before',null,{timeout:3000});
 await page.locator('#ux23-visible-before').evaluate(el=>{el.closest('.tool-group').setAttribute('aria-disabled','true');});
 await page.waitForFunction(()=>{
  const group=document.querySelector('#ux23-visibility-group');
  return document.activeElement!==document.body&&!group.contains(document.activeElement);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.closest('#ux23-visibility-group')===null),true,
  'Focus must leave an aria-disabled toolbar group');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-disabled-group-focus-recovered.png',animations:'disabled'});
 await toolbar.locator('#ux23-visibility-group').evaluate(el=>el.remove());
 await toolbar.locator('#ux23-replaced-group').evaluate(el=>el.remove());
 // Revoking aria-hidden or inert on a focused toolbar descendant must
 // trigger recovery without a resize/scroll. The subtree MutationObserver
 // must watch these permissions, not only disabled and class/style.
 await toolbar.evaluate(el=>{
  const group=document.createElement('div');group.className='tool-group';
  group.id='ux23-permission-group';
  for(const name of ['before','focused','after']){
   const button=document.createElement('button');button.type='button';
   button.id='ux23-permission-'+name;button.textContent=name;group.append(button);
  }
  el.append(group);
 });
 await page.locator('#ux23-permission-focused').focus();
 await page.locator('#ux23-permission-focused').evaluate(el=>el.setAttribute('aria-hidden','true'));
 await page.waitForFunction(()=>document.activeElement?.id==='ux23-permission-after',
  null,{timeout:3000});
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-aria-hidden-action-focus-recovered.png',animations:'disabled'});
 await page.locator('#ux23-permission-focused').evaluate(el=>el.removeAttribute('aria-hidden'));
 await page.locator('#ux23-permission-focused').focus();
 await page.locator('#ux23-permission-group').evaluate(el=>{el.inert=true;});
 await page.waitForFunction(()=>{
  const group=document.querySelector('#ux23-permission-group');
  return document.activeElement!==document.body&&!group.contains(document.activeElement);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id==='source'),true,
  'An inert toolbar group must hand focus to the editor');
 await toolbar.screenshot({path:'test-results/ux-audit/toolbar-inert-group-focus-recovered.png',animations:'disabled'});
 await toolbar.locator('#ux23-permission-group').evaluate(el=>el.remove());
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
 // A workspace switch can hide the toolbar and editor while a command is
 // focused. Their layout boxes may survive content-visibility:hidden.
 // Focus must move to an actual visible control outside those regions.
 await toolbar.evaluate(el=>{
  const group=document.createElement('div');group.className='tool-group';group.id='ux23-hidden-fallback-group';
  const action=document.createElement('button');action.type='button';
  action.id='ux23-hidden-fallback-action';action.textContent='Temporary command';
  group.append(action);el.append(group);
 });
 await page.locator('#ux23-hidden-fallback-action').focus();
 await page.evaluate(()=>{
  document.querySelector('#source').style.contentVisibility='hidden';
  const bar=document.querySelector('.markdown-toolbar');
  bar.style.contentVisibility='hidden';
  document.querySelector('#ux23-hidden-fallback-action').disabled=true;
 });
 await page.waitForFunction(()=>{
  const focused=document.activeElement,bar=document.querySelector('.markdown-toolbar');
  return focused!==document.body&&focused?.id!=='source'&&!bar.contains(focused);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id==='source'),false,
  'Hidden editor must not receive focus when the toolbar becomes unavailable');
 await page.screenshot({path:'test-results/ux-audit/toolbar-hidden-workspace-focus-recovered.png',animations:'disabled'});
 await page.evaluate(()=>{
  document.querySelector('#source').style.removeProperty('content-visibility');
  document.querySelector('.markdown-toolbar').style.removeProperty('content-visibility');
  document.querySelector('#ux23-hidden-fallback-group').remove();
 });
 // The toolbar shell sits outside the scrollport. Hiding it through a
 // responsive ancestor must revoke both its actions and its scroll arrows.
 // Chromium may blur the focused element to <body> before mutation observers
 // fire; the toolbar should restore focus to a visible workspace control.
 await toolbar.evaluate(el=>{el.scrollLeft=0;});
 await page.waitForFunction(()=>{
  const shell=document.querySelector('.markdown-toolbar-shell');
  const arrow=shell?.querySelector('.toolbar-scroll-button:last-child');
  return arrow&&!arrow.hidden&&!arrow.disabled;
 },null,{timeout:3000});
 const forwardArrow=shell.locator('.toolbar-scroll-button').last();
 await forwardArrow.focus();
 assert.equal(await forwardArrow.evaluate(el=>document.activeElement===el),true);
 await shell.evaluate(el=>{el.style.contentVisibility='hidden';});
 await page.waitForFunction(()=>{
  const shell=document.querySelector('.markdown-toolbar-shell');
  return document.activeElement!==document.body&&!shell.contains(document.activeElement)&&
   [...shell.querySelectorAll('.toolbar-scroll-button')].every(el=>el.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'source',
  'Hiding the toolbar shell must recover focus to the editor, not <body>');
 await page.screenshot({path:'test-results/ux-audit/toolbar-hidden-shell-arrow-focus.png',animations:'disabled'});
 await shell.evaluate(el=>{el.style.removeProperty('content-visibility');});
 await page.waitForFunction(()=>!document.querySelector('.markdown-toolbar-shell .toolbar-scroll-button:last-child')?.hidden);
 // A workspace mode class can hide an ancestor without touching the toolbar
 // subtree. Observe ancestor attributes, not only toolbar mutations.
 await page.evaluate(()=>{
  const style=document.createElement('style');style.id='ux23-toolbar-ancestor-style';
  style.textContent='body.ux23-toolbar-ancestor-hidden .markdown-toolbar-shell{display:none!important}';
  document.head.append(style);
 });
 await last.focus();
 await page.evaluate(()=>document.body.classList.add('ux23-toolbar-ancestor-hidden'));
 await page.waitForFunction(()=>{
  const shell=document.querySelector('.markdown-toolbar-shell');
  return document.activeElement!==document.body&&!shell.contains(document.activeElement)&&
   [...shell.querySelectorAll('.toolbar-scroll-button')].every(el=>el.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'source',
  'A CSS-only ancestor mode change must recover focus outside the hidden toolbar');
 await page.screenshot({path:'test-results/ux-audit/toolbar-hidden-ancestor-action-focus.png',animations:'disabled'});
 await page.evaluate(()=>{
  document.body.classList.remove('ux23-toolbar-ancestor-hidden');
  document.querySelector('#ux23-toolbar-ancestor-style').remove();
 });
 await page.waitForFunction(()=>!document.querySelector('.markdown-toolbar-shell .toolbar-scroll-button:last-child')?.hidden);
 // A disabled fieldset disables descendants without changing the toolbar's
 // own attributes. The toolbar is a div, so :disabled on the toolbar alone
 // cannot detect this inherited restriction. Revoke arrows and restore focus.
 await shell.evaluate(el=>{
  const fieldset=document.createElement('fieldset');
  fieldset.id='ux23-toolbar-disabled-fieldset';fieldset.style.minWidth='0';
  el.before(fieldset);fieldset.append(el);
 });
 await last.focus();
 await page.locator('#ux23-toolbar-disabled-fieldset').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-toolbar-disabled-fieldset');
  return document.activeElement!==document.body&&!host.contains(document.activeElement)&&
   [...host.querySelectorAll('.toolbar-scroll-button')].every(el=>el.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'source',
  'A disabled fieldset must recover toolbar action focus to the editor');
 await page.screenshot({path:'test-results/ux-audit/toolbar-disabled-fieldset-focus.png',animations:'disabled'});
 await page.locator('#ux23-toolbar-disabled-fieldset').evaluate(el=>{
  el.disabled=false;el.before(el.firstElementChild);el.remove();
 });
 await page.waitForFunction(()=>
  !document.querySelector('.markdown-toolbar-shell .toolbar-scroll-button:last-child')?.hidden);
 await forwardArrow.focus();
 await shell.evaluate(el=>{
  const fieldset=document.createElement('fieldset');
  fieldset.id='ux23-toolbar-disabled-arrow-fieldset';fieldset.style.minWidth='0';
  el.before(fieldset);fieldset.append(el);
 });
 await page.locator('#ux23-toolbar-disabled-arrow-fieldset').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-toolbar-disabled-arrow-fieldset');
  return document.activeElement!==document.body&&!host.contains(document.activeElement)&&
   [...host.querySelectorAll('.toolbar-scroll-button')].every(el=>el.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'source',
  'A disabled fieldset must recover scroll-arrow focus to the editor');
 await page.screenshot({path:'test-results/ux-audit/toolbar-disabled-fieldset-arrow-focus.png',animations:'disabled'});
 await page.locator('#ux23-toolbar-disabled-arrow-fieldset').evaluate(el=>{
  el.disabled=false;el.before(el.firstElementChild);el.remove();
 });
 await page.waitForFunction(()=>
  !document.querySelector('.markdown-toolbar-shell .toolbar-scroll-button:last-child')?.hidden);
 // Moving an already-focused toolbar into a previously disabled fieldset
 // must also revoke interactivity, even though the fieldset never mutates.
 await last.focus();
 await shell.evaluate(el=>{
  const fieldset=document.createElement('fieldset');
  fieldset.id='ux23-toolbar-reparent-disabled';fieldset.disabled=true;
  fieldset.style.minWidth='0';el.before(fieldset);fieldset.append(el);
 });
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-toolbar-reparent-disabled');
  return document.activeElement!==document.body&&!host.contains(document.activeElement)&&
   [...host.querySelectorAll('.toolbar-scroll-button')].every(el=>el.hidden);
 },null,{timeout:3000});
 await page.screenshot({path:'test-results/ux-audit/toolbar-reparent-disabled-fieldset.png',animations:'disabled'});
 await page.locator('#ux23-toolbar-reparent-disabled').evaluate(el=>{
  el.disabled=false;el.before(el.firstElementChild);el.remove();
 });
 await page.waitForFunction(()=>
  !document.querySelector('.markdown-toolbar-shell .toolbar-scroll-button:last-child')?.hidden);
 // Moving the shell to a different parent must refresh the watched ancestry.
 // Revoking permissions on its *new* wrapper should recover focus, not leave
 // a stale observer attached to the former workspace parent.
 await shell.evaluate(el=>{
  const wrapper=document.createElement('div');wrapper.id='ux23-toolbar-reparented';
  el.before(wrapper);wrapper.append(el);
 });
 await last.focus();
 await page.locator('#ux23-toolbar-reparented').evaluate(el=>el.setAttribute('aria-disabled','true'));
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-toolbar-reparented');
  return document.activeElement!==document.body&&!host.contains(document.activeElement)&&
   [...host.querySelectorAll('.toolbar-scroll-button')].every(el=>el.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'source',
  'Permissions on a new toolbar parent must revoke focus after reparenting');
 await page.screenshot({path:'test-results/ux-audit/toolbar-reparented-host-focus.png',animations:'disabled'});
 await page.locator('#ux23-toolbar-reparented').evaluate(el=>{
  el.removeAttribute('aria-disabled');el.before(el.firstElementChild);el.remove();
 });
 // A detached toolbar must not retain global resize/pointer listeners or
 // ancestry observers across repeated editor mounts. Explicit disposal must
 // also unwrap the toolbar and allow a fresh attachment without duplicate UI.
 await page.evaluate(async()=>{
  const {attachToolbarOverflow}=await import('/toolbar-overflow.js');
  const host=document.createElement('div');host.id='ux23-toolbar-lifecycle';
  host.style.cssText='width:210px;max-width:210px;position:relative';
  const bar=document.createElement('div');bar.className='markdown-toolbar';
  bar.style.cssText='display:flex;flex-wrap:nowrap;overflow-x:auto;width:160px';
  for(let i=0;i<8;i++){
   const action=document.createElement('button');action.type='button';
   action.textContent='Action '+i;action.style.cssText='min-width:100px;flex-shrink:0';
   bar.append(action);
  }
  host.append(bar);document.body.append(host);
  window.__ux23DisposeToolbar=attachToolbarOverflow(bar);
 });
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-toolbar-lifecycle');
  return host?.querySelectorAll('.toolbar-scroll-button').length===2&&
   [...host.querySelectorAll('.toolbar-scroll-button')].some(button=>!button.hidden);
 },null,{timeout:3000});
 await page.locator('#ux23-toolbar-lifecycle').screenshot({
  path:'test-results/ux-audit/toolbar-lifecycle-scroll-controls.png',animations:'disabled'
 });
 const lifecycle=await page.evaluate(async()=>{
  const {attachToolbarOverflow}=await import('/toolbar-overflow.js');
  const host=document.querySelector('#ux23-toolbar-lifecycle');
  const bar=host.querySelector('.markdown-toolbar');
  const arrows=[...host.querySelectorAll('.toolbar-scroll-button')];
  const controlsValid=arrows.every(arrow=>arrow.getAttribute('aria-controls')===bar.id&&bar.id);
  const sameInstance=attachToolbarOverflow(bar)===window.__ux23DisposeToolbar;
  window.__ux23DisposeToolbar();
  const explicitCleanup=host.querySelectorAll('.markdown-toolbar-shell,.toolbar-scroll-button').length===0&&
   bar.parentElement===host;
  const again=attachToolbarOverflow(bar);
  const reattached=host.querySelectorAll('.toolbar-scroll-button').length===2&&
   typeof again==='function'&&again!==window.__ux23DisposeToolbar;
  host.remove();
  await new Promise(resolve=>setTimeout(resolve,80));
  const automaticCleanup=!bar.closest('.markdown-toolbar-shell')&&
   !bar.id&&host.querySelectorAll('.toolbar-scroll-button').length===0;
  document.body.append(host);
  const third=attachToolbarOverflow(bar);
  const remounted=host.querySelectorAll('.toolbar-scroll-button').length===2;
  const newHost=document.createElement('div');newHost.id='ux23-toolbar-new-parent';
  host.after(newHost);newHost.append(bar);
  await new Promise(resolve=>setTimeout(resolve,80));
  const movedClean=host.querySelectorAll('.markdown-toolbar-shell').length===0&&
   newHost.firstElementChild===bar&&!bar.id;
  const movedDispose=attachToolbarOverflow(bar);
  const movedReattached=newHost.querySelectorAll('.toolbar-scroll-button').length===2&&
   movedDispose!==third;
  movedDispose();newHost.remove();host.remove();delete window.__ux23DisposeToolbar;
  return {controlsValid,sameInstance,explicitCleanup,reattached,automaticCleanup,
   remounted,movedClean,movedReattached};
 });
 assert.deepEqual(lifecycle,{
  controlsValid:true,sameInstance:true,explicitCleanup:true,
  reattached:true,automaticCleanup:true,remounted:true,
  movedClean:true,movedReattached:true
 },'Toolbar must dispose observers and restore a clean DOM across mounts: '+JSON.stringify(lifecycle));
 // A deliberate pointer click on blank, non-focusable workspace space can
 // blur a scroll arrow to <body>. A later responsive hide must NOT steal that
 // intentionally abandoned focus back into the editor.
 await page.evaluate(async()=>{
  const {attachToolbarOverflow}=await import('/toolbar-overflow.js');
  const host=document.createElement('div');host.id='ux23-pointer-focus-fixture';
  host.style.cssText='position:fixed;left:48px;top:120px;width:240px;z-index:9999;background:white';
  const bar=document.createElement('div');bar.className='markdown-toolbar';
  bar.style.cssText='display:flex;flex-wrap:nowrap;overflow-x:auto;width:180px';
  for(let i=0;i<8;i++){
   const action=document.createElement('button');action.type='button';
   action.textContent='Action '+i;action.style.cssText='min-width:100px;flex-shrink:0';
   bar.append(action);
  }
  host.append(bar);document.body.append(host);
  window.__ux23PointerDispose=attachToolbarOverflow(bar);
  const outside=document.createElement('div');outside.id='ux23-pointer-outside';
  outside.style.cssText='position:fixed;left:0;top:0;width:36px;height:36px;z-index:2147483647';
  document.body.append(outside);
 });
 const pointerHost=page.locator('#ux23-pointer-focus-fixture');
 const pointerArrow=pointerHost.locator('.toolbar-scroll-button').last();
 await page.waitForFunction(()=>{
  const arrow=document.querySelector('#ux23-pointer-focus-fixture .toolbar-scroll-button:last-child');
  return arrow&&!arrow.hidden&&!arrow.disabled;
 });
 await pointerArrow.focus();
 await page.locator('#ux23-pointer-outside').click();
 // Explicitly model browsers that blur the arrow to body on a blank click.
 await pointerArrow.evaluate(el=>el.blur());
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,
  'Blank pointer click leaves focus on the document rather than the toolbar');
 await pointerHost.evaluate(el=>{el.style.display='none';});
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-pointer-focus-fixture');
  return [...host.querySelectorAll('.toolbar-scroll-button')].every(arrow=>arrow.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,
  'A later toolbar hide must not steal focus after a deliberate outside pointer click');
 await pointerHost.evaluate(el=>{el.style.removeProperty('display');});
 await page.waitForFunction(()=>{
  const arrow=document.querySelector('#ux23-pointer-focus-fixture .toolbar-scroll-button:last-child');
  return arrow&&!arrow.hidden&&!arrow.disabled;
 });
 // Blank space INSIDE the shell is also a deliberate pointer interaction.
 // Its target is not a command or an arrow, and it must clear arrow ownership.
 await pointerHost.evaluate(host=>{
  const shell=host.querySelector('.markdown-toolbar-shell');
  shell.style.position='relative';
  const blank=document.createElement('div');blank.id='ux23-pointer-inside-blank';
  blank.style.cssText='position:absolute;left:0;top:0;width:20px;height:20px;z-index:99999';
  shell.append(blank);
 });
 await pointerArrow.focus();
 await page.locator('#ux23-pointer-inside-blank').click();
 await pointerArrow.evaluate(el=>el.blur());
 await pointerHost.evaluate(el=>{el.style.display='none';});
 await page.waitForFunction(()=>{
  const host=document.querySelector('#ux23-pointer-focus-fixture');
  return [...host.querySelectorAll('.toolbar-scroll-button')].every(arrow=>arrow.hidden);
 },null,{timeout:3000});
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,
  'Blank space inside the toolbar must not cause stale arrow focus recovery');
 await pointerHost.evaluate(el=>{
  el.style.removeProperty('display');
  el.querySelector('#ux23-pointer-inside-blank').remove();
 });
 await page.waitForFunction(()=>{
  const arrow=document.querySelector('#ux23-pointer-focus-fixture .toolbar-scroll-button:last-child');
  return arrow&&!arrow.hidden&&!arrow.disabled;
 });
 // The same intentional background click must abandon a previously focused
 // command. Disabling that command later must not yank focus to a neighbor.
 await pointerHost.evaluate(host=>{
  const shell=host.querySelector('.markdown-toolbar-shell');
  const blank=document.createElement('div');blank.id='ux23-pointer-action-blank';
  blank.style.cssText='position:absolute;left:0;top:0;width:20px;height:20px;z-index:99999';
  shell.append(blank);
 });
 const pointerAction=pointerHost.locator('.markdown-toolbar button').first();
 await pointerAction.focus();
 await page.locator('#ux23-pointer-action-blank').click();
 await pointerAction.evaluate(el=>el.blur());
 await pointerAction.evaluate(el=>{el.disabled=true;});
 await page.evaluate(()=>new Promise(resolve=>
  requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,
  'Disabling a command after a deliberate toolbar background click must not steal focus');
 await pointerHost.evaluate(host=>{
  host.querySelector('#ux23-pointer-action-blank').remove();
  host.querySelector('.markdown-toolbar button').disabled=false;
 });
 // Reduced-motion users should get an immediate, standards-compliant auto
 // scroll rather than the non-standard `instant` ScrollBehavior value.
 await pointerHost.evaluate(host=>{
  const bar=host.querySelector('.markdown-toolbar');
  const nativeScrollBy=bar.scrollBy.bind(bar);
  bar.scrollBy=options=>{window.__ux23ScrollBehavior=options.behavior;nativeScrollBy(options);};
 });
 await pointerArrow.click();
 await page.waitForFunction(()=>
  document.querySelector('#ux23-pointer-focus-fixture .markdown-toolbar')?.scrollLeft>30);
 assert.equal(await page.evaluate(()=>window.__ux23ScrollBehavior),'auto',
  'Reduced-motion toolbar scrolling must use standard auto behavior');
 await pointerHost.screenshot({
  path:'test-results/ux-audit/toolbar-outside-pointer-reduced-motion.png',animations:'disabled'
 });
 // A programmatic click may be dispatched in the same task that revokes
 // permissions, before MutationObserver/requestAnimationFrame disables arrows.
 // It must not scroll a hidden, inert, aria-disabled or out-of-range toolbar.
 const clickGuard=await pointerHost.evaluate(host=>{
  const bar=host.querySelector('.markdown-toolbar');
  const [previous,next]=host.querySelectorAll('.toolbar-scroll-button');
  const native=bar.scrollBy.bind(bar);
  let attempts=0;
  bar.scrollBy=options=>{attempts++;native(options);};
  const click=arrow=>arrow.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  bar.scrollLeft=0;
  click(previous); // synthetic events can bypass native disabled controls
  const boundaryBlocked=attempts===0;
  host.setAttribute('aria-disabled','true');click(next);
  const ariaBlocked=attempts===0;
  host.removeAttribute('aria-disabled');
  host.inert=true;click(next);
  const inertBlocked=attempts===0;
  host.inert=false;
  host.style.contentVisibility='hidden';click(next);
  const contentVisibilityBlocked=attempts===0;
  host.style.removeProperty('content-visibility');
  host.style.display='none';click(next);
  const displayBlocked=attempts===0;
  host.style.removeProperty('display');
  host.hidden=true;click(next);
  const hiddenBlocked=attempts===0;
  host.hidden=false;
  click(next);
  return {boundaryBlocked,ariaBlocked,inertBlocked,contentVisibilityBlocked,
   displayBlocked,hiddenBlocked,allowedClicks:attempts};
 });
 assert.deepEqual(clickGuard,{
  boundaryBlocked:true,ariaBlocked:true,inertBlocked:true,
  contentVisibilityBlocked:true,displayBlocked:true,hiddenBlocked:true,
  allowedClicks:1
 },'Live permission and boundary guards must block stale synthetic scroll clicks');
 await page.waitForFunction(()=>
  document.querySelector('#ux23-pointer-focus-fixture .markdown-toolbar')?.scrollLeft>30);
 await pointerHost.screenshot({
  path:'test-results/ux-audit/toolbar-scroll-live-permission-guard.png',animations:'disabled'
 });
 await page.evaluate(()=>{
  window.__ux23PointerDispose();
  document.querySelector('#ux23-pointer-focus-fixture').remove();
  document.querySelector('#ux23-pointer-outside').remove();
  delete window.__ux23PointerDispose;delete window.__ux23ScrollBehavior;
 });
 // Touch devices need a genuinely tappable arrow, not a 28px icon
 // surrounded by dead space. Use a real Chromium touch context and a
 // deterministic overflow fixture independent of the current workspace mode.
 const touchPage=await browser.newPage({
  viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'
 });
 await touchPage.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await touchPage.evaluate(async()=>{
  const {attachToolbarOverflow}=await import('/toolbar-overflow.js');
  const host=document.createElement('section');host.id='ux23-touch-toolbar-fixture';
  host.className='editor-panel';
  host.style.cssText='position:fixed;left:12px;top:90px;width:320px;max-width:calc(100vw - 24px);z-index:100000;display:block;background:var(--ds-panel)';
  const bar=document.createElement('div');bar.className='markdown-toolbar';
  bar.style.cssText='display:flex;flex-wrap:nowrap;overflow-x:auto;width:100%;min-height:58px';
  for(let i=0;i<8;i++){
   const action=document.createElement('button');action.type='button';
   action.textContent='Ferramenta '+i;action.style.cssText='flex:0 0 110px;min-width:110px';
   bar.append(action);
  }
  host.append(bar);document.body.append(host);
  window.__ux23TouchDispose=attachToolbarOverflow(bar);
 });
 for(const width of [390,320]){
  await touchPage.setViewportSize({width,height:844});
  await touchPage.waitForFunction(()=>{
   const host=document.querySelector('#ux23-touch-toolbar-fixture');
   const arrows=[...host?.querySelectorAll('.toolbar-scroll-button')||[]];
   return arrows.length===2&&!arrows[1].hidden&&!arrows[1].disabled;
  });
  const targets=await touchPage.locator('#ux23-touch-toolbar-fixture .toolbar-scroll-button')
   .evaluateAll(arrows=>arrows.map(el=>{
    const rect=el.getBoundingClientRect();
    return {width:rect.width,height:rect.height,hidden:el.hidden};
   }));
  assert.equal(await touchPage.evaluate(()=>matchMedia('(pointer:coarse)').matches),true,
   'Touch regression must run with coarse pointer emulation');
  assert.ok(targets.every(target=>target.width>=44&&target.height>=44),
   'Both toolbar scroll arrows need at least 44x44px touch targets: '+JSON.stringify({width,targets}));
  await touchPage.locator('#ux23-touch-toolbar-fixture').screenshot({
   path:'test-results/ux-audit/toolbar-touch-targets-'+width+'.png',animations:'disabled'
  });
 }
 await touchPage.locator('#ux23-touch-toolbar-fixture .toolbar-scroll-button').last().tap();
 await touchPage.waitForFunction(()=>
  document.querySelector('#ux23-touch-toolbar-fixture .markdown-toolbar')?.scrollLeft>30);
 await touchPage.locator('#ux23-touch-toolbar-fixture').screenshot({
  path:'test-results/ux-audit/toolbar-touch-after-tap.png',animations:'disabled'
 });
 await touchPage.evaluate(()=>{
  window.__ux23TouchDispose();
  document.querySelector('#ux23-touch-toolbar-fixture').remove();
  delete window.__ux23TouchDispose;
 });
 await touchPage.close();
 console.log('Toolbar resize, manual scroll, splitter and dynamic focus recovery passed.');
}finally{await browser.close();}
