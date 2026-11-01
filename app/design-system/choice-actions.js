/** Shared previous/next/random actions. Adapters supply current enabled choices. */
export function createChoiceActions({label,source,readChoices,onUnavailableFocus=null,actions=[
 {action:'previous',title:'Anterior',icon:'arrow-left'},
 {action:'next',title:'Próximo',icon:'arrow-right'},
 {action:'random',title:'Aleatório',icon:'shuffle'}
]}){
 const group=document.createElement('div');group.className='ds-choice-actions';
 group.setAttribute('role','group');group.setAttribute('aria-label','Alternar '+label);
 const status=document.createElement('span');status.className='ds-quick-status';status.setAttribute('role','status');
 const buttons=[];
 let lastFocusedAction=null;
 group.addEventListener('focusin',event=>{
  if(buttons.some(({button})=>button===event.target))lastFocusedAction=event.target;
 });
 group.addEventListener('focusout',event=>{
  if(event.relatedTarget&&event.relatedTarget!==document.body)lastFocusedAction=null;
 });
 // Quick actions can sit in an accordion header while their native source is
 // inside its body. Evaluate permissions on BOTH trees, not only the header.
 // HTML fieldset's first-legend exception applies independently to each tree.
 const inDisabledFieldset=element=>{
  for(let parent=element.parentElement;parent;parent=parent.parentElement){
   if(parent.tagName!=='FIELDSET'||!parent.disabled)continue;
   const legend=[...parent.children].find(child=>child.tagName==='LEGEND');
   if(!legend?.contains(element))return true;
  }
  return false;
 };
 const permissionRevoked=()=>Boolean(group.isConnected&&!source.isConnected)||
  source.matches?.(':disabled,[aria-disabled="true"],[inert]')||
  Boolean(source.parentElement?.closest('[aria-disabled="true"],[inert]'))||
  Boolean(group.closest('[aria-disabled="true"],[inert]'))||
  inDisabledFieldset(group);
 // A synthetic click can race with a disabled fieldset, hidden panel or
 // detached source before a MutationObserver updates the quick-action UI.
 // Validate both the visible action and its native source at dispatch time.
 const actionable=button=>{
  if(!button.isConnected||!group.contains(button)||button.disabled||button.hidden||
     !source.isConnected||button.matches(':disabled')||permissionRevoked())return false;
  if(group.closest('[hidden],[aria-hidden="true"]')||
     source.parentElement?.closest('[hidden],[aria-hidden="true"]'))return false;
  if(getComputedStyle(button).visibility!=='visible'||!button.getClientRects().length)return false;
  for(let node=button;node;node=node.parentElement){
   const style=getComputedStyle(node);
   if(style.display==='none'||style.contentVisibility==='hidden')return false;
  }
  return true;
 };
 for(const config of actions){
  const {action,title,icon}=config;
  const button=document.createElement('button');button.type='button';button.className='ds-quick-action';button.dataset.action=action;
  button.setAttribute('aria-label',label+' — '+title);button.title=title;
  const glyph=document.createElement('ds-icon');glyph.setAttribute('name',icon);button.append(glyph);
  button.onclick=()=>{
   if(!actionable(button))return;
   if(config.onSelect){config.onSelect();refresh();return;}
   const choices=readChoices();if(choices.length<2)return;
   const current=choices.findIndex(choice=>choice.selected);
   let index=action==='previous'?(current<0?choices.length-1:(current-1+choices.length)%choices.length):(current+1)%choices.length;
   if(action==='random'){const candidates=choices.map((_,i)=>i).filter(i=>i!==current);index=candidates[Math.floor(Math.random()*candidates.length)];}
   const choice=choices[index];
   // A stale adapter may decline a commit after native permissions change.
   // Do not announce a selection that never reached the source of truth.
   if(choice.apply()===false){refresh();return;}
   status.textContent=choice.label;button.title=title+' · '+choice.label;
   refresh();
  };
  buttons.push({button,config});group.append(button);
 }
 function refresh(){
  // A source option can disappear or become disabled while its quick action
  // owns keyboard focus. Capture focus before changing the button state:
  // Chromium may move focus to <body> synchronously on disable/hide.
  const focused=buttons.find(({button})=>document.activeElement===button)?.button||
   (document.activeElement===document.body?lastFocusedAction:null);
  const locked=permissionRevoked();
  const insufficient=locked||readChoices().length<2;
  buttons.forEach(({button,config})=>{
   const disabled=locked||Boolean(typeof config.disabled==='function'?config.disabled():config.disabled)||(!config.onSelect&&insufficient);
   const hidden=(typeof config.visible==='function'?config.visible():config.visible)===false;
   if(button.disabled!==disabled)button.disabled=disabled;
   if(button.hidden!==hidden)button.hidden=hidden;
  });
  if(focused&&(focused.disabled||focused.hidden||focused.matches(':disabled'))){
   lastFocusedAction=null;
   const alternative=buttons.map(({button})=>button).find(button=>
    button!==focused&&!button.disabled&&!button.hidden&&!button.matches(':disabled')&&
    button.getClientRects().length);
   if(alternative)alternative.focus({preventScroll:true});
   else if(typeof onUnavailableFocus==='function')onUnavailableFocus(focused);
  }
 }
 group.append(status);refresh();
 new MutationObserver(refresh).observe(source,{
  childList:true,subtree:true,attributes:true,
  attributeFilter:['disabled','hidden','selected','aria-pressed','aria-disabled','inert']
 });
 // Source and action group can have different ancestor chains. Follow both
 // after reparenting, including disabled fieldsets created after enhancement.
 // Observe direct children only: unrelated subtree changes do not refresh UX.
 const ancestryObserver=new MutationObserver(records=>{
  const relevant=records.some(record=>record.type==='attributes'||
   [...record.addedNodes,...record.removedNodes].some(node=>
    node===source||node===group||node.contains?.(source)||node.contains?.(group)));
  if(!relevant)return;
  watchAncestors();refresh();
 });
 const watchAncestors=()=>{
  ancestryObserver.disconnect();
  const ancestors=new Set();
  for(const element of [source,group])
   for(let node=element;node;node=node.parentElement)ancestors.add(node);
  for(const node of ancestors)ancestryObserver.observe(node,{
   attributes:true,childList:true,
   attributeFilter:['disabled','aria-disabled','inert','hidden','aria-hidden','class','style']
  });
 };
 watchAncestors();
 return group;
}
