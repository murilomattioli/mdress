import {initializePropertyControls,syncPropertyControls} from './design-system/property-controls.js';
/** Contextual document inspector: accessible tab navigation + compact numeric range fields. */
const $=id=>document.getElementById(id);
let currentTab='document';
const scrollPositions=new Map();
const legacyTabs={style:'document',sections:'content',background:'document',ai:'themes'};
let tabAvailabilityObserver=null,tabAvailabilityResize=null;
// Roving tab focus must skip permission-revoked and CSS-hidden destinations.
// A tab with tabindex=-1 is still eligible for arrow navigation.
const keyboardTabAvailable=tab=>{
 if(!tab?.isConnected||tab.matches(':disabled,[aria-disabled="true"]')||
    tab.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')||
    !tab.getClientRects().length)return false;
 for(let node=tab;node;node=node.parentElement){
  const style=getComputedStyle(node);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||
     style.contentVisibility==='hidden')return false;
 }
 return true;
};
// Programmatic navigation can preselect a panel before its responsive shell
// opens. Inspect tab-local permissions without treating a collapsed inspector
// as a disabled destination (the keyboard path remains stricter).
const tabSelectable=tab=>{
 if(!tab?.isConnected||tab.matches(':disabled,[aria-disabled="true"]')||
    tab.closest('[inert],[aria-hidden="true"],[aria-disabled="true"]'))return false;
 for(let node=tab;node;node=node.parentElement){
  if(node.hidden)return false;
  const style=getComputedStyle(node);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||
     style.contentVisibility==='hidden')return false;
  if(node.matches('.inspector-tabs'))break;
 }
 return true;
};
export function setInspectorTab(name,{focus=false}={}){
 name=legacyTabs[name]||name;
 const tabs=[...document.querySelectorAll('[data-inspector-tab]')];
 const chosen=tabs.find(x=>x.dataset.inspectorTab===name);
 // Programmatic calls and synthetic clicks must obey the same permissions
 // as keyboard navigation. Never select a hidden or disabled tab/panel.
 if(!tabSelectable(chosen))return false;
 const scroller=document.querySelector('.inspector-scroll');
 if(currentTab!==name&&scroller)scrollPositions.set(currentTab,scroller.scrollTop);
 const changed=currentTab!==name;
 // A programmatic panel switch can hide the focused property input. Move
 // focus to the newly selected tab before its panel becomes unavailable.
 const focusWasInHiddenPanel=changed&&[...document.querySelectorAll('[data-inspector-panel]')]
  .some(panel=>panel.dataset.inspectorPanel!==name&&panel.contains(document.activeElement));
 currentTab=name;
 for(const tab of tabs){
  const active=tab===chosen;
  tab.setAttribute('aria-selected',String(active));
  tab.tabIndex=active?0:-1;
 }
 for(const panel of document.querySelectorAll('[data-inspector-panel]')){
  const active=panel.dataset.inspectorPanel===name;
  panel.classList.toggle('hidden',!active);
  panel.setAttribute('aria-hidden',String(!active));
 }
 if(changed&&scroller)scroller.scrollTop=scrollPositions.get(name)||0;
 if(focus||focusWasInHiddenPanel)chosen.focus({preventScroll:true});
 return true;
}
export function inspectorPageSummary(count,diagnostics=[]){
 const node=$('inspectorPageCount'),warnings=$('inspectorLayoutWarning');
 if(node)node.textContent=count+' '+(count===1?'página':'páginas');
 if(warnings)warnings.textContent=diagnostics.length?diagnostics.length+' aviso(s)':'Sem avisos';
}
export function revealInspectorControl(id){
 const control=$(id);if(!control)return false;
 const panel=control.closest('[data-inspector-panel]');
 // A deep link must not expand or scroll a property inside a revoked tab.
 if(panel&&!setInspectorTab(panel.dataset.inspectorPanel))return false;
 const group=control.closest('.ds-accordion');const toggle=group?.querySelector('.ds-accordion-toggle');
 if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
 control.closest('.property-row')?.scrollIntoView({block:'nearest'});
 return true;
}
export function updatePropertyReadouts(){
 const kind=$('bgKind')?.value;
 const patterns=['dots','lines','grid','crosshatch','checker'];
 const secondary=$('bgSecondary')?.closest('.property-row')?.querySelector('.ds-prop-name');
 if(secondary){secondary.textContent=kind==='radial'?'Cor central':kind==='gradient'?'Cor final':'Cor do padrão';secondary.title=secondary.textContent;}

 for(const [id,visible] of Object.entries({bgRadialX:kind==='radial',bgRadialY:kind==='radial',bgRadialRadius:kind==='radial',bgSecondary:!['solid','mesh'].includes(kind),bgAngle:['gradient','lines'].includes(kind),bgPatternSize:patterns.includes(kind),bgOpacity:patterns.includes(kind)})){
  $(id)?.closest('.property-row')?.classList.toggle('hidden',!visible);
 }
 syncPropertyControls();
}
export function initializeInspector(){
 const tabs=[...document.querySelectorAll('[data-inspector-tab]')];
 for(const [index,tab] of tabs.entries()){
  tab.onclick=()=>setInspectorTab(tab.dataset.inspectorTab);
  tab.addEventListener('keydown',event=>{
   const keys=['ArrowRight','ArrowLeft','Home','End'];
   if(!keys.includes(event.key))return;
   event.preventDefault();
   const available=tabs.filter(keyboardTabAvailable);
   if(!available.length)return;
   const current=available.indexOf(tab);
   const step=event.key==='ArrowRight'?1:-1;
   // A programmatically focused but revoked tab is not in `available`.
   // From that state, Right starts at the first tab and Left at the last.
   const target=event.key==='Home'?available[0]:event.key==='End'?available.at(-1):
    current<0?(step>0?available[0]:available.at(-1)):
    available[(current+step+available.length)%available.length];
   setInspectorTab(target.dataset.inspectorTab,{focus:true});
  });
 }
 // Permissions can be revoked while a tab or a property inside its panel
 // owns focus. Reconcile selection rather than leaving an inaccessible
 // aria-selected=true tab or a focused control inside a hidden panel.
 tabAvailabilityObserver?.disconnect();
 if(tabAvailabilityResize)window.removeEventListener('resize',tabAvailabilityResize);
 const reconcileTabs=()=>{
  const selected=tabs.find(tab=>tab.dataset.inspectorTab===currentTab);
  if(keyboardTabAvailable(selected))return;
  const available=tabs.filter(keyboardTabAvailable);
  if(!available.length)return; // Inspector itself may be collapsed.
  const index=Math.max(0,tabs.indexOf(selected));
  const fallback=[...tabs.slice(index+1),...tabs.slice(0,index+1)]
   .find(keyboardTabAvailable)||available[0];
  const active=document.activeElement;
  const focusLost=active===selected||active===document.body||
   [...document.querySelectorAll('[data-inspector-panel]')]
    .some(panel=>panel.dataset.inspectorPanel===currentTab&&panel.contains(active));
  setInspectorTab(fallback.dataset.inspectorTab,{focus:focusLost});
 };
 const tablist=document.querySelector('.inspector-tabs');
 if(tablist){
  tabAvailabilityObserver=new MutationObserver(reconcileTabs);
  tabAvailabilityObserver.observe(tablist,{attributes:true,childList:true,subtree:true,
   attributeFilter:['disabled','hidden','inert','aria-disabled','aria-hidden','class','style']});
 }
 tabAvailabilityResize=reconcileTabs;
 window.addEventListener('resize',tabAvailabilityResize);
 initializePropertyControls();
 setInspectorTab('document');
}
