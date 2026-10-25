import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {defaults,validateTheme} from '../app/resume-themes.js';
import {shuffleTheme,normalizeThemeLocks} from '../app/theme-explorer.js';
import {parseSectionDesign} from '../app/section-design.js';
import {surpriseSections} from '../app/section-surprise.js';

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
 assert.ok(Object.keys(a.overrides).every(id=>id.startsWith('1:')||id.startsWith('2:')||id.startsWith('3:')));
 assert.ok(JSON.stringify(a).includes('defaultPreset'));
 assert.ok(markdown.startsWith('# Guia'));
});
