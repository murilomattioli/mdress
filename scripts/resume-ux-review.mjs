/**
 * Resume the human sign-off for a completed supervised UX-023 capture session.
 * Does not launch Chromium, recapture screenshots or infer visual approval.
 * Usage: node scripts/resume-ux-review.mjs <exported-review.json>
 */
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeUxCoverage,summarizeScreenshotCoverage,validateHumanReviewEvidence,validateScreenshotViewport,UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';
import {fingerprintUxQaSource} from './ux-qa-source.mjs';
import {writeUxQaReportAtomic} from './ux-qa-checkpoint.mjs';

const DEFAULT_REPORT=process.env.MDRESS_QA_REPORT||'test-results/supervised-ux-qa.json';
const SCREENSHOT_DIRECTORY=resolve(process.env.MDRESS_QA_DIRECTORY||'test-results/ux-audit/supervised');

export function assessResumeReview(report,review,currentSourceFingerprint=null){
 const problems=[];
 // Fail closed: legacy reports without a source fingerprint cannot receive
 // human sign-off. PNG hashes alone do not identify the app revision.
 if(!/^[a-f0-9]{64}$/.test(report?.sourceFingerprint||''))
  problems.push('O relatório não identifica o código da captura; gere novas evidências.');
 else if(report.sourceFingerprint!==currentSourceFingerprint)
  problems.push('O código mudou desde a captura supervisionada; gere novas evidências.');
 if(report?.schema!==6||report?.mode!=='supervised'||report?.headless!==false)
  problems.push('O relatório não pertence a uma sessão supervisionada compatível.');
 if(report?.stopped||report?.summary?.status!=='passed')
  problems.push('A matriz funcional precisa estar completa e aprovada antes da homologação.');
 if(!report?.reviewSessionId||typeof report.reviewSessionId!=='string')
  problems.push('O relatório não contém um ID de sessão válido.');
 if(!Array.isArray(report?.screenshots)||!Array.isArray(report?.coverage)||!Array.isArray(report?.findings))
  problems.push('O relatório está incompleto.');
 if(Array.isArray(report?.findings)&&report.findings.some(item=>item.severity==='error'))
  problems.push('Existem findings críticos no relatório.');
 if(Array.isArray(report?.coverage)&&Array.isArray(report?.findings)&&
  summarizeUxCoverage(report.coverage,report.findings,report.stopped).status!=='passed')
  problems.push('A cobertura funcional real não corresponde ao status informado.');
 const screenshotCoverage=summarizeScreenshotCoverage(Array.isArray(report?.screenshots)?report.screenshots:[]);
 if(screenshotCoverage.missing.length||screenshotCoverage.duplicates.length||
  screenshotCoverage.unexpected.length||screenshotCoverage.invalidPaths.length)
  problems.push('As capturas do relatório não correspondem à matriz obrigatória.');
 if(report?.screenshots?.length!==UX_QA_MATRIX.length*UX_QA_REQUIRED_SCREENSHOTS.length)
  problems.push('Quantidade de capturas incompatível.');
 if(Array.isArray(report?.screenshots)&&report.screenshots.some(item=>
  !/^[a-f0-9]{64}$/.test(item?.sha256)))
  problems.push('As capturas não contêm impressões SHA-256 válidas da sessão.');
 const validation=validateHumanReviewEvidence(review,report?.reviewSessionId);
 if(!validation.valid)problems.push('A revisão exportada não aprova todos os estados da mesma sessão.');
 return {valid:problems.length===0,problems,validation,screenshotCoverage};
}

/** Verify every PNG against its session fingerprint, not only its dimensions.
 * A different but valid PNG must never inherit a human approval.
 * An optional evidence directory keeps fixture tests isolated from live QA.
 */
export async function verifyScreenshotEvidence(screenshots,evidenceDirectory=SCREENSHOT_DIRECTORY){
 for(const item of screenshots){
  const expected=item.theme+'-'+item.width+'-'+item.state+'.png';
  const path=resolve(item.path);
  const within=relative(evidenceDirectory,path);
  if(basename(path)!==expected||within.startsWith('..')||isAbsolute(within)||dirname(path)!==evidenceDirectory)
   throw Error('Caminho de evidência inválido: '+item.path);
  if(!/^[a-f0-9]{64}$/.test(item.sha256))
   throw Error('Impressão SHA-256 ausente ou inválida: '+expected);
  let bytes;
  try{
   const info=await lstat(path);
   if(!info.isFile()||info.isSymbolicLink())
    throw Error('Captura não é arquivo regular: '+expected);
   bytes=await readFile(path);
  }catch(error){
   if(error.message.startsWith('Captura não é arquivo regular:'))throw error;
   throw Error('Captura ausente: '+expected);
  }
  if(!validateScreenshotViewport(bytes,item.width))
   throw Error('Captura inválida ou corrompida: '+expected);
  if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)
   throw Error('Captura modificada desde a sessão: '+expected);
 }
 return screenshots.length;
}

/** Keep both interactive and resumed human sign-off bound to the same source.
 * Checking only at capture completion leaves a gap while a reviewer spends
 * time inspecting the gallery. Recheck before and after reading every PNG.
 */
export async function verifySourceBoundEvidence(screenshots,sourceFingerprint,{
 evidenceDirectory=SCREENSHOT_DIRECTORY,fingerprint=fingerprintUxQaSource
}={}){
 if(!/^[a-f0-9]{64}$/.test(sourceFingerprint)||
  await fingerprint()!==sourceFingerprint)
  throw Error('O código mudou desde a captura supervisionada; gere novas evidências.');
 const count=await verifyScreenshotEvidence(screenshots,evidenceDirectory);
 if(await fingerprint()!==sourceFingerprint)
  throw Error('O código mudou durante a validação das capturas; gere novas evidências.');
 return count;
}

export async function resumeHumanReview(reportPath,reviewPath){
 const reportFile=resolve(reportPath);
 const reviewFile=resolve(reviewPath);
 const report=JSON.parse(await readFile(reportFile,'utf8'));
 const review=JSON.parse(await readFile(reviewFile,'utf8'));
 const currentSourceFingerprint=await fingerprintUxQaSource();
 const assessment=assessResumeReview(report,review,currentSourceFingerprint);
 if(!assessment.valid)throw Error(assessment.problems.join(' '));
 await verifySourceBoundEvidence(report.screenshots,currentSourceFingerprint);
 report.humanReview={
  status:'approved',requiresExplicitApproval:true,
  evidence:{file:reviewFile,...assessment.validation,verifiedScreenshots:report.screenshots.length,
   verifiedAt:new Date().toISOString()}
 };
 await writeUxQaReportAtomic(reportFile,report);
 return {reportFile,verifiedScreenshots:report.screenshots.length,sessionId:report.reviewSessionId};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const reviewPath=process.argv[2];
 if(!reviewPath||process.argv.length!==3){
  console.error('Uso: node scripts/resume-ux-review.mjs <mdress-ux023-review.json>');
  process.exitCode=2;
 }else{
  try{
   const result=await resumeHumanReview(DEFAULT_REPORT,reviewPath);
   console.log('[UX QA] Revisão humana registrada na sessão '+result.sessionId+
    ' após validar '+result.verifiedScreenshots+' capturas. Relatório: '+result.reportFile);
  }catch(error){
   console.error('[UX QA] Homologação recusada: '+error.message);
   process.exitCode=1;
  }
 }
}
