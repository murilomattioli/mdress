// Make overflowed Markdown actions discoverable without hiding keyboard focus.
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
 if(!toolbar||toolbar.closest('.markdown-toolbar-shell'))return;
 const shell=document.createElement('div');
 shell.className='markdown-toolbar-shell';
 toolbar.before(shell);shell.append(toolbar);
 const button=(direction,label,icon)=>{
  const node=document.createElement('button');
  node.type='button';node.className='toolbar-scroll-button';
  node.setAttribute('aria-label',label);node.title=label;
  const glyph=document.createElement('ds-icon');
  glyph.setAttribute('name',icon);glyph.setAttribute('aria-hidden','true');
  node.append(glyph);node.hidden=true;
  node.addEventListener('click',()=>toolbar.scrollBy({left:direction*Math.max(140,Math.round(toolbar.clientWidth*.7)),behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  return node;
 };
 const previous=button(-1,'Rolar ferramentas para a esquerda','chevron-left');
 const next=button(1,'Rolar ferramentas para a direita','chevron-right');
 shell.prepend(previous);shell.append(next);
 // App-level state updates may disable the currently focused Markdown action.
 // Remember its origin before the browser drops focus to <body>, then recover
 // the nearest usable toolbar action without stealing focus after a real click.
 let lastFocusedAction=null,lastFocusedIndex=-1;
 const actionSelector='button,select,input,[tabindex]';
 // Conditional modes can hide groups, remove nodes or mark actions aria-disabled.
 // These are unavailable for keyboard users even when disabled=false.
 const focusable=el=>{
  if(!el?.isConnected||el.matches(':disabled,[aria-disabled="true"]')||el.tabIndex<0||
     el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')||
     !el.getClientRects().length)return false;
  // content-visibility:hidden leaves a layout rectangle even though its
  // contents are not available to keyboard users. Inspect ancestor styles:
  // a descendant may still report its own display as visible.
  for(let node=el;node;node=node.parentElement){
   const style=getComputedStyle(node);
   if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||
      style.contentVisibility==='hidden')return false;
  }
  return true;
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
   const editor=document.querySelector('#source');
   if(focusable(editor))editor.focus({preventScroll:true});
   else if(toolbar.getClientRects().length&&!toolbar.closest('[hidden],[inert],[aria-hidden="true"]')){
    toolbar.tabIndex=-1;toolbar.focus({preventScroll:true});
   }
   lastFocusedAction=null;lastFocusedIndex=-1;
  }
 };
 const update=()=>{
  recoverActionFocus();
  const state=toolbarOverflowState(toolbar);
  // Disabling a focused scroll button at the end of its track can dump
  // keyboard users onto <body>. Capture focus before toggling disabled.
  const focusedArrow=document.activeElement===previous?previous:
   document.activeElement===next?next:null;
  previous.hidden=!state.overflow;next.hidden=!state.overflow;
  previous.disabled=!state.canScrollPrevious;next.disabled=!state.canScrollNext;
  if(focusedArrow&&(focusedArrow.disabled||focusedArrow.hidden)){
   const opposite=focusedArrow===next?previous:next;
   if(!opposite.disabled&&!opposite.hidden)opposite.focus({preventScroll:true});
   else{
    // A mode switch may hide every toolbar action while a scroll arrow owns
    // focus. Never hand focus to an invisible/aria-disabled descendant.
    const action=[...toolbar.querySelectorAll(actionSelector)].find(focusable);
    if(action)action.focus({preventScroll:true});
    else{
     const editor=document.querySelector('#source');
     if(focusable(editor))editor.focus({preventScroll:true});
     else if(toolbar.getClientRects().length&&
      !toolbar.closest('[hidden],[inert],[aria-hidden="true"]')){
      toolbar.tabIndex=-1;toolbar.focus({preventScroll:true});
     }
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
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;update();
   if(revealOnNextFrame){revealOnNextFrame=false;revealFocusedAction();}
  });
 };
 const scheduleReveal=()=>{revealOnNextFrame=true;schedule();};
 toolbar.addEventListener('scroll',schedule,{passive:true});
 toolbar.addEventListener('focusout',event=>{
  // A focused action can blur *before* the DOM removal/hidden mutation.
  // A null relatedTarget is not proof of deliberate keyboard navigation.
  if(event.target===lastFocusedAction&&event.relatedTarget&&
   event.relatedTarget!==document.body&&
   !toolbar.contains(event.relatedTarget))lastFocusedAction=null;
 });
 // A pointer interaction outside the toolbar is intentional; never pull
 // its focus back when a subsequent toolbar mutation arrives.
 document.addEventListener('pointerdown',event=>{
  if(!shell.contains(event.target)){lastFocusedAction=null;lastFocusedIndex=-1;}
 },{capture:true});
 toolbar.addEventListener('focusin',event=>{
  const target=event.target;
  if(target.matches?.(actionSelector)){
   lastFocusedAction=target;
   lastFocusedIndex=[...toolbar.querySelectorAll(actionSelector)].indexOf(target);
  }
  if(!toolbar.contains(target)||typeof target.getBoundingClientRect!=='function')return;
  const delta=focusedToolbarDelta(target.getBoundingClientRect(),toolbar.getBoundingClientRect());
  if(delta)toolbar.scrollBy({left:delta,behavior:'auto'});
  schedule();
 });
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
 new MutationObserver(records=>{
  if(records.some(record=>record.type==='childList'))syncObservedGroups();
  scheduleReveal();
 }).observe(toolbar,{
  childList:true,subtree:true,attributes:true,
  attributeFilter:['disabled','aria-disabled','hidden','class','style']
 });
 window.addEventListener('resize',scheduleReveal);
 document.addEventListener('studio:resized',scheduleReveal);
 schedule();
}
