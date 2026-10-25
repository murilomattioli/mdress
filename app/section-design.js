import {resolveSectionPolicies} from './section-pagination.js';

/** mdress / section composition layer, independent from Markdown source and document theme. */
export const SECTION_DESIGN_VERSION=1;
export const sectionPresets=Object.freeze([
 {id:'plain',name:'Essencial',label:'Texto editorial',description:'Sem decoração, hierarquia natural'},
 {id:'surface',name:'Cartão suave',label:'Card',description:'Superfície tonal, bordas leves e respiro'},
 {id:'glass',name:'Glass',label:'Glassmorphism',description:'Vidro translúcido com reflexo, contorno e profundidade'},
 {id:'accent',name:'Barra lateral',label:'Rail',description:'Faixa de destaque e preenchimento sutil'},
 {id:'outline',name:'Quadro',label:'Outline',description:'Moldura fina sem preencher o conteúdo'},
 {id:'band',name:'Faixa de título',label:'Banner',description:'Cabeçalho com cor de destaque'},
 {id:'editorial',name:'Editorial',label:'Magazine',description:'Título expressivo e marcador tipográfico'},
 {id:'spotlight',name:'Destaque',label:'Spotlight',description:'Fundo tonal com destaque superior'},
 {id:'minimal-grid',name:'Ficha',label:'Ficha técnica',description:'Linhas e blocos com composição compacta'}
]);
export const sectionDensities=Object.freeze(['compact','normal','airy']);
const presetIds=new Set(sectionPresets.map(x=>x.id));
const keyPattern=/^[1-6]:.{1,500}:[1-9]\d*$/;
export function parseSectionDesign(raw=null){
 if(raw===null||raw===undefined)return {version:SECTION_DESIGN_VERSION,defaultPreset:'plain',density:'normal',levelPresets:{},overrides:{}};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)throw Error('Design de seções inválido');
 if(!presetIds.has(raw.defaultPreset||'plain')||!sectionDensities.includes(raw.density||'normal'))throw Error('Estilo de seção desconhecido');
 const levelPresets={};
 for(const [level,preset] of Object.entries(raw.levelPresets??{})){
  if(!/^[1-6]$/.test(level)||!presetIds.has(preset))throw Error('Estilo por nível inválido');
  levelPresets[level]=preset;
 }
 const overrides=raw.overrides??{};
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>200)throw Error('Muitas personalizações de seção');
 const clean={};
 for(const [id,preset] of Object.entries(overrides)){
  if(!keyPattern.test(id)||!presetIds.has(preset))throw Error('Personalização de seção inválida');
  clean[id]=preset;
 }
 return {version:1,defaultPreset:raw.defaultPreset||'plain',density:raw.density||'normal',levelPresets,overrides:clean};
}
export function resolveSectionPreset(design,id='all'){
 const d=parseSectionDesign(design);
 if(id==='all')return d.defaultPreset;
 if(/^level:[1-6]$/.test(id))return d.levelPresets[id.slice(-1)]??d.defaultPreset;
 return d.overrides[id]??d.levelPresets[id.split(':')[0]]??d.defaultPreset;
}
export function setSectionPreset(design,id,preset){
 const d=parseSectionDesign(design);
 if(!presetIds.has(preset))throw Error('Estilo de seção desconhecido');
 if(id==='all')return {...d,defaultPreset:preset,levelPresets:{},overrides:{}};
 if(/^level:[1-6]$/.test(id)){
  const level=id.slice(-1),levelPresets={...d.levelPresets};
  if(preset===d.defaultPreset)delete levelPresets[level];else levelPresets[level]=preset;
  return {...d,levelPresets};
 }
 if(!keyPattern.test(id))throw Error('Seção inválida');
 const overrides={...d.overrides};
 if(preset===(d.levelPresets[id.split(':')[0]]??d.defaultPreset))delete overrides[id];else overrides[id]=preset;
 return {...d,overrides};
}
export function setSectionDensity(design,density){
 const d=parseSectionDesign(design);
 if(!sectionDensities.includes(density))throw Error('Densidade de seção inválida');
 return {...d,density};
}
/** Annotates semantic blocks, but never changes authored Markdown or inner text. */
export function decorateSections(root,markdown,design){
 const parsed=parseSectionDesign(design),sections=resolveSectionPolicies(markdown,null).anchors;
 const known=new Set(sections.map(x=>x.id));
 const annotated=[];
 for(const heading of root.querySelectorAll('h1[data-section-id],h2[data-section-id],h3[data-section-id],h4[data-section-id],h5[data-section-id],h6[data-section-id]')){
  const wrapper=heading.closest('.semantic-section')&&heading.tagName==='H2'?heading.closest('.semantic-section'):heading.closest('.section-lead');
  if(!wrapper)continue;
  const id=heading.dataset.sectionId;
  if(!known.has(id))continue;
  const preset=resolveSectionPreset(parsed,id);
  wrapper.dataset.sectionVariant=preset;
  wrapper.dataset.sectionDensity=parsed.density;
  wrapper.dataset.sectionStyleId=id;
  const lead=heading.closest('.section-lead');
  if(lead){
   const actions=heading.ownerDocument.createElement('span');actions.className='section-design-tools';
   const button=heading.ownerDocument.createElement('button');button.type='button';button.className='section-design-action';
   button.dataset.editSection=id;
   button.setAttribute('aria-label','Personalizar visual da seção '+heading.textContent.trim());
   button.setAttribute('title','Estilizar esta seção');const icon=heading.ownerDocument.createElement('ds-icon');icon.setAttribute('name','paintbrush');icon.setAttribute('size','14');button.append(icon);
   actions.append(button);lead.append(actions);
  }
  annotated.push({id,preset});
 }
 return {sections:annotated,orphaned:Object.keys(parsed.overrides).filter(id=>!known.has(id))};
}
