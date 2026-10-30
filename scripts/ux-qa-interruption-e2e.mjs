/**
 * Linux CI integration: exercise a REAL interactive PTY checkpoint, manual
 * intervention, stop, process restart and resumed capture. Never approves UX.
 * Requires an already running mdress dev server and Chromium from Playwright.
 */
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {strict as assert} from 'node:assert';
import {UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';

const command=spawnSync('script',['--version'],{encoding:'utf8'});
if(process.platform!=='linux'||command.error||command.status!==0)
 throw Error('O teste E2E de interrupção exige util-linux script em Linux.');

const timeoutMs=180000;
async function runInteractive({resume,manual,env}){
 const cmd='node scripts/supervised-ux-qa.mjs --headless'+(resume?' --resume':'');
 const child=spawn('script',['-q','-e','-f','-c',cmd,'/dev/null'],{
  cwd:process.cwd(),env:{...process.env,...env},stdio:['pipe','pipe','pipe'],
  detached:true
 });
 let output='',responded=false,manualSeen=false,finished=false;
 const finish=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{
   try{process.kill(-child.pid,'SIGKILL');}catch{}
   reject(Error('Timeout no runner interativo: '+output.slice(-2000)));
  },timeoutMs);
  const fail=error=>{clearTimeout(timer);reject(error);};
  child.on('error',fail);
  child.on('close',(code,signal)=>{
   finished=true;clearTimeout(timer);
   if(!responded)return reject(Error('Runner terminou sem checkpoint: '+code+'/'+signal+'\n'+output.slice(-3000)));
   resolve({code,signal,output});
  });
 });
 const handle=data=>{
  output+=data.toString('utf8');
  // The first run enters the manual intervention branch, then stops there.
  if(manual&&!responded&&output.includes('ENTER=continuar | m=inspecionar | q=parar > ')){
   responded=true;child.stdin.write('m\n');
  }
  if(manual&&responded&&!manualSeen&&output.includes('ENTER=retomar | q=parar > ')){
   manualSeen=true;child.stdin.write('q\n');
  }
  if(!manual&&!responded&&output.includes('ENTER=continuar | m=inspecionar | q=parar > ')){
   responded=true;child.stdin.write('q\n');
  }
 };
 child.stdout.on('data',handle);
 child.stderr.on('data',handle);
 try{
  const result=await finish;
  assert.equal(result.code,1,'Parada intencional não deve aprovar matriz incompleta. '+output.slice(-1000));
  if(manual)assert.equal(manualSeen,true,'Intervenção manual não foi alcançada.');
  return result;
 }finally{
  if(!finished){try{process.kill(-child.pid,'SIGKILL');}catch{}}
  child.stdin.destroy();
 }
}

const root=await mkdtemp(join(tmpdir(),'mdress-ux-resume-e2e-'));
const env={
 MDRESS_QA_REPORT:join(root,'report.json'),
 MDRESS_QA_DIRECTORY:join(root,'screenshots'),
 MDRESS_AUDIT_URL:process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173'
};
try{
 const first=await runInteractive({resume:false,manual:true,env});
 const before=JSON.parse(await readFile(env.MDRESS_QA_REPORT,'utf8'));
 assert.equal(before.mode,'supervised');
 assert.equal(before.summary.status,'stopped');
 assert.equal(before.coverage.length,1);
 assert.equal(before.screenshots.length,UX_QA_REQUIRED_SCREENSHOTS.length);
 assert.equal(before.coverage[0].theme,'graphite');
 assert.equal(before.coverage[0].width,1440);
 assert.equal(before.coverage[0].scenario,true,'Primeiro viewport precisa passar funcionalmente.');
 assert.equal(before.humanReview.status,'not-reviewed');
 const preserved=new Map(before.screenshots.map(shot=>[shot.path,shot.sha256]));
 const second=await runInteractive({resume:true,manual:false,env});
 const after=JSON.parse(await readFile(env.MDRESS_QA_REPORT,'utf8'));
 assert.match(second.output,/Retomada segura: 1\/8 viewports reutilizados/);
 assert.equal(after.summary.status,'stopped');
 assert.equal(after.coverage.length,2);
 assert.equal(after.coverage[0].width,1440);
 assert.equal(after.coverage[1].width,1024);
 assert.equal(after.coverage[1].scenario,true);
 assert.equal(after.screenshots.length,UX_QA_REQUIRED_SCREENSHOTS.length*2);
 for(const [path,sha] of preserved)
  assert.equal(after.screenshots.find(shot=>shot.path===path)?.sha256,sha,
   'A retomada não pode recapturar o viewport já concluído: '+path);
 assert.notEqual(after.reviewSessionId,before.reviewSessionId,
  'Capturar um viewport adicional deve invalidar revisões da sessão anterior.');
 assert.equal(after.humanReview.status,'not-reviewed');
 assert.equal(after.humanReview.requiresExplicitApproval,true);
 console.log('[UX QA] E2E real aprovado: PTY, intervenção m/q, checkpoint, reinício, 1 viewport reutilizado, 1 novo, sessão rotacionada; sem homologação humana.');
}finally{
 await rm(root,{recursive:true,force:true});
}
