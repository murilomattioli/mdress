import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {summarizeUxCoverage,summarizeScreenshotCoverage,UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS,parseHumanReviewChoice,validateHumanReviewEvidence,validateScreenshotViewport,UX_QA_VIEWPORT_HEIGHT} from '../scripts/ux-qa-coverage.mjs';

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

test('human visual sign-off is explicit and separate from passing automated checks',()=>{
 assert.equal(parseHumanReviewChoice(''), 'not-reviewed');
 assert.equal(parseHumanReviewChoice('m'), 'not-reviewed');
 assert.equal(parseHumanReviewChoice(' A '), 'approved');
 assert.equal(parseHumanReviewChoice('r'), 'rejected');
 assert.equal(parseHumanReviewChoice(null), 'not-reviewed');
 assert.equal(summarizeUxCoverage(full(),[],false).status,'passed',
  'Automated status remains a separate functional result');
});

test('visual evidence requires every control state in every viewport exactly once',()=>{
 const all=UX_QA_MATRIX.flatMap(({theme,width})=>
  UX_QA_REQUIRED_SCREENSHOTS.map(state=>({theme,width,state,path:theme+'-'+width+'-'+state+'.png'})));
 const complete=summarizeScreenshotCoverage(all);
 assert.equal(complete.expected,300);
 assert.equal(complete.captured,300);
 assert.deepEqual(complete.missing,[]);
 assert.deepEqual(complete.duplicates,[]);
 assert.deepEqual(complete.unexpected,[]);
 assert.deepEqual(complete.invalidPaths,[]);
 const missing=summarizeScreenshotCoverage(all.slice(1));
 assert.deepEqual(missing.missing,['graphite:1440:workspace']);
 const repeated=summarizeScreenshotCoverage([...all,all[0]]);
 assert.deepEqual(repeated.duplicates,['graphite:1440:workspace']);
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('range-live-any'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-tab-backward'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('toolbar-last-focus'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('color-draft-sync'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('range-native-override'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('binary-disabled-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-disabled-trigger-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('segment-live-options'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('segment-live-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('segment-disabled-focus-handoff'));
 const unexpected=summarizeScreenshotCoverage([...all,{theme:'graphite',width:1440,state:'not-in-contract',path:'graphite-1440-not-in-contract.png'}]);
 assert.deepEqual(unexpected.unexpected,['graphite:1440:not-in-contract']);
 const wrongPath=summarizeScreenshotCoverage(all.map((row,index)=>index===0?{...row,path:'stale-capture.png'}:row));
 assert.deepEqual(wrongPath.invalidPaths,['graphite:1440:workspace']);
 const missingPath=summarizeScreenshotCoverage(all.map((row,index)=>index===0?{...row,path:undefined}:row));
 assert.deepEqual(missingPath.invalidPaths,['graphite:1440:workspace']);
});

test('human review requires a matching session and explicit approval of all 50 states',()=>{
 const session='review-session-1';
 const states=Object.fromEntries(UX_QA_REQUIRED_SCREENSHOTS.map(state=>[state,{status:'approved',note:''}]));
 const complete={schema:1,sessionId:session,states};
 assert.equal(validateHumanReviewEvidence(complete,session).valid,true);
 assert.equal(validateHumanReviewEvidence(complete,'another-session').valid,false);
 assert.equal(validateHumanReviewEvidence({...complete,schema:0},session).valid,false);
 const pending=structuredClone(complete);
 pending.states.workspace.status='pending';
 assert.equal(validateHumanReviewEvidence(pending,session).valid,false);
 assert.ok(validateHumanReviewEvidence(pending,session).missing.includes('workspace'));
 const rejected=structuredClone(complete);
 rejected.states.toolbar.status='rejected';
 assert.deepEqual(validateHumanReviewEvidence(rejected,session).rejected,['toolbar']);
 assert.equal(validateHumanReviewEvidence(rejected,session).valid,false);
 const extra=structuredClone(complete);
 extra.states['unverified-extra']={status:'approved'};
 assert.deepEqual(validateHumanReviewEvidence(extra,session).unexpected,['unverified-extra']);
 assert.equal(validateHumanReviewEvidence(extra,session).valid,false);
 assert.equal(validateHumanReviewEvidence(null,session).valid,false);
});

test('PNG evidence requires exact viewport dimensions and IHDR',()=>{
 const png=Buffer.alloc(33);
 Buffer.from('89504e470d0a1a0a','hex').copy(png,0);
 png.writeUInt32BE(13,8);png.write('IHDR',12);
 png.writeUInt32BE(1440,16);png.writeUInt32BE(UX_QA_VIEWPORT_HEIGHT,20);
 assert.equal(validateScreenshotViewport(png,1440),true);
 assert.equal(validateScreenshotViewport(png,1024),false);
 png.writeUInt32BE(1,16);
 assert.equal(validateScreenshotViewport(png,1440),false,'1px placeholder must fail');
 png.writeUInt32BE(1440,16);png.write('IDAT',12);
 assert.equal(validateScreenshotViewport(png,1440),false,'IHDR is mandatory');
 assert.equal(validateScreenshotViewport(Buffer.from('not a PNG'),1440),false);
});
