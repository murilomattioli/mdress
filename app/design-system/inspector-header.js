/** Shared fieldset header: title/actions, optional menu, expansion at the far edge. */
let nextMenuId=0;
// Pure geometry keeps keyboard scrolling local to the open popover.
export function menuScrollDelta(item,viewport,padding=4){
 if(item.top<viewport.top+padding)return item.top-viewport.top-padding;
 if(item.bottom>viewport.bottom-padding)return item.bottom-viewport.bottom+padding;
 return 0;
}
export function createInspectorHeader({toggle,actions,menuItems=[],menuVisibility='hover'}){
 const header=document.createElement('div');header.className='ds-accordion-header';header.append(toggle);
 if(actions){actions.classList.add('ds-accordion-actions');header.append(actions);}
 if(menuItems.length){
  const more=document.createElement('button');more.type='button';more.className='ds-header-menu-trigger ds-quick-action';more.dataset.visibility=menuVisibility;
  // Some accordion toggles are named by visible content, not aria-label.
  const toggleName=toggle.getAttribute('aria-label')||toggle.textContent.trim()||'seção';
  more.setAttribute('aria-label','Opções de '+toggleName);more.title=more.getAttribute('aria-label');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
  const icon=document.createElement('ds-icon');icon.setAttribute('name','ellipsis-vertical');more.append(icon);
  const menu=document.createElement('div');menu.className='ds-header-menu';menu.id='ds-header-menu-'+(++nextMenuId);
  menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label',more.getAttribute('aria-label'));
  more.setAttribute('aria-controls',menu.id);
  const buttons=menuItems.map(item=>{
   const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.textContent=item.label;button.disabled=Boolean(item.disabled);
   button.onclick=()=>{
    // aria-disabled does not prevent native clicks; respect runtime changes.
    if(!available().includes(button))return;
    menu.hidePopover();more.focus();item.onSelect();
   };
   menu.append(button);return button;
  });
  // Runtime permissions can also hide an action with CSS, inert or ARIA.
  // A native hidden/disabled check alone leaves invisible menuitems in the
  // roving keyboard order and may dispatch actions that are no longer offered.
  const available=()=>buttons.filter(button=>{
   if(button.disabled||button.hidden||button.getAttribute('aria-disabled')==='true'||
      button.closest('[inert],[aria-hidden="true"]'))return false;
   const style=getComputedStyle(button);
   return style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse';
  });
  const isOpen=()=>menu.matches(':popover-open');
  // Keep the menu anchored when a responsive panel scrolls or resizes while open.
  const position=()=>{
   if(!isOpen()||!more.isConnected)return;
   // A virtual keyboard or pinch zoom can shrink/offset the *visual*
   // viewport without changing innerHeight. Keep the popover inside the
   // actually visible rectangle, including its left/top offsets.
   const viewport=window.visualViewport;
   // Some engines report a visualViewport resize before the layout viewport
   // settles. Use their intersection so neither coordinate system can push
   // the menu outside the actually visible page during that transition.
   const offsetLeft=viewport?.offsetLeft??0,offsetTop=viewport?.offsetTop??0;
   const left=Math.max(0,offsetLeft),top=Math.max(0,offsetTop);
   const right=Math.min(innerWidth,offsetLeft+(viewport?.width||innerWidth));
   const bottom=Math.min(innerHeight,offsetTop+(viewport?.height||innerHeight));
   const width=Math.max(0,right-left),height=Math.max(0,bottom-top);
   menu.style.maxWidth=Math.max(0,width-16)+'px';
   menu.style.maxHeight=Math.max(0,height-16)+'px';
   const r=more.getBoundingClientRect(),menuHeight=menu.offsetHeight,menuWidth=menu.offsetWidth;
   const below=top+height-r.bottom-8,above=r.top-top-8;
   const openAbove=below<Math.min(menuHeight,160)&&above>below;
   const desiredTop=openAbove?r.top-menuHeight-4:r.bottom+4;
   menu.style.left=Math.max(left+8,Math.min(left+width-menuWidth-8,r.right-menuWidth))+'px';
   menu.style.top=Math.max(top+8,Math.min(top+height-menuHeight-8,desiredTop))+'px';
  };
  let frame=0,lastFocusedItem=null,menuResizeObserver=null;
  menu.addEventListener('focusin',event=>{
   if(buttons.includes(event.target))lastFocusedItem=event.target;
  });
  menu.addEventListener('focusout',event=>{
   if(event.target===lastFocusedItem&&event.relatedTarget&&event.relatedTarget!==document.body)
    lastFocusedItem=null;
  });
  const clearOutsidePointer=event=>{
   if(!menu.contains(event.target))lastFocusedItem=null;
  };
  const schedulePosition=()=>{
   if(frame)return;
   frame=requestAnimationFrame(()=>{frame=0;position();});
  };
  const startTracking=()=>{
   window.addEventListener('resize',schedulePosition);
   window.addEventListener('scroll',schedulePosition,true);
   document.addEventListener('pointerdown',clearOutsidePointer,true);
   window.visualViewport?.addEventListener('resize',schedulePosition);
   window.visualViewport?.addEventListener('scroll',schedulePosition);
   // A menu can grow after opening (font/layout settling, viewport CSS
   // max-height, dynamic labels). Window resize alone misses that reflow.
   if(typeof ResizeObserver==='function'){
    menuResizeObserver=new ResizeObserver(schedulePosition);
    menuResizeObserver.observe(menu);menuResizeObserver.observe(more);
   }
  };
  const stopTracking=()=>{
   window.removeEventListener('resize',schedulePosition);
   window.removeEventListener('scroll',schedulePosition,true);
   document.removeEventListener('pointerdown',clearOutsidePointer,true);
   window.visualViewport?.removeEventListener('resize',schedulePosition);
   window.visualViewport?.removeEventListener('scroll',schedulePosition);
   menuResizeObserver?.disconnect();menuResizeObserver=null;
   if(frame){cancelAnimationFrame(frame);frame=0;}
  };
  const focusItem=item=>{
   if(!item)return;
   // Native scrollIntoView also scrolls ancestor inspector panels and the
   // document. Only the menu itself should move when navigating its actions.
   item.focus({preventScroll:true});
   const delta=menuScrollDelta(item.getBoundingClientRect(),menu.getBoundingClientRect());
   if(delta)menu.scrollTop+=delta;
  };
  const syncAvailability=()=>{
   const items=available();
   const triggerFocused=document.activeElement===more;
   // Chromium can blur a disabled focused button to <body> before the
   // MutationObserver runs. Retain its prior focus ownership for recovery.
   const lostMenuFocus=lastFocusedItem&&!items.includes(lastFocusedItem)&&document.activeElement===document.body;
   more.hidden=!items.length;
   // Hiding a focused trigger would otherwise send keyboard focus to <body>.
   if(!items.length&&triggerFocused&&toggle.isConnected)toggle.focus();
   if(!items.length&&isOpen()){
    const focusInside=menu.contains(document.activeElement)||lostMenuFocus;
    menu.hidePopover();
    if(focusInside&&toggle.isConnected)toggle.focus();
   }else if(isOpen()&&(menu.contains(document.activeElement)||lostMenuFocus)&&!items.includes(document.activeElement)){
    focusItem(items[0]);
   }
  };
  syncAvailability();
  // Consumers can disable or hide actions after the header has been created.
  new MutationObserver(syncAvailability).observe(menu,{subtree:true,attributes:true,attributeFilter:['disabled','hidden','aria-disabled','aria-hidden','inert','class','style']});
  more.onclick=()=>{
   if(more.hidden||!available().length)return;
   if(isOpen()){menu.hidePopover();return;}
   menu.showPopover();position();focusItem(available()[0]);
  };
  let typed='',lastTypedAt=0,composing=false;
  menu.addEventListener('compositionstart',()=>{composing=true;typed='';lastTypedAt=0;});
  menu.addEventListener('compositionend',()=>{composing=false;typed='';lastTypedAt=0;});

  const normalizeLabel=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  menu.addEventListener('toggle',()=>{
   const open=isOpen();
   more.setAttribute('aria-expanded',String(open));
   if(open){startTracking();position();}
   else{stopTracking();lastFocusedItem=null;typed='';lastTypedAt=0;composing=false;}
  });
  menu.onkeydown=e=>{
   // Escape/arrows are used by IME candidate windows. Never dismiss the
   // menu or change the selected action while composition is in progress.
   if(composing||e.isComposing||e.keyCode===229)return;
   const items=available(),index=items.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(e.key)){
    e.preventDefault();
    if(!items.length)return;
    const next=e.key==='Home'?0:e.key==='End'?items.length-1:
     e.key==='PageDown'?Math.min(items.length-1,Math.max(0,index)+5):
     e.key==='PageUp'?Math.max(0,(index<0?items.length-1:index)-5):
     index<0?(e.key==='ArrowDown'?0:items.length-1):
     (index+(e.key==='ArrowDown'?1:items.length-1))%items.length;
    focusItem(items[next]);
   }
   // Printable-key typeahead is important in long inspector menus. Repeated
   // letters cycle matches; accents are ignored for Portuguese labels. Never
   // steal keystrokes from an active IME candidate/composition session.
   if(e.key.length===1&&e.key!==' '&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&
      !e.isComposing&&e.keyCode!==229&&items.length){
    const now=performance.now(),letter=normalizeLabel(e.key);
    typed=now-lastTypedAt>700?letter:typed+letter;
    lastTypedAt=now;
    const repeated=[...typed].every(char=>char===letter);
    const query=repeated?letter:typed;
    const find=prefix=>Array.from({length:items.length},(_,step)=>items[(Math.max(index,0)+step+1)%items.length])
     .find(item=>normalizeLabel(item.textContent.trim()).startsWith(prefix));
    const match=find(query)||(query.length>1?find(letter):null);
    if(match){e.preventDefault();focusItem(match);}
   }
   if(e.key==='Escape'){e.preventDefault();menu.hidePopover();more.focus();}
   if(e.key==='Tab'){
    // Native Tab after hiding a top-layer popover can land on <body> when
    // the focused menuitem has tabindex=-1. Resolve the adjacent page stop
    // from the trigger before closing, including wrap at the document edge.
    e.preventDefault();
    const stops=[...document.querySelectorAll('a[href],area[href],button,input,select,textarea,[tabindex]')]
     .filter(el=>el.tabIndex>=0&&!el.matches(':disabled,[aria-disabled="true"]')&&
      !el.closest('[hidden],[inert],[aria-hidden="true"],[role="menu"]')&&
      el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
    const index=stops.indexOf(more),step=e.shiftKey?-1:1;
    const target=index>=0?stops[(index+step+stops.length)%stops.length]:toggle;
    menu.hidePopover();
    (target||toggle).focus();
   }
  };
  header.append(more,menu);
 }
 return header;
}
