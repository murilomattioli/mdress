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
 const update=()=>{
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
 toolbar.addEventListener('focusin',event=>{
  const target=event.target;
  if(!toolbar.contains(target)||typeof target.getBoundingClientRect!=='function')return;
  const delta=focusedToolbarDelta(target.getBoundingClientRect(),toolbar.getBoundingClientRect());
  if(delta)toolbar.scrollBy({left:delta,behavior:'auto'});
  schedule();
 });
 if(typeof ResizeObserver==='function'){
  const resize=new ResizeObserver(schedule);
  resize.observe(toolbar);
  for(const group of toolbar.children)resize.observe(group);
 }
 window.addEventListener('resize',schedule);
 document.addEventListener('studio:resized',schedule);
 schedule();
}
