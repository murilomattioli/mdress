import {estimateWeight,pageSectionCounts,pageElementStyleCounts,BACKGROUND_KIND_COST,PAGE_BASE_KIB} from './pdf-weight.js';
import {sectionPresets} from './section-design.js';
import {elementPresets} from './element-styles.js';
const format=n=>n<1024?Math.round(n)+' KiB':(n/1024).toFixed(1)+' MiB';
/** Read only the completed page plan; no persistence or pagination side effects. */
export function renderWeightEstimate(stack,theme){
 const sections=pageSectionCounts(stack),elements=pageElementStyleCounts(stack);
 const sum=items=>items.reduce((out,{counts})=>{for(const [id,n] of Object.entries(counts))out[id]=(out[id]||0)+n;return out;},{});
 const result=estimateWeight({pages:sections.length||1,backgroundKind:theme.backgroundStyle.kind,sectionPresetCounts:sum(sections),elementPresetCounts:sum(elements)});
 const badge=document.getElementById('weightBadge');
 badge.textContent='~'+format(result.totalKiB);badge.dataset.band=result.band;
 badge.setAttribute('aria-label','PDF estimado: '+format(result.totalKiB)+'. Abrir detalhes');
 document.getElementById('weightTotal').textContent='~'+format(result.totalKiB)+' estimados';
 const row=(label,value)=>{const el=document.createElement('div');el.className='pdf-weight-row';const name=document.createElement('span'),cost=document.createElement('span');name.textContent=label;cost.textContent='~'+format(value);el.append(name,cost);return el;};
 const name=id=>{if(!id.includes(':'))return sectionPresets.find(p=>p.id===id)?.name||id;const [kind,preset]=id.split(':');return (elementPresets[kind]?.find(p=>p.id===preset)?.label||preset)+' · elementos';};
 const contributors=[row('Páginas e conteúdo',(sections.length||1)*PAGE_BASE_KIB)];
 const background=BACKGROUND_KIND_COST[theme.backgroundStyle.kind]||0;
 if(background)contributors.push(row('Fundo',background));
 contributors.push(...result.perItem.filter(x=>x.kib>0).slice(0,5).map(x=>row(name(x.id),x.kib)));
 document.getElementById('weightContributors').replaceChildren(...contributors);
 document.getElementById('weightPerPage').replaceChildren(...sections.map((p,i)=>row('Página '+p.page,estimateWeight({pages:1,backgroundKind:'solid',sectionPresetCounts:p.counts,elementPresetCounts:elements[i]?.counts||{}}).totalKiB+background/sections.length)));
 return result;
}
