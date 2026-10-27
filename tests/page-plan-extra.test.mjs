import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {pageGeometry} from '../app/page-plan.js';
test('A4 and letter constraints allow multi-page layout',()=>{
 for(const type of ['a4','letter']){const p=pageGeometry({paper:type,marginMm:18});
  assert.ok(p.usableHeightMm>240&&p.usableWidthMm>170);
 }
});
test('invalid page properties cause deterministic errors',()=>{
 assert.throws(()=>pageGeometry({paper:'a3'}));
 assert.throws(()=>pageGeometry({marginMm:NaN}));
});
