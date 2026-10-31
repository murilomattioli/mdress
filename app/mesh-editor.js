import {confirmAlert} from './design-system/alert-dialog.js';
import {validateTheme,backgroundCSS,backgroundSize} from './resume-themes.js';
import {meshSeed} from './mesh-background.js';

const $=id=>document.getElementById(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function make(tag,options={}){const node=document.createElement(tag);for(const [k,v] of Object.entries(options))if(k==='text')node.textContent=v;else if(k==='class')node.className=v;else node.setAttribute(k,v);return node;}
/**
 * Contextual mesh editor; drag previews never persist until pointerup.
 * All colors/points use validated declarative config; no freeform CSS.
 */
export function drawMeshEditor(themeInput,onApply,onPreview){
 const theme=validateTheme(themeInput),visible=theme.backgroundStyle.kind==='mesh';
 const root=$('meshControls');root.classList.toggle('hidden',!visible);
 if(!visible)return;
 const panel=$('meshPointControls'),canvas=$('meshCanvas'),add=$('meshAddPoint');
 const background=theme.backgroundStyle,points=background.points.map(p=>({...p}));
 $('meshSoftness').value=background.softness;
 add.disabled=points.length>=6;panel.replaceChildren();canvas.replaceChildren();
 function fromPoints(updated){return {...theme,backgroundStyle:{...background,points:updated.map(p=>({...p}))}};}
 function preview(updated){
  const t=fromPoints(updated);canvas.style.backgroundImage=backgroundCSS(t);canvas.style.backgroundSize=backgroundSize(t);
  onPreview(t);
 }
 canvas.style.backgroundColor=theme.background;
 canvas.style.backgroundImage=backgroundCSS(theme);canvas.style.backgroundSize=backgroundSize(theme);
 add.onclick=()=>{
  if(points.length>=6)return;
  const p={...meshSeed[points.length%meshSeed.length],x:45+((points.length*13)%35),y:24+((points.length*17)%55)};
  onApply({backgroundStyle:{...background,points:[...points,p]}});
 };
 $('meshSoftness').onchange=e=>onApply({backgroundStyle:{...background,softness:Number(e.target.value)}});
 function commitPoints(next){onApply({backgroundStyle:{...background,points:next}});}
 for(let i=0;i<points.length;i++){
  const point=points[i],handle=make('button',{class:'mesh-handle',type:'button','aria-label':'Mover ponto '+(i+1),'title':'Arraste para reposicionar. Setas do teclado também funcionam.'});
  handle.style.left=point.x+'%';handle.style.top=point.y+'%';handle.style.backgroundColor=point.color;
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{
   if(!handle.hasPointerCapture(event.pointerId))return;
   const rect=canvas.getBoundingClientRect();
   const x=Math.round(clamp((event.clientX-rect.left)/rect.width*100,0,100)),y=Math.round(clamp((event.clientY-rect.top)/rect.height*100,0,100));
   points[i]={...points[i],x,y};handle.style.left=x+'%';handle.style.top=y+'%';preview(points);
  });
  handle.addEventListener('pointerup',event=>{
   if(!handle.hasPointerCapture(event.pointerId))return;
   handle.releasePointerCapture(event.pointerId);commitPoints(points);
  });
  handle.addEventListener('keydown',event=>{
   const delta=event.shiftKey?10:2;
   const amount={ArrowLeft:['x',-delta],ArrowRight:['x',delta],ArrowUp:['y',-delta],ArrowDown:['y',delta]}[event.key];
   if(!amount)return;event.preventDefault();
   const [axis,step]=amount;points[i]={...points[i],[axis]:clamp(points[i][axis]+step,0,100)};commitPoints(points);
  });
  canvas.append(handle);
  const row=make('div',{class:'mesh-point'});
  const heading=make('div',{class:'mesh-point-heading'});heading.append(make('strong',{text:'Ponto '+(i+1)}));row.append(heading);
  const color=make('input',{type:'color',value:point.color,'aria-label':'Cor do ponto '+(i+1)});
  color.id='meshPointColor'+i;color.dataset.opacity=point.opacity??1;
  color.addEventListener('coloropacitychange',e=>{points[i]={...points[i],opacity:e.detail};commitPoints(points);});
  color.value=point.color;color.onchange=e=>{points[i]={...points[i],color:e.target.value};commitPoints(points);};
  const colorRow=make('label',{class:'property-row',text:'Cor'});colorRow.append(color);row.append(colorRow);
  const remove=make('button',{type:'button','aria-label':'Remover ponto '+(i+1),title:'Remover ponto'});
  remove.innerHTML='<ds-icon name="trash-2" size="14"></ds-icon>';remove.disabled=points.length<=2;remove.onclick=async()=>{if(await confirmAlert('Remover o ponto '+(i+1)+' do fundo? Sua cor e posição serão removidas da composição.'))commitPoints(points.filter((_,index)=>index!==i));};heading.append(remove);
  const sliders=make('div',{class:'mesh-sliders'});
  for(const [key,label,min,max,step] of [['x','X',0,100,1],['y','Y',0,100,1],['radius','Raio',15,120,1],['strength','Intensidade',0.05,1,0.05]]){
   const labelNode=make('label',{class:'property-row',text:label});
   const input=make('input',{type:'range',min,max,step,'aria-label':label+' do ponto '+(i+1)});
   input.id='meshPoint'+i+key;input.value=point[key];if(key==='x'||key==='y')input.dataset.unit='%';
   input.onchange=e=>{points[i]={...points[i],[key]:Number(e.target.value)};commitPoints(points);};
   labelNode.append(input);sliders.append(labelNode);
  }
  row.append(sliders);panel.append(row);
 }
}
