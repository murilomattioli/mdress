/** Offline PDF weight cost model. No DOM, no IO, no network — see specs/F-013/spec.md §4.2. */
/** Calibrated against real Chromium page.pdf() output (scripts/pdf-weight-calibrate.mjs,
 * 9-job reference document, run 2026-10-26, corrected for the real decorated-section count
 * — 14, not 9: every heading in the reference document is decorated, not just job entries).
 * KiB per occurrence. */
export const SECTION_PRESET_COST=Object.freeze({
 plain:0,editorial:1,'minimal-grid':1,outline:2,accent:2,band:2,surface:3,spotlight:22,glass:171
});
/** KiB flat per document (background is one shared layer, not per-occurrence). */
export const BACKGROUND_KIND_COST=Object.freeze({
 solid:0,gradient:1,radial:2,lines:6,crosshatch:12,mesh:17,checker:38,dots:45,grid:46
});
export const PAGE_BASE_KIB=20;
/** Mostly reasoned placeholders pending a full calibration pass with scripts/pdf-weight-calibrate.mjs
 * extended to app/element-styles.js — except block:glass, spot-measured directly (5 individual
 * <li> elements given the Glass preset: +329 KiB real for the PDF, ~66 KiB/occurrence). That one
 * measurement already overturns the obvious assumption: backdrop-filter cost is NOT proportional
 * to the element's own size — a single list item costs nearly as much as a whole glass section
 * (171 KiB), suggesting a large fixed cost per blurred element rather than a per-pixel one. Treat
 * every *:glass entry as expensive regardless of how small the element looks. Keys are
 * "block:<id>"/"inline:<id>" (element-styles.js has separate block/inline preset lists that both
 * happen to include 'glass', 'accent' etc. — namespacing avoids colliding with SECTION_PRESET_COST's
 * same-named presets, which are a different thing applied at a different granularity). */
export const ELEMENT_PRESET_COST=Object.freeze({
 'block:plain':0,'block:accent':0.5,'block:outline':0.5,'block:editorial':0.5,'block:surface':1,'block:glass':66,
 'inline:plain':0,'inline:underline':0,'inline:marker':0,'inline:pill':0.2,'inline:accent':0.2,'inline:glass':40
});
export function costClass(kib){return kib<5?'leve':kib<15?'medio':'pesado';}
export function weightBand(totalKiB){return totalKiB<500?'leve':totalKiB<2560?'atencao':'pesado';}
export function estimateWeight({pages=1,backgroundKind='solid',sectionPresetCounts={},elementPresetCounts={},font='system'}={}){
 const backgroundKiB=BACKGROUND_KIND_COST[backgroundKind]??BACKGROUND_KIND_COST.gradient;
 const sectionItems=Object.entries(sectionPresetCounts)
  .filter(([id,count])=>id in SECTION_PRESET_COST&&count>0)
  .map(([id,count])=>({id,kib:SECTION_PRESET_COST[id]*count}));
 const elementItems=Object.entries(elementPresetCounts)
  .filter(([,count])=>count>0)
  .map(([id,count])=>({id,kib:(ELEMENT_PRESET_COST[id]??0)*count}));
 const perItem=[...sectionItems,...elementItems].sort((a,b)=>b.kib-a.kib);
 const totalContentKiB=perItem.reduce((sum,item)=>sum+item.kib,0);
 const totalKiB=pages*PAGE_BASE_KIB+backgroundKiB+totalContentKiB;
 return {totalKiB,perItem,band:weightBand(totalKiB)};
}
/** DOM-coupled, not pure — reads the already-paginated editor, one entry per physical page.
 * A section that spans multiple physical pages is counted once per page fragment, not once
 * total: Chromium rasterizes a separate decoration layer per page, so each fragment really
 * does carry its own cost in the final PDF. */
export function pageSectionCounts(pageStackEl){
 if(!pageStackEl)return [];
 return [...pageStackEl.querySelectorAll(':scope > .paper')].map((paper,i)=>{
  const counts={};
  for(const el of paper.querySelectorAll('[data-section-variant]'))counts[el.dataset.sectionVariant]=(counts[el.dataset.sectionVariant]||0)+1;
  return {page:i+1,counts};
 });
}
/** DOM-coupled sibling of pageSectionCounts, for the separate per-element styling layer
 * (app/element-styles.js — a paragraph, list item or inline span styled independently of its
 * section's preset). Previously uncounted entirely: estimateWeight only saw section presets,
 * so per-element Glass/Surface customizations were invisible to the live weight badge even
 * though they genuinely render and cost real bytes in the exported PDF. Keys are namespaced
 * "block:<preset>"/"inline:<preset>" to match ELEMENT_PRESET_COST. */
export function pageElementStyleCounts(pageStackEl){
 if(!pageStackEl)return [];
 const inlineTags=new Set(['a','strong','em','del','code']);
 return [...pageStackEl.querySelectorAll(':scope > .paper')].map((paper,i)=>{
  const counts={};
  for(const el of paper.querySelectorAll('[data-md-element-style]')){
   const tag=(el.dataset.mdElementId||'').split(':')[0];
   const key=(inlineTags.has(tag)?'inline:':'block:')+el.dataset.mdElementStyle;
   counts[key]=(counts[key]||0)+1;
  }
  return {page:i+1,counts};
 });
}
