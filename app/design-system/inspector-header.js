/** Shared fieldset header: title/actions, optional menu, expansion at the far edge. */
let nextMenuId=0;
// Accordion titles may change after creation (rename, localization, undo).
// Keep both the trigger and the top-layer menu named by the current toggle.
export function inspectorMenuLabel(toggle){
 return 'Opções de '+(toggle.getAttribute('aria-label')?.trim()||toggle.textContent.trim()||'seção');
}
// Pure geometry keeps keyboard scrolling local to the open popover.
export function menuScrollDelta(item,viewport,padding=4){
 // Zoom and text scaling can make one action taller than the menu viewport.
 // Keep its top visible instead of alternately scrolling to both edges.
 if(item.bottom-item.top>viewport.bottom-viewport.top-2*padding){
  return item.top<viewport.top+padding||item.top>=viewport.bottom-padding?
   item.top-viewport.top-padding:0;
 }
 if(item.top<viewport.top+padding)return item.top-viewport.top-padding;
 if(item.bottom>viewport.bottom-padding)return item.bottom-viewport.bottom+padding;
 return 0;
}
// Preserve the user's place in a long menu when a permission update removes
// the currently focused action. Prefer the next action, then the previous one.
export function nextAvailableMenuItem(allItems,availableItems,origin){
 const index=allItems.indexOf(origin);
 if(index<0)return availableItems[0]??null;
 const usable=new Set(availableItems);
 return allItems.slice(index+1).find(item=>usable.has(item))??
  allItems.slice(0,index).reverse().find(item=>usable.has(item))??null;
}
export function createInspectorHeader({toggle,actions,menuItems=[],menuVisibility='hover'}){
 const header=document.createElement('div');header.className='ds-accordion-header';header.append(toggle);
 if(actions){actions.classList.add('ds-accordion-actions');header.append(actions);}
 if(menuItems.length){
  const more=document.createElement('button');more.type='button';more.className='ds-header-menu-trigger ds-quick-action';more.dataset.visibility=menuVisibility;
  // Some accordion toggles are named by visible content, not aria-label.
  more.setAttribute('aria-label',inspectorMenuLabel(toggle));more.title=more.getAttribute('aria-label');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
  const icon=document.createElement('ds-icon');icon.setAttribute('name','ellipsis-vertical');more.append(icon);
  const menu=document.createElement('div');menu.className='ds-header-menu';menu.id='ds-header-menu-'+(++nextMenuId);
  menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label',more.getAttribute('aria-label'));
  more.setAttribute('aria-controls',menu.id);
  // Renaming a section must not leave stale names on its actions menu.
  // The observer is scoped to the title, not the whole document.
  const syncMenuName=()=>{
   const label=inspectorMenuLabel(toggle);
   if(more.getAttribute('aria-label')!==label){
    more.setAttribute('aria-label',label);more.title=label;
    menu.setAttribute('aria-label',label);
   }
  };
  new MutationObserver(syncMenuName).observe(toggle,{
   attributes:true,attributeFilter:['aria-label'],childList:true,characterData:true,subtree:true
  });
  // A top-layer popover is not governed by ancestor visibility. A feature
  // switch can disable or hide its host while the menu is open; late clicks
  // must not bypass the host's current interactive state.
  const headerInteractive=()=>{
   if(!header.isConnected||more.matches(':disabled')||
      more.closest('[inert],[aria-hidden="true"],[aria-disabled="true"]'))return false;
   for(let node=header;node;node=node.parentElement){
    if(node.hidden)return false;
    const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
   }
   return true;
  };
  const buttons=menuItems.map(item=>{
   const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;button.textContent=item.label;button.disabled=Boolean(item.disabled);
   button.onclick=()=>{
    // Enter can dispatch a native button click while an IME candidate is
    // being confirmed. Composition must never execute an inspector action.
    if(composing||!isOpen()||!headerInteractive()||!available().includes(button))return;
    menu.hidePopover();more.focus();item.onSelect();
   };
   menu.append(button);return button;
  });
  // Runtime permissions can also hide an action with CSS, inert or ARIA.
  // A native hidden/disabled check alone leaves invisible menuitems in the
  // roving keyboard order and may dispatch actions that are no longer offered.
  const available=()=>buttons.filter(button=>{
   if(!menu.contains(button)||button.matches(':disabled')||button.hidden||
      button.getAttribute('aria-disabled')==='true'||
      button.closest('[inert],[aria-hidden="true"],[aria-disabled="true"]'))return false;
   // A feature flag can hide a wrapper rather than the menuitem itself.
   // getComputedStyle(button).display stays visible for descendants of a
   // display:none ancestor, so inspect the path up to (not including) the
   // closed popover. Checking the popover would hide the trigger forever.
   for(let node=button;node&&node!==menu;node=node.parentElement){
    if(node.hidden)return false;
    const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
   }
   return true;
  });
  const isOpen=()=>menu.matches(':popover-open');
  // Keep the menu anchored when a responsive panel scrolls or resizes while open.
  const position=()=>{
   if(!isOpen()||!more.isConnected)return;
   // Responsive CSS can hide the host without mutating any attribute.
   // Window/visualViewport resize still invokes positioning: revoke the
   // top-layer popover instead of leaving actions floating over the page.
   if(!headerInteractive()){
    const focusLost=menu.contains(document.activeElement)||document.activeElement===more||
     document.activeElement===document.body;
    menu.hidePopover();
    if(focusLost)restoreFocusOutsideHost();
    return;
   }
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
  let frame=0,lastFocusedItem=null,menuResizeObserver=null,tracking=false;
  // A top-layer menu can outlive the interactivity of its accordion host.
  // Never return focus to a disabled/inert/hidden trigger when permissions
  // change: that would strand keyboard users on <body>.
  const restoreFocusOutsideHost=()=>{
   const usable=el=>Boolean(el?.isConnected&&!header.contains(el)&&el.tabIndex>=0&&
    !el.matches(':disabled,[aria-disabled="true"]')&&
    !el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')&&
    el.getClientRects().length&&getComputedStyle(el).visibility==='visible');
   const editor=document.querySelector('#source');
   const target=usable(editor)?editor:
    [...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].find(usable);
   target?.focus({preventScroll:true});
  };
  const hostObserver=new MutationObserver(()=>{
   if(!header.isConnected){
    // Detaching an open header may close its popover natively without a
    // toggle event. Release listeners/observers even in that case.
    const focusLost=menu.contains(document.activeElement)||document.activeElement===document.body;
    if(isOpen())menu.hidePopover();
    stopTracking();
    if(focusLost)restoreFocusOutsideHost();
    return;
   }
   if(!isOpen())return;
   if(!headerInteractive()){
    const focusLost=menu.contains(document.activeElement)||document.activeElement===more||
     document.activeElement===document.body;
    menu.hidePopover();
    if(focusLost)restoreFocusOutsideHost();
    return;
   }
   syncAvailability();schedulePosition();
  });
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
   if(tracking)return;
   tracking=true;
   window.addEventListener('resize',schedulePosition);
   window.addEventListener('scroll',schedulePosition,true);
   document.addEventListener('pointerdown',clearOutsidePointer,true);
   for(let node=header;node;node=node.parentElement){
    hostObserver.observe(node,{attributes:true,childList:true,attributeFilter:[
     'disabled','hidden','inert','aria-hidden','aria-disabled','class','style'
    ]});
   }
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
   if(!tracking)return;
   tracking=false;
   window.removeEventListener('resize',schedulePosition);
   window.removeEventListener('scroll',schedulePosition,true);
   document.removeEventListener('pointerdown',clearOutsidePointer,true);
   hostObserver.disconnect();
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
    // A disabled action can lose DOM focus before this observer fires. Keep
    // its original index so a long menu does not jump back to the top.
    focusItem(nextAvailableMenuItem(buttons,items,lastFocusedItem||document.activeElement));
   }
  };
  syncAvailability();
  // Consumers can disable or hide actions after the header has been created.
  // Actions may be removed/reinserted by permission-driven UI updates. A
  // detached button must never remain keyboard-reachable or executable; DOM
  // removal can also blur the focused item before the observer callback.
  new MutationObserver(syncAvailability).observe(menu,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','aria-disabled','aria-hidden','inert','class','style']});
  more.onclick=()=>{
   if(more.hidden||!headerInteractive()||!available().length)return;
   if(isOpen()){menu.hidePopover();return;}
   menu.showPopover();startTracking();position();focusItem(available()[0]);
  };
  let typed='',lastTypedAt=0,composing=false;
  menu.addEventListener('compositionstart',()=>{composing=true;typed='';lastTypedAt=0;});
  menu.addEventListener('compositionend',()=>{composing=false;typed='';lastTypedAt=0;});

  const normalizeLabel=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  menu.addEventListener('toggle',()=>{
   const open=isOpen();
   more.setAttribute('aria-expanded',String(open));
   if(open){startTracking();position();}
   else{
    // Reparenting into a disabled fieldset can natively close the popover
    // before MutationObserver sees the new ancestor. Recover keyboard focus
    // on the close event as well, but never steal it after normal dismissal.
    if(!headerInteractive()&&(menu.contains(document.activeElement)||
       document.activeElement===document.body))restoreFocusOutsideHost();
    stopTracking();lastFocusedItem=null;typed='';lastTypedAt=0;composing=false;
   }
  });
  menu.onkeydown=e=>{
   // Escape/arrows are used by IME candidate windows. Never dismiss the
   // menu or change the selected action while composition is in progress.
   if(composing||e.isComposing||e.keyCode===229){
    // A native popover may still dismiss on Escape, and Tab may move focus,
    // even though the application ignores these keys during IME composition.
    // Keep Enter's default IME confirmation; the click handler guards it.
    if(e.key==='Escape'||e.key==='Tab')e.preventDefault();
    return;
   }
   const items=available(),index=items.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(e.key)){
    // Arrow/page navigation starts a new search context. Otherwise a quick
    // printable key can accidentally extend the typeahead used before moving.
    typed='';lastTypedAt=0;
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
      !el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"],[role="menu"]')&&
      el.getClientRects().length&&getComputedStyle(el).visibility==='visible');
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
