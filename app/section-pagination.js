/**
 * F-006P: Stable-ish section anchors and explicit page-before policies.
 * Stored outside authored Markdown. This first iteration supports Markdown
 * ATX headings; duplicate headings are disambiguated by occurrence ordinal.
 * Renaming/moving duplicates may invalidate an anchor, never silently mutate source.
 */
export const SECTION_POLICY_VERSION=1;
export function sectionId(level,title,occurrence=1){
 if(!Number.isInteger(level)||level<1||level>6||!Number.isInteger(occurrence)||occurrence<1)throw Error('Identificador de seção inválido');
 const normalized=String(title).replace(/[*_~\x60]/g,'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
 if(!normalized||normalized.length>500)throw Error('Título da seção inválido');
 return String(level)+':'+normalized+':'+occurrence;
}
export function sectionAnchors(markdown){
 if(typeof markdown!=='string')throw Error('Markdown inválido');
 const offsets=new Map(),result=[],lines=markdown.split(/\r?\n/);
 let fenced=false;
 for(let index=0;index<lines.length;index++){
  const raw=lines[index],trim=raw.trimStart();
  if(/^(\x60{3,}|~{3,})/.test(trim)){fenced=!fenced;continue;}
  if(fenced)continue;
  const match=trim.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if(!match)continue;
  const level=match[1].length,text=match[2].trim(),base=sectionId(level,text);
  const n=(offsets.get(base)||0)+1;offsets.set(base,n);
  result.push({id:sectionId(level,text,n),level,title:text,line:index+1,ordinal:n});
 }
 return result;
}
export function parseSectionPolicies(value){
 if(value==null)return {version:SECTION_POLICY_VERSION,breakBefore:[]};
 if(typeof value!=='object'||Array.isArray(value)||value.version!==1||!Array.isArray(value.breakBefore)||value.breakBefore.length>250)throw Error('Políticas de paginação inválidas');
 const result=[];
 for(const id of value.breakBefore){
  if(typeof id!=='string'||!/^([1-6]):.{1,500}:[1-9]\d*$/.test(id))throw Error('Âncora de seção inválida');
  if(!result.includes(id))result.push(id);
 }
 return {version:1,breakBefore:result};
}
export function toggleSectionBreak(policies,id,enabled){
 const p=parseSectionPolicies(policies);
 if(typeof enabled!=='boolean'||!/^([1-6]):.{1,500}:[1-9]\d*$/.test(id))throw Error('Política inválida');
 return {version:1,breakBefore:enabled?[...new Set([...p.breakBefore,id])]:p.breakBefore.filter(x=>x!==id)};
}
export function resolveSectionPolicies(markdown,policies){
 const anchors=sectionAnchors(markdown),p=parseSectionPolicies(policies);
 const known=new Set(anchors.map(x=>x.id));
 return {anchors,breakBefore:p.breakBefore.filter(x=>known.has(x)),orphaned:p.breakBefore.filter(x=>!known.has(x))};
}
/**
 * Called after markdown render/semantic grouping, before DOM pagination.
 * Adds non-printing actions without affecting the measured text flow.
 */
export function decoratePageBreaks(root,markdown,policies){
 if(!root||typeof root.querySelectorAll!=='function')throw Error('Preview indisponível');
 const resolution=resolveSectionPolicies(markdown,policies),nodes=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 const wanted=new Set(resolution.breakBefore);
 for(const [index,heading] of nodes.entries()){
  const anchor=resolution.anchors[index];
  if(!anchor)continue;
  heading.dataset.sectionId=anchor.id;
  const wrapper=heading.closest('.section-lead')||heading;
  const section=heading.closest('.semantic-section');
  // For H2 starts use section container; for H3 children use their own lead.
  const target=heading.tagName==='H2'&&section?.querySelector('h2')===heading?section:wrapper;
  target.dataset.breakAnchor=anchor.id;
  if(wanted.has(anchor.id))target.dataset.pageBefore='true';else delete target.dataset.pageBefore;
  const controller=heading.ownerDocument.createElement('button');
  controller.type='button';controller.className='section-break-control';
  controller.dataset.sectionBreakId=anchor.id;
  controller.setAttribute('aria-label',(wanted.has(anchor.id)?'Remover quebra antes de ':'Iniciar nova página antes de ')+anchor.title);
  controller.setAttribute('aria-pressed',String(wanted.has(anchor.id)));
  controller.title=wanted.has(anchor.id)?'Remover quebra antes desta seção':'Iniciar seção em uma nova página';
  controller.innerHTML='<ds-icon name="page-break" size="14"></ds-icon>';
  const controls=heading.ownerDocument.createElement('span');controls.className='section-break-actions';
  controls.append(controller);wrapper.append(controls);
 }
 return resolution;
}
