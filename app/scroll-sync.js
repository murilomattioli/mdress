import {sectionAnchors} from './section-pagination.js';

/** Piecewise scroll mapping. Heading landmarks keep independent editor/canvas sizes aligned. */
export function interpolateScroll(value,landmarks){
 if(!Number.isFinite(value)||!landmarks.length)return 0;
 const ordered=[...landmarks].sort((a,b)=>a[0]-b[0]);
 if(value<=ordered[0][0])return ordered[0][1];
 for(let i=1;i<ordered.length;i++){
  const [x,y]=ordered[i],[prevX,prevY]=ordered[i-1];
  if(value<=x){
   const delta=x-prevX;
   return delta>0?prevY+(y-prevY)*((value-prevX)/delta):y;
  }
 }
 return ordered[ordered.length-1][1];
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Both directions; pagination/zoom may change canvas geometry independently. */
export function connectScrollSync({source,preview,stack,workspace,frame=requestAnimationFrame}){
 if(!source||!preview||!stack||!workspace)throw Error('Painéis de sincronização ausentes');
 let owner='',release=0;
 const active=()=>workspace.dataset.mode==='split'&&source.clientHeight>0&&preview.clientHeight>0;
 const points=()=>{
  const sourceMax=Math.max(0,source.scrollHeight-source.clientHeight);
  const previewMax=Math.max(0,preview.scrollHeight-preview.clientHeight);
  const anchors=sectionAnchors(source.value),totalLines=Math.max(1,source.value.split('\n').length);
  const headings=new Map([...stack.querySelectorAll('[data-section-id]')].filter(node=>/^H[1-6]$/.test(node.tagName)).map(node=>[node.dataset.sectionId,node]));
  const markers=[[0,0]];
  for(const anchor of anchors){
   const element=headings.get(anchor.id);if(!element)continue;
   const top=element.getBoundingClientRect().top-preview.getBoundingClientRect().top+preview.scrollTop;
   markers.push([
    clamp(((anchor.line-1)/totalLines)*source.scrollHeight,0,sourceMax),
    clamp(top,0,previewMax)
   ]);
  }
  markers.push([sourceMax,previewMax]);
  return {sourceMax,previewMax,markers};
 };
 const onSource=()=>{
  if(!active()||owner==='preview')return;
  owner='source';const {previewMax,markers}=points();
  preview.scrollTop=clamp(interpolateScroll(source.scrollTop,markers),0,previewMax);
  const token=++release;frame(()=>{if(release===token)owner='';});
 };
 const onPreview=()=>{
  if(!active()||owner==='source')return;
  owner='preview';const {sourceMax,markers}=points();
  const inverse=markers.map(([a,b])=>[b,a]);
  source.scrollTop=clamp(interpolateScroll(preview.scrollTop,inverse),0,sourceMax);
  const token=++release;frame(()=>{if(release===token)owner='';});
 };
 source.addEventListener('scroll',onSource,{passive:true});
 preview.addEventListener('scroll',onPreview,{passive:true});
 return ()=>{source.removeEventListener('scroll',onSource);preview.removeEventListener('scroll',onPreview);};
}
