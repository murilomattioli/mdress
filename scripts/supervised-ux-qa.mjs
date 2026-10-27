/**
 * UX-023 — supervised inspector/toolbar review.
 * Usage: pnpm dev (another terminal), then pnpm qa:supervised
 * CI: node scripts/supervised-ux-qa.mjs --auto --headless
 * ENTER=continue; m=manual inspection then ENTER; q=stop.
 * Reports and screenshots stay in ignored test-results/.
 */
import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {summarizeUxCoverage} from './ux-qa-coverage.mjs';

const args=new Set(process.argv.slice(2));
const automated=args.has('--auto');
if(!automated&&!stdin.isTTY){
 console.error('[UX QA] O modo supervisionado exige um terminal interativo. Use --auto --headless para CI.');
 process.exit(2);
}
const headless=args.has('--headless');
const url=process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173';
const directory='test-results/ux-audit/supervised';
const findings=[],screenshots=[],coverage=[];
let stopped=false;
class ReviewStopped extends Error {constructor(){super('Interrompido pelo revisor');this.name='ReviewStopped';}}
const io=!automated?createInterface({input:stdin,output:stdout}):null;
async function checkpoint(label){
 console.log('[UX QA] '+label);
 if(!io)return;
 while(true){
  const choice=(await io.question('ENTER=continuar | m=inspecionar | q=parar > ')).trim().toLowerCase();
  if(choice==='q'){stopped=true;throw new ReviewStopped();}
  if(choice==='m'){
   console.log('Inspecione e interaja no navegador. Volte aqui quando terminar.');
   const resume=(await io.question('ENTER=retomar | q=parar > ')).trim().toLowerCase();
   if(resume==='q'){stopped=true;throw new ReviewStopped();}
   return;
  }
  return;
 }
}
async function capture(page,theme,width,name){
 const path=directory+'/'+theme+'-'+width+'-'+name+'.png';
 await page.screenshot({path,animations:'disabled'});
 screenshots.push({theme,width,state:name,path});
 await checkpoint(theme+'/'+width+'/'+name);
}
function error(phase,theme,width,e){
 findings.push({severity:'error',phase,theme,width,message:e?.stack||String(e)});
 console.error('[UX QA] '+phase+': '+(e?.message||e));
}
async function revealInspector(page,tab){
 const target=page.locator('[data-inspector-tab="'+tab+'"]');
 if(!(await target.isVisible())){
  const toggle=page.locator('#designToggle');
  if(await toggle.isVisible())await toggle.click();
  else {
   const rail=page.locator('#railDesign');
   if(await rail.isVisible())await rail.click();
  }
 }
 await target.waitFor({state:'visible',timeout:8000});
 await target.click();
}
async function exercise(page,theme,width){
 await revealInspector(page,'style');
 const range=page.locator('.ds-property-range').filter({has:page.locator('#fontSize')});
 const precise=range.locator('.ds-prop-number');
 await range.scrollIntoViewIfNeeded();
 await capture(page,theme,width,'range-normal');
 await range.hover();await capture(page,theme,width,'range-hover');
 await precise.focus();
 assert.equal(await precise.evaluate(el=>el===document.activeElement),true);
 await capture(page,theme,width,'range-focus');
 const originalRange=await page.locator('#fontSize').inputValue();
 await precise.fill('9999');await precise.dispatchEvent('change');
 assert.equal(await precise.getAttribute('aria-invalid'),'true');
 assert.equal(await range.locator('..').locator('.ds-prop-error').isVisible(),true);
 assert.equal(await page.locator('#fontSize').inputValue(),originalRange,'Invalid range must not mutate the document');
 await capture(page,theme,width,'range-invalid');
 await precise.press('Escape');
 assert.equal(await precise.getAttribute('aria-invalid'),null);
 const color=page.locator('.ds-property-color').filter({has:page.locator('#accentColor')});
 const hex=color.locator('.ds-color-hex');
 await color.scrollIntoViewIfNeeded();
 await hex.focus();await capture(page,theme,width,'color-focus');
 const originalColor=await page.locator('#accentColor').inputValue();
 await hex.fill('#BAD');await hex.dispatchEvent('change');
 assert.equal(await hex.getAttribute('aria-invalid'),'true');
 assert.equal(await color.locator('..').locator('.ds-prop-error').isVisible(),true);
 assert.equal(await page.locator('#accentColor').inputValue(),originalColor);
 await capture(page,theme,width,'color-invalid');
 await hex.press('Escape');
 assert.equal(await hex.getAttribute('aria-invalid'),null);
 const select=page.locator('.ds-property-select').filter({has:page.locator('#fontChoice')});
 const trigger=select.locator('.ds-select-trigger');
 await trigger.scrollIntoViewIfNeeded();await trigger.hover();await capture(page,theme,width,'select-hover');
 await trigger.focus();await trigger.press('ArrowDown');
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 await capture(page,theme,width,'select-open');
 await page.keyboard.press('Escape');
 await page.locator('#fontChoice').evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#fontChoice')?.closest('.ds-property-select')?.querySelector('.ds-select-trigger')?.disabled);
 await capture(page,theme,width,'select-disabled');
 await page.locator('#fontChoice').evaluate(el=>{el.disabled=false;});
 await revealInspector(page,'page');
 const number=page.locator('.ds-property-number').filter({has:page.locator('#marginMm')});
 const input=page.locator('#marginMm');
 await input.scrollIntoViewIfNeeded();
 await input.focus();await capture(page,theme,width,'number-focus');
 const originalNumber=await input.inputValue();
 await input.fill('9999');await input.dispatchEvent('change');
 assert.equal(await input.getAttribute('aria-invalid'),'true');
 assert.equal(await number.locator('..').locator('.ds-prop-error').isVisible(),true);
 await capture(page,theme,width,'number-invalid');
 await input.press('Escape');
 assert.equal(await input.inputValue(),originalNumber);
 assert.equal(await input.getAttribute('aria-invalid'),null);
 const binary=page.locator('.ds-property-binary').filter({has:page.locator('#showPageGuides')});
 const native=page.locator('#showPageGuides');
 await native.evaluate(el=>{el.disabled=true;});
 await page.waitForFunction(()=>[...document.querySelector('#showPageGuides')?.closest('.ds-property-binary')?.querySelectorAll('button')||[]].every(b=>b.disabled));
 await binary.scrollIntoViewIfNeeded();
 await capture(page,theme,width,'binary-disabled');
 await native.evaluate(el=>{el.disabled=false;});
 const boxes=await page.locator('.design-inspector .ds-property-row').evaluateAll(rows=>rows.filter(el=>{
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return r.width>0&&s.display!=='none'&&el.scrollWidth>el.clientWidth+3;
 }).map(el=>({text:el.textContent.trim().slice(0,60),overflow:el.scrollWidth-el.clientWidth})));
 assert.deepEqual(boxes,[],'Inspector property rows must not overflow');
}
async function toolbarAudit(page,theme,width){
 const toolbar=page.locator('.markdown-toolbar');
 await toolbar.waitFor({state:'visible'});
 const rows=await toolbar.locator('.tool-group').evaluateAll(groups=>groups.map(el=>Math.round(el.getBoundingClientRect().top)));
 assert.ok(rows.length>1,'Expected multiple toolbar groups');
 assert.ok(rows.every(y=>y===rows[0]),'Toolbar must not wrap to a second row');
 const hasOverflow=await toolbar.evaluate(el=>el.scrollWidth>el.clientWidth+2);
 if(hasOverflow){
  const next=page.getByRole('button',{name:'Rolar ferramentas para a direita'});
  await next.waitFor({state:'visible'});
  assert.equal(await next.isDisabled(),false);
 }
 await capture(page,theme,width,'toolbar');
 const focus=toolbar.locator('button:not([disabled]),select:not([disabled])').first();
 await focus.focus();
 const outline=await focus.evaluate(el=>getComputedStyle(el).outlineStyle);
 if(outline==='none')findings.push({severity:'warning',phase:'toolbar-focus',theme,width,message:'First toolbar control has no own outline; inspect focus-within feedback'});
 await capture(page,theme,width,'toolbar-focus');
}
await mkdir(directory,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless,slowMo:automated?0:120,args:['--no-sandbox']});
 for(const theme of ['graphite','studio']){
  for(const width of [1440,1024,768]){
   if(stopped)break;
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let toolbarPassed=false,inspectorPassed=false,scenarioPassed=false;
   try{
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('#source').waitFor();
    await page.locator('body').evaluate((el,value)=>el.dataset.theme=value,theme);
    await capture(page,theme,width,'workspace');
    try{await toolbarAudit(page,theme,width);toolbarPassed=true;}catch(e){if(e instanceof ReviewStopped)throw e;error('toolbar',theme,width,e);}
    try{await exercise(page,theme,width);inspectorPassed=true;}catch(e){if(e instanceof ReviewStopped)throw e;error('inspector',theme,width,e);}
    for(const message of errors)findings.push({severity:'error',phase:'runtime',theme,width,message});
    scenarioPassed=toolbarPassed&&inspectorPassed&&errors.length===0;
   }catch(e){if(e instanceof ReviewStopped)stopped=true;else error('scenario',theme,width,e);}
   finally{
    coverage.push({theme,width,scenario:scenarioPassed,inspector:inspectorPassed,toolbar:toolbarPassed,errors:errors.length});
    await page.close();
   }
   if(stopped)break;
  }
  if(stopped)break;
 }
}catch(e){if(!stopped)error('browser','global',0,e);}
finally{
 await browser?.close();
 io?.close();
 const summary=summarizeUxCoverage(coverage,findings,stopped);
 const report={schema:2,generatedAt:new Date().toISOString(),url,mode:automated?'automatic':'supervised',headless,stopped,summary,coverage,screenshots,findings};
 await writeFile('test-results/supervised-ux-qa.json',JSON.stringify(report,null,2)+'\n');
 console.log('[UX QA] report: test-results/supervised-ux-qa.json | status: '+summary.status+' | scenarios: '+summary.passing+'/'+summary.expected+' | screenshots: '+screenshots.length+' | findings: '+findings.length);
 if(summary.status!=='passed')process.exitCode=1;
}
