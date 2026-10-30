import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeUxQaResumeCheckpoint,reviewSessionForResume} from '../scripts/ux-qa-checkpoint.mjs';
import {resumableUxViewportRows,UX_QA_REQUIRED_SCREENSHOTS,validateHumanReviewEvidence} from '../scripts/ux-qa-coverage.mjs';

test('headed runner checkpoints complete viewports atomically without granting UX approval',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-checkpoint-'));
 const reportPath=join(directory,'nested','report.json');
 const evidenceDirectory='test-results/ux-audit/supervised';
 const sourceFingerprint='a'.repeat(64),url='http://127.0.0.1:4173';
 const session={sourceFingerprint,reviewSessionId:'session-checkpoint',url,headless:true,
  coverage:[],screenshots:[],findings:[]};
 try{
  const empty=await writeUxQaResumeCheckpoint(reportPath,session);
  assert.equal(empty.summary.status,'stopped');
  assert.equal(empty.humanReview.status,'not-reviewed');
  assert.equal(empty.schema,6);
  session.coverage.push({theme:'graphite',width:1440,scenario:true,
   inspector:true,toolbar:true,errors:0});
  session.screenshots.push(...UX_QA_REQUIRED_SCREENSHOTS.map(state=>({
   theme:'graphite',width:1440,state,
   path:evidenceDirectory+'/graphite-1440-'+state+'.png',
   sha256:'b'.repeat(64)
  })));
  await writeUxQaResumeCheckpoint(reportPath,session);
  const restored=JSON.parse(await readFile(reportPath,'utf8'));
  assert.equal(restored.summary.status,'stopped');
  assert.equal(restored.humanReview.status,'not-reviewed');
  assert.equal(restored.reviewSessionId,'session-checkpoint');
  assert.deepEqual(resumableUxViewportRows(restored,{
   url,directory:evidenceDirectory,sourceFingerprint
  }).map(row=>row.width),[1440]);
  assert.deepEqual(await readdir(join(directory,'nested')),['report.json'],
   'Atomic checkpoint must not leave a temporary report');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('recaptured viewports invalidate previous human review IDs, fully reused ones preserve them',()=>{
 const oldId='prior-review',newId='new-review';
 assert.equal(reviewSessionForResume(oldId,8,8,()=>newId),oldId,
  'A stop after the final viewport should preserve its immutable evidence session');
 assert.equal(reviewSessionForResume(oldId,7,8,()=>newId),newId,
  'Even one recaptured viewport must invalidate prior approvals');
 assert.equal(reviewSessionForResume(oldId,0,8,()=>newId),newId);
 const oldReview={schema:1,sessionId:oldId,
  states:Object.fromEntries(UX_QA_REQUIRED_SCREENSHOTS.map(state=>[state,{status:'approved'}]))};
 assert.equal(validateHumanReviewEvidence(oldReview,newId).valid,false,
  'A stale exported review cannot approve new screenshots');
 assert.throws(()=>reviewSessionForResume(oldId,9,8),/inválida/);
});
