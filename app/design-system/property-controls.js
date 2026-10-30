/**
 * DS v4 • Professional inspector controls.
 * Progressive enhancement: native controls keep their IDs, constraints and
 * source-of-truth listeners. No duplicated theme state or external dependencies.
 */
import {initializeColorPicker} from './color-picker.js';
import {createChoiceActions} from './choice-actions.js';
import {createInspectorHeader} from './inspector-header.js';
const enhanced=new WeakSet();
const controllers=[];
let openSelect=null;
let nextUid=0;
const $=(id)=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const unitOf=(el)=>el.dataset.unit??({
 fontSize:'pt',marginMm:'mm',sectionGapEm:'em',lineHeight:'×',
 titleScale:'×',bgAngle:'°',bgPatternSize:'px',bgOpacity:'',meshSoftness:'%'
})[el.id]??'';
const labelOf=(label)=>{
 const texts=[...label.childNodes].filter(n=>n.nodeType===3);
 const title=texts.map(n=>n.textContent).join(' ').trim();
 for(const node of texts)node.remove();
 return title.replace(/\s+/g,' ');
};
function span(cls,text=''){const x=document.createElement('span');x.className=cls;x.textContent=text;if(cls==='ds-prop-name')x.title=text;return x;}
function button(cls,title){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=title;return b;}
function selectThumbnail(select,value){
 if(select.dataset.preview==='font-weight'){
  const thumb=span('ds-select-thumbnail ds-weight-thumbnail');thumb.setAttribute('aria-hidden','true');
  if(value===''){
   const icon=document.createElement('ds-icon');icon.setAttribute('name','undo-2');icon.setAttribute('size','16');thumb.append(icon);
  }else{
   thumb.textContent='Aa';thumb.style.fontWeight=String(Number(value)||400);
  }
  return thumb;
 }
 if(select.dataset.preview==='section'){
  if(value==='all'){
   const thumb=span('ds-select-thumbnail ds-element-thumbnail');thumb.setAttribute('aria-hidden','true');
   thumb.innerHTML='<svg viewBox="0 0 32 30" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="5" y="4" width="22" height="9" rx="2"/><rect x="5" y="17" width="22" height="9" rx="2"/><path d="M9 8h14M9 21h14"/></svg>';
   return thumb;
  }
  value=value.startsWith('level:')?'h'+value.slice(6):[...select.options].find(option=>option.value===value)?.dataset.elementKind||'p';
 }
 if(['element','section'].includes(select.dataset.preview)){
  const thumb=span('ds-select-thumbnail ds-element-thumbnail');thumb.setAttribute('aria-hidden','true');
  const shapes={
   p:'<path d="M5 7h22M5 12h20M5 17h22M5 22h14"/>',
   ul:'<path d="M11 8h16M11 15h16M11 22h12"/><circle cx="5" cy="8" r="1"/><circle cx="5" cy="15" r="1"/><circle cx="5" cy="22" r="1"/>',
   ol:'<text x="3" y="10" font-size="7">1</text><text x="3" y="17" font-size="7">2</text><text x="3" y="24" font-size="7">3</text><path d="M11 8h16M11 15h16M11 22h12"/>',
   li:'<circle cx="5" cy="14" r="1.5"/><path d="M11 14h16M11 19h11"/>',
   blockquote:'<path d="M5 5v19" stroke-width="3"/><path d="M11 9h16M11 15h16M11 21h10"/>',
   pre:'<rect x="3" y="4" width="26" height="22" rx="3"/><path d="m12 10-5 5 5 5m8-10 5 5-5 5"/>',
   hr:'<path d="M4 15h24" stroke-width="2"/>',
   img:'<rect x="3" y="4" width="26" height="22" rx="2"/><circle cx="11" cy="11" r="2"/><path d="m4 23 8-7 5 4 5-8 7 11"/>',
   a:'<path d="m12 18 8-8m-9 3-3 3a4 4 0 0 0 6 6l3-3m-2-8 3-3a4 4 0 0 1 6 6l-3 3"/>',
   strong:'<text x="7" y="23" font-size="22" font-weight="800">B</text>',
   em:'<text x="11" y="23" font-size="22" font-style="italic">I</text>',
   del:'<text x="8" y="23" font-size="21">S</text><path d="M5 15h23"/>',
   code:'<path d="m11 9-6 6 6 6m10-12 6 6-6 6m-3-16-4 20"/>'
  };
  let art=shapes[value];
  if(/^h[1-6]$/.test(value))art='<text x="4" y="21" font-size="18" font-weight="700">H'+value[1]+'</text>';
  if(['table','thead','tbody','tr','th','td'].includes(value)){
   const highlight={thead:'4 5 24 6',tbody:'4 11 24 14',tr:'4 12 24 6',th:'4 5 8 6',td:'12 12 8 6'}[value];
   art=(highlight?(()=>{const [x,y,w,h]=highlight.split(' ');return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="currentColor" opacity=".25" stroke="none"/>`;})():'')+'<rect x="4" y="5" width="24" height="20" rx="1"/><path d="M4 11h24M4 18h24M12 5v20M20 5v20"/>';
  }
  thumb.innerHTML='<svg viewBox="0 0 32 30" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">'+(art||shapes.p)+'</svg>';
  return thumb;
 }
 if(select.dataset.preview!=='background')return null;
 const thumb=span('ds-select-thumbnail');
 thumb.dataset.background=value;thumb.setAttribute('aria-hidden','true');
 return thumb;
}
export function normalizeRange(value,min,max,step){
 if(![value,min,max].every(Number.isFinite)||min>=max)throw Error('Faixa inválida');
 if(step==='any')return clamp(value,min,max);
 if(!Number.isFinite(step)||step<=0)throw Error('Faixa inválida');
 // The upper bound is not necessarily on the step grid. Clamping a
 // rounded step to max would produce a stepMismatch (e.g. 10 for 0..10/6).
 // Restrict the index before reconstructing the value instead.
 // A fixed epsilon in *step indices* can accept a maximum that is
 // genuinely off-grid (e.g. max=0.99999999995, step=0.1). Only compensate
 // for IEEE-754 rounding at the magnitude of the actual candidate value.
 const ratio=(max-min)/step;
 let lastIndex=Math.max(0,Math.floor(ratio));
 const fits=index=>{
  const candidate=min+index*step;
  const tolerance=Number.EPSILON*4*Math.max(Math.abs(min),Math.abs(max),Math.abs(candidate));
  return candidate<=max+tolerance;
 };
 if(lastIndex>0&&!fits(lastIndex))lastIndex--;
 if(fits(lastIndex+1))lastIndex++;
 const index=clamp(Math.round((clamp(value,min,max)-min)/step),0,lastIndex);
 const snapped=min+index*step;
 // Decimal-place caps silently turn sub-picosecond / micro-scale steps into
 // zero. Round floating-point noise using significant digits instead: this
 // retains scientific-notation steps and fractional step bases alike.
 return clamp(Number(snapped.toPrecision(15)),min,max);
}
// Match the precision input to the live native slider, including range
// defaults and the unrestricted step="any" case.
export function rangeConstraints(input){
 const min=input.min===''?0:Number(input.min);
 const max=input.max===''?100:Number(input.max);
 const step=input.step===''?1:input.step==='any'?'any':Number(input.step);
 const valid=Number.isFinite(min)&&Number.isFinite(max)&&min<max&&
  (step==='any'||Number.isFinite(step)&&step>0);
 return {min,max,step,valid};
}
// Auxiliary numeric scrub sliders require two finite, ordered native bounds.
// A number input itself may remain usable with a single bound; its slider
// cannot truthfully represent that domain and must be disabled.
export function numericScrubBoundsValid(min,max,step){
 const increment=step===''?1:step==='any'?'any':Number(step);
 return Number.isFinite(min)&&Number.isFinite(max)&&min<max&&
  (increment==='any'||Number.isFinite(increment)&&increment>0);
}
// Free-step ranges advance by 1% of the current span. Discrete grids
// may end below max; an inert boundary button must be disabled.
export function rangeStepTarget(value,direction,min,max,step){
 if(![value,direction,min,max].every(Number.isFinite)||Math.abs(direction)!==1||min>=max)return null;
 if(step==='any'){
  const candidate=Number((value+direction*(max-min)/100).toPrecision(15));
  const next=clamp(candidate,min,max);
  return next===value?null:next;
 }
 if(!Number.isFinite(step)||step<=0)return null;
 const next=normalizeRange(value+direction*step,min,max,step);
 return next===value?null:next;
}
export function formatControlValue(v,unit=''){
 const value=Number(v);
 // Significant digits remove floating-point noise without turning tiny
 // valid increments into 0. Prefer expanded decimals down to 1e-15; below
 // that, scientific notation is safer than a misleading zero.
 const rounded=Number.isFinite(value)?Number(value.toPrecision(15)):value;
 const body=Number.isFinite(rounded)&&rounded!==0&&Math.abs(rounded)>=1e-15&&Math.abs(rounded)<1?
  rounded.toFixed(15).replace(/0+$/,'').replace(/[.]$/,''):String(rounded);
 return body+(unit&&unit!=='×'?' '+unit:unit);
}
export function validationMessage(input,min,max,unit=''){
 if(input.value.trim()==='')return 'Informe um valor.';
 if(input.validity.rangeUnderflow||input.validity.rangeOverflow){
  const suffix=unit?' '+unit:'';
  if(Number.isFinite(min)&&Number.isFinite(max))return 'Use um valor entre '+min+' e '+max+suffix+'.';
  if(input.validity.rangeUnderflow&&Number.isFinite(min))return 'Use um valor maior ou igual a '+min+suffix+'.';
  if(input.validity.rangeOverflow&&Number.isFinite(max))return 'Use um valor menor ou igual a '+max+suffix+'.';
 }
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
// Disabling a focused native input may blur it before a MutationObserver runs.
// Remember its focus until the disabled-state update can move keyboard users
// to another visible inspector control; never steal focus after a real click.
function watchDisabledNativeFocus(input){
 let hadFocus=false;
 input.addEventListener('focus',()=>{hadFocus=true;});
 input.addEventListener('blur',()=>{if(!input.disabled)hadFocus=false;});
 return ()=>{
  if(!input.disabled){hadFocus=document.activeElement===input;return;}
  if(hadFocus&&(document.activeElement===input||document.activeElement===document.body))
   focusInspectorNeighbor(input,{visibleOnly:true});
  hadFocus=false;
 };
}
function nativeCommit(input,next){
 if(input.disabled)return false;
 // A repeated selection, unchanged hex value or re-entered slider value is
 // not a document edit. Let the native control normalize the candidate first
 // (notably color casing and range snapping), then emit only real changes.
 const previous=input.value;
 input.value=String(next);
 if(input.value===previous)return false;
 input.dispatchEvent(new Event('input',{bubbles:true}));
 input.dispatchEvent(new Event('change',{bubbles:true}));
 return true;
}
function scrubStep(title,direction){
 const node=button('ds-number-step ds-scrub-step','');
 node.setAttribute('aria-label',(direction<0?'Diminuir ':'Aumentar ')+title);
 const icon=document.createElement('ds-icon');icon.setAttribute('name',direction<0?'minus':'plus');icon.setAttribute('size','14');node.append(icon);return node;
}
function enhanceRange(label,input,title){
 const unit=unitOf(input);
 if(!rangeConstraints(input).valid)return;
 label.classList.add('ds-property-row','ds-property-row--range');
 const field=document.createElement('div');field.className='ds-property-range';
 const name=span('ds-prop-name',title);
 const progress=document.createElement('span');progress.className='ds-prop-track';
 const fill=span('ds-prop-fill'),ticks=span('ds-prop-ticks'),thumb=span('ds-prop-thumb');
 const valueBox=document.createElement('div');valueBox.className='ds-prop-numberbox';
 const numeric=document.createElement('input');numeric.type='number';numeric.className='ds-prop-number';
 const restoreNativeFocus=watchDisabledNativeFocus(input);
 const syncConstraints=()=>{
  const constraints=rangeConstraints(input);
  numeric.min=String(constraints.min);
  numeric.max=String(constraints.max);
  numeric.step=String(constraints.step);
  return constraints;
 };
 syncConstraints();
 numeric.setAttribute('aria-label',title+' — valor'+(unit?' em '+unit:''));
 const setError=feedbackFor(label,numeric);
 const unitBadge=span('ds-prop-unit',unit);
 if(!unit)unitBadge.classList.add('hidden');
 input.classList.add('ds-range-native');
 if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',title);
 input.setAttribute('title',title);
 input.replaceWith(field);
 const shell=document.createElement('div');shell.className='ds-scrub-control';
 const minus=scrubStep(title,-1),plus=scrubStep(title,1);
 field.append(name,shell);shell.append(minus,progress,valueBox,plus);
 progress.append(fill,ticks,thumb,input);valueBox.append(numeric,unitBadge);
 // The precision field is an editable draft. Never silently clamp or snap
 // invalid values: preserve them for correction without mutating the document.
 const valid=()=>numeric.value.trim()!==''&&numeric.validity.valid&&Number.isFinite(numeric.valueAsNumber);
 let editing=false;
 const update=()=>{
  const {min,max,valid:boundsValid}=syncConstraints();
  const value=Number(input.value);
  const pct=boundsValid?(clamp(value,min,max)-min)/(max-min)*100:0;
  field.style.setProperty('--ds-range-progress',pct+'%');
  if(input.disabled)editing=false;
  const focusedPrecision=document.activeElement===numeric;
  numeric.disabled=input.disabled;
  const {step}=rangeConstraints(input);
  const focusedStepper=[minus,plus].find(button=>document.activeElement===button);
  minus.disabled=input.disabled||!boundsValid||rangeStepTarget(value,-1,min,max,step)===null;
  plus.disabled=input.disabled||!boundsValid||rangeStepTarget(value,1,min,max,step)===null;
  if(focusedStepper?.disabled)focusInspectorNeighbor(focusedStepper,{visibleOnly:true});
  if(input.disabled&&focusedPrecision)focusInspectorNeighbor(numeric,{visibleOnly:true});
  restoreNativeFocus();
  if(!editing)numeric.value=input.value;
  setError(!input.disabled&&editing?
   (!boundsValid?'Verifique os limites e o incremento da faixa.':!valid()?validationMessage(numeric,min,max,unit):''):'');
  if(!Number.isNaN(value))field.setAttribute('data-value',formatControlValue(value,unit));
 };
 const increment=direction=>{
  const {min,max,step,valid}=rangeConstraints(input);
  if(!valid)return;
  const next=rangeStepTarget(Number(input.value),direction,min,max,step);
  if(next===null)return;
  editing=false;nativeCommit(input,next);update();
 };
 minus.onclick=()=>increment(-1);plus.onclick=()=>increment(1);
 // A real slider gesture supersedes a stale numeric draft and its error.
 const nativeUpdate=()=>{editing=false;update();};
 input.addEventListener('input',nativeUpdate);
 input.addEventListener('change',nativeUpdate);
 numeric.addEventListener('input',()=>{editing=true;update();});
 numeric.addEventListener('change',()=>{
  const {min,max,step,valid:boundsValid}=syncConstraints();
  if(!boundsValid||!valid()){editing=true;update();return;}
  const value=numeric.valueAsNumber;
  editing=false;
  nativeCommit(input,normalizeRange(value,min,max,step));
  update();
 });
 numeric.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();editing=false;update(); /* Keep keyboard focus for the next edit. */ }
  if(e.key==='Enter'){numeric.dispatchEvent(new Event('change'));if(valid())numeric.blur();}
 });
 // Double-click resets only when an explicit initial value is available.
 const initial=Number(input.defaultValue);
 if(input.hasAttribute('value')&&Number.isFinite(initial))field.title='Clique duas vezes na régua para restaurar';
 if(input.hasAttribute('value'))progress.addEventListener('dblclick',()=>{
  const {min,max,step,valid}=rangeConstraints(input);
  if(valid)nativeCommit(input,normalizeRange(initial,min,max,step));
 });
 const output=label.querySelector('output');if(output)output.classList.add('property-visually-hidden');
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled','min','max','step']});
 controllers.push(update);update();
}
function enhanceNumber(label,input,title){
 label.classList.add('ds-property-row','ds-property-row--number');
 const field=document.createElement('div');field.className='ds-property-number';
 const name=span('ds-prop-name',title),controls=document.createElement('span');controls.className='ds-number-actions';
 const minus=scrubStep(title,-1),plus=scrubStep(title,1);
 minus.setAttribute('aria-label','Diminuir '+title);plus.setAttribute('aria-label','Aumentar '+title);
 const unit=span('ds-prop-unit',unitOf(input));
 if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',title+' — valor'+(unitOf(input)?' em '+unitOf(input):''));
 input.classList.add('ds-number-native');
 input.replaceWith(field);field.append(name,controls);controls.append(minus,input,unit,plus);
 let slider=null;
 if(input.min!==''&&input.max!==''&&Number(input.max)>Number(input.min)&&!input.hasAttribute('data-inherit')){
  controls.classList.add('ds-scrub-control');
  const track=document.createElement('span');track.className='ds-scrub-number-track';
  slider=document.createElement('input');slider.type='range';slider.className='ds-scrub-range';slider.setAttribute('aria-label',title+' — deslizar');
  track.append(slider);controls.insertBefore(track,input);
  slider.addEventListener('input',()=>nativeCommit(input,slider.value));
 }
 const restoreSliderFocus=slider?watchDisabledNativeFocus(slider):()=>{};
 const bounds=()=>({min:input.min===''?-Infinity:Number(input.min),max:input.max===''?Infinity:Number(input.max)});
 const setError=feedbackFor(label,input);
 const restoreNativeFocus=watchDisabledNativeFocus(input);
 const valid=()=>input.validity.valid&&((input.hasAttribute('data-inherit')&&input.value==='')||(input.value.trim()!==''&&Number.isFinite(input.valueAsNumber)));
 // Let the browser enforce the native number step grid, including fractional
 // bases and absent bounds. The previous synthetic 0..999 range blocked
 // negative and large values even when the HTML input allowed them.
 const stepTarget=direction=>{
  if(input.disabled||!valid())return null;
  const probe=input.cloneNode(false);
  probe.value=input.value;
  try{
   if(input.step==='any'){
    // HTMLInputElement.stepUp throws for step=any. Use a unit increment
    // while still respecting explicit bounds, without changing the input.
    const {min,max}=bounds();
    const next=clamp(input.valueAsNumber+direction,min,max);
    if(!Number.isFinite(next))return null;
    probe.value=String(next);
   }else if(direction>0)probe.stepUp();
   else probe.stepDown();
  }catch{return null;}
  return Number(probe.value)!==input.valueAsNumber?probe.value:null;
 };
 let committed=input.value,editing=false,draftEmitted=false,restoring=false;
 // Valid input drafts are observable by app listeners before the change
 // event commits them. Undoing a draft must notify those listeners too;
 // otherwise Escape/disable restores only the DOM while the model stays stale.
 const rollbackDraft=()=>{
  const notify=draftEmitted&&input.value!==committed;
  input.value=committed;editing=false;draftEmitted=false;
  if(notify){
   restoring=true;
   try{input.dispatchEvent(new Event('input',{bubbles:true}));}
   finally{restoring=false;}
  }
 };
 const update=()=>{
  // Disabling a numeric field must discard its uncommitted draft, just like
  // the range and hex controls. Otherwise an invalid number can remain in
  // the native source of truth after the inspector becomes read-only.
  if(input.disabled&&editing)rollbackDraft();
  const ok=valid();
  if(!editing&&ok)committed=input.value;
  const {min,max}=bounds();
  if(slider){
   // Dynamic native constraints can invalidate a formerly bounded slider.
   // Do not expose a misleading default 0..100 range or a NaN progress track.
   const usable=numericScrubBoundsValid(min,max,input.step);
   slider.min=input.min;slider.max=input.max;slider.step=input.step||'1';
   slider.disabled=input.disabled||!usable;
   if(usable){
    slider.value=input.value;
    controls.style.setProperty('--ds-range-progress',
     clamp((Number(input.value)-min)/(max-min)*100,0,100)+'%');
   }else controls.style.setProperty('--ds-range-progress','0%');
  }
  setError(!input.disabled&&editing&&!ok?validationMessage(input,min,max,unitOf(input)):'');
  const focusedStepper=[minus,plus].find(button=>document.activeElement===button);
  minus.disabled=stepTarget(-1)===null;
  plus.disabled=stepTarget(1)===null;
  if(focusedStepper?.disabled)focusInspectorNeighbor(focusedStepper,{visibleOnly:true});
  restoreNativeFocus();
  restoreSliderFocus();
 };
 const increment=direction=>{
  const next=stepTarget(direction);
  if(next===null)return;
  nativeCommit(input,next);
  update();
 };
 minus.onclick=()=>increment(-1);plus.onclick=()=>increment(1);
 input.addEventListener('input',event=>{
  if(restoring)return;
  editing=true;update();
  // Native number fields emit `input` for empty, out-of-bounds and off-step
  // drafts. Do not leak those invalid values to document-level listeners;
  // only a valid draft may update the app's source of truth.
  if(!valid())event.stopImmediatePropagation();
  else draftEmitted=true;
 },true);
 // Capture before the app's change listener: an invalid draft must never mutate the document.
 input.addEventListener('change',event=>{
  if(restoring)return;
  // Disabling a focused number can synchronously emit a native change
  // before MutationObserver runs. That event must not commit its draft.
  if(input.disabled){
   if(editing)rollbackDraft();
   event.preventDefault();event.stopImmediatePropagation();update();return;
  }
  if(!valid()){
   editing=true;update();event.preventDefault();event.stopImmediatePropagation();return;
  }
  editing=false;committed=input.value;draftEmitted=false;update();
 },true);
 input.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!editing)return;
  event.preventDefault();rollbackDraft();update();
 });
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled','min','max','step']});
 controllers.push(update);update();
}
function enhanceColor(label,input,title){
 label.classList.add('ds-property-row','ds-property-row--color');
 const field=document.createElement('div');field.className='ds-property-color';
 const name=span('ds-prop-name',title),right=document.createElement('div');right.className='ds-color-right';
 const swatch=document.createElement('span');swatch.className='ds-color-swatch';
 const hex=document.createElement('input');hex.type='text';hex.className='ds-color-hex';hex.maxLength=7;
 hex.spellcheck=false;hex.autocomplete='off';hex.setAttribute('aria-label',title+' — hexadecimal');
 if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',title+' — seletor de cor');
 hex.setAttribute('inputmode','text');
 const setError=feedbackFor(label,hex);
 const restoreNativeFocus=watchDisabledNativeFocus(input);
 input.classList.add('ds-color-native');
 input.setAttribute('aria-haspopup','dialog');
 input.replaceWith(field);
 field.append(name,right);right.append(swatch,hex);swatch.append(input);
 const pipette=button('ds-color-pipette',''),pipetteIcon=document.createElement('ds-icon');
 pipetteIcon.setAttribute('name','pipette');pipetteIcon.setAttribute('size','15');pipetteIcon.setAttribute('aria-hidden','true');
 pipette.append(pipetteIcon);pipette.setAttribute('aria-label','Capturar cor da tela — '+title);
 const canPick=typeof window.EyeDropper==='function';
 pipette.title=canPick?'Capturar cor da tela':'Conta-gotas indisponível neste navegador';right.append(pipette);
 let picking=false;
 const isHex=v=>/^#[0-9a-f]{6}$/i.test(v);
 let editing=false;
 const update=()=>{
  const v=input.value.toUpperCase();
  if(input.disabled)editing=false;
  // App-level inspector synchronization must not discard an uncommitted
  // hex draft (especially an invalid one) or clear its error announcement.
  if(!editing){hex.value=v;setError('');}
  const focusedHex=document.activeElement===hex;
  hex.disabled=input.disabled;
  pipette.disabled=input.disabled||!canPick||picking;
  if(input.disabled&&focusedHex)focusInspectorNeighbor(hex,{visibleOnly:true});
  restoreNativeFocus();
  swatch.style.backgroundColor=v;
  pipette.disabled=input.disabled||!canPick||picking;
 };
 pipette.addEventListener('click',async event=>{
  event.preventDefault();event.stopPropagation();
  if(input.disabled||picking||!canPick)return;
  picking=true;update();
  try{
   const result=await new window.EyeDropper().open();
   if(!input.disabled&&input.isConnected&&isHex(result.sRGBHex)){
    editing=false;nativeCommit(input,result.sRGBHex);update();
   }
  }catch(error){if(error.name!=='AbortError')setError('Não foi possível capturar a cor. Tente novamente.');}
  finally{picking=false;pipette.disabled=input.disabled||!canPick;if(!pipette.disabled&&pipette.isConnected)pipette.focus({preventScroll:true});}
 });
 hex.addEventListener('input',()=>{
  editing=true;
  setError(isHex(hex.value.trim())?'':'Use uma cor hexadecimal com seis dígitos (#RRGGBB).');
 });
 hex.addEventListener('change',()=>{
  const v=hex.value.trim();
  if(!isHex(v)){editing=true;setError('Use uma cor hexadecimal com seis dígitos (#RRGGBB).');return;}
  editing=false;setError('');nativeCommit(input,v);update();
 });
 hex.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();editing=false;update(); /* Keep keyboard focus for the next edit. */ }
  if(e.key==='Enter'){hex.dispatchEvent(new Event('change'));if(isHex(hex.value.trim()))hex.blur();}
 });
 // A real native swatch edit takes precedence over the pending text draft.
 const nativeUpdate=()=>{editing=false;update();};
 input.addEventListener('input',nativeUpdate);input.addEventListener('change',nativeUpdate);
 new MutationObserver(update).observe(input,{attributes:true,attributeFilter:['disabled']});
 controllers.push(update);update();
}
function enhanceBinary(label,input,title){
 label.classList.add('ds-property-row','ds-property-row--binary');
 const field=document.createElement('div');field.className='ds-property-binary';
 const name=span('ds-prop-name',title),group=document.createElement('div');group.className='ds-binary-group';
 group.setAttribute('role','group');group.setAttribute('aria-label',title);
 const states={bottomSectionEnabled:['No fluxo','No rodapé'],selectedSectionBreak:['Continuar','Nova página'],showPageGuides:['Ocultar','Mostrar']}[input.id]||['Não','Sim'];
 const off=button('ds-binary-option',states[0]),on=button('ds-binary-option',states[1]);
 // Screen readers must hear the actual layout alternatives, not generic on/off.
 off.setAttribute('aria-label',title+' — '+states[0]);on.setAttribute('aria-label',title+' — '+states[1]);
 input.classList.add('ds-binary-native');input.setAttribute('aria-hidden','true');input.tabIndex=-1;
 input.replaceWith(field);field.append(name,group,input);group.append(off,on);
 const update=()=>{
  const focused=group.contains(document.activeElement)?document.activeElement:null;
  off.setAttribute('aria-pressed',String(!input.checked));
  on.setAttribute('aria-pressed',String(input.checked));
  // The native checkbox remains the source of truth for disabled state.
  // In particular, bottomSectionEnabled is disabled when no section is selected.
  off.disabled=input.disabled;on.disabled=input.disabled;
  // Exactly one sequential Tab stop; arrows and Home/End change selection.
  off.tabIndex=!input.disabled&&!input.checked?0:-1;
  on.tabIndex=!input.disabled&&input.checked?0:-1;
  // Disabling a focused button must not silently dump keyboard focus on body.
  if(focused&&input.disabled)focusInspectorNeighbor(focused,{visibleOnly:true});
 };
 const commit=val=>{
  if(input.disabled||input.checked===val)return;
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
// Select the active enabled segment or a safe fallback after native option edits.
export function rovingSegmentIndex(options,selectedValue){
 const selected=options.findIndex(item=>!item.disabled&&item.value===selectedValue);
 return selected!==-1?selected:options.findIndex(item=>!item.disabled);
}
function enhanceSegment(label,select,title){
 label.classList.add('ds-property-row','ds-property-row--segment');
 const field=document.createElement('div');field.className='ds-property-segment';
 const name=span('ds-prop-name',title),group=document.createElement('div');group.className='ds-segment-buttons';
 group.setAttribute('role','group');group.setAttribute('aria-label',title);
 select.classList.add('ds-select-native');
 select.setAttribute('aria-hidden','true');select.tabIndex=-1;
 select.replaceWith(field);field.append(name,group,select);
 const compact={
  fontChoice:{system:'Sans',serif:'Serif',mono:'Mono'},
  sectionRule:{line:'Linha',none:'Nenhum',block:'Bloco'}
 }[select.id]||{};
 // Compact labels are only aliases for the original options. If the native
 // label changes later, show the new text instead of a stale abbreviation.
 const initialLabels=new WeakMap();
 for(const option of select.options)initialLabels.set(option,option.label||option.textContent);
 const labelFor=option=>{
  const text=option.label||option.textContent;
  return initialLabels.get(option)===text&&compact[option.value]||text;
 };
 let elements=[],rendered=[];
 const makeButton=option=>{
  const btn=button('ds-segment-option',labelFor(option));
  btn.dataset.value=option.value;
  btn.onclick=()=>{if(!select.disabled&&!isSelectOptionDisabled(option))nativeCommit(select,option.value);};
  btn.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();
   const next=nextEnabledSegmentIndex(elements.map(item=>item.disabled),elements.indexOf(btn),e.key);
   if(next!==-1){elements[next].focus();elements[next].click();}
  });
  return btn;
 };
 const update=()=>{
  const options=visibleSelectOptions(select);
  const changed=rendered.length!==options.length||options.some((option,index)=>{
   const item=rendered[index];
   return item.option!==option||item.value!==option.value||item.label!==labelFor(option);
  });
  // Apply disabled states before restoring focus after live option changes.
  // The nearest replacement can itself be disabled or removed.
  let focusRecovery=null;
  if(changed){
   const focusedIndex=rendered.findIndex(item=>item.button===document.activeElement);
   const focusedOption=rendered[focusedIndex]?.option;
   const previous=new Map(rendered.map(item=>[item.option,item.button]));
   rendered=options.map(option=>{
    const btn=previous.get(option)||makeButton(option);
    const text=labelFor(option);
    btn.textContent=text;btn.title=text;btn.dataset.value=option.value;
    return {option,button:btn,label:text,value:option.value};
   });
   elements=rendered.map(item=>item.button);
   group.replaceChildren(...elements);
   if(focusedIndex!==-1)focusRecovery={focusedIndex,focusedOption};
  }
  // Disabling a focused button may synchronously blur it to <body>.
  // Capture the owner before touching the disabled property.
  const focusedBeforeDisable=elements.indexOf(document.activeElement);
  for(const [index,btn] of elements.entries()){
   btn.setAttribute('aria-pressed',String(btn.dataset.value===select.value));
   btn.disabled=select.disabled||isSelectOptionDisabled(rendered[index].option);
  }
  if(focusRecovery){
   const {focusedIndex,focusedOption}=focusRecovery;
   const preserved=rendered.find(item=>item.option===focusedOption&&!item.button.disabled);
   const start=Math.min(focusedIndex,rendered.length);
   const nearest=[...rendered.slice(start),...rendered.slice(0,start).reverse()]
    .find(item=>!item.button.disabled);
   const target=preserved?.button||nearest?.button;
   if(target)target.focus({preventScroll:true});
   else focusInspectorNeighbor(select,{visibleOnly:true});
  }
  const focused=focusRecovery?elements.indexOf(document.activeElement):focusedBeforeDisable;
  if(focused!==-1&&elements[focused].disabled){
   const next=nextEnabledSegmentIndex(elements.map(item=>item.disabled),focused,'ArrowRight');
   if(next!==-1)elements[next].focus({preventScroll:true});
   else focusInspectorNeighbor(elements[focused],{visibleOnly:true});
  }
  const tabStop=rovingSegmentIndex(rendered.map((item,index)=>({
   value:item.value,disabled:elements[index].disabled
  })),select.value);
  elements.forEach((btn,index)=>{btn.tabIndex=index===tabStop?0:-1;});
 };
 new MutationObserver(update).observe(select,{
  subtree:true,childList:true,characterData:true,attributes:true,
  attributeFilter:['disabled','hidden','label','value']
 });
 select.addEventListener('change',update);controllers.push(update);update();
}
function closePopup({restoreFocus=true}={}){
 if(!openSelect)return;
 const {popup,trigger,onClose,visibilityObserver}=openSelect;
 visibilityObserver?.disconnect();
 popup.remove();trigger.setAttribute('aria-expanded','false');
 // The portalled listbox no longer exists: never leave a dangling ARIA IDREF.
 trigger.removeAttribute('aria-controls');
 openSelect=null;onClose?.();
 if(restoreFocus){
  // Escape/resize may race with an inspector tab hiding or detaching.
  // Never restore focus to a disabled or hidden combobox trigger.
  const usable=trigger.isConnected&&!trigger.disabled&&
   !trigger.closest('[hidden],[inert],[aria-hidden="true"]')&&
   trigger.getClientRects().length&&getComputedStyle(trigger).visibility!=='hidden';
  if(usable)trigger.focus({preventScroll:true});
  else focusInspectorNeighbor(trigger,{visibleOnly:true});
 }
}
export function isSelectOptionDisabled(option){
 return Boolean(option.disabled||(option.parentElement?.tagName==='OPTGROUP'&&option.parentElement.disabled));
}
// A portalled listbox is a snapshot of native options. Detect edits to
// option order, membership, labels and optgroup headings before it goes stale.
// Hidden optgroups must hide their descendants in the enhanced popup, just
// as a hidden native option does. Preserve the underlying select unchanged.
export function visibleSelectOptions(select){
 return [...select.options].filter(option=>!option.hidden&&
  !(option.parentElement?.tagName==='OPTGROUP'&&option.parentElement.hidden));
}
export function selectPopupNeedsRefresh(rendered,visible){
 if(rendered.length!==visible.length)return true;
 return visible.some((option,index)=>{
  const group=option.parentElement?.tagName==='OPTGROUP'?option.parentElement.label:null;
  const label=option.label||option.textContent;
  return rendered[index].option!==option||rendered[index].group!==group||rendered[index].label!==label||rendered[index].value!==option.value;
 });
}
// Native-select-style typeahead: skip disabled options and cycle repeated initials.
export function findEnabledOptionIndex(options,prefix,afterIndex=-1){
 // Normalize accents so typing "arv" can find "Árvore" in Portuguese.
 // Keep the original label for visual display and screen readers.
 const fold=text=>String(text).normalize('NFD').replace(/\p{M}/gu,'').trim().toLocaleLowerCase();
 const query=fold(prefix);
 if(!query||!options.length)return -1;
 for(let offset=1;offset<=options.length;offset++){
  const index=(afterIndex+offset+options.length)%options.length;
  const option=options[index];
  if(!option.disabled&&fold(option.label).startsWith(query))return index;
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
// When a native select becomes disabled while its portalled option owns
// keyboard focus, move to a real enabled inspector control. A disabled
// combobox trigger cannot receive focus, and body is not a useful fallback.
function focusInspectorNeighbor(trigger,{visibleOnly=false}={}){
 const root=trigger.isConnected?(trigger.closest('.design-inspector,dialog')||document.body):null;
 if(!root){
  // A portalled option can retain focus after its entire inspector row was
  // detached. There is no neighboring row to search in that case.
  const toggle=[$('designToggle'),$('railDesign')].find(el=>el&&!el.disabled&&
   el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  toggle?.focus({preventScroll:true});
  return;
 }
 const controls=[...root.querySelectorAll('button,input,select,textarea,[tabindex]')];
 const index=controls.indexOf(trigger);
 const eligible=el=>{
  if(el===trigger||el.disabled||el.tabIndex<0||
   el.closest('[hidden],[inert],[aria-hidden="true"]')||!el.getClientRects().length||
   getComputedStyle(el).visibility==='hidden')return false;
  if(!visibleOnly)return true;
  const rect=el.getBoundingClientRect();
  if(rect.bottom<=0||rect.top>=window.innerHeight||
   rect.right<=0||rect.left>=window.innerWidth)return false;
  const scroller=el.closest('.inspector-scroll');
  if(scroller){
   const viewport=scroller.getBoundingClientRect();
   if(rect.bottom<=viewport.top||rect.top>=viewport.bottom)return false;
  }
  return true;
 };
 const next=controls.slice(index+1).find(eligible)||
  controls.slice(0,index).reverse().find(eligible);
 if(next)next.focus({preventScroll:true});
 else if(root.getClientRects().length&&
  !root.closest('[hidden],[inert],[aria-hidden="true"]')&&
  getComputedStyle(root).visibility!=='hidden'){
  root.tabIndex=-1;root.focus({preventScroll:true});
 }else{
  // Closing the inspector itself must not focus a hidden panel.
  const toggle=[$('designToggle'),$('railDesign')].find(el=>el&&!el.disabled&&el.getClientRects().length);
  toggle?.focus({preventScroll:true});
 }
}
function makeListbox(label,select,title){
 label.classList.add('ds-property-row','ds-property-row--select');
 const field=document.createElement('div');field.className='ds-property-select';
 const name=span('ds-prop-name',title),trigger=button('ds-select-trigger','');
 trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 trigger.setAttribute('aria-label',title);
 const value=span('ds-select-value'),chevron=span('ds-select-chevron');
 const chevronIcon=document.createElement('ds-icon');
 chevronIcon.setAttribute('name','chevron-down');
 chevronIcon.setAttribute('size','16');
 chevron.setAttribute('aria-hidden','true');
 chevron.append(chevronIcon);
 value.id='ds-select-value-'+(++nextUid);
 // Keep a stable accessible name, but announce the selected value as a
 // description. The native title exposes truncated values on hover too.
 trigger.setAttribute('aria-describedby',value.id);
 trigger.append(value,chevron);
 select.classList.add('ds-select-native');
 select.setAttribute('aria-hidden','true');select.tabIndex=-1;
 select.replaceWith(field);field.append(name,trigger,select);
 if(select.hasAttribute('data-choice-actions')){
  field.classList.add('ds-property-select--quick');
  const actions=createChoiceActions({label:title,source:select,onUnavailableFocus:origin=>focusInspectorNeighbor(origin,{visibleOnly:true}),readChoices:()=>select.disabled?[]:visibleSelectOptions(select).filter(option=>!isSelectOptionDisabled(option)).map(option=>({label:option.textContent,selected:option.selected,apply:()=>nativeCommit(select,option.value)}))});
  field.insertBefore(actions,trigger);
 }
 const popupId='ds-select-list-'+(++nextUid);
 const searchable=select.hasAttribute('data-searchable');
 const update=()=>{
  const o=select.selectedOptions[0];
  const selectedLabel=o?.label||o?.textContent||'Selecionar';
  value.textContent=selectedLabel;trigger.title=selectedLabel;
  trigger.querySelector('.ds-select-thumbnail')?.remove();
  const thumbnail=selectThumbnail(select,select.value);
  if(thumbnail)trigger.prepend(thumbnail);
  // Disabling a focused trigger can synchronously move focus to body.
  // Capture focus BEFORE setting disabled, including when the portal is closed.
  const triggerWasFocused=document.activeElement===trigger;
  trigger.disabled=select.disabled;
  if(select.disabled&&openSelect?.trigger===trigger){
   const focusInPopup=openSelect.popup.contains(document.activeElement);
   closePopup({restoreFocus:false});
   if(focusInPopup||triggerWasFocused)focusInspectorNeighbor(trigger,{visibleOnly:true});
   return;
  }
  if(select.disabled&&triggerWasFocused){
   focusInspectorNeighbor(trigger,{visibleOnly:true});
   return;
  }
  if(openSelect?.trigger===trigger){
   const focusedOption=openSelect.optionItems.find(({item})=>item===document.activeElement);
   const visible=visibleSelectOptions(select);
   if(selectPopupNeedsRefresh(openSelect.sourceItems||openSelect.optionItems,visible)){
    // Preserve the keyboard position when options are inserted, removed,
    // hidden or renamed. Never leave focus in a detached popup button.
    closePopup({restoreFocus:false});
    open(focusedOption?.option.value);
    return;
   }
   for(const {option,item} of openSelect.optionItems){
    item.disabled=isSelectOptionDisabled(option);
    item.setAttribute('aria-selected',String(select.value===option.value));
   }
   if(!openSelect.optionItems.some(({item})=>!item.disabled)){
    // No focusable option remains. Dismiss instead of leaving focus in a
    // disabled/detached portal (or exposing an unusable expanded combobox).
    closePopup({restoreFocus:false});trigger.focus({preventScroll:true});return;
   }
   if(focusedOption?.item.disabled){
    openSelect.optionItems.find(({item})=>!item.disabled).item.focus();
   }
  }
 };
 const open=(preferredValue=null)=>{
  if(select.disabled)return;
  if(openSelect?.trigger===trigger){closePopup();return;}
  closePopup({restoreFocus:false});
  select.dispatchEvent(new Event('mdress:select-open'));
  const popup=document.createElement('div');popup.id=popupId;popup.className='ds-select-popover';
  popup.setAttribute('popover','manual');
  popup.setAttribute('role','listbox');popup.setAttribute('aria-label',title);
  let list=popup,search=null;
  if(searchable){
   popup.removeAttribute('role');popup.classList.add('ds-select-popover--searchable');
   list=document.createElement('div');list.className='ds-select-results';
   list.id=popupId+'-results';list.setAttribute('role','listbox');list.setAttribute('aria-label',title);
   search=document.createElement('input');search.type='search';search.className='ds-select-search';
   search.placeholder='Buscar fonte…';search.setAttribute('aria-label','Buscar fonte');search.setAttribute('aria-controls',list.id);
   search.autocomplete='off';search.spellcheck=false;
   popup.append(search,list);
  }
  const opts=visibleSelectOptions(select),buttons=[],optionItems=[];
  let typeahead='',lastTypedAt=0,limit=60;
  const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const more=button('ds-select-more','Mostrar mais');
  const renderOptions=()=>{
  list.replaceChildren();buttons.length=0;optionItems.length=0;let lastGroup=null;
  const query=normalize(search?.value.trim()||'');
  const matches=opts.filter(o=>normalize((o.label||o.textContent)+' '+(o.parentElement?.label||'')).includes(query));
  const shown=searchable?matches.slice(0,limit):matches;
  for(const [index,opt] of shown.entries()){
   const group=opt.parentElement?.tagName==='OPTGROUP'?opt.parentElement.label:null;
   if(group&&group!==lastGroup){
    const heading=span('ds-select-group-label',group);
    heading.setAttribute('aria-hidden','true');list.append(heading);
   }
   lastGroup=group;
   const item=button('ds-select-option','');
   item.setAttribute('role','option');item.setAttribute('aria-selected',String(select.value===opt.value));
   item.disabled=isSelectOptionDisabled(opt);
   const text=span('ds-option-label',opt.label||opt.textContent);
   const check=span('ds-option-check');
   const checkIcon=document.createElement('ds-icon');
   checkIcon.setAttribute('name','check');
   checkIcon.setAttribute('size','16');
   check.setAttribute('aria-hidden','true');
   check.append(checkIcon);item.append(text,check);
   const thumbnail=selectThumbnail(select,opt.value);
   if(thumbnail){item.classList.add('ds-select-option--preview');item.prepend(thumbnail);}
   item.dataset.value=opt.value;
   item.title=text.textContent; // Full label remains discoverable when ellipsized.
   item.addEventListener('click',()=>{if(isSelectOptionDisabled(opt))return;nativeCommit(select,opt.value);closePopup();});
   item.addEventListener('keydown',e=>{
    const move=(dir)=>{const available=buttons.filter(b=>!b.disabled&&!b.hidden);const cur=available.indexOf(item);if(search&&dir===-1&&cur===0){search.focus();return;}available[(cur+dir+available.length)%available.length]?.focus();};
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();move(e.key==='ArrowDown'?1:-1);}
    if(e.key==='Home'||e.key==='End'){e.preventDefault();(e.key==='Home'?buttons.find(x=>!x.disabled&&!x.hidden):[...buttons].reverse().find(x=>!x.disabled&&!x.hidden))?.focus();}
    if(e.key==='Escape'){e.preventDefault();closePopup();}
    if(e.key==='Tab'){
     // The listbox is portalled to document.body. Without restoring the
     // sequential-navigation origin, Tab jumps to the page's first control.
     // Move focus to the trigger before the browser handles Tab/Shift+Tab.
     closePopup({restoreFocus:false});
     trigger.focus({preventScroll:true});
    }
    if(!e.isComposing&&e.key.length===1&&/[\p{L}\p{N}]/u.test(e.key)&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
     // Search full labels while typing quickly; repeated initials still cycle.
     const now=Date.now(),query=now-lastTypedAt<700?typeahead+e.key:e.key;
     const options=buttons.map(b=>({disabled:b.disabled||b.hidden,label:b.querySelector('.ds-option-label')?.textContent||''}));
     let index=findEnabledOptionIndex(options,query,buttons.indexOf(item));
     typeahead=query;
     if(index===-1){
      index=findEnabledOptionIndex(options,e.key,buttons.indexOf(item));
      typeahead=e.key;
     }
     lastTypedAt=now;
     if(index!==-1){e.preventDefault();buttons[index].focus();}
    }
   });
   list.append(item);buttons.push(item);optionItems.push({option:opt,item,group,label:text.textContent,value:opt.value});
  }
  more.hidden=shown.length===matches.length;
  more.textContent='Mostrar mais · '+shown.length+' de '+matches.length;
  if(!matches.length)list.append(span('ds-select-empty','Nenhuma fonte encontrada.'));
  };
  renderOptions();
  more.addEventListener('click',()=>{const firstNew=buttons.length;limit+=60;renderOptions();buttons[firstNew]?.focus();});
  if(searchable)popup.append(more);
  if(search){
   search.addEventListener('input',()=>{limit=60;renderOptions();list.scrollTop=0;});
   search.addEventListener('keydown',event=>{
    const available=buttons.filter(item=>!item.disabled&&!item.hidden);
    if(['ArrowDown','ArrowUp','Enter'].includes(event.key)){
     event.preventDefault();
     if(event.key==='Enter')available[0]?.click();
     else (event.key==='ArrowUp'?available.at(-1):available[0])?.focus();
    }
    if(event.key==='Escape'){event.preventDefault();closePopup();}
    if(event.key==='Tab'){closePopup({restoreFocus:false});trigger.focus({preventScroll:true});}
   });
  }
  (trigger.closest('dialog')||document.body).append(popup);popup.showPopover();
  trigger.setAttribute('aria-controls',searchable?popupId+'-results':popupId);
  const reposition=()=>{
   const anchor=trigger.getBoundingClientRect();
   const box=selectPopoverLayout(searchable?{...anchor.toJSON(),width:320}:anchor,
    {width:window.innerWidth,height:window.innerHeight},popup.scrollHeight);
   popup.style.left=box.left+'px';
   popup.style.top=box.top+'px';
   popup.style.bottom='auto';
   popup.style.width=box.width+'px';
   popup.style.maxHeight=box.maxHeight+'px';
  };
  reposition();
  trigger.setAttribute('aria-expanded','true');
  openSelect={popup,trigger,optionItems,sourceItems:opts.map(option=>({option,value:option.value,label:option.label||option.textContent,group:option.parentElement?.tagName==='OPTGROUP'?option.parentElement.label:null})),reposition,onClose:()=>{}};
  // The listbox is portalled to body, so hiding its source accordion,
  // inspector tab or entire panel does not automatically remove it.
  // Observe only the anchor's ancestor chain while open. This also catches
  // programmatic tab changes (no pointerdown) and detached inspector nodes.
  const visibilityObserver=new MutationObserver(()=>{
   if(openSelect?.trigger!==trigger)return;
   const hidden=!trigger.isConnected||
    Boolean(trigger.closest('[hidden],[inert],[aria-hidden="true"]'))||
    !trigger.getClientRects().length||
    getComputedStyle(trigger).visibility==='hidden';
   if(!hidden)return;
   const focusInPopup=popup.contains(document.activeElement);
   closePopup({restoreFocus:false});
   if(focusInPopup)focusInspectorNeighbor(trigger,{visibleOnly:true});
  });
  for(let ancestor=trigger;ancestor;ancestor=ancestor.parentElement)
   visibilityObserver.observe(ancestor,{
    attributes:true,attributeFilter:['hidden','inert','aria-hidden','class','style'],
    childList:true
   });
  openSelect.visibilityObserver=visibilityObserver;
  const target=buttons.find(b=>b.dataset.value===preferredValue&&!b.disabled)||
   buttons.find(b=>b.dataset.value===select.value&&!b.disabled)||
   buttons.find(b=>!b.disabled);
  if(search&&preferredValue===null)search.focus();
  else if(target)target.focus();
  else {closePopup({restoreFocus:false});trigger.focus({preventScroll:true});}
 };
 trigger.addEventListener('click',event=>{event.preventDefault();open();});
 trigger.addEventListener('keydown',e=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}});
 select.addEventListener('change',()=>queueMicrotask(update));
 const observer=new MutationObserver(update);observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['selected','label','disabled','hidden','value'],characterData:true});
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
  const sectionIcons={'Tipografia':'typography','Cores e fundo':'palette','Fundos prontos':'paintbrush','Aparência dos blocos':'layout-template','Ritmo do documento':'line-height','Página e margens':'layout-template','Paginação':'file-text','Peso do PDF':'file-down','Estilos prontos':'sparkles','Meus temas':'save','Variações e travas':'lock','Criar tema com IA':'sparkles'};
  const sectionIcon=document.createElement('ds-icon');
  sectionIcon.className='ds-accordion-icon';sectionIcon.setAttribute('name',sectionIcons[title]||'settings-2');
  sectionIcon.setAttribute('size','15');sectionIcon.setAttribute('aria-hidden','true');name.prepend(sectionIcon);
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
  const gallery=body.querySelector('#themeRecipeGallery,#backgroundGallery');
  let actions;
  if(gallery){
   actions=createChoiceActions({label:title,source:gallery,onUnavailableFocus:origin=>focusInspectorNeighbor(origin,{visibleOnly:true}),readChoices:()=>[...gallery.querySelectorAll('button')].filter(b=>!b.disabled).map(b=>({label:b.getAttribute('aria-label')||b.textContent,selected:b.getAttribute('aria-pressed')==='true',apply:()=>b.click()}))});
  }
  const header=createInspectorHeader({toggle,actions});heading.replaceWith(header);section.append(body);
  toggle.setAttribute('aria-controls',id);
  let initial=Boolean(gallery)||section.dataset.collapsed==='true';
  try{const stored=localStorage.getItem(key);if(stored)initial=stored==='closed';}catch{}
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
  const typographyIcon={fontChoice:'type',fontSize:'font-size',lineHeight:'line-height',titleScale:'heading',sectionStyleTarget:'layout-template',markdownElementTarget:'mouse-pointer-2',bottomSectionEnabled:'panel-bottom',selectedSectionBreak:'page-break',sectionGapEm:'line-height',sectionRule:'minus',elementFontSize:'font-size',elementLineHeight:'line-height',elementSpacing:'panel-bottom',paperSize:'file',marginMm:'maximize-2',showPageGuides:'page-break',resumeTheme:'paintbrush',savedThemePicker:'save'}[input.id]||{fontWeight:'heading',align:'list-tree'}[input.dataset.elementProperty];
  if(typographyIcon){
   const name=label.querySelector('.ds-prop-name');
   if(name){
    name.parentElement.classList.add('ds-property-icon-label');
    const text=span('ds-prop-name-hidden',title),icon=document.createElement('ds-icon');
    icon.setAttribute('name',typographyIcon);icon.setAttribute('size','16');icon.setAttribute('aria-hidden','true');
    name.replaceChildren(icon,text);
   }
  }
 }
}
export function syncPropertyControls(){
 for(const update of controllers)update();
}
/** Upgrade native selects anywhere, retaining their IDs, options and change events. */
export function enhanceSelects(root=document){
 for(const select of root.querySelectorAll('select:not([hidden]):not(.ds-select-native)')){
  if(enhanced.has(select))continue;
  enhanced.add(select);
  const host=document.createElement('span');host.className='ds-select-host';host.dataset.selectId=select.id;
  const title=select.getAttribute('aria-label')||select.closest('label')?.childNodes[0]?.textContent?.trim()||'Selecionar';
  select.before(host);host.append(select);makeListbox(host,select,title);
 }
}
export function initializePropertyControls(){
 initializeColorPicker();
 enhancePropertyControls();
 enhanceSelects();
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
 // Focus may leave a portalled listbox without a pointer event (scripted
 // focus, browser navigation or assistive technology). Do not leave an
 // expanded combobox behind when keyboard focus moves elsewhere. Preserve
 // the new focus target instead of stealing focus back to the trigger.
 document.addEventListener('focusin',event=>{
  if(openSelect&&!openSelect.popup.contains(event.target)&&!openSelect.trigger.contains(event.target))
   closePopup({restoreFocus:false});
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&openSelect){event.preventDefault();closePopup();}});
 document.addEventListener('close',event=>{
  if(openSelect&&event.target.contains?.(openSelect.trigger))closePopup({restoreFocus:false});
 },true);
 document.addEventListener('scroll',event=>{
  if(!openSelect||openSelect.trigger.closest('.design-inspector')||openSelect.popup.contains(event.target))return;
  const {trigger,reposition}=openSelect,rect=trigger.getBoundingClientRect();
  const dialog=trigger.closest('dialog'),bounds=dialog?.getBoundingClientRect();
  if(rect.bottom<=0||rect.top>=innerHeight||(bounds&&(rect.bottom<=bounds.top||rect.top>=bounds.bottom)))closePopup({restoreFocus:false});
  else reposition();
 },true);
 window.addEventListener('resize',()=>{
  if(!openSelect)return;
  // A resize (including browser zoom/orientation changes) must not strand
  // keyboard focus in a detached option when the popup is dismissed.
  const {popup,trigger}=openSelect;
  closePopup({restoreFocus:popup.contains(document.activeElement)&&!trigger.disabled});
 });
 document.querySelector('.inspector-scroll')?.addEventListener('scroll',()=>{
  // Keep popovers anchored while auto-scrolling an inspector control into view.
  if(!openSelect)return;
  const {trigger,reposition}=openSelect,rect=trigger.getBoundingClientRect();
  const scroller=trigger.closest('.inspector-scroll');
  const viewport=scroller?.getBoundingClientRect();
  if(rect.bottom<=0||rect.top>=window.innerHeight||
   (viewport&&(rect.bottom<=viewport.top||rect.top>=viewport.bottom))){
   // A portalled option owns focus while the trigger scrolls out of view.
   // Removing it without a focus handoff silently drops keyboard users on body.
   const focusInPopup=openSelect.popup.contains(document.activeElement);
   closePopup({restoreFocus:false});
   if(focusInPopup)focusInspectorNeighbor(trigger,{visibleOnly:true});
   return;
  }
  reposition();
 },{passive:true});
}
