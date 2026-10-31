import {chromium} from 'playwright';
import {stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sectionPresets} from '../app/section-design.js';
import {backgroundPresets} from '../app/background-presets.js';

/** On-demand calibration: measures real Chromium PDF output per section/background preset.
 * Not part of the standard CI gate (specs/F-013/spec.md §8) — run manually when the cost
 * table in app/pdf-weight.js needs recalibrating. */

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const temp=await mkdtemp(join(tmpdir(),'mdress-weight-calib-'));
const base=process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173';
const results=[];

const jobs=Array.from({length:9},(_,i)=>
`## Empresa ${i+1} — Cargo de Engenharia\nJan 202${i} – Dez 202${i+1}\n\nAtuação em desenvolvimento frontend, arquitetura e produto.\n\n- Entregou funcionalidades X, Y e Z com qualidade.\n- Colaborou com time multidisciplinar em projeto relevante.\n- Melhorou performance e manutenibilidade do sistema.\n\nStack: React, TypeScript, Node.`).join('\n\n');
const referenceMarkdown=`# Nome Completo\nEngenheiro de Software\n\n## Sobre\nResumo profissional curto com duas frases sobre experiência.\n\n## Experiência Profissional\n\n${jobs}\n\n## Formação\nCurso superior em andamento.`;

async function openDocument(){
 const page=await browser.newPage({viewport:{width:1500,height:900}});
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('#source').waitFor();
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
 await page.locator('#source').fill(referenceMarkdown);
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
 return page;
}
async function waitStable(page,selector){
 await page.waitForFunction(sel=>{
  const el=document.querySelector(sel);
  return el&&el.getBoundingClientRect().width>0;
 },selector);
}
async function openDesignPanel(page){
 const panelHidden=await page.locator('#themesView').evaluate(el=>el.classList.contains('hidden'));
 if(panelHidden)await page.locator('#designToggle').click();
}
async function reveal(page,id){await openDesignPanel(page);await page.evaluate(async id=>{const {revealInspectorControl}=await import('/property-inspector.js');revealInspectorControl(id);},id);}
async function setSectionPreset(page,presetId){
 await reveal(page,'sectionStyleGallery');
 await page.locator('#sectionStyleGallery').evaluate(el=>el.showPopover());
 await page.locator('[data-section-preset="'+presetId+'"]').click();
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
}
async function setBackgroundPreset(page,label){
 await reveal(page,'backgroundGallery');
 await page.locator('.bg-preset[aria-label="Usar fundo '+label+'"]').click();
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
}
async function measure(scenario,page){
 await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
 const pages=await page.locator('#pageStack > .paper').count();
 // Count actual decorated sections rather than assuming it matches the 9 job entries —
 // every heading in the reference document gets the same preset when applied via 'all'.
 const decoratedSections=await page.locator('#pageStack [data-section-variant]').count();
 const path=join(temp,scenario.replace(/[^a-z0-9-]/gi,'_')+'.pdf');
 await page.pdf({path,preferCSSPageSize:true,printBackground:true,scale:1,displayHeaderFooter:false});
 const bytes=(await stat(path)).size;
 const kib=Math.round(bytes/1024*10)/10;
 const row={scenario,bytes,kib,pages,decoratedSections,kibPerPage:Math.round(kib/pages*10)/10};
 results.push(row);
 console.log('PDF WEIGHT CALIBRATION '+JSON.stringify(row));
 return row;
}

try{
 const page=await openDocument();
 const baseline=await measure('section:plain',page);
 for(const preset of sectionPresets){
  if(preset.id==='plain')continue;
  await setSectionPreset(page,preset.id);
  const row=await measure('section:'+preset.id,page);
  console.log('  -> kib/occurrence vs baseline ('+row.decoratedSections+' decorated sections): '+Math.round((row.kib-baseline.kib)/row.decoratedSections*10)/10);
 }
 await setSectionPreset(page,'plain');
 for(const preset of backgroundPresets){
  await setBackgroundPreset(page,preset.name);
  const row=await measure('background:'+preset.kind+':'+preset.id,page);
  console.log('  -> kib vs baseline (kind='+preset.kind+'): '+Math.round((row.kib-baseline.kib)*10)/10);
 }
 await page.close();
}finally{
 await browser.close();
 await rm(temp,{recursive:true,force:true});
}
console.log('CALIBRATION DONE, '+results.length+' scenarios');
