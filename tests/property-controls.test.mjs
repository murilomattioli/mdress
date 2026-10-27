import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {normalizeRange,formatControlValue} from '../app/design-system/property-controls.js';
test('precision control rounds to native step and clamps bounds',()=>{
 assert.equal(normalizeRange(11.22,9,14,.5),11);
 assert.equal(normalizeRange(1.174,1.1,2.2,.05),1.15);
 assert.equal(normalizeRange(100,8,35,1),35);
 assert.equal(normalizeRange(-20,8,35,1),8);
});
test('precision control rejects unsupported numeric states',()=>{
 assert.throws(()=>normalizeRange(NaN,0,1,.1));
 assert.throws(()=>normalizeRange(0,1,1,.1));
 assert.throws(()=>normalizeRange(0,0,1,0));
});
test('value formatting preserves exact custom units',()=>{
 assert.equal(formatControlValue(11,'pt'),'11 pt');
 assert.equal(formatControlValue(0.18,''),'0.18');
 assert.equal(formatControlValue(1.5,'×'),'1.5×');
 assert.equal(formatControlValue(18,'mm'),'18 mm');
});
