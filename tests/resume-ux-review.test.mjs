import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assessResumeReview,resumeHumanReview,verifyScreenshotEvidence,verifySourceBoundEvidence} from '../scripts/resume-ux-review.mjs';
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from '../scripts/ux-qa-coverage.mjs';
import {fingerprintUxQaSource} from '../scripts/ux-qa-source.mjs';

const sessionId='resume-ux023-test';
const screenshots=UX_QA_MATRIX.flatMap(({theme,width})=>
 UX_QA_REQUIRED_SCREENSHOTS.map(state=>({
  theme,width,state,path:'test-results/ux-audit/supervised/'+theme+'-'+width+'-'+state+'.png',
  sha256:'0'.repeat(64)
 })));
const report=()=>({
 schema:6,mode:'supervised',headless:false,stopped:false,reviewSessionId:sessionId,
 sourceFingerprint:'a'.repeat(64),
 summary:{status:'passed'},coverage:UX_QA_MATRIX.map(({theme,width})=>({theme,width,scenario:true,inspector:true,toolbar:true,errors:0})),
 findings:[],screenshots:structuredClone(screenshots),
 humanReview:{status:'not-reviewed',requiresExplicitApproval:true}
});
const review=()=>({schema:1,sessionId,
 states:Object.fromEntries(UX_QA_REQUIRED_SCREENSHOTS.map(state=>[state,{status:'approved',note:''}]))});
const assess=(capture,decision,currentFingerprint='a'.repeat(64))=>
 assessResumeReview(capture,decision,currentFingerprint);

test('resumed sign-off requires a completed interactive session and matching human review',()=>{
 assert.equal(assess(report(),review()).valid,true);
 const automatic=report();automatic.mode='automatic';automatic.headless=true;
 assert.equal(assess(automatic,review()).valid,false);
 const interrupted=report();interrupted.stopped=true;interrupted.summary.status='stopped';
 assert.equal(assess(interrupted,review()).valid,false);
 const failed=report();failed.findings.push({severity:'error',message:'broken'});
 assert.equal(assess(failed,review()).valid,false);
 const falseGreen=report();falseGreen.coverage[0].inspector=false;
 assert.equal(assess(falseGreen,review()).valid,false);
 const unsigned=report();delete unsigned.screenshots[0].sha256;
 assert.equal(assess(unsigned,review()).valid,false,'Unsigned evidence must not be approved');
 const malformedHash=report();malformedHash.screenshots[0].sha256='abc';
 assert.equal(assess(malformedHash,review()).valid,false);
 const legacy=report();legacy.schema=5;
 assert.equal(assess(legacy,review()).valid,false,'Old reports cannot bypass fingerprint validation');
 const unbound=report();delete unbound.sourceFingerprint;
 assert.equal(assess(unbound,review()).valid,false,'Legacy schema-6 reports cannot bypass source binding');
 const malformedSource=report();malformedSource.sourceFingerprint='broken';
 assert.equal(assess(malformedSource,review()).valid,false);
 const missing=report();missing.screenshots.pop();
 assert.equal(assess(missing,review()).valid,false);
 const duplicate=report();duplicate.screenshots[0]=duplicate.screenshots[1];
 assert.equal(assess(duplicate,review()).valid,false);
 const foreign=review();foreign.sessionId='another-session';
 assert.equal(assess(report(),foreign).valid,false);
 const pending=review();pending.states.workspace.status='pending';
 assert.equal(assess(report(),pending).valid,false);
 const rejected=review();rejected.states.workspace.status='rejected';
 assert.equal(assess(report(),rejected).valid,false);
});

test('source-bound sign-off rejects changed or malformed capture revisions',()=>{
 const sourceBound=report();
 sourceBound.sourceFingerprint='a'.repeat(64);
 assert.equal(assess(sourceBound,review(),'a'.repeat(64)).valid,true);
 assert.equal(assess(sourceBound,review(),'b'.repeat(64)).valid,false,
  'A different app/QA revision cannot inherit human approval');
 assert.equal(assess(sourceBound,review(),null).valid,false,
  'Unknown current source is not sufficient for a source-bound report');
 sourceBound.sourceFingerprint='not-a-sha256';
 assert.equal(assess(sourceBound,review(),'not-a-sha256').valid,false);
});

test('source mismatch refuses approval before modifying the report',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-source-bound-'));
 const reportPath=join(directory,'report.json'),reviewPath=join(directory,'review.json');
 try{
  const stale={...report(),sourceFingerprint:'0'.repeat(64)};
  const original=JSON.stringify(stale);
  await writeFile(reportPath,original);
  await writeFile(reviewPath,JSON.stringify(review()));
  await assert.rejects(resumeHumanReview(reportPath,reviewPath),/código mudou/);
  assert.equal(await readFile(reportPath,'utf8'),original);
 }finally{await rm(directory,{recursive:true,force:true});}
});


test('legacy capture cannot receive human approval even with a valid exported review',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-unbound-review-'));
 const reportPath=join(directory,'report.json'),reviewPath=join(directory,'review.json');
 try{
  const unbound=report();delete unbound.sourceFingerprint;
  const original=JSON.stringify(unbound);
  await writeFile(reportPath,original);
  await writeFile(reviewPath,JSON.stringify(review()));
  await assert.rejects(resumeHumanReview(reportPath,reviewPath),/não identifica o código/);
  assert.equal(await readFile(reportPath,'utf8'),original,
   'Refusing legacy sign-off must preserve the unapproved report');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('resume rejects missing or mismatched live evidence and preserves original report',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-resume-'));
 const reportPath=join(directory,'report.json'),reviewPath=join(directory,'review.json');
 try{
  const captured=report();captured.sourceFingerprint=await fingerprintUxQaSource();
  const original=JSON.stringify(captured);
  await writeFile(reportPath,original);
  await writeFile(reviewPath,JSON.stringify(review()));
  await assert.rejects(resumeHumanReview(reportPath,reviewPath),/Captura ausente|Captura inválida|Captura modificada/);
  assert.equal(await readFile(reportPath,'utf8'),original,
   'Missing evidence must not change the human verdict');
 }finally{await rm(directory,{recursive:true,force:true});}
});

const pngChunk=(type,data)=>{
 const name=Buffer.from(type,'ascii'),length=Buffer.alloc(4),crcBytes=Buffer.alloc(4);
 length.writeUInt32BE(data.length);
 let crc=0xffffffff;
 for(const byte of Buffer.concat([name,data])){
  crc^=byte;
  for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 crcBytes.writeUInt32BE((crc^0xffffffff)>>>0);
 return Buffer.concat([length,name,data,crcBytes]);
};
function validPng(width,modified=false){
 const header=Buffer.alloc(13);
 header.writeUInt32BE(width,0);header.writeUInt32BE(900,4);
 header[8]=8;header[9]=2;
 const pixels=Buffer.alloc((width*3+1)*900);
 if(modified)pixels[1]=127;
 return Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  pngChunk('IHDR',header),
  pngChunk('IDAT',deflateSync(pixels)),
  pngChunk('IEND',Buffer.alloc(0))
 ]);
}

test('resumed approval rejects a replaced, dimensionally valid PNG',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-evidence-'));
 const path=join(directory,'graphite-768-workspace.png');
 const original=validPng(768),replacement=validPng(768,true);
 const screenshot={theme:'graphite',width:768,state:'workspace',path,
  sha256:createHash('sha256').update(original).digest('hex')};
 try{
  await writeFile(path,original);
  assert.equal(await verifyScreenshotEvidence([screenshot],directory),1);
  await writeFile(path,replacement);
  await assert.rejects(verifyScreenshotEvidence([screenshot],directory),/Captura modificada/);
  await assert.rejects(verifyScreenshotEvidence([{...screenshot,sha256:'bad'}],directory),/SHA-256/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('both sign-off paths reject source changes before and during screenshot verification',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-source-race-'));
 const path=join(directory,'graphite-768-workspace.png');
 const png=validPng(768),source='a'.repeat(64);
 const screenshot={theme:'graphite',width:768,state:'workspace',path,
  sha256:createHash('sha256').update(png).digest('hex')};
 try{
  await writeFile(path,png);
  assert.equal(await verifySourceBoundEvidence([screenshot],source,{
   evidenceDirectory:directory,fingerprint:async()=>source
  }),1);
  await assert.rejects(verifySourceBoundEvidence([screenshot],source,{
   evidenceDirectory:directory,fingerprint:async()=>'b'.repeat(64)
  }),/código mudou desde/);
  let calls=0;
  await assert.rejects(verifySourceBoundEvidence([screenshot],source,{
   evidenceDirectory:directory,
   fingerprint:async()=>++calls===1?source:'b'.repeat(64)
  }),/código mudou durante/);
  assert.equal(calls,2,'Source must be rechecked after all PNGs are validated');
  await assert.rejects(verifySourceBoundEvidence([screenshot],'invalid',{
   evidenceDirectory:directory,fingerprint:async()=>source
  }),/código mudou desde/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('human sign-off never follows a symlinked screenshot outside its evidence directory',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mdress-symlink-evidence-'));
 const target=join(directory,'source.png'),link=join(directory,'graphite-768-workspace.png');
 const png=validPng(768);
 try{
  await writeFile(target,png);
  try{await symlink(target,link);}
  catch(error){
   if(['EPERM','EACCES','ENOTSUP'].includes(error.code))return;
   throw error;
  }
  await assert.rejects(verifyScreenshotEvidence([{
   theme:'graphite',width:768,state:'workspace',path:link,
   sha256:createHash('sha256').update(png).digest('hex')
  }],directory),/arquivo regular/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
