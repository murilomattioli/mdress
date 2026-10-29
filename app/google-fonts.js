// Catalog metadata is local; font binaries are requested only for a chosen family.
export const googleFamily=id=>typeof id==='string'&&/^google:[A-Za-z0-9][A-Za-z0-9 .-]{0,99}$/.test(id)?id.slice(7):null;
export const googleStack=id=>{const family=googleFamily(id);return family?'"'+family+'", Arial, sans-serif':null;};
let catalogPromise;
export function loadFontCatalog(){
 return catalogPromise??=fetch(new URL('./google-fonts-catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Catálogo de fontes indisponível');return r.json();}).then(d=>d.families).catch(e=>{catalogPromise=null;throw e;});
}
export function fontCSSURL(entry){
 const variants=entry.variants;
 const regular=variants.includes('400')?'400':variants.find(v=>!v.endsWith('i'))||variants[0];
 const chosen=[regular,variants.includes('700')?'700':null,variants.includes('400i')?'400i':null,variants.includes('700i')?'700i':null].filter(Boolean);
 const tuples=[...new Set(chosen)].map(v=>[v.endsWith('i')?1:0,parseInt(v)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 return 'https://fonts.googleapis.com/css2?family='+encodeURIComponent(entry.family)+':ital,wght@'+tuples.map(v=>v.join(',')).join(';')+'&display=swap';
}
const pending=new Map();
export function ensureGoogleFont(id){
 const family=googleFamily(id);if(!family)return Promise.resolve();
 if(pending.has(id))return pending.get(id);
 const task=loadFontCatalog().then(async catalog=>{
  const entry=catalog.find(x=>x.family===family);if(!entry)throw Error('Fonte não encontrada no catálogo');
  const link=document.createElement('link');link.rel='stylesheet';link.href=fontCSSURL(entry);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{link.remove();reject(Error('Tempo esgotado ao carregar a fonte'));},12000);link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(Error('Fonte indisponível. Verifique sua conexão.'));};document.head.append(link);});
  const normal=entry.variants.find(v=>v==='400')||entry.variants.find(v=>!v.endsWith('i'))||entry.variants[0];
  let timer;
  try{await Promise.race([(async()=>{
   const loaded=await document.fonts.load((normal.endsWith('i')?'italic ':'')+parseInt(normal)+' 16px "'+family+'"');
   if(!loaded.length)throw Error('Não foi possível carregar a fonte selecionada');
   await document.fonts.ready;
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo esgotado ao carregar a fonte')),12000);})]);}
  catch(error){link.remove();throw error;}finally{clearTimeout(timer);}
 });
 pending.set(id,task);task.catch(()=>pending.delete(id));return task;
}
export function ensureFontOption(select,id){
 const family=googleFamily(id);if(family&&![...select.options].some(o=>o.value===id))select.add(new Option(family,id));
}
export function initializeFontCatalog(select,onError){
 let loaded=false;
 select.addEventListener('mdress:select-open',async()=>{
  if(loaded)return;
  try{const entries=await loadFontCatalog();const selected=select.value;
   const group=document.createElement('optgroup');group.label='Google Fonts';
   const existing=new Set([...select.options].map(o=>o.value));
   for(const entry of entries){const id='google:'+entry.family;if(!existing.has(id))group.append(new Option(entry.family,id));}
   select.append(group);select.value=selected;loaded=true;
  }catch(e){onError(e.message);}
 });
}
