import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateAuditFindings, summarizeAuditFindings, auditCoverageFinding, findInspectorControlOverlaps, findInspectorCrossRowOverlaps, missingAriaReferenceIds, duplicateAriaReferenceIds, emptyAriaLabelReferenceIds} from '../scripts/component-ux-findings.mjs';

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

test('cross-row audit catches overlapping hit targets even when each row is internally valid',()=>{
 const control=(name,left,top,right,bottom)=>({name,rect:{left,top,right,bottom},html:name});
 const rows=[
  {name:'Font size',controls:[control('minus',0,0,44,44),control('plus',50,0,94,44)]},
  {name:'Spacing',controls:[control('input',80,30,160,74)]},
  {name:'Color',controls:[control('swatch',0,74,44,118)]}
 ];
 assert.deepEqual(findInspectorControlOverlaps(rows),[]);
 const overlaps=findInspectorCrossRowOverlaps(rows);
 assert.equal(overlaps.length,1);
 assert.deepEqual({row:overlaps[0].row,otherRow:overlaps[0].otherRow,
  first:overlaps[0].first,second:overlaps[0].second,
  horizontal:overlaps[0].horizontal,vertical:overlaps[0].vertical},
  {row:'Font size',otherRow:'Spacing',first:'plus',second:'input',horizontal:14,vertical:14});
 assert.equal(findInspectorCrossRowOverlaps(rows,14).length,0);
});

test('cross-row audit ignores shared borders and only compares distinct rows',()=>{
 const control=(name,left,top,right,bottom)=>({name,rect:{left,top,right,bottom},html:name});
 assert.deepEqual(findInspectorCrossRowOverlaps([
  {name:'A',controls:[control('a',0,0,50,44),control('b',20,0,70,44)]},
  {name:'B',controls:[control('c',0,42,50,86)]}
 ]),[]);
});

test('ARIA IDREF audit rejects missing references, not valid multi-label chains',()=>{
 const known=new Set(['property-name','property-help','error-text']);
 const exists=id=>known.has(id);
 assert.deepEqual(missingAriaReferenceIds('property-name property-help',exists),[]);
 assert.deepEqual(missingAriaReferenceIds('property-name missing missing',exists),['missing']);
 assert.deepEqual(missingAriaReferenceIds('  ',exists),[]);
 assert.deepEqual(missingAriaReferenceIds(null,exists),[]);
 assert.deepEqual(missingAriaReferenceIds('error-text other',exists),['other']);
});


test('ARIA IDREF audit rejects duplicate and empty label targets without double-counting',()=>{
 const counts=new Map([['name',1],['duplicate',2],['description',1]]);
 const texts=new Map([['name','Tamanho'],['duplicate','Nome'],['description','']]);
 const count=id=>counts.get(id)||0;
 const resolveText=id=>texts.get(id);
 assert.deepEqual(duplicateAriaReferenceIds('name duplicate duplicate',count),['duplicate']);
 assert.deepEqual(duplicateAriaReferenceIds('name missing',count),[]);
 assert.deepEqual(emptyAriaLabelReferenceIds('name description description missing',resolveText),['description']);
 assert.deepEqual(emptyAriaLabelReferenceIds('name',resolveText),[]);
 assert.deepEqual(emptyAriaLabelReferenceIds(null,resolveText),[]);
});
