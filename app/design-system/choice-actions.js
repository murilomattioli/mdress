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
 for(const config of actions){
  const {action,title,icon}=config;
  const button=document.createElement('button');button.type='button';button.className='ds-quick-action';button.dataset.action=action;
  button.setAttribute('aria-label',label+' — '+title);button.title=title;
  const glyph=document.createElement('ds-icon');glyph.setAttribute('name',icon);button.append(glyph);
  button.onclick=()=>{
   if(config.onSelect){config.onSelect();refresh();return;}
   const choices=readChoices();if(choices.length<2)return;
   const current=choices.findIndex(choice=>choice.selected);
   let index=action==='previous'?(current<0?choices.length-1:(current-1+choices.length)%choices.length):(current+1)%choices.length;
   if(action==='random'){const candidates=choices.map((_,i)=>i).filter(i=>i!==current);index=candidates[Math.floor(Math.random()*candidates.length)];}
   const choice=choices[index];choice.apply();status.textContent=choice.label;button.title=title+' · '+choice.label;
   refresh();
  };
  buttons.push({button,config});group.append(button);
 }
 function refresh(){
  // A source option can disappear or become disabled while its quick action
  // owns keyboard focus. Capture focus before changing the button state:
  // Chromium may move focus to <body> synchronously on disable/hide.
  const focused=buttons.find(({button})=>document.activeElement===button)?.button;
  const insufficient=readChoices().length<2;
  buttons.forEach(({button,config})=>{
   const disabled=Boolean(typeof config.disabled==='function'?config.disabled():config.disabled)||(!config.onSelect&&insufficient);
   const hidden=(typeof config.visible==='function'?config.visible():config.visible)===false;
   if(button.disabled!==disabled)button.disabled=disabled;
   if(button.hidden!==hidden)button.hidden=hidden;
  });
  if(focused&&(focused.disabled||focused.hidden)){
   const alternative=buttons.map(({button})=>button).find(button=>
    button!==focused&&!button.disabled&&!button.hidden&&button.getClientRects().length);
   if(alternative)alternative.focus({preventScroll:true});
   else if(typeof onUnavailableFocus==='function')onUnavailableFocus(focused);
  }
 }
 group.append(status);refresh();
 new MutationObserver(refresh).observe(source,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','selected','aria-pressed']});
 return group;
}
