import test from 'node:test';
import assert from 'node:assert/strict';
import {setElementProperty,parseElementStyles,clearElementInstance} from '../app/element-styles.js';
test('element visibility survives serialization and can be restored',()=>{
 const hidden=setElementProperty(null,'h1:1','visibility','hidden');
 assert.equal(parseElementStyles(JSON.parse(JSON.stringify(hidden))).properties['h1:1'].visibility,'hidden');
 assert.deepEqual(setElementProperty(hidden,'h1:1','visibility',null).properties,{});
 assert.deepEqual(clearElementInstance(hidden,'h1:1').properties,{});
 assert.throws(()=>setElementProperty(null,'h1:1','visibility','collapse'));
});

test('visibility supports type defaults and explicit instance exceptions',()=>{
 let value=setElementProperty(null,'hr','visibility','hidden');
 value=setElementProperty(value,'hr:1','visibility','visible');
 const parsed=parseElementStyles(JSON.parse(JSON.stringify(value)));
 assert.equal(parsed.properties.hr.visibility,'hidden');
 assert.equal(parsed.properties['hr:1'].visibility,'visible');
 assert.equal(setElementProperty(parsed,'hr:1','visibility',null).properties['hr:1'],undefined);
});
