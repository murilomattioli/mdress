/** Shared fieldset header: title/actions, optional menu, expansion at the far edge. */
let nextMenuId=0;
export function createInspectorHeader({toggle,actions,menuItems=[],menuVisibility='hover'}){
 const header=document.createElement('div');header.className='ds-accordion-header';header.append(toggle);
 if(actions){actions.classList.add('ds-accordion-actions');header.append(actions);}
 if(menuItems.length){
  const more=document.createElement('button');more.type='button';more.className='ds-header-menu-trigger ds-quick-action';more.dataset.visibility=menuVisibility;
  more.setAttribute('aria-label','Opções de '+toggle.getAttribute('aria-label'));more.title=more.getAttribute('aria-label');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
  const icon=document.createElement('ds-icon');icon.setAttribute('name','ellipsis-vertical');more.append(icon);
  const menu=document.createElement('div');menu.className='ds-header-menu';menu.id='ds-header-menu-'+(++nextMenuId);
  menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label',more.getAttribute('aria-label'));
  more.setAttribute('aria-controls',menu.id);
  const buttons=menuItems.map(item=>{
   const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=item.label;button.disabled=Boolean(item.disabled);
   button.onclick=()=>{menu.hidePopover();more.focus();item.onSelect();};menu.append(button);return button;
  });
  const enabled=()=>buttons.filter(button=>!button.disabled&&!button.hidden);
  // An entirely unavailable menu must not occupy a phantom header action or
  // open a popover without a reachable menuitem.
  if(!enabled().length)more.hidden=true;
  more.onclick=()=>{
   if(more.hidden||!enabled().length)return;
   if(menu.matches(':popover-open')){menu.hidePopover();return;}
   menu.showPopover();
   const r=more.getBoundingClientRect();
   const height=menu.offsetHeight,width=menu.offsetWidth;
   const below=innerHeight-r.bottom-8,above=r.top-8;
   const openAbove=below<Math.min(height,160)&&above>below;
   const desiredTop=openAbove?r.top-height-4:r.bottom+4;
   menu.style.left=Math.max(8,Math.min(innerWidth-width-8,r.right-width))+'px';
   menu.style.top=Math.max(8,Math.min(innerHeight-height-8,desiredTop))+'px';
   enabled()[0]?.focus();
  };
  menu.addEventListener('toggle',()=>more.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
  menu.onkeydown=e=>{
   const items=enabled(),index=items.indexOf(document.activeElement);
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
