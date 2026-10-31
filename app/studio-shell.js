import {createIcon,createOutlineItem} from './design-system/components.js';
import {sectionAnchors} from './section-pagination.js';
import {connectScrollSync} from './scroll-sync.js';
import {attachToolbarOverflow} from './toolbar-overflow.js';
const $=id=>document.getElementById(id);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function saved(key,initial){try{const value=Number(localStorage.getItem('studio-'+key));return value>0?value:initial;}catch{return initial;}}
function store(key,v){try{localStorage.setItem('studio-'+key,String(v));}catch{}}
class DSSplitter extends HTMLElement{
 connectedCallback(){
  this.tabIndex=0;this.dataset.area=this.dataset.target;this.size=this.dataset.area==='inspector'?330:435;
  this.size=saved(this.dataset.area,this.size);this.apply(this.size);
  this.setAttribute('aria-valuemin',this.dataset.area==='inspector'?'268':'280');
  this.setAttribute('aria-valuemax',this.dataset.area==='inspector'?'470':'720');
  this.addEventListener('pointerdown',e=>this.begin(e));
  this.addEventListener('keydown',e=>this.keys(e));
 }
 apply(value){
  const right=this.dataset.area==='inspector',min=right?268:280;
  const max=right?470:Math.min(720,Math.max(min,innerWidth-440));
  this.size=Math.round(clamp(value,min,max));
  document.documentElement.style.setProperty(right?'--inspector-width':'--editor-width',this.size+'px');
  this.setAttribute('aria-valuenow',String(this.size));store(this.dataset.area,this.size);
  document.dispatchEvent(new CustomEvent('studio:resized',{detail:{area:this.dataset.area,size:this.size}}));
 }
 begin(event){
  if(event.button!==0)return;event.preventDefault();this.setPointerCapture(event.pointerId);
  const id=event.pointerId,start=event.clientX,initial=this.size,sgn=this.dataset.area==='inspector'?-1:1;
  this.dataset.dragging='true';
  const move=e=>{if(e.pointerId===id)this.apply(initial+(e.clientX-start)*sgn);};
  const end=e=>{
   if(e.pointerId!==id)return;this.dataset.dragging='false';
   this.removeEventListener('pointermove',move);this.removeEventListener('pointerup',end);this.removeEventListener('pointercancel',end);
   if(this.hasPointerCapture(id))this.releasePointerCapture(id);
  };
  this.addEventListener('pointermove',move);this.addEventListener('pointerup',end);this.addEventListener('pointercancel',end);
 }
 keys(e){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
  if(e.key==='Home')return this.apply(270);
  if(e.key==='End')return this.apply(this.dataset.area==='inspector'?470:720);
  this.apply(this.size+(e.key==='ArrowRight'?1:-1)*(this.dataset.area==='inspector'?-1:1)*(e.shiftKey?40:16));
 }
}
if(!customElements.get('ds-splitter'))customElements.define('ds-splitter',DSSplitter);
function menu(){
 const popup=$('documentMenu'),toggle=$('documentMenuToggle');
 const close=()=>{popup.classList.add('hidden');toggle.setAttribute('aria-expanded','false');};
 toggle.addEventListener('click',event=>{
  event.stopPropagation();const opening=popup.classList.contains('hidden');
  popup.classList.toggle('hidden',!opening);toggle.setAttribute('aria-expanded',String(opening));if(opening)popup.querySelector('button')?.focus();
 });
 popup.addEventListener('click',event=>{if(event.target.closest('button'))close();});
 document.addEventListener('pointerdown',event=>{if(!popup.contains(event.target)&&!toggle.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popup.classList.contains('hidden')){close();toggle.focus();}});
}
function outline(){
 const source=$('source'),gutter=$('sourceGutter'),list=$('outlineList'),count=$('outlineCount');let last='',timer=0,breakBefore=new Set();
 const refresh=()=>{
  const markdown=source.value||'';if(markdown===last)return;last=markdown;
  const lines=markdown.split('\n'),fragment=document.createDocumentFragment(),total=Math.min(lines.length,1800);
  for(let i=0;i<total;i++){const node=document.createElement('span');node.textContent=String(i+1);fragment.append(node);}
  gutter.replaceChildren(fragment);list.replaceChildren();
  let offset=0,sections=0;const headings=document.createDocumentFragment();
  const anchors=new Map(sectionAnchors(markdown).map(a=>[a.line,a]));
  let lineNumber=0;
  for(const line of lines){
   lineNumber++;
   const match=line.match(/^(#{1,4})\s+(.+?)\s*$/);
   if(match&&sections<120){
    const title=match[2].replace(/[*_~\x60]/g,'').slice(0,80),start=offset,depth=match[1].length;
    const item=createOutlineItem({heading:title,depth,onClick:()=>{
     source.focus();source.setSelectionRange(start+depth+1,start+line.length);
     const row=markdown.slice(0,start).split('\n').length;
     source.scrollTop=Math.max(0,(row-1)*22.8-source.clientHeight*.25);
     const rendered=[...document.querySelectorAll('#pageStack h1,#pageStack h2,#pageStack h3,#pageStack h4')];
     rendered.find(n=>n.textContent.trim().toLowerCase()===title.toLowerCase())?.scrollIntoView({behavior:'smooth',block:'center'});
    }});
    const anchor=anchors.get(lineNumber);
    if(anchor&&anchor.level>=2){
     const group=document.createElement('div');group.className='outline-section-row';group.append(item);
     const action=document.createElement('button');action.type='button';action.className='outline-break-toggle';
     action.setAttribute('aria-label','Alternar quebra de página para '+title);
     action.dataset.sectionBreakId=anchor.id;action.setAttribute('aria-pressed',String(breakBefore.has(anchor.id)));action.title=breakBefore.has(anchor.id)?'Remover quebra manual':'Iniciar em nova página';
     action.innerHTML='<ds-icon name="page-break" size="14"></ds-icon>';
     action.onclick=()=>document.dispatchEvent(new CustomEvent('mdress:toggle-page-break',{detail:{id:anchor.id}}));
     group.append(action);headings.append(group);
    }else headings.append(item);
    sections++;
   }
   offset+=line.length+1;
  }
  list.append(headings);count.textContent=sections+' '+(sections===1?'seção':'seções');
 };
 source.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(refresh,100);});
 source.addEventListener('scroll',()=>{gutter.scrollTop=source.scrollTop;},{passive:true});
 source.addEventListener('keyup',markLine);source.addEventListener('click',markLine);
 function markLine(){
  const line=source.value.slice(0,source.selectionStart).split('\n').length;
  for(const [index,node] of [...gutter.children].entries())node.classList.toggle('line-active',index===line-1);
 }
 new MutationObserver(()=>{last='';refresh();}).observe($('docPicker'),{childList:true,attributes:true,attributeFilter:['value']});
 setTimeout(refresh,100);
  const syncBreaks=event=>{
  breakBefore=new Set(event.detail?.breakBefore||[]);
  for(const button of list.querySelectorAll('[data-section-break-id]')){
   const checked=breakBefore.has(button.dataset.sectionBreakId);
   button.setAttribute('aria-pressed',String(checked));
   button.title=checked?'Remover quebra manual':'Iniciar em nova página';
  }
 };
 document.addEventListener('mdress:pagination-changed',syncBreaks);
 document.addEventListener('mdress:document-changed',event=>{syncBreaks(event);last='';refresh();});
}
function canvas(){
 const zoom=$('zoom'),stack=$('pageStack'),scroll=document.querySelector('.preview-scroll');
 const setZoom=raw=>{
  const value=Number(clamp(raw,.4,1.5).toFixed(2)),key=String(value);
  stack.style.setProperty('--preview-zoom',key);
  if(![...zoom.options].some(x=>x.value===key))zoom.add(new Option(Math.round(value*100)+'%',key));
  zoom.value=key;zoom.dispatchEvent(new Event('change',{bubbles:true}));store('zoom',value);
 };
 const fit=()=>{
  const paper=$('paper');if(!paper||!paper.offsetWidth)return;
  setZoom(Math.min(1,(scroll.clientWidth-58)/paper.offsetWidth,(scroll.clientHeight-110)/paper.offsetHeight));
 };
 $('zoomIn').addEventListener('click',()=>setZoom(Number(zoom.value)+.125));
 $('zoomOut').addEventListener('click',()=>setZoom(Number(zoom.value)-.125));
 $('zoomFit').addEventListener('click',fit);
 zoom.addEventListener('change',()=>store('zoom',Number(zoom.value)));
 setZoom(saved('zoom',.75));requestAnimationFrame(()=>requestAnimationFrame(fit));
 document.addEventListener('studio:resized',()=>{if(innerWidth<1440)fit();});
 const design=$('railDesign');
 design.addEventListener('click',()=>{$('designToggle').click();requestAnimationFrame(fit);});
 new MutationObserver(()=>{
  const opened=!$('themesView').classList.contains('hidden');
  design.classList.toggle('active',opened);design.setAttribute('aria-pressed',String(opened));
  requestAnimationFrame(fit);
 }).observe($('themesView'),{attributes:true,attributeFilter:['class']});
 document.querySelectorAll('[data-workspace-mode]').forEach(button=>button.addEventListener('click',()=>requestAnimationFrame(fit)));
}
function setupPageGuides(){
 const control=$('showPageGuides'),stack=$('pageStack');if(!control||!stack)return;
 try{control.checked=localStorage.getItem('studio-page-guides')!=='hidden';}catch{}
 const sync=()=>{
  stack.classList.toggle('hide-page-guides',!control.checked);
  try{localStorage.setItem('studio-page-guides',control.checked?'visible':'hidden');}catch{}
 };
 control.addEventListener('change',sync);sync();
}
function enhancement(){
 document.querySelectorAll('.markdown-toolbar [data-md-command]').forEach(button=>{
  button.classList.add('ds-button');
  const icon={link:'file',inlineCode:'code-2',bullet:'list-tree',number:'list-tree',task:'list-tree',quote:'file-text',fence:'code-2',rule:'minus'}[button.dataset.mdCommand];
  if(icon)button.replaceChildren(createIcon(icon,15));
 });
 $('paginationStatus')?.classList.add('ds-status');
 const status=$('saveStatus'),dot=document.querySelector('.save-indicator');
 new MutationObserver(()=>{
  const msg=status.textContent||'';
  dot.style.backgroundColor=/indisponível|falha|erro/i.test(msg)?'var(--ds-danger)':/pendente|salvando|carregando/i.test(msg)?'var(--ds-warning)':'var(--ds-success)';
 }).observe(status,{childList:true,characterData:true,subtree:true});
}
function init(){
 $('editorSplitter')?.apply(saved('editor',435));$('inspectorSplitter')?.apply(saved('inspector',330));
 menu();outline();enhancement();attachToolbarOverflow(document.querySelector('.markdown-toolbar'));canvas();setupPageGuides();
 connectScrollSync({source:$('source'),preview:document.querySelector('.preview-scroll'),stack:$('pageStack'),workspace:document.querySelector('.workspace')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
