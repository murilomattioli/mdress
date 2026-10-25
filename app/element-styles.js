/** Element-level design independent of section composition and authored Markdown. */
export const markdownElements=Object.freeze([
 {id:'h1',label:'Título H1',inline:false},{id:'h2',label:'Título H2',inline:false},{id:'h3',label:'Título H3',inline:false},{id:'h4',label:'Título H4',inline:false},{id:'h5',label:'Título H5',inline:false},{id:'h6',label:'Título H6',inline:false},
 {id:'p',label:'Parágrafo',inline:false},{id:'ul',label:'Lista com marcadores',inline:false},{id:'ol',label:'Lista numerada',inline:false},{id:'li',label:'Item de lista',inline:false},
 {id:'blockquote',label:'Citação',inline:false},{id:'pre',label:'Bloco de código',inline:false},
 {id:'hr',label:'Separador',inline:false},{id:'img',label:'Imagem',inline:false},
 {id:'table',label:'Tabela',inline:false},{id:'thead',label:'Cabeçalho da tabela',inline:false},{id:'tbody',label:'Corpo da tabela',inline:false},{id:'tr',label:'Linha da tabela',inline:false},{id:'th',label:'Célula de cabeçalho',inline:false},{id:'td',label:'Célula da tabela',inline:false},
 {id:'a',label:'Link',inline:true},{id:'strong',label:'Negrito',inline:true},{id:'em',label:'Itálico',inline:true},{id:'del',label:'Riscado',inline:true},{id:'code',label:'Código inline',inline:true}
]);
export const elementPresets=Object.freeze({
 block:Object.freeze([{id:'plain',label:'Original'},{id:'accent',label:'Destaque'},{id:'surface',label:'Superfície'},{id:'outline',label:'Contorno'},{id:'glass',label:'Glass'},{id:'editorial',label:'Editorial'}]),
 inline:Object.freeze([{id:'plain',label:'Original'},{id:'accent',label:'Destaque'},{id:'marker',label:'Marcador'},{id:'pill',label:'Pílula'},{id:'underline',label:'Sublinhado'},{id:'glass',label:'Glass'}])
});
const index=new Map(markdownElements.map(item=>[item.id,item]));
export function parseElementStyles(raw=null){
 if(raw==null)return {version:1,rules:{},instances:{},properties:{}};
 if(typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||!raw.rules||typeof raw.rules!=='object'||Array.isArray(raw.rules))throw Error('Estilos de elementos inválidos');
 const keys=Object.keys(raw.rules);if(keys.length>markdownElements.length)throw Error('Muitos estilos de elementos');
 const inputInstances=raw.instances??{};
 if(!inputInstances||typeof inputInstances!=='object'||Array.isArray(inputInstances)||Object.keys(inputInstances).length>500)throw Error('Muitas personalizações individuais');
 const rawProperties=raw.properties??{};
 if(!rawProperties||typeof rawProperties!=='object'||Array.isArray(rawProperties)||Object.keys(rawProperties).length>500)throw Error('Propriedades individuais inválidas');
 const properties={};
 for(const [id,props] of Object.entries(rawProperties)){
  if(!/^([a-z0-9]+):([0-9]{1,5})$/.test(id)||!index.has(id.split(':')[0])||!props||typeof props!=='object'||Array.isArray(props))throw Error('Propriedade individual inválida');
  const safe={};
  for(const [key,value] of Object.entries(props)){
   if(key==='fontSize'&&Number.isFinite(value)&&value>=8&&value<=96)safe[key]=value;
   else if(key==='fontWeight'&&[400,500,600,700,800,900].includes(value))safe[key]=value;
   else if(key==='lineHeight'&&Number.isFinite(value)&&value>=1&&value<=2.5)safe[key]=value;
   else if(key==='spacing'&&Number.isFinite(value)&&value>=0&&value<=48)safe[key]=value;
   else if(key==='align'&&['left','center','right','justify'].includes(value))safe[key]=value;
   else throw Error('Propriedade individual inválida');
  }
  if(Object.keys(safe).length)properties[id]=safe;
 }
 const rules={};
 for(const id of keys){
  const element=index.get(id),preset=raw.rules[id];
  if(!element||!elementPresets[element.inline?'inline':'block'].some(x=>x.id===preset))throw Error('Estilo de elemento inválido');
  if(preset!=='plain')rules[id]=preset;
 }
 const instances={};
 for(const [id,preset] of Object.entries(inputInstances)){
  const match=id.match(/^([a-z0-9]+):([0-9]{1,5})$/),element=index.get(match?.[1]);
  if(!element||!match||Number(match[2])>10000||!elementPresets[element.inline?'inline':'block'].some(x=>x.id===preset))throw Error('Personalização individual inválida');
  instances[id]=preset;
 }
 return {version:1,rules,instances,properties};
}
export function setElementStyle(value,kind,preset){
 const parsed=parseElementStyles(value),element=index.get(kind);
 if(!element)throw Error('Elemento Markdown desconhecido');
 if(!elementPresets[element.inline?'inline':'block'].some(x=>x.id===preset))throw Error('Preset de elemento desconhecido');
 const rules={...parsed.rules};
 if(preset==='plain')delete rules[kind];else rules[kind]=preset;
 return {...parsed,rules};
}
export function setElementInstanceStyle(value,id,preset){
 const parsed=parseElementStyles(value),kind=id?.split(':')[0],element=index.get(kind);
 if(!element||!/^([a-z0-9]+):([0-9]{1,5})$/.test(id)||!elementPresets[element.inline?'inline':'block'].some(x=>x.id===preset))throw Error('Estilo individual inválido');
 const instances={...parsed.instances};
 if(preset===parsed.rules[kind]||(!parsed.rules[kind]&&preset==='plain'))delete instances[id];else instances[id]=preset;
 return {...parsed,instances};
}
export function clearElementInstance(value,id){
 const parsed=parseElementStyles(value),instances={...parsed.instances},properties={...parsed.properties};
 delete instances[id];delete properties[id];
 return {...parsed,instances,properties};
}
export function setElementProperty(value,id,key,property){
 const parsed=parseElementStyles(value);
 if(!/^([a-z0-9]+):([0-9]{1,5})$/.test(id)||!index.has(id.split(':')[0]))throw Error('Elemento desconhecido');
 const properties={...parsed.properties},current={...(properties[id]||{})};
 if(property===null)delete current[key];else current[key]=property;
 if(Object.keys(current).length)properties[id]=current;else delete properties[id];
 return parseElementStyles({...parsed,properties});
}
export function decorateMarkdownElements(root,value){
 const styles=parseElementStyles(value);let touched=0;
 for(const element of markdownElements){
  let ordinal=0;
  for(const node of root.querySelectorAll(element.id)){
   if(element.id==='code'&&node.closest('pre'))continue;
   const id=element.id+':'+(++ordinal),preset=styles.instances[id]??styles.rules[element.id]??'plain';
   node.dataset.mdElementId=id;
   node.dataset.mdElementKind=element.id;
   const props=styles.properties[id]||{};
   for(const key of ['fontSize','fontWeight','lineHeight','spacing','align']){
    const css={fontSize:'font-size',fontWeight:'font-weight',lineHeight:'line-height',spacing:'margin-bottom',align:'text-align'}[key];
    if(props[key]!==undefined)node.style.setProperty(css,String(props[key])+(key==='fontSize'||key==='spacing'?'px':''));
    else node.style.removeProperty(css);
   }
   if(preset!=='plain'){node.dataset.mdElementStyle=preset;touched++;}
   else delete node.dataset.mdElementStyle;
  }
 }
 return touched;
}
