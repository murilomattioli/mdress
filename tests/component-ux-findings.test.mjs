import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateAuditFindings, summarizeAuditFindings, auditCoverageFinding, findInspectorControlOverlaps} from '../scripts/component-ux-findings.mjs';

const finding = (theme, width, severity = 'warning') => ({
  rule: 'scrollable-toolbar',
  severity,
  component: 'button',
  detail: 'Controle fora da área visível',
  context: {theme, width, html: '<button title="Citação">Citação</button>'},
});

test('preserves the same control finding across viewports and themes', () => {
  const observations = [
    finding('studio', 1024),
    finding('studio', 768),
    finding('graphite', 1024),
  ];
  assert.deepEqual(deduplicateAuditFindings(observations), observations);
});

test('deduplicates repeated observations only within the same scenario', () => {
  const original = finding('studio', 1024);
  assert.deepEqual(
    deduplicateAuditFindings([original, {...original}, finding('studio', 768)]),
    [original, finding('studio', 768)],
  );
});

test('never collapses a critical error into a warning', () => {
  const warning = finding('studio', 1024);
  const error = finding('studio', 1024, 'error');
  assert.deepEqual(deduplicateAuditFindings([warning, error]), [warning, error]);
});

test('summarizes warnings and errors per scenario without treating warnings as passes', () => {
  const observations = deduplicateAuditFindings([
    finding('studio', 1024),
    finding('studio', 1024), // repeated observation within a scenario
    finding('graphite', 1024),
    finding('studio', 768, 'error'),
  ]);
  const summary = summarizeAuditFindings(observations, [
    {theme: 'graphite', width: 1024},
    {theme: 'studio', width: 1024},
    {theme: 'studio', width: 768},
    {theme: 'graphite', width: 1440},
  ]);
  assert.equal(summary.critical, 1);
  assert.equal(summary.warnings, 2);
  assert.deepEqual(summary.scenarios, [
    {theme: 'graphite', width: 1024, critical: 0, warnings: 1, rules: ['scrollable-toolbar']},
    {theme: 'studio', width: 1024, critical: 0, warnings: 1, rules: ['scrollable-toolbar']},
    {theme: 'studio', width: 768, critical: 1, warnings: 0, rules: ['scrollable-toolbar']},
    {theme: 'graphite', width: 1440, critical: 0, warnings: 0, rules: []},
  ]);
});

test('a viewport with zero inventoried controls fails rather than silently passing',()=>{
 assert.equal(auditCoverageFinding(24,{theme:'studio',width:768}),null);
 for(const count of [0,undefined,NaN,-1]){
  const finding=auditCoverageFinding(count,{theme:'studio',width:768});
  assert.equal(finding.severity,'error');
  assert.equal(finding.rule,'coverage');
  assert.equal(summarizeAuditFindings([finding],[{theme:'studio',width:768}]).critical,1);
 }
});

test('inspector geometry audit catches overlapping interactive targets without flagging adjacent borders',()=>{
 const control=(name,left,top,right,bottom)=>({name,rect:{left,top,right,bottom},html:'<button>'+name+'</button>'});
 const rows=[
  {name:'Number',controls:[
   control('minus',0,0,44,44),control('value',43,0,110,44),control('plus',100,0,144,44)
  ]},
  {name:'Segment',controls:[
   control('left',0,50,50,94),control('right',50,50,100,94)
  ]},
  {name:'Color',controls:[control('hex',0,100,80,144)]}
 ];
 const found=findInspectorControlOverlaps(rows);
 assert.equal(found.length,1);
 assert.equal(found[0].row,'Number');
 assert.equal(found[0].first,'value');
 assert.equal(found[0].second,'plus');
 assert.equal(found[0].horizontal,10);
 assert.equal(found[0].vertical,44);
 assert.equal(findInspectorControlOverlaps(rows,10).length,0,
  'A collision must exceed the minimum intersection in both axes');
});
test('inspector geometry audit ignores separate rows and near-zero overlap',()=>{
 const control=(name,left,top,right,bottom)=>({name,rect:{left,top,right,bottom},html:name});
 assert.deepEqual(findInspectorControlOverlaps([
  {name:'A',controls:[control('a',0,0,44,44)]},
  {name:'B',controls:[control('b',0,0,44,44)]},
  {name:'C',controls:[control('c',0,0,44,44),control('d',41,0,85,44)]}
 ]),[]);
});
