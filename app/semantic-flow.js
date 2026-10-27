/** Small semantic grouping before CSS fragmentation.
 * Groups heading chains with the first paragraph/list item. Content is moved,
 * never duplicated or removed. This is NOT a full PagePlan engine.
 */
export function groupSemanticLeads(root){
 if(!root||typeof root.querySelectorAll!=='function')throw Error('Raiz do documento inválida');
 let groups=0;
 const isHeading=node=>/^H[1-6]$/.test(node?.tagName??'');
 for(const original of [...root.children]){
  if(!isHeading(original)||original.parentElement!==root)continue;
  const chain=[original];let next=original.nextElementSibling;
  // Each heading must keep an independent page-break anchor. Never merge consecutive headings.
  // Always provide a stable, clickable wrapper, including headings without body text.
  const hasBody=!!next&&['P','UL','OL','BLOCKQUOTE'].includes(next.tagName);
  const group=root.ownerDocument.createElement('div');
  group.className='section-lead';group.dataset.pagination='keep-with-next';
  root.insertBefore(group,original);
  for(const heading of chain)group.append(heading);
  if(hasBody&&['UL','OL'].includes(next.tagName)){
   const item=next.firstElementChild;
   if(item){
    const list=root.ownerDocument.createElement(next.tagName.toLowerCase());
    if(next.tagName==='OL')list.start=next.start||1;
    list.append(item);group.append(list);
    if(!next.firstElementChild)next.remove();
    else if(next.tagName==='OL')next.start=(next.start||1)+1;
   }
  }else if(hasBody)group.append(next);
  groups++;
 }
 return groups;
}

/** A section smaller than the usable page is kept intact when it fits comfortably.
 * Large sections remain splittable to avoid pushing entire chapters to the next page.
 * Uses measured DOM height; this is a browser-print hint, not a deterministic PagePlan.
 */
export function groupShortSections(root,usablePageHeightPx){
 if(!root||typeof root.querySelectorAll!=='function'||!Number.isFinite(usablePageHeightPx)||usablePageHeightPx<=0)throw Error('Medidas de paginação inválidas');
 const starts=[...root.children].filter(node=>node.classList?.contains('section-lead')&&node.querySelector(':scope > h2'));
 let count=0;
 for(let i=0;i<starts.length;i++){
  const first=starts[i],next=starts[i+1]??null;
  if(first.parentElement!==root)continue;
  const section=root.ownerDocument.createElement('section');
  section.className='semantic-section';
  root.insertBefore(section,first);
  for(let cursor=first;cursor&&cursor!==next;){
   const following=cursor.nextElementSibling;section.append(cursor);cursor=following;
  }
  const height=section.offsetHeight;
  // Reserve free space for natural text flow: keep only short sections.
  const keep=height>0&&height<=usablePageHeightPx*0.72;
  section.dataset.keepTogether=String(keep);
  count++;
 }
 return count;
}

/** Re-measure after print media is enabled; editor-only mode can hide preview
 * during normal rendering, and transforms/zoom must not affect physical size.
 */
export function refreshShortSectionPolicies(root,usablePageHeightPx){
 if(!root||!Number.isFinite(usablePageHeightPx)||usablePageHeightPx<=0)throw Error('Medidas inválidas');
 let count=0;
 for(const section of root.querySelectorAll(':scope > .semantic-section')){
  const height=section.offsetHeight;
  section.dataset.keepTogether=String(height>0&&height<=usablePageHeightPx*0.72);
  count++;
 }
 return count;
}
