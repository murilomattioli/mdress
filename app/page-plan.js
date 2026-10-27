/**
 * F-006 live, DOM-measured pagination.
 * Pages rendered on screen are the SAME page nodes printed by the browser.
 * No Markdown mutation, no screenshots/rasterized text.
 * Text inside extremely long blocks can be split at whitespace while retaining inline markup.
 * This engine is browser-specific (not yet a fully cross-browser deterministic PagePlan).
 */
export const PAGE_GEOMETRY=Object.freeze({
 a4:{widthMm:210,heightMm:297},
 letter:{widthMm:215.9,heightMm:279.4}
});
const MAX_PAGES=120;
const EPSILON=1.5;
const within=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;

export function pageGeometry(input){
 const format=input?.paper||'a4',marginMm=Number(input?.marginMm??18);
 if(!Object.hasOwn(PAGE_GEOMETRY,format)||!within(marginMm,8,35))throw Error('Geometria da página inválida');
 const size=PAGE_GEOMETRY[format];
 return Object.freeze({paper:format,marginMm,widthMm:size.widthMm,heightMm:size.heightMm,usableWidthMm:size.widthMm-2*marginMm,usableHeightMm:size.heightMm-2*marginMm});
}
export function planSummary(raw){
 const p=pageGeometry(raw),heightPt=p.usableHeightMm*72/25.4;
 return Object.freeze({...p,usableHeightPt:Number(heightPt.toFixed(2))});
}

/** Conservative fit measured in unscaled layout pixels. */
function fits(content){
 const rect=content.getBoundingClientRect();
 if(rect.height<=0)return true;
 return content.scrollHeight<=content.clientHeight+EPSILON;
}
function isContainer(n){return ['DIV','SECTION','UL','OL','BLOCKQUOTE'].includes(n.tagName);}
function blockClone(n){return n.cloneNode(false);}
/** Clone node contents split at its Nth UTF-16 offset, preserving formatting tags. */
function splitAtText(node,offset){
 const doc=node.ownerDocument;
 const walker=doc.createTreeWalker(node,NodeFilter.SHOW_TEXT);
 let textNode=null,position=0,total=0,cur;
 while((cur=walker.nextNode())){total+=cur.textContent.length;if(total>=offset){textNode=cur;position=cur.textContent.length-(total-offset);break;}}
 if(!textNode)return null;
 const leftRange=doc.createRange();leftRange.selectNodeContents(node);leftRange.setEnd(textNode,position);
 const rightRange=doc.createRange();rightRange.selectNodeContents(node);rightRange.setStart(textNode,position);
 const left=blockClone(node),right=blockClone(node);left.append(leftRange.cloneContents());right.append(rightRange.cloneContents());
 return [left,right];
}
function breakOffsets(text){
 const offsets=[];
 for(let i=1;i<text.length;i++)if(/\s/.test(text[i-1]))offsets.push(i);
 // Long unbroken URLs/code tokens: make progress without splitting a UTF-16 surrogate pair.
 if(offsets.length===0){for(let i=1;i<text.length;i++)if(!(text.charCodeAt(i-1)>=0xD800&&text.charCodeAt(i-1)<=0xDBFF&&text.charCodeAt(i)>=0xDC00&&text.charCodeAt(i)<=0xDFFF))offsets.push(i);}
 return offsets;
}
/**
 * @returns {{pages:Array, geometry:Object, diagnostics:Array, status:string}}
 */
export function paginateDOM(root,raw,options={}){
 if(!root||!root.querySelector)throw Error('Preview indisponível');
 const geometry=pageGeometry(raw);
 const first=root.querySelector('#paper');
 const firstContent=first?.querySelector('#rendered');
 if(!first||!firstContent)throw Error('Estrutura de página inicial ausente');
 const contents=[...firstContent.children]; // already rendered and semantically grouped
 root.querySelectorAll('.paper:not(#paper)').forEach(el=>el.remove());
 first.classList.add('print-page');first.classList.toggle('letter',geometry.paper==='letter');
 firstContent.classList.add('page-content');
 const styleSource=first.getAttribute('style')||'';
 const sectionRule=firstContent.dataset.sectionRule||'line';
 firstContent.replaceChildren();
 const pages=[],diagnostics=[];
 let activeArticle=first,activeContent=firstContent,blocks=0;
 const createPage=()=>{
  if(pages.length>=MAX_PAGES)throw Error('Limite de páginas atingido. Simplifique o documento ou reduza o tamanho do texto.');
  const el=first.ownerDocument.createElement('article');
  el.className=first.className;el.removeAttribute('id');el.style.cssText=styleSource;
  const body=first.ownerDocument.createElement('div');body.className='page-content';body.dataset.sectionRule=sectionRule;
  el.append(body);root.append(el);
  activeArticle=el;activeContent=body;blocks=0;pages.push({index:pages.length+1,element:el,content:body});
 };
 pages.push({index:1,element:first,content:firstContent});
 const pageHasContent=()=>activeContent.children.length>0;
 const freshPage=()=>{if(pageHasContent())createPage();};
 const tryPlace=(node,parent=activeContent)=>{
  parent.append(node);
  if(fits(activeContent))return true;
  node.remove();return false;
 };
 // Very long single paragraph/code/list item: binary-search the longest text prefix fitting
 // the current page. The two cloned fragments preserve all inline text.
 const splitLeaf=(node,parentMaker=null)=>{
  let pending=node,guard=0;
  while(pending&&guard++<160){
   const rawText=pending.textContent||'';
   if(!rawText){if(!tryPlace(pending)){freshPage();if(!tryPlace(pending))diagnostics.push({type:'oversized-empty',tag:pending.tagName});}break;}
   const candidates=breakOffsets(rawText);
   if(!candidates.length){
    if(pageHasContent()){createPage();continue;}
    if(!tryPlace(pending)){diagnostics.push({type:'oversized-token',tag:pending.tagName});activeContent.append(pending);}
    break;
   }
   let low=0,high=candidates.length-1,best=null;
   while(low<=high){
    const mid=(low+high)>>1;
    const pieces=splitAtText(pending,candidates[mid]);
    if(!pieces){high=mid-1;continue;}
    const probe=pieces[0];
    if(tryPlace(probe)){probe.remove();best={index:mid,left:pieces[0],right:pieces[1]};low=mid+1;}
    else high=mid-1;
   }
   if(!best){
    if(pageHasContent()){createPage();continue;}
    // Cannot fit a single whitespace-terminated token; force a small, visible fragment.
    const cut=splitAtText(pending,candidates[0]);
    if(!cut){diagnostics.push({type:'unsplittable',tag:pending.tagName});activeContent.append(pending);break;}
    activeContent.append(cut[0]);
    diagnostics.push({type:'forced-token',tag:pending.tagName});
    pending=cut[1];createPage();continue;
   }
   activeContent.append(best.left);
   pending=best.right;
   if(!(pending.textContent||'').trim())break;
   createPage();
  }
  if(guard>=160)diagnostics.push({type:'fragment-limit',tag:node.tagName});
 };
 function placeList(list){
  const items=[...list.children],tag=list.tagName,initialNumber=list.start||1;
  let count=0,segment=null,placed=0;
  const makeSegment=()=>{
   const fragment=blockClone(list);
   if(tag==='OL')fragment.start=initialNumber+placed;
   activeContent.append(fragment);segment=fragment;
  };
  for(const item of items){
   if(!segment)makeSegment();
   segment.append(item);
   if(fits(activeContent)){placed++;continue;}
   item.remove();
   if(segment.childElementCount===0)segment.remove();
   freshPage();makeSegment();segment.append(item);
   if(fits(activeContent)){placed++;continue;}
   item.remove();segment.remove();segment=null;
   // Oversized list item is split into paragraph fragments rather than clipped.
   diagnostics.push({type:'long-list-item',index:placed+1});
   splitLeaf(item);placed++;
  }
 }
 function placeSection(section){
  // A styled Markdown section has visual continuity, NOT an unbreakable height.
  // Try whole section in remaining space, then split by blocks on real pages.
  if(section.dataset?.pageBefore==='true'&&pageHasContent())createPage();
  // A section may fit physically while containing an explicit break on a nested heading.
  // In that case it must be fragmented at that heading, not placed as one block.
  const hasNestedBreak=!!section.querySelector('[data-page-before="true"]');
  if(!hasNestedBreak&&tryPlace(section)){blocks++;return;}
  const children=[...section.children];
  const freshSegment=(continued)=>{
   const fragment=blockClone(section);
   fragment.classList.add('section-segment');
   fragment.removeAttribute('id');
   fragment.removeAttribute('data-page-before');
   fragment.dataset.sectionContinued=String(continued);
   activeContent.append(fragment);return fragment;
  };
  let segment=null,continued=false;
  for(const child of children){
   // Inner H3-H6 anchors must start on a physical page, not just the outer H2.
   if(child.dataset?.pageBefore==='true'&&pageHasContent()){
    createPage();segment=null;continued=true;
   }
   if(!segment)segment=freshSegment(continued);
   segment.append(child);
   if(fits(activeContent)){blocks++;continue;}
   child.remove();
   if(segment.childElementCount===0){segment.remove();segment=null;}
   if(pageHasContent())createPage();
   continued=true;segment=freshSegment(true);
   segment.append(child);
   if(fits(activeContent)){blocks++;continue;}
   // A paragraph/list item longer than a physical page must be fragmented;
   // never emit overflow or an empty styled page.
   child.remove();segment.remove();segment=null;
   child.dataset.sectionVariant=section.dataset.sectionVariant||'plain';
   child.dataset.sectionDensity=section.dataset.sectionDensity||'normal';
   child.classList.add('section-long-block');
   place(child);
   continued=true;
  }
 }
 function place(node){
  if(node.classList?.contains('semantic-section')){placeSection(node);return;}
  if(node.dataset?.pageBefore==='true'&&pageHasContent())createPage();
  if(node.tagName==='UL'||node.tagName==='OL'){
   if(tryPlace(node)){blocks++;return;}
   placeList(node);return;
  }
  if(tryPlace(node)){blocks++;return;}
  if(pageHasContent()){
   createPage();
   if(tryPlace(node)){blocks++;return;}
  }
  if(isContainer(node)&&node.children.length){
   const children=[...node.children];node.replaceChildren();
   for(const child of children)place(child);
   return;
  }
  splitLeaf(node);
 }
 try {
  for(const n of contents)place(n);
 } catch(error) {
  diagnostics.push({type:'layout-error',message:String(error?.message||error)});
  if(options.strict)throw error;
 }
 // Recalculate physical overflow after all fragments are positioned; never silently claim valid pages.
 for(const page of pages){
  const overflow=!fits(page.content);
  if(overflow)diagnostics.push({type:'overflow',page:page.index});
  page.element.dataset.pageNumber=String(page.index);
  page.element.dataset.overflow=String(overflow);
  const existingLabel=page.element.querySelector(':scope > .page-label');
  existingLabel?.remove();
  const label=first.ownerDocument.createElement('div');label.className='page-label';label.textContent='Página '+page.index;
  label.setAttribute('aria-hidden','true');page.element.append(label);
 }
 return {version:1,geometry:planSummary(geometry),pages:pages.map(p=>({index:p.index,textLength:p.content.textContent.length,blocks:p.content.children.length,overflow:p.element.dataset.overflow==='true'})),diagnostics,status:diagnostics.some(d=>d.type==='overflow'||d.type==='layout-error')?'needs-review':'ready'};
}
