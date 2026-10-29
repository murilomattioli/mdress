import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {estimateWeight,costClass,weightBand,PAGE_BASE_KIB,SECTION_PRESET_COST,BACKGROUND_KIND_COST,ELEMENT_PRESET_COST} from '../app/pdf-weight.js';

test('page-only estimate uses the base page cost and is leve',()=>{
 const r=estimateWeight({pages:3});
 assert.equal(r.totalKiB,3*PAGE_BASE_KIB);
 assert.equal(r.band,'leve');
});
test('costClass boundaries match the spec table',()=>{
 assert.equal(costClass(4),'leve');assert.equal(costClass(5),'medio');
 assert.equal(costClass(14),'medio');assert.equal(costClass(15),'pesado');
});
test('weightBand boundaries match the reused inspectPDFFile thresholds',()=>{
 assert.equal(weightBand(499),'leve');assert.equal(weightBand(500),'atencao');
 assert.equal(weightBand(2559),'atencao');assert.equal(weightBand(2560),'pesado');
});
test('unknown background kind or section preset id never throws or yields NaN',()=>{
 const r=estimateWeight({pages:1,backgroundKind:'future-kind',sectionPresetCounts:{'future-preset':3}});
 assert.ok(Number.isFinite(r.totalKiB));
});
test('many manually-heavy sections across many pages report pesado regardless of how they were set',()=>{
 const r=estimateWeight({pages:9,backgroundKind:'solid',sectionPresetCounts:{glass:100}});
 assert.equal(r.band,'pesado');
});
test('top contributors are sorted by kib descending',()=>{
 const r=estimateWeight({pages:1,sectionPresetCounts:{outline:1,glass:1,surface:1}});
 assert.deepEqual(r.perItem.map(x=>x.id),['glass','surface','outline']);
});
test('per-element styles (a separate layer from section presets, e.g. Glass on many paragraphs/list items) contribute real weight',()=>{
 const sectionOnly=estimateWeight({pages:1,sectionPresetCounts:{}});
 const withElements=estimateWeight({pages:1,sectionPresetCounts:{},elementPresetCounts:{'block:glass':40}});
 assert.ok(withElements.totalKiB>sectionOnly.totalKiB,'element-level glass must add weight the badge previously ignored entirely');
 assert.equal(withElements.totalKiB,sectionOnly.totalKiB+40*ELEMENT_PRESET_COST['block:glass']);
});
test('unknown element preset id never throws or yields NaN',()=>{
 const r=estimateWeight({pages:1,elementPresetCounts:{'inline:future':5}});
 assert.ok(Number.isFinite(r.totalKiB));
});
