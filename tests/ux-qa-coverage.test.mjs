import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {summarizeUxCoverage,UX_QA_MATRIX} from '../scripts/ux-qa-coverage.mjs';

const full=()=>UX_QA_MATRIX.map(({theme,width})=>({theme,width,scenario:true,inspector:true,toolbar:true,errors:0}));

test('full matrix passes only when every scenario and sub-audit passes',()=>{
 const result=summarizeUxCoverage(full(),[],false);
 assert.deepEqual([result.status,result.expected,result.passing,result.complete],['passed',6,6,true]);
});
test('a missing or duplicated viewport never counts as full coverage',()=>{
 const missing=full().slice(0,-1);
 assert.equal(summarizeUxCoverage(missing,[],false).status,'failed');
 const duplicate=full();duplicate[5]={...duplicate[0]};
 assert.equal(summarizeUxCoverage(duplicate,[],false).complete,false);
});
test('toolbar, inspector, runtime and finding failures fail the report',()=>{
 for(const key of ['toolbar','inspector','scenario']){
  const rows=full();rows[0][key]=false;
  assert.equal(summarizeUxCoverage(rows,[],false).status,'failed');
 }
 const rows=full();rows[0].errors=1;
 assert.equal(summarizeUxCoverage(rows,[],false).status,'failed');
 assert.equal(summarizeUxCoverage(full(),[{severity:'error'}],false).status,'failed');
 assert.equal(summarizeUxCoverage(full(),[{severity:'warning'}],false).status,'passed');
});
test('reviewer stop is never reported as successful completion',()=>{
 assert.equal(summarizeUxCoverage(full(),[],true).status,'stopped');
 assert.equal(summarizeUxCoverage(full().slice(0,1),[],true).status,'stopped');
});
