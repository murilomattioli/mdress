import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assessResumeReview,resumeHumanReview} from '../scripts/resume-ux-review.mjs';
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from '../scripts/ux-qa-coverage.mjs';

const sessionId='resume-ux023-test';
const screenshots=UX_QA_MATRIX.flatMap(({theme,width})=>
 UX_QA_REQUIRED_SCREENSHOTS.map(state=>({
  theme,width,state,path:'test-results/ux-audit/supervised/'+theme+'-'+width+'-'+state+'.png'
 })));
const report=()=>({
 schema:5,mode:'supervised',headless:false,stopped:false,reviewSessionId:sessionId,
 summary:{status:'passed'},coverage:UX_QA_MATRIX.map(({theme,width})=>({theme,width,scenario:true})),
 findings:[],screenshots:structuredClone(screenshots),
 humanReview:{status:'not-reviewed',requiresExplicitApproval:true}
});
const review=()=>({schema:1,sessionId,
 states:Object.fromEntries(UX_QA_REQUIRED_SCREENSHOTS.map(state=>[state,{status:'approved',note:''}]))});

test('resumed sign-off requires a completed interactive session and matching human review',()=>{
 assert.equal(assessResumeReview(report(),review()).valid,true);
 const automatic=report();automatic.mode='automatic';automatic.headless=true;
 assert.equal(assessResumeReview(automatic,review()).valid,false);
 const interrupted=report();interrupted.stopped=true;interrupted.summary.status='stopped';
 assert.equal(assessResumeReview(interrupted,review()).valid,false);
 const failed=report();failed.findings.push({severity:'error',message:'broken'});
 assert.equal(assessResumeReview(failed,review()).valid,false);
 const missing=report();missing.screenshots.pop();
 assert.equal(assessResumeReview(missing,review()).valid,false);
 const duplicate=report();duplicate.screenshots[0]=duplicate.screenshots[1];
 assert.equal(assessResumeReview(duplicate,review()).valid,false);
 const foreign=review();foreign.sessionId='another-session';
 assert.equal(assessResumeReview(report(),foreign).valid,false);
 const pending=review();pending.states.workspace.status='pending';
 assert.equal(assessResumeReview(report(),pending).valid,false);
 const rejected=review();rejected.states.workspace.status='rejected';
 assert.equal(assessResumeReview(report(),rejected).valid,false);
});

test('resume never signs off when screenshots are missing and preserves original report',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-resume-'));
 const reportPath=join(directory,'report.json'),reviewPath=join(directory,'review.json');
 try{
  const original=JSON.stringify(report());
  await writeFile(reportPath,original);
  await writeFile(reviewPath,JSON.stringify(review()));
  await assert.rejects(resumeHumanReview(reportPath,reviewPath),/Captura ausente|Captura inválida/);
  assert.equal(await readFile(reportPath,'utf8'),original,
   'Missing evidence must not change the human verdict');
 }finally{await rm(directory,{recursive:true,force:true});}
});
