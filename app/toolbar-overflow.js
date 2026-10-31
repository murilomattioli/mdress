// Make overflowed Markdown actions discoverable without hiding keyboard focus.
const overflowInstances=new WeakMap();
let nextToolbarId=0;
export function toolbarOverflowState({scrollLeft,scrollWidth,clientWidth}){
 const max=Math.max(0,scrollWidth-clientWidth);
 const overflow=max>2;
 return {overflow,canScrollPrevious:overflow&&scrollLeft>1,canScrollNext:overflow&&scrollLeft<max-1};
}
export function focusedToolbarDelta(control,viewport,padding=6){
 // At high zoom or very narrow split panes a control can be wider than the
 // entire scrollport. Reveal its leading edge once: trying to reveal both
 // edges on successive resize frames would oscillate the toolbar forever.
 if(control.right-control.left>viewport.right-viewport.left-2*padding){
  return control.left<viewport.left+padding||control.left>=viewport.right-padding?
   Math.round(control.left-viewport.left-padding):0;
 }
 if(control.left<viewport.left+padding)return Math.round(control.left-viewport.left-padding);
 if(control.right>viewport.right-padding)return Math.round(control.right-viewport.right+padding);
 return 0;
}
export function attachToolbarOverflow(toolbar){
 if(!toolbar)return ()=>{};
 if(overflowInstances.has(toolbar))return overflowInstances.get(toolbar);
 if(toolbar.closest('.markdown-toolbar-shell'))return ()=>{};
 const generatedId=!toolbar.id;
 if(generatedId)toolbar.id='mdress-markdown-toolbar-'+(++nextToolbarId);
 const shell=document.createElement('div');
 shell.className='markdown-toolbar-shell';
 toolbar.before(shell);shell.append(toolbar);
 const button=(direction,label,icon)=>{
  const node=document.createElement('button');
  node.type='button';node.className='toolbar-scroll-button';
  node.setAttribute('aria-label',label);node.setAttribute('aria-controls',toolbar.id);node.title=label;
  const glyph=document.createElement('ds-icon');
  glyph.setAttribute('name',icon);glyph.setAttribute('aria-hidden','true');
  node.append(glyph);node.hidden=true;
  node.addEventListener('click',()=>toolbar.scrollBy({left:direction*Math.max(140,Math.round(toolbar.clientWidth*.7)),behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  return node;
 };
 const previous=button(-1,'Rolar ferramentas para a esquerda','chevron-left');
 const next=button(1,'Rolar ferramentas para a direita','chevron-right');
 shell.prepend(previous);shell.append(next);
 // App-level state updates may disable the currently focused Markdown action.
 // Remember its origin before the browser drops focus to <body>, then recover
 // the nearest usable toolbar action without stealing focus after a real click.
 let lastFocusedAction=null,lastFocusedIndex=-1,lastFocusedArrow=null;
 // A CSS-hidden scroll arrow can lose native focus before the next frame.
 // Remember its ownership without stealing focus after deliberate navigation.
 const onShellFocusIn=event=>{
  if(event.target===previous||event.target===next)lastFocusedArrow=event.target;
 };
 shell.addEventListener('focusin',onShellFocusIn);
 const onShellFocusOut=event=>{
  if(event.target===lastFocusedArrow&&event.relatedTarget&&
     event.relatedTarget!==document.body)lastFocusedArrow=null;
 };
 shell.addEventListener('focusout',onShellFocusOut);
 const actionSelector='button,select,input,[tabindex]';
 // Conditional modes can hide groups, remove nodes or mark actions aria-disabled.
 // These are unavailable for keyboard users even when disabled=false.
 // A disabled fieldset disables descendants even when the toolbar itself
 // is a div (and therefore never matches :disabled). Preserve the HTML
 // exception for controls inside the fieldset's first direct-child legend.
 const inDisabledFieldset=el=>{
  for(let node=el?.parentElement;node;node=node.parentElement){
   if(node.tagName!=='FIELDSET'||!node.disabled)continue;
   const legend=[...node.children].find(child=>child.tagName==='LEGEND');
   if(!legend?.contains(el))return true;
  }
  return false;
 };
 const visibleInTree=el=>{
  if(inDisabledFieldset(el))return false;
  if(!el?.isConnected||!el.getClientRects().length||
     el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]'))return false;
  // A layout rectangle does not imply visibility with content-visibility.
  for(let node=el;node;node=node.parentElement){
   const style=getComputedStyle(node);
   if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||
      style.contentVisibility==='hidden')return false;
  }
  return true;
 };
 const focusable=el=>visibleInTree(el)&&el.tabIndex>=0&&
  !el.matches(':disabled,[aria-disabled="true"]');
 const focusFallback=()=>{
  const editor=document.querySelector('#source');
  if(focusable(editor)){editor.focus({preventScroll:true});return;}
  if(visibleInTree(toolbar)){
   toolbar.tabIndex=-1;toolbar.focus({preventScroll:true});return;
  }
  // A mode switch can hide both editor and toolbar. Do not leave focus in
  // an invisible toolbar or on <body> when another page control is usable.
  const outside=[...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
   .find(el=>!shell.contains(el)&&focusable(el));
  outside?.focus({preventScroll:true});
 };
 const recoverActionFocus=()=>{
  const origin=lastFocusedAction;
  if(!origin||focusable(origin)||
   (document.activeElement!==document.body&&document.activeElement!==origin))return;
  const actions=[...toolbar.querySelectorAll(actionSelector)];
  // A removed focused node is no longer in querySelectorAll. Keep its
  // former position so focus goes to the adjacent action, not the first
  // unrelated command in the toolbar.
  const currentIndex=actions.indexOf(origin);
  const index=currentIndex>=0?currentIndex+1:Math.min(lastFocusedIndex,actions.length);
  const next=actions.slice(Math.max(index,0)).find(focusable)||
   actions.slice(0,Math.max(index,0)).reverse().find(focusable);
  if(next){next.focus({preventScroll:true});lastFocusedAction=next;
   lastFocusedIndex=actions.indexOf(next);}
  else{
   // A workspace-mode change can hide the whole toolbar. Do not focus it.
   focusFallback();
   lastFocusedAction=null;lastFocusedIndex=-1;
  }
 };
 const update=()=>{
  recoverActionFocus();
  // A hidden/disabled toolbar must not leave visible, tabbable scroll arrows
  // outside it. The shell itself may be hidden by a responsive ancestor.
  const state=visibleInTree(toolbar)?toolbarOverflowState(toolbar):
   {overflow:false,canScrollPrevious:false,canScrollNext:false};
  // Disabling a focused scroll button at the end of its track can dump
  // keyboard users onto <body>. Capture focus before toggling disabled.
  const focusedArrow=document.activeElement===previous?previous:
   document.activeElement===next?next:
   document.activeElement===document.body&&!visibleInTree(toolbar)?lastFocusedArrow:null;
  previous.hidden=!state.overflow;next.hidden=!state.overflow;
  previous.disabled=!state.canScrollPrevious;next.disabled=!state.canScrollNext;
  if(focusedArrow&&(focusedArrow.disabled||focusedArrow.hidden)){
   lastFocusedArrow=null;
   const opposite=focusedArrow===next?previous:next;
   if(!opposite.disabled&&!opposite.hidden)opposite.focus({preventScroll:true});
   else{
    // A mode switch may hide every toolbar action while a scroll arrow owns
    // focus. Never hand focus to an invisible/aria-disabled descendant.
    const action=[...toolbar.querySelectorAll(actionSelector)].find(focusable);
    if(action)action.focus({preventScroll:true});
    else{
     focusFallback();
    }
   }
  }
 };
 // Resizing the editor can clip a focused command without another focusin.
 // Reveal it only for layout changes, never on ordinary scroll: a user must
 // still be able to browse the toolbar independently of keyboard focus.
 const revealFocusedAction=()=>{
  const active=document.activeElement;
  if(!toolbar.contains(active)||!focusable(active))return;
  const delta=focusedToolbarDelta(active.getBoundingClientRect(),toolbar.getBoundingClientRect());
  if(delta)toolbar.scrollLeft+=delta;
 };
 let frame=0,revealOnNextFrame=false;
 const schedule=()=>{
  if(disposed||frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;update();
   if(revealOnNextFrame){revealOnNextFrame=false;revealFocusedAction();}
  });
 };
 const scheduleReveal=()=>{revealOnNextFrame=true;schedule();};
 toolbar.addEventListener('scroll',schedule,{passive:true});
 const onToolbarFocusOut=event=>{
  // A focused action can blur *before* the DOM removal/hidden mutation.
  // A null relatedTarget is not proof of deliberate keyboard navigation.
  if(event.target===lastFocusedAction&&event.relatedTarget&&
   event.relatedTarget!==document.body&&
   !toolbar.contains(event.relatedTarget))lastFocusedAction=null;
 };
 toolbar.addEventListener('focusout',onToolbarFocusOut);
 // A pointer interaction outside the toolbar is intentional; never pull
 // its focus back when a subsequent toolbar mutation arrives.
 const onDocumentPointerDown=event=>{
  // Clicking a non-focusable area (including empty toolbar space) can
  // blur a scroll arrow to <body>. This is deliberate, not focus loss from
  // a later permission/layout change. Do not recover a stale arrow.
  if(!previous.contains(event.target)&&!next.contains(event.target))
   lastFocusedArrow=null;
  // A click on the toolbar background also abandons the previous action.
  // Only retain ownership when the pointer actually targets an action.
  const clickedAction=event.target.closest?.(actionSelector);
  if(!clickedAction||!toolbar.contains(clickedAction)){
   lastFocusedAction=null;lastFocusedIndex=-1;
  }
 };
 document.addEventListener('pointerdown',onDocumentPointerDown,true);
 const onToolbarFocusIn=event=>{
  const target=event.target;
  if(target.matches?.(actionSelector)){
   lastFocusedAction=target;
   lastFocusedIndex=[...toolbar.querySelectorAll(actionSelector)].indexOf(target);
  }
  if(!toolbar.contains(target)||typeof target.getBoundingClientRect!=='function')return;
  const delta=focusedToolbarDelta(target.getBoundingClientRect(),toolbar.getBoundingClientRect());
  if(delta)toolbar.scrollBy({left:delta,behavior:'auto'});
  schedule();
 };
 toolbar.addEventListener('focusin',onToolbarFocusIn);
 let resize=null;
 const observedGroups=new Set();
 const syncObservedGroups=()=>{
  if(!resize)return;
  const current=new Set(toolbar.children);
  for(const group of observedGroups)if(!current.has(group)){
   resize.unobserve(group);observedGroups.delete(group);
  }
  for(const group of current)if(!observedGroups.has(group)){
   resize.observe(group);observedGroups.add(group);
  }
 };
 if(typeof ResizeObserver==='function'){
  resize=new ResizeObserver(scheduleReveal);
  resize.observe(toolbar);
  syncObservedGroups();
 }
 // Observe new groups, but release detached groups on mode switches. Keeping
 // removed DOM nodes observed leaks them across repeated editor transitions.
 const toolbarObserver=new MutationObserver(records=>{
  if(records.some(record=>record.type==='childList'))syncObservedGroups();
  scheduleReveal();
 });
 toolbarObserver.observe(toolbar,{
  childList:true,subtree:true,attributes:true,
  attributeFilter:['disabled','aria-disabled','hidden','class','style']
 });
 // Toolbar subtree observation alone misses mode changes on the wrapping
 // shell, body or inspector workspace. Observe ancestor attributes so an
 // already-focused action/scroll arrow is recovered when its host is hidden.
 let watchedAncestors=[];
 let disposed=false;
 const ancestryObserver=new MutationObserver(records=>{
  if(!shell.isConnected||!shell.contains(toolbar)){dispose();return;}
  // Ignore unrelated document child changes: only a changed permission or
  // a DOM move involving this shell requires a toolbar layout pass.
  const relevant=records.some(record=>record.type==='attributes'||
   [...record.addedNodes,...record.removedNodes].some(node=>
    node===shell||node.contains?.(shell)));
  if(!relevant)return;
  // Reparenting changes which ancestor permissions apply.
  syncAncestry();scheduleReveal();
 });
 const syncAncestry=()=>{
  const ancestors=[];
  for(let node=shell;node;node=node.parentElement)ancestors.push(node);
  if(ancestors.length===watchedAncestors.length&&
     ancestors.every((node,index)=>node===watchedAncestors[index]))return;
  ancestryObserver.disconnect();watchedAncestors=ancestors;
  for(const node of ancestors)ancestryObserver.observe(node,{
   attributes:true,childList:true,
   attributeFilter:['hidden','inert','aria-hidden','aria-disabled','disabled','class','style']
  });
 };
 const dispose=()=>{
  if(disposed)return;
  disposed=true;
  if(frame)cancelAnimationFrame(frame);
  resize?.disconnect();toolbarObserver.disconnect();ancestryObserver.disconnect();
  observedGroups.clear();watchedAncestors=[];
  toolbar.removeEventListener('scroll',schedule);
  toolbar.removeEventListener('focusout',onToolbarFocusOut);
  toolbar.removeEventListener('focusin',onToolbarFocusIn);
  shell.removeEventListener('focusin',onShellFocusIn);
  shell.removeEventListener('focusout',onShellFocusOut);
  document.removeEventListener('pointerdown',onDocumentPointerDown,true);
  document.removeEventListener('studio:resized',scheduleReveal);
  window.removeEventListener('resize',scheduleReveal);
  if(toolbar.parentNode===shell){
   if(shell.parentNode)shell.replaceWith(toolbar);
   else shell.removeChild(toolbar);
  }else shell.remove();
  if(generatedId)toolbar.removeAttribute('id');
  lastFocusedAction=null;lastFocusedArrow=null;
  overflowInstances.delete(toolbar);
 };
 syncAncestry();
 window.addEventListener('resize',scheduleReveal);
 document.addEventListener('studio:resized',scheduleReveal);
 overflowInstances.set(toolbar,dispose);
 schedule();
 return dispose;
}
