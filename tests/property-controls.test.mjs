import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {normalizeRange,formatControlValue,validationMessage,isSelectOptionDisabled} from '../app/design-system/property-controls.js';
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

test('property validation explains missing, out-of-range, step and nonnumeric values',()=>{
 const make=(value,validity={})=>({value,validity});
 assert.equal(validationMessage(make(''),0,100),'Informe um valor.');
 assert.equal(validationMessage(make('101',{rangeOverflow:true}),0,100,'mm'),'Use um valor entre 0 e 100 mm.');
 assert.equal(validationMessage(make('-1',{rangeUnderflow:true}),0,100),'Use um valor entre 0 e 100.');
 assert.equal(validationMessage(make('0.3',{stepMismatch:true}),0,1),'Use um valor compatível com o incremento permitido.');
 assert.equal(validationMessage(make('abc'),0,1),'Informe um número válido.');
});

test('combobox respects disabled options and inherited disabled optgroups',()=>{
 const group={tagName:'OPTGROUP',disabled:true};
 assert.equal(isSelectOptionDisabled({disabled:false,parentElement:group}),true);
 assert.equal(isSelectOptionDisabled({disabled:true,parentElement:{tagName:'SELECT',disabled:false}}),true);
 group.disabled=false;
 assert.equal(isSelectOptionDisabled({disabled:false,parentElement:group}),false);
 assert.equal(isSelectOptionDisabled({disabled:false,parentElement:null}),false);
});
