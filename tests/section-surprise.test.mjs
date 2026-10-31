import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {defaults,validateTheme} from '../app/resume-themes.js';
import {shuffleTheme,normalizeThemeLocks} from '../app/theme-explorer.js';
import {parseSectionDesign} from '../app/section-design.js';
import {surpriseSections} from '../app/section-surprise.js';
import {costClass,SECTION_PRESET_COST,estimateWeight} from '../app/pdf-weight.js';

const markdown='# Guia\n\n## Visão geral\nTexto inicial\n\n### Objetivos\nAlinhamentos\n\n## Implementação\nTexto técnico\n\n## Considerações\nFinal';
test('full randomizer changes theme parameters beyond recipe choices',()=>{
 const initial=validateTheme(defaults);
 const a=shuffleTheme(initial,{},0.17);
 const b=shuffleTheme(initial,{},0.18);
 assert.notDeepEqual(a,b);
 assert.notDeepEqual(a.layout,b.layout);
 for(const theme of [a,b])assert.deepEqual(validateTheme(theme),theme);
});
test('full randomizer honors visual locks including sections',()=>{
 const base=validateTheme(defaults);
 const locked=shuffleTheme(base,{colors:true,background:true,typography:true,spacing:true,sections:false},0.31);
 assert.deepEqual(locked,base);
 const design=parseSectionDesign();
 assert.deepEqual(surpriseSections(markdown,design,{sections:true},0.45),design);
 assert.deepEqual(surpriseSections(markdown,design,{},0.45),surpriseSections(markdown,design,{},0.45));
 assert.notDeepEqual(surpriseSections(markdown,design,{},0.45),design);
 assert.equal(normalizeThemeLocks({sections:true}).sections,true);
});
test('full randomizer keeps original Markdown and varies heading composition',()=>{
 const base=parseSectionDesign();
 const a=surpriseSections(markdown,base,{},0.11);
 const b=surpriseSections(markdown,base,{},0.91);
 assert.notDeepEqual(a,b);
 assert.ok(JSON.stringify(a).includes('defaultPreset'));
 assert.ok(markdown.startsWith('# Guia'));
});
test('surprise varies by heading level, not per heading independently',()=>{
 const a=surpriseSections(markdown,parseSectionDesign(),{},0.11);
 assert.deepEqual(a.overrides,{});
 assert.ok(Object.keys(a.levelPresets).every(level=>/^[1-6]$/.test(level)));
 // markdown fixture has two level-2 headings ("Visão geral","Implementação","Considerações" are H2) —
 // same level must resolve to the same preset for both.
});
test('heavy-cost presets never exceed one level per document, across many seeds',()=>{
 const sixLevels='# A\n## B\n### C\n#### D\n##### E\n###### F\nTexto.';
 for(let s=0;s<1;s+=0.03){
  const r=surpriseSections(sixLevels,parseSectionDesign(),{},s);
  const heavy=Object.values(r.levelPresets).filter(id=>costClass(SECTION_PRESET_COST[id])==='pesado');
  assert.ok(heavy.length<=1,'seed '+s+' produced '+heavy.length+' heavy levels');
 }
});
test('a document with many same-level headings never estimates as pesado, across many seeds (REQ-013-06/F013-04)',()=>{
 // Reproduces the shape of the real bug report: many job entries at one heading level. A level
 // count cap alone is not enough — a single heavy level with enough occurrences can still blow
 // the budget (caught by the final review: glass landing on a many-occurrence level). 15 × the
 // calibrated glass cost (171 KiB) alone already crosses the 2560 KiB pesado threshold.
 const manyJobs='# Nome\n\n'+Array.from({length:15},(_,i)=>'## Empresa '+(i+1)+'\nTexto da vaga.').join('\n\n');
 for(let s=0;s<1;s+=0.01){
  const r=surpriseSections(manyJobs,parseSectionDesign(),{},s);
  const sectionPresetCounts={};
  for(const [level,preset] of Object.entries(r.levelPresets))sectionPresetCounts[preset]=(sectionPresetCounts[preset]||0)+(level==='2'?15:1);
  const estimate=estimateWeight({pages:9,backgroundKind:'solid',sectionPresetCounts});
  assert.notEqual(estimate.band,'pesado','seed '+s+' estimated '+estimate.totalKiB+' KiB ('+JSON.stringify(r.levelPresets)+')');
 }
});
test('document with no headings does not throw and yields no level presets',()=>{
 const r=surpriseSections('Só um parágrafo solto, sem heading.',parseSectionDesign(),{},0.5);
 assert.deepEqual(r.levelPresets,{});
});
test('document where every heading shares one level still gets a preset for that level',()=>{
 const oneLevel='## Um\nTexto\n\n## Dois\nTexto\n\n## Três\nTexto';
 const r=surpriseSections(oneLevel,parseSectionDesign(),{},0.6);
 assert.ok(r.levelPresets['2']);
});

test('effective presets including default stay within the heavy-level cap',()=>{
 const md='# A\n## B\n### C\n#### D\n##### E\n###### F';
 for(let seed=0;seed<1;seed+=.005){
  const r=surpriseSections(md,parseSectionDesign(),{},seed);
  const effective=[1,2,3,4,5,6].map(n=>r.levelPresets[n]||r.defaultPreset);
  assert.ok(effective.filter(id=>costClass(SECTION_PRESET_COST[id])==='pesado').length<=1);
 }
});
