// Make overflowed Markdown actions discoverable without hiding keyboard focus.
export function toolbarOverflowState({scrollLeft,scrollWidth,clientWidth}){
 const max=Math.max(0,scrollWidth-clientWidth);
 return {overflow:max>2,canScrollPrevious:scrollLeft>1,canScrollNext:scrollLeft<max-1};
}
export function focusedToolbarDelta(control,viewport,padding=6){
 if(control.left<viewport.left+padding)return Math.round(control.left-viewport.left-padding);
 if(control.right>viewport.right-padding)return Math.round(control.right-viewport.right+padding);
 return 0;
}
export function attachToolbarOverflow(toolbar){
 if(!toolbar||toolbar.closest('.markdown-toolbar-shell'))return;
 const shell=document.createElement('div');
 shell.className='markdown-toolbar-shell';
 toolbar.before(shell);shell.append(toolbar);
 const button=(direction,label,glyph)=>{
  const node=document.createElement('button');
  node.type='button';node.className='toolbar-scroll-button';
  node.setAttribute('aria-label',label);node.title=label;
  node.textContent=glyph;node.hidden=true;
  node.addEventListener('click',()=>toolbar.scrollBy({
   left:direction*Math.max(140,Math.round(toolbar.clientWidth*.7)),
   behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'
  }));
  return node;
 };
 const previous=button(-1,'Rolar ferramentas para a esquerda','‹');
 const next=button(1,'Rolar ferramentas para a direita','›');
 shell.prepend(previous);shell.append(next);
 // App-level state updates may disable the currently focused Markdown action.
 // Remember its origin before the browser drops focus to <body>, then recover
 // the nearest usable toolbar action without stealing focus after a real click.
 let lastFocusedAction=null;
 const actionSelector='button,select,input,[tabindex]';
 // Conditional modes can hide groups, remove nodes or mark actions aria-disabled.
 // These are unavailable for keyboard users even when disabled=false.
 const focusable=el=>Boolean(el?.isConnected&&!el.matches(':disabled,[aria-disabled="true"]')&&
  el.tabIndex>=0&&!el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')&&
  el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
 const recoverActionFocus=()=>{
  const origin=lastFocusedAction;
  if(!origin||focusable(origin)||
   (document.activeElement!==document.body&&document.activeElement!==origin))return;
  const actions=[...toolbar.querySelectorAll(actionSelector)];
  const index=actions.indexOf(origin);
  const next=actions.slice(Math.max(index+1,0)).find(focusable)||
   actions.slice(0,Math.max(index,0)).reverse().find(focusable);
  if(next){next.focus({preventScroll:true});lastFocusedAction=next;}
  else{
   // A workspace-mode change can hide the whole toolbar. Do not focus it.
   const editor=document.querySelector('#source');
   if(focusable(editor))editor.focus({preventScroll:true});
   else if(toolbar.getClientRects().length&&!toolbar.closest('[hidden],[inert],[aria-hidden="true"]')){
    toolbar.tabIndex=-1;toolbar.focus({preventScroll:true});
   }
   lastFocusedAction=null;
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
    const action=toolbar.querySelector('button:not(:disabled):not([hidden]),[href],[tabindex="0"]');
    if(action)action.focus({preventScroll:true});
    else {toolbar.tabIndex=-1;toolbar.focus({preventScroll:true});}
   }
  }
 };
 let frame=0;
 const schedule=()=>{
  if(frame)cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{frame=0;update();});
 };
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
  if(!shell.contains(event.target))lastFocusedAction=null;
 },{capture:true});
 toolbar.addEventListener('focusin',event=>{
  const target=event.target;
  if(target.matches?.(actionSelector))lastFocusedAction=target;
  if(!toolbar.contains(target)||typeof target.getBoundingClientRect!=='function')return;
  const delta=focusedToolbarDelta(target.getBoundingClientRect(),toolbar.getBoundingClientRect());
  if(delta)toolbar.scrollBy({left:delta,behavior:'auto'});
  schedule();
 });
 let resize=null;
 if(typeof ResizeObserver==='function'){
  resize=new ResizeObserver(schedule);
  resize.observe(toolbar);
  for(const group of toolbar.children)resize.observe(group);
 }
 // ResizeObserver only tracks the groups present during setup. Watch live
 // actions and newly inserted groups as editor modes/permissions change.
 new MutationObserver(records=>{
  if(resize&&records.some(record=>record.type==='childList'))
   for(const group of toolbar.children)resize.observe(group);
  schedule();
 }).observe(toolbar,{
  childList:true,subtree:true,attributes:true,
  attributeFilter:['disabled','hidden','class','style']
 });
 window.addEventListener('resize',schedule);
 document.addEventListener('studio:resized',schedule);
 schedule();
}
