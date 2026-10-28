import {initializePropertyControls,syncPropertyControls} from './design-system/property-controls.js';
import {organizeInspector} from './inspector-organization.js';
/** Contextual document inspector: accessible tab navigation + compact numeric range fields. */
const $=id=>document.getElementById(id);
let currentTab='style';
export function setInspectorTab(name,{focus=false}={}){
 const tabs=[...document.querySelectorAll('[data-inspector-tab]')];
 const chosen=tabs.find(x=>x.dataset.inspectorTab===name);if(!chosen)return false;
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
 if(focus)chosen.focus();
 return true;
}
export function inspectorPageSummary(count,diagnostics=[]){
 const node=$('inspectorPageCount'),warnings=$('inspectorLayoutWarning');
 if(node)node.textContent=count+' '+(count===1?'página':'páginas');
 if(warnings)warnings.textContent=diagnostics.length?diagnostics.length+' aviso(s)':'Sem avisos';
}
export function updatePropertyReadouts(){syncPropertyControls();}
export function initializeInspector(){
 organizeInspector();
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
 setInspectorTab('style');
}
