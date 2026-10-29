import {initializePropertyControls,syncPropertyControls} from './design-system/property-controls.js';
/** Contextual document inspector: accessible tab navigation + compact numeric range fields. */
const $=id=>document.getElementById(id);
let currentTab='document';
const scrollPositions=new Map();
const legacyTabs={style:'document',sections:'content',background:'document',ai:'themes'};
export function setInspectorTab(name,{focus=false}={}){
 name=legacyTabs[name]||name;
 const tabs=[...document.querySelectorAll('[data-inspector-tab]')];
 const chosen=tabs.find(x=>x.dataset.inspectorTab===name);if(!chosen)return false;
 const scroller=document.querySelector('.inspector-scroll');
 if(currentTab!==name&&scroller)scrollPositions.set(currentTab,scroller.scrollTop);
 const changed=currentTab!==name;currentTab=name;
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
 if(focus)chosen.focus({preventScroll:true});
 return true;
}
export function inspectorPageSummary(count,diagnostics=[]){
 const node=$('inspectorPageCount'),warnings=$('inspectorLayoutWarning');
 if(node)node.textContent=count+' '+(count===1?'página':'páginas');
 if(warnings)warnings.textContent=diagnostics.length?diagnostics.length+' aviso(s)':'Sem avisos';
}
export function revealInspectorControl(id){
 const control=$(id);if(!control)return;
 const panel=control.closest('[data-inspector-panel]');if(panel)setInspectorTab(panel.dataset.inspectorPanel);
 const group=control.closest('.ds-accordion');const toggle=group?.querySelector('.ds-accordion-toggle');
 if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
 control.closest('.property-row')?.scrollIntoView({block:'nearest'});
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
   let target=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   setInspectorTab(tabs[target].dataset.inspectorTab,{focus:true});
  });
 }
 initializePropertyControls();
 setInspectorTab('document');
}
