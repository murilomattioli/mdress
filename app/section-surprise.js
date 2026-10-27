import {sectionPresets,parseSectionDesign} from './section-design.js';
import {sectionAnchors} from './section-pagination.js';
import {normalizeThemeLocks} from './theme-explorer.js';

/** Document-aware section composition; visual metadata only, never edits Markdown. */
export function surpriseSections(markdown,current,locks={},random=Math.random){
 const design=parseSectionDesign(current);
 if(normalizeThemeLocks(locks).sections)return design;
 const anchors=sectionAnchors(markdown);
 const n=typeof random==='function'?random():random;
 if(!Number.isFinite(n)||n<0||n>1)throw Error('Semente inválida');
 const presets=sectionPresets.map(p=>p.id);
 const densities=['compact','normal','airy'];
 const seed=Math.min(0xffffffff,Math.floor(n*0x100000000));
 let state=seed||0x9e3779b9;
 const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const choose=(values,old)=>{const available=values.filter(v=>v!==old);return available[Math.floor(next()*available.length)]??old;};
 const defaultPreset=choose(presets,design.defaultPreset);
 const density=choose(densities,design.density);
 // Every document gets a composition, not a flat preset repeated across every heading.
 // Avoid overriding all headings: vary the major blocks while allowing visual hierarchy.
 const overrides={};
 for(const anchor of anchors){
  if(anchor.level>3||Object.keys(overrides).length>=200||next()>.62)continue;
  const candidate=choose(presets,defaultPreset);
  if(candidate!==defaultPreset)overrides[anchor.id]=candidate;
 }
 return parseSectionDesign({version:1,defaultPreset,density,overrides});
}
