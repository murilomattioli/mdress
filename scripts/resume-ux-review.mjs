/**
 * Resume the human sign-off for a completed supervised UX-023 capture session.
 * Does not launch Chromium, recapture screenshots or infer visual approval.
 * Usage: node scripts/resume-ux-review.mjs <exported-review.json>
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,basename,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeUxCoverage,summarizeScreenshotCoverage,validateHumanReviewEvidence,validateScreenshotViewport,UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';

const DEFAULT_REPORT='test-results/supervised-ux-qa.json';
const SCREENSHOT_DIRECTORY=resolve('test-results/ux-audit/supervised');

export function assessResumeReview(report,review){
 const problems=[];
 if(report?.schema!==5||report?.mode!=='supervised'||report?.headless!==false)
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
 const validation=validateHumanReviewEvidence(review,report?.reviewSessionId);
 if(!validation.valid)problems.push('A revisão exportada não aprova todos os estados da mesma sessão.');
 return {valid:problems.length===0,problems,validation,screenshotCoverage};
}

export async function resumeHumanReview(reportPath,reviewPath){
 const reportFile=resolve(reportPath);
 const reviewFile=resolve(reviewPath);
 const report=JSON.parse(await readFile(reportFile,'utf8'));
 const review=JSON.parse(await readFile(reviewFile,'utf8'));
 const assessment=assessResumeReview(report,review);
 if(!assessment.valid)throw Error(assessment.problems.join(' '));
 // Never trust only the JSON manifest: check all 396 PNGs again on disk.
 // Paths must stay inside the local QA evidence directory, never arbitrary
 // files supplied by a stale or edited report.
 for(const item of report.screenshots){
  const expected=item.theme+'-'+item.width+'-'+item.state+'.png';
  const path=resolve(item.path);
  const within=relative(SCREENSHOT_DIRECTORY,path);
  if(basename(path)!==expected||within.startsWith('..')||isAbsolute(within)||dirname(path)!==SCREENSHOT_DIRECTORY)
   throw Error('Caminho de evidência inválido: '+item.path);
  let bytes;
  try{bytes=await readFile(path);}
  catch{throw Error('Captura ausente: '+expected);}
  if(!validateScreenshotViewport(bytes,item.width))
   throw Error('Captura inválida ou corrompida: '+expected);
 }
 report.humanReview={
  status:'approved',requiresExplicitApproval:true,
  evidence:{file:reviewFile,...assessment.validation,verifiedScreenshots:report.screenshots.length,
   verifiedAt:new Date().toISOString()}
 };
 await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
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
