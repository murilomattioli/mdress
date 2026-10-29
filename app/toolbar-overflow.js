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
 const button=(direction,label,icon)=>{
  const node=document.createElement('button');
  node.type='button';node.className='toolbar-scroll-button';
  node.setAttribute('aria-label',label);node.title=label;
  const glyph=document.createElement('ds-icon');
  glyph.setAttribute('name',icon);glyph.setAttribute('aria-hidden','true');
  node.append(glyph);node.hidden=true;
  node.addEventListener('click',()=>toolbar.scrollBy({left:direction*Math.max(140,Math.round(toolbar.clientWidth*.7)),behavior:'smooth'}));
  return node;
 };
 const previous=button(-1,'Rolar ferramentas para a esquerda','chevron-left');
 const next=button(1,'Rolar ferramentas para a direita','chevron-right');
 shell.prepend(previous);shell.append(next);
 const update=()=>{
  const state=toolbarOverflowState(toolbar);
  previous.hidden=!state.overflow;next.hidden=!state.overflow;
  previous.disabled=!state.canScrollPrevious;next.disabled=!state.canScrollNext;
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
