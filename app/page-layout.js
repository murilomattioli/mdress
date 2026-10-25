import {sectionAnchors} from './section-pagination.js';

/** Layout metadata lives in the document, never in the authored Markdown. */
const ID=/^[1-6]:.{1,500}:[1-9]\d*$/;
export function parsePageLayout(value){
 if(value==null)return {version:1,alignBottom:[]};
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!Array.isArray(value.alignBottom)||value.alignBottom.length>100)throw Error('Composição de página inválida');
 if(value.alignBottom.some(id=>typeof id!=='string'||!ID.test(id)))throw Error('Âncora de composição inválida');
 return {version:1,alignBottom:[...new Set(value.alignBottom)]};
}
export function setBottomAlignment(value,id,enabled){
 if(!ID.test(id))throw Error('Seção inválida');
 const current=parsePageLayout(value);
 return {version:1,alignBottom:enabled?[...new Set([...current.alignBottom,id])]:current.alignBottom.filter(x=>x!==id)};
}
/** Wrap top-level H1 sections so headings and their paragraphs move as one unit.
 * H2 sections are already wrapped by the existing semantic composition layer.
 */
export function decoratePageLayout(root,markdown,value){
 const wanted=new Set(parsePageLayout(value).alignBottom);
 const anchors=sectionAnchors(markdown);
 const headings=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 for(const [index,heading] of headings.entries()){
  const anchor=anchors[index];if(!anchor||!wanted.has(anchor.id))continue;
  let target=heading.closest('.semantic-section');
  if(!target||heading.tagName==='H1'){
   const lead=heading.closest('.section-lead');
   const start=lead?.parentElement===root?lead:heading.parentElement===root?heading:null;
   if(!start)continue;
   target=root.ownerDocument.createElement('section');target.className='editorial-layout-group';
   root.insertBefore(target,start);
   let cursor=start;
   while(cursor){
    const next=cursor.nextElementSibling;
    if(cursor!==start&&(cursor.matches('h1,h2,h3,h4,h5,h6')||cursor.classList?.contains('semantic-section')||cursor.querySelector?.(':scope > h1,:scope > h2')))break;
    target.append(cursor);
    cursor=next;
   }
  }
  target.dataset.layoutAnchor=anchor.id;
 }
}
/** Called only after measured pagination. auto margin uses the actual page free height.
 * Does not affect normal pages and never inserts fake text or blank page blocks.
 */
export function applyPageLayout(root,value){
 const wanted=new Set(parsePageLayout(value).alignBottom),applied=[];
 for(const content of root.querySelectorAll('.page-content')){
  content.classList.remove('editorial-bottom-layout');
  for(const group of content.querySelectorAll('[data-layout-anchor]')){
   if(!wanted.has(group.dataset.layoutAnchor)||group.parentElement!==content)continue;
   content.classList.add('editorial-bottom-layout');
   group.classList.add('editorial-bottom-target');
   applied.push(group.dataset.layoutAnchor);
  }
 }
 return applied;
}
