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

export async function writeUxQaResumeCheckpoint(reportPath,session){
 const destination=resolve(reportPath);
 const temporary=destination+'.tmp-'+process.pid+'-'+randomUUID();
 const report=makeUxQaResumeCheckpoint(session);
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
