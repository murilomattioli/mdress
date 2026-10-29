/** Dependency-free color editor. Native inputs remain the document's source of truth. */
const clamp=(n,max=100)=>Math.max(0,Math.min(max,n));
export function parseHex(value){
 if(!/^#?[\da-f]{6}$/i.test(value))return null;
 return '#'+value.replace('#','').toUpperCase();
}
export function rgbToHex(rgb){return '#'+rgb.map(n=>Math.round(clamp(n,255)).toString(16).padStart(2,'0')).join('').toUpperCase();}
export function hexToRgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function rgbToHsv(rgb){
 const [r,g,b]=rgb.map(n=>n/255),v=Math.max(r,g,b),d=v-Math.min(r,g,b);
 const h=!d?0:v===r?((g-b)/d+6)%6:v===g?(b-r)/d+2:(r-g)/d+4;
 return [h*60,v?d/v*100:0,v*100];
}
export function hsvToRgb([h,s,v]){
 s=clamp(s)/100;v=clamp(v)/100;h=((h%360)+360)%360/60;
 const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;
 return [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)].map(n=>Math.round((n+m)*255));
}
// Invalid persisted opacity must not poison native range inputs or CSS alpha.
export function opacityPercent(value){
 if(value===undefined||value===null||value==='')return 100;
 const numeric=Number(value);
 return Number.isFinite(numeric)?Math.round(clamp(numeric,1)*100):100;
}
const STORE='mdress.saved-colors.v1';
const DEFAULTS=['#000000','#FFFFFF','#FF3B30','#FF9500','#FFCC00','#34C759','#5AC8FA','#007AFF','#5856D6','#FF2D55'];
function savedColors(){try{const list=JSON.parse(localStorage.getItem(STORE));return Array.isArray(list)?[...new Set(list.filter(v=>typeof v==='string').map(parseHex).filter(Boolean))].slice(0,12):DEFAULTS;}catch{return DEFAULTS;}}
function node(tag,cls,text){const el=document.createElement(tag);el.className=cls||'';if(text)el.textContent=text;return el;}
function button(label,icon){const b=node('button','cp-button');b.type='button';b.setAttribute('aria-label',label);b.title=label;if(icon){const svg=node('ds-icon');svg.setAttribute('name',icon);svg.setAttribute('size','18');b.append(svg);}else b.textContent=label;return b;}
let active=null;
let nextPickerId=0;
export function openColorPicker(input){
 if(input.disabled)return;
 active?.close();
 let hex=parseHex(input.value)||'#000000',hsv=rgbToHsv(hexToRgb(hex)),saved=savedColors();
 const dialog=node('dialog','mdress-color-picker');active=dialog;
 let restoreFocus=true,handoffOnClose=false,opacity=opacityPercent(input.dataset.opacity);
 const events=new AbortController();
 const anchor=()=>input.isConnected?input:[...document.querySelectorAll('input[type="color"]')].find(el=>input.id?el.id===input.id:el.getAttribute('aria-label')===input.getAttribute('aria-label'));
 dialog.setAttribute('aria-label','Cores — '+(input.getAttribute('aria-label')||input.closest('label')?.querySelector('.ds-prop-name')?.textContent||'Documento'));
 const header=node('header','cp-header'),heading=node('h2','','Cores'),close=button('Fechar seletor de cores','x'),pipette=button('Capturar cor da tela','pipette');
 header.append(pipette,heading,close);close.onclick=()=>dialog.close();
 pipette.disabled=typeof window.EyeDropper!=='function';if(pipette.disabled)pipette.title='Conta-gotas indisponível neste navegador';
 const tabs=node('div','cp-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Modo de seleção');
 const modes=['Grade','Espectro','RGB'],panels=modes.map((name,i)=>{const p=node('div','cp-panel');p.id='cp-panel-'+i;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby','cp-tab-'+i);return p;});
 const tabButtons=modes.map((name,i)=>{const b=button(name);b.id='cp-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',panels[i].id);b.onclick=()=>selectTab(i);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;selectTab(next);tabButtons[next].focus();};tabs.append(b);return b;});
 function selectTab(index){tabButtons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});}
 const grid=node('div','cp-grid');grid.setAttribute('aria-label','Paleta de cores');panels[0].append(grid);
 const colors=Array.from({length:12},(_,i)=>rgbToHex(Array(3).fill(255-i*255/11)));
 for(let row=0;row<7;row++)for(let col=0;col<12;col++)colors.push(rgbToHex(hsvToRgb([col*30,row<3?25+row*25:90,row<3?100:100-(row-3)*20])));
 // Roving keyboard focus starts at the selected palette color, not at an
 // unrelated first swatch. Keep exactly one Tab stop as users navigate.
 let gridFocusIndex=Math.max(0,colors.indexOf(hex));
 const cells=colors.map((color,i)=>{const b=button(color);b.className='cp-cell';b.textContent='';b.style.background=color;b.tabIndex=i===gridFocusIndex?0:-1;b.onclick=()=>{gridFocusIndex=i;commit(color);};b.onkeydown=e=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-12,ArrowDown:12,Home:-i,End:colors.length-1-i}[e.key];if(delta===undefined)return;e.preventDefault();gridFocusIndex=clamp(i+delta,colors.length-1);cells.forEach((c,j)=>c.tabIndex=j===gridFocusIndex?0:-1);cells[gridFocusIndex].focus();};grid.append(b);return b;});
 const spectrum=node('div','cp-spectrum');spectrum.tabIndex=0;spectrum.setAttribute('role','group');spectrum.setAttribute('aria-label','Saturação e luminosidade. Use as setas para ajustar.');
 const cursor=node('span','cp-cursor');spectrum.append(cursor);
 const hueLabel=node('label','cp-hue-label','Matiz'),hue=node('input','cp-hue');hue.type='range';hue.min='0';hue.max='360';hue.setAttribute('aria-label','Matiz');hueLabel.append(hue);panels[1].append(spectrum,hueLabel);
 function changeHSV(){commit(rgbToHex(hsvToRgb(hsv)),true);}
 function move(e){const r=spectrum.getBoundingClientRect();hsv[1]=clamp((e.clientX-r.left)/r.width*100);hsv[2]=100-clamp((e.clientY-r.top)/r.height*100);changeHSV();}
 spectrum.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();spectrum.focus();spectrum.setPointerCapture(e.pointerId);move(e);};
 spectrum.onpointermove=e=>{if(spectrum.hasPointerCapture(e.pointerId))move(e);};
 spectrum.onpointerup=e=>{if(spectrum.hasPointerCapture(e.pointerId))spectrum.releasePointerCapture(e.pointerId);};
 spectrum.onkeydown=e=>{const delta={ArrowLeft:[1,-1],ArrowRight:[1,1],ArrowUp:[2,1],ArrowDown:[2,-1]}[e.key];if(!delta)return;e.preventDefault();hsv[delta[0]]=clamp(hsv[delta[0]]+delta[1]*(e.shiftKey?10:1));changeHSV();};
 hue.oninput=()=>{hsv[0]=Number(hue.value);changeHSV();};
 const channels=['Vermelho','Verde','Azul'].map((label,index)=>{
  const row=node('label','cp-channel'),name=node('span','',label),range=node('input'),number=node('input');range.type='range';number.type='number';
  for(const el of [range,number]){el.min='0';el.max='255';el.step='1';el.setAttribute('aria-label',label+(el===range?' — controle':' — valor'));}
  function apply(el){const value=el.valueAsNumber;if(!Number.isFinite(value)||value<0||value>255||!Number.isInteger(value)){showFieldError(el,'Use um valor inteiro entre 0 e 255.');return;}clearFieldError(el);const rgb=hexToRgb(hex);rgb[index]=value;commit(rgbToHex(rgb));}
  range.oninput=()=>apply(range);number.onchange=()=>apply(number);number.onkeydown=e=>{if(e.key==='Enter')apply(number);if(e.key==='Escape'){e.stopPropagation();number.value=hexToRgb(hex)[index];clearFieldError(number);}};
  row.append(name,range,number);panels[2].append(row);return {range,number};
 });
 const valueRow=node('div','cp-value'),preview=node('span','cp-preview'),hexLabel=node('label','','Hexadecimal'),hexInput=node('input','cp-hex');hexInput.type='text';hexInput.maxLength=7;hexInput.spellcheck=false;hexInput.setAttribute('aria-label','Cor hexadecimal');hexLabel.append(hexInput);valueRow.append(preview,hexLabel);
 const opacityRow=node('label','cp-opacity'),opacityLabel=node('span','','Opacidade'),opacityRange=node('input'),opacityValue=node('input');
 opacityRange.type='range';opacityValue.type='number';
 for(const control of [opacityRange,opacityValue]){control.min='0';control.max='100';control.step='1';control.setAttribute('aria-label',control===opacityRange?'Opacidade':'Opacidade em porcentagem');}
 const opacitySuffix=node('span','','%');opacityRow.append(opacityLabel,opacityRange,opacityValue,opacitySuffix);
 function applyOpacity(control){
  const value=control.valueAsNumber;
  if(!Number.isFinite(value)||!Number.isInteger(value)||value<0||value>100){
   showFieldError(control,'Use um valor inteiro entre 0% e 100%.');
   return;
  }
  clearFieldError(control);
  opacity=value;sync();
  const target=anchor();
  if(target){
   const previous=target.dataset.opacity===undefined?1:Number(target.dataset.opacity);
   const next=opacity/100;
   // Do not create duplicate history entries for Enter/change or unchanged slider values.
   // Repair corrupted persisted alpha instead of treating it as a valid unchanged value.
   if(!Number.isFinite(previous)||previous<0||previous>1||Math.abs(previous-next)>1e-9){
    target.dataset.opacity=next;
    target.dispatchEvent(new CustomEvent('coloropacitychange',{bubbles:true,detail:next}));
   }
  }
 }
 opacityRange.oninput=()=>applyOpacity(opacityRange);opacityValue.onchange=()=>applyOpacity(opacityValue);
 opacityValue.onkeydown=e=>{
  if(e.key!=='Escape')return;
  e.stopPropagation();
  opacityValue.value=opacity;
  clearFieldError(opacityValue);
 };
 const status=node('p','cp-status');status.id='mdress-color-error-'+(++nextPickerId);status.setAttribute('role','status');
 function showFieldError(control,message){
  control.setAttribute('aria-invalid','true');
  control.setAttribute('aria-errormessage',status.id);
  status.dataset.error='true';status.textContent=message;
 }
 function clearFieldError(control){
  control.removeAttribute('aria-invalid');control.removeAttribute('aria-errormessage');
  delete status.dataset.error;status.textContent='';
 }
 function applyHex(){const value=parseHex(hexInput.value.trim());if(!value){showFieldError(hexInput,'Use seis dígitos: #RRGGBB.');return;}commit(value);}
 hexInput.onchange=applyHex;hexInput.onkeydown=e=>{if(e.key==='Enter')applyHex();if(e.key==='Escape'){e.stopPropagation();hexInput.value=hex;clearFieldError(hexInput);}};
 const footer=node('section','cp-saved'),footerTitle=node('div','cp-saved-title','Cores salvas'),swatches=node('div','cp-swatches'),add=button('Salvar cor atual','plus');footerTitle.append(add);footer.append(footerTitle,swatches);
 function renderSaved(){swatches.replaceChildren();saved.forEach(color=>{const b=button('Usar '+color);b.className='cp-saved-color';b.textContent='';b.style.background=color;b.onclick=()=>commit(color);swatches.append(b);});}
 add.onclick=()=>{saved=[hex,...saved.filter(c=>c!==hex)].slice(0,12);renderSaved();try{localStorage.setItem(STORE,JSON.stringify(saved));status.textContent='Cor salva.';}catch{status.textContent='Cor disponível nesta sessão; armazenamento indisponível.';}};
 function sync(){
  opacityRange.value=opacityValue.value=opacity;for(const control of [opacityRange,opacityValue]){control.removeAttribute('aria-invalid');control.removeAttribute('aria-errormessage');}opacityRange.style.setProperty('--cp-opacity-color',hex);
  preview.style.background=hex+Math.round(opacity/100*255).toString(16).padStart(2,'0');hexInput.value=hex;hexInput.removeAttribute('aria-invalid');hexInput.removeAttribute('aria-errormessage');
  // When a different editor selects a palette color, the next Tab into the
  // palette must reach that color. Do not move focus during arrow navigation.
  const selectedIndex=colors.indexOf(hex);
  if(selectedIndex>=0&&!grid.contains(document.activeElement))gridFocusIndex=selectedIndex;
  cells.forEach((b,i)=>{b.setAttribute('aria-pressed',String(b.title===hex));b.tabIndex=i===gridFocusIndex?0:-1;});
  spectrum.style.backgroundColor=rgbToHex(hsvToRgb([hsv[0],100,100]));cursor.style.left=hsv[1]+'%';cursor.style.top=(100-hsv[2])+'%';
  spectrum.setAttribute('aria-description',`Saturação ${Math.round(hsv[1])}%, luminosidade ${Math.round(hsv[2])}%.`);hue.value=hsv[0];
  const rgb=hexToRgb(hex);channels.forEach(({range,number},i)=>{range.value=number.value=rgb[i];number.removeAttribute('aria-invalid');number.removeAttribute('aria-errormessage');const low=[...rgb],high=[...rgb];low[i]=0;high[i]=255;range.style.background=`linear-gradient(to right,${rgbToHex(low)},${rgbToHex(high)})`;});
 }
 function commit(value,keepHSV=false){
  if(input.disabled){dialog.close();return;}hex=value;if(!keepHSV)hsv=rgbToHsv(hexToRgb(hex));status.textContent='';delete status.dataset.error;sync();
  const target=anchor();if(target){
   // Native color inputs normalize case; compare semantic colors, not raw strings.
   // Enter followed by change and reselecting a swatch must not duplicate edits.
   const changed=parseHex(target.value)!==hex;
   if(changed){target.value=hex;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));}
  }
 }
 pipette.onclick=async()=>{try{const result=await new window.EyeDropper().open();if(dialog.open)commit(parseHex(result.sRGBHex)||hex);}catch(error){if(error.name!=='AbortError')status.textContent='Não foi possível capturar a cor.';}};
 dialog.append(header,tabs,...panels,valueRow,opacityRow,footer,status);document.body.append(dialog);
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();dialog.close();}
  if(e.key==='Tab'){
   const items=[...dialog.querySelectorAll('button,input,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
   if(document.activeElement===(e.shiftKey?items[0]:items.at(-1))){dialog.close();}
  }
 });
 function reposition(){
  const target=anchor();if(!target){dialog.close();return;}
  const a=target.getBoundingClientRect(),gap=8,edge=12,w=dialog.offsetWidth,h=dialog.offsetHeight;
  const below=innerHeight-a.bottom-gap-edge,above=a.top-gap-edge;
  let top=a.bottom+gap,left=a.right-w;
  if(below<h){
   if(above>=h)top=a.top-gap-h;
   else if(a.left-gap-edge>=w){left=a.left-gap-w;top=a.top;}
   else if(innerWidth-a.right-gap-edge>=w){left=a.right+gap;top=a.top;}
   else top=below>=above?a.bottom+gap:a.top-gap-h;
  }
  dialog.style.left=Math.max(edge,Math.min(innerWidth-w-edge,left))+'px';
  dialog.style.top=Math.max(edge,Math.min(innerHeight-h-edge,top))+'px';
 }
 document.addEventListener('pointerdown',e=>{
  if(!dialog.contains(e.target)&&e.target!==anchor()){restoreFocus=false;dialog.close();}
 },{signal:events.signal});
 document.addEventListener('focusin',e=>{
  if(dialog.open&&!dialog.contains(e.target)&&e.target!==anchor()){restoreFocus=false;dialog.close();}
 },{signal:events.signal});
 window.addEventListener('resize',reposition,{signal:events.signal});
 document.addEventListener('scroll',reposition,{capture:true,signal:events.signal});
 const observer=new ResizeObserver(reposition);observer.observe(dialog);
 // A disabled source can no longer accept edits: dismiss its popover and
 // transfer keyboard focus instead of stranding focus inside a dead editor.
 const disabledObserver=new MutationObserver(()=>{
  if(!input.disabled||!dialog.open)return;
  restoreFocus=false;handoffOnClose=true;dialog.close();
 });
 disabledObserver.observe(input,{attributes:true,attributeFilter:['disabled']});
 dialog.addEventListener('close',()=>{
  events.abort();observer.disconnect();disabledObserver.disconnect();
  dialog.remove();if(active===dialog)active=null;
  // Mesh updates rebuild their native inputs; restore focus to the replacement.
  const target=anchor();
  if(restoreFocus&&target&&!target.disabled)target.focus();
   else if(handoffOnClose){
    const scope=input.closest('.design-inspector')||document;
    const usable=el=>el!==input&&!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&
     !el.closest('[hidden],[inert],[aria-hidden="true"]')&&getComputedStyle(el).visibility!=='hidden';
    [...scope.querySelectorAll('button,input,select,textarea,[tabindex]')].find(usable)?.focus({preventScroll:true});
   }
 },{once:true});
 selectTab(0);renderSaved();sync();dialog.show();reposition();tabButtons[0].focus({preventScroll:true});
}
let initialized=false;
export function initializeColorPicker(){
 if(initialized)return;initialized=true;
 document.addEventListener('click',e=>{if(e.target.matches('input[type="color"]')){e.preventDefault();openColorPicker(e.target);}});
 document.addEventListener('keydown',e=>{if(e.target.matches('input[type="color"]')&&['Enter',' '].includes(e.key)){e.preventDefault();openColorPicker(e.target);}});
}
