import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {sectionAnchors,parseSectionPolicies,toggleSectionBreak,resolveSectionPolicies} from '../app/section-pagination.js';
test('heading anchors disambiguate duplicate titles and ignore fenced code',()=>{
 const md='# Docs\n\n## Intro\n\n## Intro\n\n'+String.fromCharCode(96).repeat(3)+'markdown\n## Hidden\n'+String.fromCharCode(96).repeat(3)+'\n\n### Details';
 const a=sectionAnchors(md);assert.equal(a.length,4);assert.notEqual(a[1].id,a[2].id);assert.ok(!a.some(x=>x.title==='Hidden'));
});
test('page break can be toggled and remains detached from Markdown source',()=>{
 const md='# Article\n\n## Section one\nSome text\n\n## Section two\nMore text';
 const id=sectionAnchors(md)[2].id;
 const p=toggleSectionBreak(null,id,true);
 assert.ok(resolveSectionPolicies(md,p).breakBefore.includes(id));
 assert.ok(!resolveSectionPolicies(md,toggleSectionBreak(p,id,false)).breakBefore.length);
 assert.equal(md.includes('<!--'),false);
});
test('orphaned anchors are identified instead of changing a different section',()=>{
 const md='# Docs\n\n## Original';
 const id=sectionAnchors(md)[1].id;
 const r=resolveSectionPolicies('# Docs\n\n## Renamed',toggleSectionBreak(null,id,true));
 assert.equal(r.breakBefore.length,0);assert.deepEqual(r.orphaned,[id]);
 assert.throws(()=>parseSectionPolicies({version:1,breakBefore:['<script>']}));
});
