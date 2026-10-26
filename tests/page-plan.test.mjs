import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {pageGeometry,planSummary,PAGE_GEOMETRY} from '../app/page-plan.js';
test('physical page dimensions',()=>{
 assert.equal(PAGE_GEOMETRY.a4.heightMm,297);
 assert.equal(pageGeometry({paper:'letter'}).heightMm,279.4);
 assert.equal(pageGeometry({paper:'a4',marginMm:20}).usableHeightMm,257);
});
test('page geometry guards unknown format and unsafe margins',()=>{
 assert.throws(()=>pageGeometry({paper:'legal'}));
 assert.throws(()=>pageGeometry({marginMm:400}));
});
test('pagination summary returns physical points',()=>{
 const p=planSummary({paper:'a4',marginMm:18});
 assert.equal(p.usableHeightMm,261);
 assert.ok(Math.abs(p.usableHeightPt-739.84)<1);
});
