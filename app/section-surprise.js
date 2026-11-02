import {sectionPresets,parseSectionDesign} from './section-design.js';
import {sectionAnchors} from './section-pagination.js';
import {normalizeThemeLocks} from './theme-explorer.js';
import {costClass,SECTION_PRESET_COST} from './pdf-weight.js';

/** Document-aware section composition; visual metadata only, never edits Markdown. */
export function surpriseSections(markdown,current,locks={},random=Math.random){
 const design=parseSectionDesign(current);
 if(normalizeThemeLocks(locks).sections)return design;
 const anchors=sectionAnchors(markdown);
 const n=typeof random==='function'?random():random;
 if(!Number.isFinite(n)||n<0||n>1)throw Error('Semente inválida');
 const presets=sectionPresets.map(p=>p.id);
 const lightPresets=presets.filter(id=>costClass(SECTION_PRESET_COST[id]??0)!=='pesado');
 // A level-count cap alone ignores how many headings share that level: a single heavy preset
 // on a level with many occurrences can still blow the document weight budget on its own.
 const HEAVY_LEVEL_BUDGET_KIB=400;
 const occurrencesByLevel=anchors.reduce((acc,a)=>(acc[a.level]=(acc[a.level]||0)+1,acc),{});
 const densities=['compact','normal','airy'];
 const seed=Math.min(0xffffffff,Math.floor(n*0x100000000));
 let state=seed||0x9e3779b9;
 const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const choose=(values,old)=>{const available=values.filter(v=>v!==old);return available[Math.floor(next()*available.length)]??old;};
 const defaultPreset=choose(lightPresets,design.defaultPreset);
 const density=choose(densities,design.density);
 // One preset per heading level present in the document — same level, same look — instead of
 // an independent per-heading coin flip. At most one level may land on a heavy-cost preset.
 const levels=[...new Set(anchors.map(a=>a.level))].sort((a,b)=>a-b);
 const levelPresets={};
 let heavyPicked=false;
 for(const level of levels){
  let candidate=choose(presets,defaultPreset);
  if(costClass(SECTION_PRESET_COST[candidate]??0)==='pesado'){
   const overBudget=(SECTION_PRESET_COST[candidate]??0)*(occurrencesByLevel[level]||1)>HEAVY_LEVEL_BUDGET_KIB;
   if(heavyPicked||overBudget)candidate=choose(lightPresets,defaultPreset);
   else heavyPicked=true;
  }
  if(candidate!==defaultPreset)levelPresets[level]=candidate;
 }
 return parseSectionDesign({version:1,defaultPreset,density,levelPresets,overrides:{}});
}
