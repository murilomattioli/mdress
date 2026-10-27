import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {execFileSync} from 'node:child_process';
import {mkdtemp,stat,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const temp=await mkdtemp(join(tmpdir(),'resume-pdf-quality-'));
const metrics=[];
const MAX_BYTES=5*1024*1024;
const base='http://127.0.0.1:4173';

async function openDocument(){
 const page=await browser.newPage({viewport:{width:1500,height:900}});
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('#source').waitFor();
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
 return page;
}
async function setPaperTheme(page,id){
 await page.locator('#designToggle').click();
 await page.locator('[data-inspector-tab="background"]').click();
 await page.locator('.bg-preset[aria-label="Usar fundo '+id+'"]').click();
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
}
async function printScenario(name,{backgroundPreset=null,profile='visual',backgroundMode=null,textMode=null,paper='a4',long=false}={}){
 const page=await openDocument();
 try{
  if(backgroundPreset)await setPaperTheme(page,backgroundPreset);
  if(paper==='letter')await page.locator('#paperSize').selectOption('letter');
  if(long){
   const tail='\n## Experiências complementares\n'+Array.from({length:130},(_,i)=>'- Projeto '+(i+1)+': otimização, React, TypeScript e documentação acessível em aplicações empresariais.').join('\n')+'\n\n## Encerramento\nMARCADOR FINAL MULTIPAGINA';
   await page.locator('#source').fill((await page.locator('#source').inputValue())+tail);
   await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  }
  const expectedStyle=await page.evaluate(async opts=>{
   const {configurePDFPrint}=await import('./pdf-export.js');
   configurePDFPrint(document.body,opts);
   return true;
  },{profile,...backgroundMode?{backgroundMode}:{},...textMode?{textMode}:{},paper});
  assert.equal(expectedStyle,true);
  await page.emulateMedia({media:'print'});
  const computed=await page.locator('#paper').evaluate(el=>{
   const s=getComputedStyle(el);return {color:s.color,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,display:s.display,width:s.width};
  });
  if(profile==='readable'||backgroundMode==='none'){
   assert.equal(computed.backgroundImage,'none',name+' must remove background graphics');
   assert.equal(computed.backgroundColor,'rgb(255, 255, 255)',name+' must print on white');
   assert.equal(computed.color,'rgb(21, 26, 32)',name+' must use dark text');
  }
  if(profile==='visual'&&backgroundPreset==='Soft Mesh'&&!backgroundMode){
   assert.match(computed.backgroundImage,/radial-gradient/);
  }
  if(backgroundMode==='solid')assert.equal(computed.backgroundImage,'none','Solid-only must omit mesh gradients');
  await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  const planned=await page.locator('#pageStack > .paper').count();
  const pdfPath=join(temp,name+'.pdf');
  await page.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true,tagged:true,outline:true,scale:1,displayHeaderFooter:false});
  const size=(await stat(pdfPath)).size;
  assert.ok(size>500,'PDF output is unexpectedly empty');
  assert.ok(size<MAX_BYTES,'PDF above safety budget: '+size+' bytes');
  const extracted=execFileSync('pdftotext',['-enc','UTF-8',pdfPath,'-'],{encoding:'utf8'});
  for(const phrase of ['O título do artigo','Uma introdução para o leitor.','Desenvolva sua ideia','Primeira ideia']){
   assert.ok(extracted.includes(phrase),name+' lost source text: '+phrase);
  }
  if(long)assert.ok(extracted.includes('MARCADOR FINAL MULTIPAGINA'),name+' clipped end of document');
  const info=execFileSync('pdfinfo',[pdfPath],{encoding:'utf8'});
  const pages=Number((info.match(/^Pages:\s*(\d+)/m)||[])[1]||0);
  assert.equal(pages,planned,name+': physical page count differs between preview and PDF');
  const pageSize=(info.match(/^Page size:\s*(.*)$/m)||[])[1]||'';
  assert.ok(pages>=1&&pages<20,name+': unexpected page count '+pages);
  if(long)assert.ok(pages>=2,name+' expected multiple pages');
  const widthPt=Number.parseFloat(pageSize);
  assert.ok(Math.abs(widthPt-(paper==='letter'?612:595.28))<2,name+' physical page size mismatch: '+pageSize);
  const result={name,bytes:size,kib:Math.round(size/1024),pages,paper,profile,backgroundPreset,backgroundMode:backgroundMode||'default',extractedCharacters:extracted.length,within500KiB:size<=500*1024,taggedRequested:true};
  metrics.push(result);
  console.log('PDF QUALITY '+JSON.stringify(result));
 } finally {await page.close();}
}

async function testSemanticNearPageBoundary(){
 const page=await openDocument();
 try{
  const filler=Array.from({length:48},(_,i)=>'Parágrafo anterior '+(i+1)+': experiência em engenharia de interfaces, arquitetura CSS e componentes acessíveis.').join('\n\n');
  const markdown='# Teste de paginação\n\n'+filler+'\n\n## SECAO LIMITE\nPRIMEIRO PARAGRAFO JUNTO AO TITULO\n\n- Item adicional depois do título.';
  await page.locator('#source').fill(markdown);
  await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  await page.locator('[data-workspace-mode="edit"]').click();
  assert.equal(await page.locator('.preview-panel').isVisible(),false,'Editor-only hides preview before print');
  await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  const groups=await page.locator('#pageStack .section-lead').count();
  assert.ok(groups>=1,'Expected at least one semantic group');
  const path=join(temp,'semantic-break.pdf');
  await page.pdf({path,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  const information=execFileSync('pdfinfo',[path],{encoding:'utf8'});
  const count=Number((information.match(/^Pages:\s*(\d+)/m)||[])[1]||0);
  assert.ok(count>=2&&count<=10,'Unreasonable number of pages: '+count);
  let headingPage=-1,leadPage=-1;
  for(let i=1;i<=count;i++){
   const out=execFileSync('pdftotext',['-enc','UTF-8','-f',String(i),'-l',String(i),path,'-'],{encoding:'utf8'});
   if(out.includes('SECAO LIMITE'))headingPage=i;
   if(out.includes('PRIMEIRO PARAGRAFO JUNTO AO TITULO'))leadPage=i;
  }
  assert.ok(headingPage>0&&leadPage>0,'Heading or first block lost');
  assert.equal(headingPage,leadPage,'Heading stranded from first paragraph at page boundary');
  const full=execFileSync('pdftotext',['-enc','UTF-8',path,'-'],{encoding:'utf8'});
  assert.ok(full.includes('Item adicional depois do título.'),'Content removed by pagination');
  console.log('PAGINATION QUALITY '+JSON.stringify({pages:count,headingPage,leadPage,samePage:true,groupedHeadings:groups}));
 } finally {await page.close();}
}


async function testExperienceSectionFlow(){
 const page=await openDocument();
 try{
  // A multi-page professional experience section must fill existing pages,
  // then naturally continue; only the NEXT heading should start a new flow.
  const records=Array.from({length:80},(_,i)=>'Experiência item '+String(i+1).padStart(2,'0')+': implementação de design systems, engenharia frontend e melhorias de acessibilidade em produtos B2B.');
  const markdown='# Currículo de teste\n\n## Experiência Profissional\n\n'+records.join('\n\n')+'\n\n## Formação Acadêmica\n\nCurso de Engenharia de Software. Fim do currículo.';
  await page.locator('#source').fill(markdown);
  await page.locator('#designToggle').click();
  await page.locator('[data-inspector-tab="sections"]').click();
  await page.locator('[data-style-nav="section:1"]').click();
  await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready',{timeout:20000});
  const decorated=await page.locator('#pageStack > .paper .semantic-section[data-section-variant="surface"]').count();
  assert.ok(decorated>=2,'Section style not preserved across multi-page fragmentation');
  const fragments=await page.locator('#pageStack > .paper .semantic-section[data-section-continued=true]').count();
  assert.ok(fragments>=1,'Long styled section did not continue into next page');
  const texts=await page.locator('#pageStack > .paper .page-content').allTextContents();
  assert.ok(texts.length>=2,'Experience fixture should span multiple pages');
  assert.ok(texts.every(x=>x.trim().length>0),'Empty or blank page must not be created');
  assert.ok(texts[0].includes('Experiência Profissional'),'Section heading displaced from initial page');
  assert.ok(texts[0].includes('Experiência item 01'),'Experience content displaced by entire-section keep rule');
  const combined=texts.join(' ');
  for(let i=1;i<=records.length;i++){
   assert.ok(combined.includes('Experiência item '+String(i).padStart(2,'0')),'Lost experience record '+i);
  }
  const educationPage=texts.findIndex(x=>x.includes('Formação Acadêmica'));
  assert.ok(educationPage>=1,'Next section missing from later pages');
  const previousText=texts[educationPage-1];
  assert.ok(previousText.includes('Experiência item'),'Previous page should carry professional experience content before next heading');
  const previewPages=texts.length;
  const path=join(temp,'experience-continuity.pdf');
  await page.pdf({path,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  const info=execFileSync('pdfinfo',[path],{encoding:'utf8'});
  const pages=Number((info.match(/^Pages:\s*(\d+)/m)||[])[1]||0);
  assert.equal(pages,previewPages,'Preview/PDF pages diverged');
  for(let i=1;i<=pages;i++){
   const extracted=execFileSync('pdftotext',['-enc','UTF-8','-f',String(i),'-l',String(i),path,'-'],{encoding:'utf8'});
   assert.ok(extracted.trim().length>20,'Blank PDF page '+i);
  }
  const allText=execFileSync('pdftotext',['-enc','UTF-8',path,'-'],{encoding:'utf8'});
  assert.ok(allText.includes('Experiência item 80'),'Last experience item missing');
  assert.ok(allText.toLocaleLowerCase('pt-BR').includes('formação acadêmica'),'Following heading missing');
  console.log('SECTION FLOW PASS '+JSON.stringify({previewPages,pdfPages:pages,firstPageHasExperience:true,noEmptyPage:true,lastExperiencePreserved:true,styled:true,fragments}));
 } finally {await page.close();}
}

async function testExplicitBreakOnDocumentSection(){
 const page=await openDocument();
 try{
  await page.locator('#designToggle').click();
  await page.locator('[data-inspector-tab="page"]').click();
  const choices=page.locator('#pageBreakList .page-break-option[data-section-break-id^="2:"]');
  assert.ok(await choices.count()>=2,'No markdown sections were found');
  await choices.first().click();
  await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  const count=await page.locator('#pageStack > .paper').count();
  assert.ok(count>=2,'A manual new-page policy did not split the preview');
  const target=join(temp,'mdress-explicit-page-break.pdf');
  await page.pdf({path:target,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  const info=execFileSync('pdfinfo',[target],{encoding:'utf8'});
  const pdfPages=Number((info.match(/^Pages:\s*(\d+)/m)||[])[1]||0);
  assert.equal(pdfPages,count,'Manual break PDF page count diverges from preview');
  const first=execFileSync('pdftotext',['-enc','UTF-8','-f','1','-l','1',target,'-'],{encoding:'utf8'});
  const second=execFileSync('pdftotext',['-enc','UTF-8','-f','2','-l','2',target,'-'],{encoding:'utf8'});
  assert.match(first,/O título do artigo/);
  assert.match(second.toLocaleLowerCase('pt-BR'),/o contexto/);
  assert.doesNotMatch(first.toLocaleLowerCase('pt-BR'),/o contexto/);
  console.log('MANUAL SECTION BREAK PDF PASS '+JSON.stringify({previewPages:count,pdfPages,headingMovedToSecondPage:true}));
 }finally{await page.close();}
}

try{
 await printScenario('visual-minimal');
 await printScenario('visual-soft-mesh',{backgroundPreset:'Soft Mesh'});
 await printScenario('mesh-solid-only',{backgroundPreset:'Soft Mesh',profile:'custom',backgroundMode:'solid'});
 await printScenario('readable-soft-mesh',{backgroundPreset:'Soft Mesh',profile:'readable'});
 await printScenario('long-ats-letter',{backgroundPreset:'Aurora Glow',profile:'readable',paper:'letter',long:true});
 await testExplicitBreakOnDocumentSection();
 await testSemanticNearPageBoundary();
 await testExperienceSectionFlow();
 const comparison=metrics.find(x=>x.name==='visual-soft-mesh').bytes/metrics.find(x=>x.name==='readable-soft-mesh').bytes;
 console.log('MESH/PDF BASELINE '+JSON.stringify({meshToReadableBytesRatio:Number(comparison.toFixed(2)),note:'Browser generated PDF byte sizes; not guaranteed across engines or versions'}));
 await writeFile(join(temp,'metrics.json'),JSON.stringify(metrics,null,2));
 console.log('F009 PASS: browser-generated PDFs retain text and expected pages/profile styling.');
} finally {await browser.close();await rm(temp,{recursive:true,force:true});}
