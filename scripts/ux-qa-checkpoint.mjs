/** Crash-safe checkpoints for headed UX review. These are never approvals. */
import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {summarizeUxCoverage,summarizeScreenshotCoverage} from './ux-qa-coverage.mjs';

export function makeUxQaResumeCheckpoint({
 sourceFingerprint,reviewSessionId,url,headless,coverage,screenshots,findings
}){
 return {
  schema:6,sourceFingerprint,reviewSessionId,
  generatedAt:new Date().toISOString(),url,mode:'supervised',headless,
  stopped:true,summary:summarizeUxCoverage(coverage,findings,true),
  screenshotCoverage:summarizeScreenshotCoverage(screenshots),
  humanReview:{status:'not-reviewed',requiresExplicitApproval:true,evidence:null},
  gallery:null,coverage,screenshots,traces:[],findings
 };
}

/** Atomic replacement for both capture checkpoints and final/human-review reports.
 * A crash while writing must leave the previous resumable JSON intact.
 */
export async function writeUxQaReportAtomic(reportPath,report){
 const destination=resolve(reportPath);
 const temporary=destination+'.tmp-'+process.pid+'-'+randomUUID();
 await mkdir(dirname(destination),{recursive:true});
 try{
  await writeFile(temporary,JSON.stringify(report,null,2)+'\n');
  await rename(temporary,destination);
 }catch(error){
  await rm(temporary,{force:true}).catch(()=>{});
  throw error;
 }
 return report;
}

export async function writeUxQaResumeCheckpoint(reportPath,session){
 return writeUxQaReportAtomic(reportPath,makeUxQaResumeCheckpoint(session));
}

/** A new screenshot set must never inherit a prior human review's session ID.
 * Preserve the ID only when every viewport is reused unchanged.
 */
export function reviewSessionForResume(previousId,reusedViewports,expectedViewports,createId=randomUUID){
 if(!Number.isInteger(reusedViewports)||!Number.isInteger(expectedViewports)||
  expectedViewports<1||reusedViewports<0||reusedViewports>expectedViewports)
  throw Error('Contagem de viewports inválida na retomada.');
 return reusedViewports===expectedViewports?previousId:createId();
}
