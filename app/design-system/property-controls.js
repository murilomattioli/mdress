/**
 * DS v4 • Professional inspector controls.
 * Progressive enhancement: native controls keep their IDs, constraints and
 * source-of-truth listeners. No duplicated theme state or external dependencies.
 */
const enhanced=new WeakSet();
const controllers=[];
let openSelect=null;
let nextUid=0;
const $=(id)=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const unitOf=(el)=>({
 fontSize:'pt',marginMm:'mm',sectionGapEm:'em',lineHeight:'×',
 titleScale:'×',bgAngle:'°',bgPatternSize:'px',bgOpacity:'',meshSoftness:'%'
})[el.id]??'';
const labelOf=(label)=>{
 const texts=[...label.childNodes].filter(n=>n.nodeType===3);
 const title=texts.map(n=>n.textContent).join(' ').trim();
 for(const node of texts)node.remove();
 return title.replace(/\s+/g,' ');
};
function span(cls,text=''){const x=document.createElement('span');x.className=cls;x.textContent=text;return x;}
function button(cls,title){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=title;return b;}
export function normalizeRange(value,min,max,step){
 if(![value,min,max,step].every(Number.isFinite)||min>=max||step<=0)throw Error('Faixa inválida');
 const snapped=Math.round((clamp(value,min,max)-min)/step)*step+min;
 const precision=(String(step).split('.')[1]??'').length;
 return Number(clamp(Number(snapped.toFixed(Math.min(precision,6))),min,max).toFixed(Math.min(precision,6)));
}
export function formatControlValue(v,unit=''){
 const value=Number(v);
 const body=Number.isInteger(value)?String(value):String(Number(value.toFixed(3)));
 return body+(unit&&unit!=='×'?' '+unit:unit);
}
export function validationMessage(input,min,max,unit=''){
 if(input.value.trim()==='')return 'Informe um valor.';
 if(input.validity.rangeUnderflow||input.validity.rangeOverflow)return 'Use um valor entre '+min+' e '+max+(unit?' '+unit:'')+'.';
 if(input.validity.stepMismatch)return 'Use um valor compatível com o incremento permitido.';
 return 'Informe um número válido.';
}
function feedbackFor(label,control){
 const feedback=span('ds-prop-error');
 feedback.id='ds-prop-error-'+(++nextUid);
 feedback.setAttribute('aria-live','polite');
 feedback.hidden=true;
 label.append(feedback);
 const previous=control.getAttribute('aria-describedby');
 control.setAttribute('aria-describedby',[previous,feedback.id].filter(Boolean).join(' '));
 return message=>{
  feedback.textContent=message||'';
  feedback.hidden=!message;
  if(message)control.setAttribute('aria-invalid','true');
  else control.removeAttribute('aria-invalid');
 };
}
function nativeCommit(input,next){
 if(input.disabled)return;
 input.value=String(next);
 input.dispatchEvent(new Event('input',{bubbles:true}));
 input.dispatchEvent(new Event('change',{bubbles:true}));
}
function enhanceRange(label,input,title){
 const min=Number(input.min),max=Number(input.max),step=Number(input.step||1);
 const unit=unitOf(input);
 if(![min,max,step].every(Number.isFinite)||min>=max)return;
 label.classList.add('ds-property-row','ds-property-row--range');
 const field=document.createElement('div');field.className='ds-property-range';
 const name=span('ds-prop-name',title);
 const progress=document.createElement('span');progress.className='ds-prop-track';
 const fill=span('ds-prop-fill'),ticks=span('ds-prop-ticks'),thumb=span('ds-prop-thumb');
 const valueBox=document.createElement('div');valueBox.className='ds-prop-numberbox';
 const numeric=document.createElement('input');numeric.type='number';numeric.className='ds-prop-number';
 numeric.min=input.min;numeric.max=input.max;numeric.step=input.step||'1';
 numeric.setAttribute('aria-label',title+' — valor'+(unit?' em '+unit:''));
 const setError=feedbackFor(label,numeric);
 const unitBadge=span('ds-prop-unit',unit);
 if(!unit)unitBadge.classList.add('hidden');
 input.classList.add('ds-range-native');
 if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',title);
 input.setAttribute('title',title);
 input.replaceWith(field);
 field.append(name,progress,valueBox);
 progress.append(fill,ticks,thumb,input);valueBox.append(numeric,unitBadge);
 // The precision field is an editable draft. Never silently clamp or snap
 // invalid values: preserve them for correction without mutating the document.
 const valid=()=>numeric.value.trim()!==''&&numeric.validity.valid&&Number.isFinite(numeric.valueAsNumber);
 let editing=false;
 const update=()=>{
  const value=Number(input.value),pct=(clamp(value,min,max)-min)/(max-min)*100;
  field.style.setProperty('--ds-range-progress',pct+'%');
  if(input.disabled)editing=false;
  numeric.disabled=input.disabled;
  if(!editing)numeric.value=input.value;
  setError(!input.disabled&&editing&&!valid()?validationMessage(numeric,min,max,unit):'');
  if(!Number.isNaN(value))field.setAttribute('data-value',formatControlValue(value,unit));
 };
 input.addEventListener('input',update);
 input.addEventListener('change',update);
 numeric.addEventListener('input',()=>{editing=true;update();});
 numeric.addEventListener('change',()=>{
  if(!valid()){editing=true;update();return;}
  const value=numeric.valueAsNumber;
  editing=false;
  nativeCommit(input,normalizeRange(value,min,max,step));
  update();
 });
 numeric.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();editing=false;update();numeric.blur();}
  if(e.key==='Enter'){numeric.dispatchEvent(new Event('change'));if(valid())numeric.blur();}
 });
 // Double-click resets only when an explicit initial value is available.
 const initial=Number(input.defaultValue);
 if(input.hasAttribute('value')&&Number.isFinite(initial))field.title='Clique duas vezes na régua para restaurar';
 if(input.hasAttribute('value'))progress.addEventListener('dblclick',()=>nativeCommit(input,normalizeRange(initial,min,max,step)));
 const output=label.querySelector('output');if(output)output.classList.add('property-visually-hidden');
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled']});
 controllers.push(update);update();
}
function enhanceNumber(label,input,title){
 label.classList.add('ds-property-row','ds-property-row--number');
 const field=document.createElement('div');field.className='ds-property-number';
 const name=span('ds-prop-name',title),controls=document.createElement('span');controls.className='ds-number-actions';
 const minus=button('ds-number-step','−'),plus=button('ds-number-step','+');
 minus.setAttribute('aria-label','Diminuir '+title);plus.setAttribute('aria-label','Aumentar '+title);
 const unit=span('ds-prop-unit',unitOf(input));
 if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',title+' — valor'+(unitOf(input)?' em '+unitOf(input):''));
 input.classList.add('ds-number-native');
 input.replaceWith(field);field.append(name,controls);controls.append(minus,input,unit,plus);
 const min=Number(input.min||0),max=Number(input.max||999),step=Number(input.step||1);
 const setError=feedbackFor(label,input);
 const valid=()=>input.value.trim()!==''&&input.validity.valid&&Number.isFinite(input.valueAsNumber);
 let committed=input.value,editing=false;
 const update=()=>{
  const ok=valid();
  if(!editing&&ok)committed=input.value;
  setError(editing&&!ok?validationMessage(input,min,max,unitOf(input)):'');
  minus.disabled=input.disabled||!ok||Number(input.value)<=min;
  plus.disabled=input.disabled||!ok||Number(input.value)>=max;
 };
 const increment=direction=>{
  if(!valid())return;
  nativeCommit(input,normalizeRange(Number(input.value)+direction*step,min,max,step));
  update();
 };
 minus.onclick=()=>increment(-1);plus.onclick=()=>increment(1);
 input.addEventListener('input',()=>{editing=true;update();});
 // Capture before the app's change listener: an invalid draft must never mutate the document.
 input.addEventListener('change',event=>{
  if(!valid()){
   editing=true;update();event.preventDefault();event.stopImmediatePropagation();return;
  }
  editing=false;committed=input.value;update();
 },true);
 input.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!editing)return;
  event.preventDefault();input.value=committed;editing=false;update();
 });
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled']});
 controllers.push(update);update();
}
function enhanceColor(label,input,title){
 label.classList.add('ds-property-row','ds-property-row--color');
 const field=document.createElement('div');field.className='ds-property-color';
 const name=span('ds-prop-name',title),right=document.createElement('div');right.className='ds-color-right';
 const swatch=document.createElement('span');swatch.className='ds-color-swatch';
 const hex=document.createElement('input');hex.type='text';hex.className='ds-color-hex';hex.maxLength=7;
 hex.spellcheck=false;hex.autocomplete='off';hex.setAttribute('aria-label',title+' — hexadecimal');
 hex.setAttribute('inputmode','text');
 const setError=feedbackFor(label,hex);
 input.classList.add('ds-color-native');
 input.replaceWith(field);
 field.append(name,right);right.append(swatch,hex);swatch.append(input);
 const isHex=v=>/^#[0-9a-f]{6}$/i.test(v);
 const update=()=>{const v=input.value.toUpperCase();hex.value=v;hex.disabled=input.disabled;setError('');swatch.style.backgroundColor=v;};
 // Keep invalid user input visible for correction instead of replacing it with
 // the last saved color while leaving a stale aria-invalid state behind.
 hex.addEventListener('input',()=>{
  setError(isHex(hex.value.trim())?'':'Use uma cor hexadecimal com seis dígitos (#RRGGBB).');
 });
 hex.addEventListener('change',()=>{
  const v=hex.value.trim();
  if(!isHex(v)){setError('Use uma cor hexadecimal com seis dígitos (#RRGGBB).');return;}
  setError('');nativeCommit(input,v);update();
 });
 hex.addEventListener('keydown',e=>{
  if(e.key==='Escape'){update();hex.blur();}
  if(e.key==='Enter'){hex.dispatchEvent(new Event('change'));if(isHex(hex.value.trim()))hex.blur();}
 });
 input.addEventListener('input',update);input.addEventListener('change',update);
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled']});
 controllers.push(update);update();
}
function enhanceBinary(label,input,title){
 label.classList.add('ds-property-row','ds-property-row--binary');
 const field=document.createElement('div');field.className='ds-property-binary';
 const name=span('ds-prop-name',title),group=document.createElement('div');group.className='ds-binary-group';
 group.setAttribute('role','group');group.setAttribute('aria-label',title);
 const off=button('ds-binary-option','Off'),on=button('ds-binary-option','On');
 off.setAttribute('aria-label',title+' desligado');on.setAttribute('aria-label',title+' ligado');
 input.classList.add('ds-binary-native');input.setAttribute('aria-hidden','true');input.tabIndex=-1;
 input.replaceWith(field);field.append(name,group,input);group.append(off,on);
 const update=()=>{
  off.setAttribute('aria-pressed',String(!input.checked));
  on.setAttribute('aria-pressed',String(input.checked));
  // The native checkbox remains the source of truth for disabled state.
  // In particular, bottomSectionEnabled is disabled when no section is selected.
  off.disabled=input.disabled;on.disabled=input.disabled;
 };
 const commit=val=>{
  if(input.disabled)return;
  input.checked=val;input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));update();
 };
 off.onclick=()=>commit(false);on.onclick=()=>commit(true);
 for(const [index,btn] of [off,on].entries())btn.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const value=e.key==='Home'?false:e.key==='End'?true:e.key==='ArrowRight'?true:false;
  const next=value?on:off;next.focus();commit(value);
 });
 input.addEventListener('change',update);
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled']});
 controllers.push(update);update();
}
// Keyboard navigation must never land on a disabled segment (including disabled optgroups).
export function nextEnabledSegmentIndex(disabled,current,key){
 const length=disabled.length;
 if(!length||disabled.every(Boolean))return -1;
 if(key==='Home')return disabled.findIndex(value=>!value);
 if(key==='End')return disabled.findLastIndex(value=>!value);
 const direction=key==='ArrowLeft'?-1:1;
 for(let offset=1;offset<=length;offset++){
  const index=(current+direction*offset+length*2)%length;
  if(!disabled[index])return index;
 }
 return -1;
}
function enhanceSegment(label,select,title){
 label.classList.add('ds-property-row','ds-property-row--segment');
 const field=document.createElement('div');field.className='ds-property-segment';
 const name=span('ds-prop-name',title),group=document.createElement('div');group.className='ds-segment-buttons';
 group.setAttribute('role','group');group.setAttribute('aria-label',title);
 select.classList.add('ds-select-native');
 select.setAttribute('aria-hidden','true');select.tabIndex=-1;
 select.replaceWith(field);field.append(name,group,select);
 const elements=[];
 const compact={
  fontChoice:{system:'Sans',serif:'Serif',mono:'Mono'},
  sectionRule:{line:'Linha',none:'Nenhum',block:'Bloco'}
 }[select.id]||{};
 for(const option of select.options){
  const btn=button('ds-segment-option',compact[option.value]||option.textContent);
  btn.setAttribute('aria-pressed',String(select.value===option.value));
  btn.dataset.value=option.value;
  btn.onclick=()=>{if(!select.disabled&&!isSelectOptionDisabled(option))nativeCommit(select,option.value);};
  btn.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();
   const next=nextEnabledSegmentIndex(elements.map(item=>item.disabled),elements.indexOf(btn),e.key);
   if(next!==-1){elements[next].focus();elements[next].click();}
  });
  elements.push(btn);group.append(btn);
 }
 const update=()=>{
  const focused=elements.indexOf(document.activeElement);
  for(const [index,btn] of elements.entries()){
   btn.setAttribute('aria-pressed',String(btn.dataset.value===select.value));
   btn.disabled=select.disabled||isSelectOptionDisabled(select.options[index]);
  }
  // When the active option becomes disabled, keep keyboard focus in the group.
  if(focused!==-1&&elements[focused].disabled){
   const next=nextEnabledSegmentIndex(elements.map(item=>item.disabled),focused,'ArrowRight');
   if(next!==-1)elements[next].focus();
   else {group.tabIndex=-1;group.focus();}
  }
 };
 new MutationObserver(update).observe(select,{subtree:true,attributes:true,attributeFilter:['disabled']});
 select.addEventListener('change',update);controllers.push(update);update();
}
function closePopup({restoreFocus=true}={}){
 if(!openSelect)return;
 const {popup,trigger,onClose}=openSelect;
 popup.remove();trigger.setAttribute('aria-expanded','false');
 openSelect=null;onClose?.();
 if(restoreFocus)trigger.focus();
}
export function isSelectOptionDisabled(option){
 return Boolean(option.disabled||(option.parentElement?.tagName==='OPTGROUP'&&option.parentElement.disabled));
}
// Native-select-style typeahead: skip disabled options and cycle repeated initials.
export function findEnabledOptionIndex(options,prefix,afterIndex=-1){
 const query=String(prefix).trim().toLocaleLowerCase();
 if(!query||!options.length)return -1;
 for(let offset=1;offset<=options.length;offset++){
  const index=(afterIndex+offset+options.length)%options.length;
  const option=options[index];
  if(!option.disabled&&String(option.label).trim().toLocaleLowerCase().startsWith(query))return index;
 }
 return -1;
}
// Keep a portalled listbox fully visible, even near the right/bottom edges
// of the viewport. Shared by opening and inspector-scroll repositioning.
export function selectPopoverLayout(anchor,viewport,contentHeight){
 const margin=8,gap=5;
 const width=Math.min(Math.max(0,viewport.width-2*margin),Math.max(194,anchor.width));
 const left=clamp(anchor.left,margin,Math.max(margin,viewport.width-margin-width));
 const below=Math.max(0,viewport.height-margin-anchor.bottom-gap);
 const above=Math.max(0,anchor.top-margin-gap);
 const desired=Math.min(300,Math.max(0,contentHeight));
 const placeAbove=below<Math.min(155,desired)&&above>below;
 const space=placeAbove?above:below;
 const maxHeight=Math.min(300,space);
 const top=placeAbove?anchor.top-gap-Math.min(desired,maxHeight):anchor.bottom+gap;
 return {left,top,width,maxHeight,placement:placeAbove?'above':'below'};
}
function makeListbox(label,select,title){
 label.classList.add('ds-property-row','ds-property-row--select');
 const field=document.createElement('div');field.className='ds-property-select';
 const name=span('ds-prop-name',title),trigger=button('ds-select-trigger','');
 trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 trigger.setAttribute('aria-label',title);
 const value=span('ds-select-value'),chevron=span('ds-select-chevron','⌄');
 trigger.append(value,chevron);
 select.classList.add('ds-select-native');
 select.setAttribute('aria-hidden','true');select.tabIndex=-1;
 select.replaceWith(field);field.append(name,trigger,select);
 const popupId='ds-select-list-'+(++nextUid);
 trigger.setAttribute('aria-controls',popupId);
 const update=()=>{
  const o=select.selectedOptions[0];value.textContent=o?.label||o?.textContent||'Selecionar';
  // The hidden native select owns availability; the visible combobox must follow it.
  trigger.disabled=select.disabled;
  if(select.disabled&&openSelect?.trigger===trigger){closePopup({restoreFocus:false});return;}
  if(openSelect?.trigger===trigger){
   const focusedOption=openSelect.optionItems.find(({item})=>item===document.activeElement);
   for(const {option,item} of openSelect.optionItems){
    item.disabled=isSelectOptionDisabled(option);
    item.setAttribute('aria-selected',String(select.value===option.value));
   }
   if(focusedOption?.item.disabled){
    (openSelect.optionItems.find(({item})=>!item.disabled)?.item||trigger).focus();
   }
  }
 };
 const open=()=>{
  if(select.disabled)return;
  if(openSelect?.trigger===trigger){closePopup();return;}
  closePopup({restoreFocus:false});
  const popup=document.createElement('div');popup.id=popupId;popup.className='ds-select-popover';
  popup.setAttribute('role','listbox');popup.setAttribute('aria-label',title);
  const opts=[...select.options].filter(o=>!o.hidden),buttons=[],optionItems=[];
  let lastGroup=null;
  for(const [index,opt] of opts.entries()){
   const group=opt.parentElement?.tagName==='OPTGROUP'?opt.parentElement.label:null;
   if(group&&group!==lastGroup){
    const heading=span('ds-select-group-label',group);
    heading.setAttribute('aria-hidden','true');popup.append(heading);
   }
   lastGroup=group;
   const item=button('ds-select-option','');
   item.setAttribute('role','option');item.setAttribute('aria-selected',String(select.value===opt.value));
   item.disabled=isSelectOptionDisabled(opt);
   const text=span('ds-option-label',opt.label||opt.textContent);
   const check=span('ds-option-check','✓');item.append(text,check);
   item.dataset.value=opt.value;
   item.addEventListener('click',()=>{if(isSelectOptionDisabled(opt))return;nativeCommit(select,opt.value);closePopup();});
   item.addEventListener('keydown',e=>{
    const move=(dir)=>{const available=buttons.filter(b=>!b.disabled);const cur=available.indexOf(item);available[(cur+dir+available.length)%available.length]?.focus();};
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();move(e.key==='ArrowDown'?1:-1);}
    if(e.key==='Home'||e.key==='End'){e.preventDefault();(e.key==='Home'?buttons.find(x=>!x.disabled):[...buttons].reverse().find(x=>!x.disabled))?.focus();}
    if(e.key==='Escape'){e.preventDefault();closePopup();}
    if(e.key==='Tab')closePopup({restoreFocus:false});
    if(e.key.length===1&&/[\p{L}\p{N}]/u.test(e.key)&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
     const index=findEnabledOptionIndex(
      buttons.map(b=>({disabled:b.disabled,label:b.querySelector('.ds-option-label')?.textContent||''})),
      e.key,buttons.indexOf(item)
     );
     if(index!==-1){e.preventDefault();buttons[index].focus();}
    }
   });
   popup.append(item);buttons.push(item);optionItems.push({option:opt,item});
  }
  document.body.append(popup);
  const reposition=()=>{
   const box=selectPopoverLayout(trigger.getBoundingClientRect(),
    {width:window.innerWidth,height:window.innerHeight},popup.scrollHeight);
   popup.style.left=box.left+'px';
   popup.style.top=box.top+'px';
   popup.style.bottom='auto';
   popup.style.width=box.width+'px';
   popup.style.maxHeight=box.maxHeight+'px';
  };
  reposition();
  trigger.setAttribute('aria-expanded','true');
  openSelect={popup,trigger,optionItems,reposition,onClose:()=>{}};
  (buttons.find(b=>b.dataset.value===select.value&&!b.disabled)||buttons.find(b=>!b.disabled))?.focus();
 };
 trigger.addEventListener('click',event=>{event.preventDefault();open();});
 trigger.addEventListener('keydown',e=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}});
 select.addEventListener('change',update);
 const observer=new MutationObserver(update);observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['selected','label','disabled']});
 controllers.push(update);update();
}
function accordionChevron(){
 // Drawn SVG, not a font glyph. Same geometry in every browser/theme.
 const NS='http://www.w3.org/2000/svg';
 const icon=document.createElementNS(NS,'svg');
 icon.setAttribute('viewBox','0 0 24 24');
 icon.setAttribute('width','16');icon.setAttribute('height','16');
 icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');
 icon.setAttribute('stroke-width','1.85');icon.setAttribute('stroke-linecap','round');
 icon.setAttribute('stroke-linejoin','round');
 icon.setAttribute('aria-hidden','true');
 const path=document.createElementNS(NS,'path');path.setAttribute('d','m6 9 6 6 6-6');
 icon.append(path);return icon;
}
function sectionAccordions(root){
 for(const section of root.querySelectorAll('.inspector-panel .property-section')){
  if(enhanced.has(section))continue;
  const heading=section.querySelector(':scope > .property-section-heading');
  if(!heading)continue;
  enhanced.add(section);section.classList.add('ds-accordion');
  const title=heading.querySelector('strong')?.textContent?.trim()||'Propriedades';
  const meta=heading.querySelector('span')?.textContent?.trim()||'';
  const panel=section.closest('[data-inspector-panel]')?.dataset.inspectorPanel||'settings';
  const key='studio-inspector-'+panel+'-'+title;
  const toggle=button('ds-accordion-toggle','');
  toggle.setAttribute('aria-label',title);
  const name=span('ds-accordion-title',title);
  const trailing=span('ds-accordion-trailing');
  // Badges convey information only. Repeated labels like "Automática",
  // "CSS" and "Documento atual" are not useful in the header.
  if(meta&&(/^\d+\s/.test(meta)||meta==='Offline')){
   trailing.append(span('ds-accordion-meta',meta));
  }
  const arrow=span('ds-accordion-chevron');
  arrow.append(accordionChevron());
  trailing.append(arrow);toggle.append(name,trailing);
  const body=document.createElement('div');body.className='ds-accordion-body';
  const id='ds-accordion-'+(++nextUid);body.id=id;
  while(heading.nextSibling)body.append(heading.nextSibling);
  heading.replaceWith(toggle);section.append(body);
  toggle.setAttribute('aria-controls',id);
  let initial=false;
  try{initial=localStorage.getItem(key)==='closed';}catch{}
  const set=closed=>{
   toggle.setAttribute('aria-expanded',String(!closed));
   section.classList.toggle('ds-accordion--collapsed',closed);
   body.hidden=closed;
   try{localStorage.setItem(key,closed?'closed':'open');}catch{}
  };
  toggle.addEventListener('click',()=>set(toggle.getAttribute('aria-expanded')==='true'));
  set(initial);
 }
}
export function enhancePropertyControls(root=document){
 sectionAccordions(root);
 for(const label of root.querySelectorAll('.design-inspector label.property-row')){
  if(enhanced.has(label))continue;
  const input=label.querySelector(':scope > input,:scope > select');
  if(!input)continue;enhanced.add(label);
  const title=labelOf(label);
  if(input.matches('input[type="range"]'))enhanceRange(label,input,title);
  else if(input.matches('input[type="number"]'))enhanceNumber(label,input,title);
  else if(input.matches('input[type="color"]'))enhanceColor(label,input,title);
  else if(input.matches('input[type="checkbox"]'))enhanceBinary(label,input,title);
  else if(input.matches('select')){
   if(input.id==='sectionRule')enhanceSegment(label,input,title);
   else makeListbox(label,input,title);
  }
 }
}
export function syncPropertyControls(){
 for(const update of controllers)update();
}
export function initializePropertyControls(){
 enhancePropertyControls();
 const mesh=$('meshControls');
 if(mesh){
  let scheduled=false;
  new MutationObserver(()=>{
   if(scheduled)return;
   scheduled=true;queueMicrotask(()=>{scheduled=false;enhancePropertyControls(mesh);});
  }).observe(mesh,{childList:true,subtree:true});
 }
 document.addEventListener('pointerdown',event=>{
  if(openSelect&&!openSelect.popup.contains(event.target)&&!openSelect.trigger.contains(event.target))closePopup({restoreFocus:false});
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&openSelect){event.preventDefault();closePopup();}});
 window.addEventListener('resize',()=>closePopup({restoreFocus:false}));
 document.querySelector('.inspector-scroll')?.addEventListener('scroll',()=>{
  // Keep popovers anchored while auto-scrolling an inspector control into view.
  if(!openSelect)return;
  const {trigger,reposition}=openSelect,rect=trigger.getBoundingClientRect();
  const scroller=trigger.closest('.inspector-scroll');
  const viewport=scroller?.getBoundingClientRect();
  if(rect.bottom<=0||rect.top>=window.innerHeight||
   (viewport&&(rect.bottom<=viewport.top||rect.top>=viewport.bottom))){
   closePopup({restoreFocus:false});
   return;
  }
  reposition();
 },{passive:true});
}
