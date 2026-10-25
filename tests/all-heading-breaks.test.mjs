import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionAnchors,toggleSectionBreak,resolveSectionPolicies} from '../app/section-pagination.js';

test('all six Markdown heading levels are independently selectable',()=>{
 const md=['# Principal','## Seção','### Subseção','#### Detalhe','##### Nota','###### Menor'].join('\n');
 const anchors=sectionAnchors(md);
 assert.deepEqual(anchors.map(a=>a.level),[1,2,3,4,5,6]);
 let policies=null;
 for(const anchor of anchors)policies=toggleSectionBreak(policies,anchor.id,true);
 assert.equal(resolveSectionPolicies(md,policies).breakBefore.length,6);
});
test('duplicate section headings receive different anchors',()=>{
 const anchors=sectionAnchors('## Repetida\n## Repetida');
 assert.notEqual(anchors[0].id,anchors[1].id);
});
