/** Shared fieldset header: title/actions, optional menu, expansion at the far edge. */
let nextMenuId=0;
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
   const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=item.label;button.disabled=Boolean(item.disabled);
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
   const r=more.getBoundingClientRect(),height=menu.offsetHeight,width=menu.offsetWidth;
   const below=innerHeight-r.bottom-8,above=r.top-8;
   const openAbove=below<Math.min(height,160)&&above>below;
   const desiredTop=openAbove?r.top-height-4:r.bottom+4;
   menu.style.left=Math.max(8,Math.min(innerWidth-width-8,r.right-width))+'px';
   menu.style.top=Math.max(8,Math.min(innerHeight-height-8,desiredTop))+'px';
  };
  let frame=0,lastFocusedItem=null;
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
  };
  const stopTracking=()=>{
   window.removeEventListener('resize',schedulePosition);
   window.removeEventListener('scroll',schedulePosition,true);
   document.removeEventListener('pointerdown',clearOutsidePointer,true);
   window.visualViewport?.removeEventListener('resize',schedulePosition);
   if(frame){cancelAnimationFrame(frame);frame=0;}
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
    items[0]?.focus();
   }
  };
  syncAvailability();
  // Consumers can disable or hide actions after the header has been created.
  new MutationObserver(syncAvailability).observe(menu,{subtree:true,attributes:true,attributeFilter:['disabled','hidden','aria-disabled','aria-hidden','inert','class','style']});
  more.onclick=()=>{
   if(more.hidden||!available().length)return;
   if(isOpen()){menu.hidePopover();return;}
   menu.showPopover();position();available()[0]?.focus();
  };
  menu.addEventListener('toggle',()=>{
   const open=isOpen();
   more.setAttribute('aria-expanded',String(open));
   if(open){startTracking();position();}
   else{stopTracking();lastFocusedItem=null;}
  });
  menu.onkeydown=e=>{
   const items=available(),index=items.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
    e.preventDefault();
    if(!items.length)return;
    const next=e.key==='Home'?0:e.key==='End'?items.length-1:
     index<0?(e.key==='ArrowDown'?0:items.length-1):
     (index+(e.key==='ArrowDown'?1:items.length-1))%items.length;
    items[next].focus();
   }
   if(e.key==='Escape'){e.preventDefault();menu.hidePopover();more.focus();}
   if(e.key==='Tab')menu.hidePopover();
  };
  header.append(more,menu);
 }
 return header;
}
