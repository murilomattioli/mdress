import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {sectionPresets,parseSectionDesign,resolveSectionPreset,setSectionPreset,setSectionDensity} from '../app/section-design.js';
const a='2:primeira seção:1',b='2:segunda seção:1';
test('all section presets have stable IDs and render independent of Markdown',()=>{
 assert.equal(new Set(sectionPresets.map(x=>x.id)).size,sectionPresets.length);
 assert.ok(sectionPresets.length>=8);
 const value=parseSectionDesign();
 assert.equal(resolveSectionPreset(value,a),'plain');
 const styled=setSectionPreset(value,'all','surface');
 assert.equal(resolveSectionPreset(styled,a),'surface');
 assert.equal(resolveSectionPreset(styled,b),'surface');
 assert.deepEqual(parseSectionDesign(null),value);
});
test('per-section override never changes sibling or global preset',()=>{
 let d=setSectionPreset(parseSectionDesign(),'all','surface');
 d=setSectionPreset(d,a,'band');
 assert.equal(resolveSectionPreset(d,a),'band');
 assert.equal(resolveSectionPreset(d,b),'surface');
 d=setSectionPreset(d,a,'surface');
 assert.equal(Object.keys(d.overrides).length,0);
 assert.deepEqual(d.defaultPreset,'surface');
});
test('global preset can reset one-off overrides, density is independent',()=>{
 let d=setSectionPreset(null,a,'accent');
 d=setSectionDensity(d,'airy');
 d=setSectionPreset(d,'all','outline');
 assert.equal(d.density,'airy');
 assert.equal(d.defaultPreset,'outline');
 assert.equal(Object.keys(d.overrides).length,0);
 assert.notEqual(parseSectionDesign().density,d.density);
});
test('design safely rejects untrusted or invalid dynamic values',()=>{
 assert.throws(()=>setSectionPreset(null,a,'<style>'));
 assert.throws(()=>setSectionPreset(null,'<h2>', 'surface'));
 assert.throws(()=>setSectionDensity(null,'999px'));
 assert.throws(()=>parseSectionDesign({version:1,defaultPreset:'surface',overrides:{[a]:'unknown'}}));
 assert.throws(()=>parseSectionDesign({version:1,defaultPreset:'plain',overrides:{constructor:'plain'}}));
});
test('stored configuration is JSON serializable',()=>{
 const state=setSectionPreset(setSectionDensity(null,'compact'),a,'editorial');
 assert.deepEqual(parseSectionDesign(JSON.parse(JSON.stringify(state))),state);
});

test('glass design is available, serializable and locally overridable',()=>{
 const base=setSectionPreset(null,'all','glass');
 assert.equal(resolveSectionPreset(base,'all'),'glass');
 const local=setSectionPreset(base,a,'surface');
 assert.equal(resolveSectionPreset(local,a),'surface');
 assert.equal(resolveSectionPreset(local,b),'glass');
 assert.deepEqual(parseSectionDesign(JSON.parse(JSON.stringify(local))),local);
});

test('level styles apply to every matching heading and preserve individual overrides',()=>{
 const h1='1:título:1',h2a='2:experiência:1',h2b='2:formação:1',h3='3:big2be:1';
 let design=setSectionPreset(null,'level:2','glass');
 assert.equal(resolveSectionPreset(design,h1),'plain');
 assert.equal(resolveSectionPreset(design,h2a),'glass');
 assert.equal(resolveSectionPreset(design,h2b),'glass');
 assert.equal(resolveSectionPreset(design,h3),'plain');
 design=setSectionPreset(design,h2a,'surface');
 assert.equal(resolveSectionPreset(design,h2a),'surface');
 assert.equal(resolveSectionPreset(design,h2b),'glass');
 design=setSectionPreset(design,'level:2','editorial');
 assert.equal(resolveSectionPreset(design,h2a),'surface');
 assert.equal(resolveSectionPreset(design,h2b),'editorial');
 design=setSectionPreset(design,h2a,'editorial');
 assert.equal(Object.keys(design.overrides).length,0);
 assert.deepEqual(parseSectionDesign(JSON.parse(JSON.stringify(design))),design);
});
test('level presets reject invalid heading level and reset to default',()=>{
 assert.throws(()=>setSectionPreset(null,'level:7','glass'));
 assert.throws(()=>parseSectionDesign({version:1,levelPresets:{7:'glass'}}));
 let design=setSectionPreset(null,'level:1','accent');
 design=setSectionPreset(design,'level:1','plain');
 assert.deepEqual(design.levelPresets,{});
});
