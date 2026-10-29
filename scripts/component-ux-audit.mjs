import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {deduplicateAuditFindings, summarizeAuditFindings, auditCoverageFinding, findInspectorControlOverlaps, findInspectorCrossRowOverlaps} from './component-ux-findings.mjs';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const findings=[],coverage=[],screenshots=[];
await mkdir('test-results/ux-audit',{recursive:true});
const emit=(rule,severity,component,detail,context)=>findings.push({rule,severity,component,detail,context});
try{
 for(const theme of ['graphite','studio']){
  for(const width of [1440,1024,768,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   try{
    await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
    await page.locator('#source').waitFor();
    await page.locator('body').evaluate((el,value)=>el.dataset.theme=value,theme);
    const data=await page.evaluate(()=>{
     const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
     const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}};
     const controls=[...document.querySelectorAll('button,input,select,textarea,[role="combobox"],[role="slider"],[role="switch"]')].filter(visible);
     const categories={button:0,input:0,select:0,textarea:0,combobox:0,slider:0,switch:0};
     const violations=[];
     // Compute ID cardinality once: getElementById alone silently accepts
     // duplicate IDs and can resolve the wrong accessible-name target.
     const idCounts=new Map();
     for(const element of document.querySelectorAll('[id]')){
      idCounts.set(element.id,(idCounts.get(element.id)||0)+1);
     }
     // page.evaluate runs in Chromium, not Node: keep DOM lookups local.
     const ids=value=>[...new Set(String(value||'').trim().split(/\s+/).filter(Boolean))];
     const missingAriaReferenceIds=value=>ids(value).filter(id=>!document.getElementById(id));
     const referenceText=id=>{
      const element=document.getElementById(id);
      return element?(element.getAttribute('aria-label')?.trim()||element.textContent?.trim()||''):'';
     };
     for(const control of controls){
      const tag=control.tagName.toLowerCase(),role=control.getAttribute('role');
      categories[role in categories?role:tag]=(categories[role in categories?role:tag]||0)+1;
      const labelledBy=control.getAttribute('aria-labelledby');
      const describedBy=control.getAttribute('aria-describedby');
      const controlledBy=control.getAttribute('aria-controls');
      const brokenControls=missingAriaReferenceIds(controlledBy);
      const brokenLabels=missingAriaReferenceIds(labelledBy);
      const brokenDescriptions=missingAriaReferenceIds(describedBy);
      for(const id of brokenLabels)violations.push({rule:'aria-labelledby-target',severity:'error',component:tag,detail:'Referência de nome acessível inexistente: '+id,html:control.outerHTML.slice(0,190)});
      for(const id of brokenDescriptions)violations.push({rule:'aria-describedby-target',severity:'error',component:tag,detail:'Referência de descrição acessível inexistente: '+id,html:control.outerHTML.slice(0,190)});
      for(const id of brokenControls)violations.push({rule:'aria-controls-target',severity:'error',component:tag,detail:'Controle ARIA aponta para elemento desmontado ou inexistente: '+id,html:control.outerHTML.slice(0,190)});
      for(const id of new Set([...ids(labelledBy),...ids(describedBy),...ids(controlledBy)])){
       if((idCounts.get(id)||0)>1)violations.push({rule:'aria-idref-duplicate',severity:'error',component:tag,detail:'Referência ARIA ambígua (ID duplicado): '+id,html:control.outerHTML.slice(0,190)});
      }
      // aria-labelledby takes precedence over aria-label. An empty existing
      // target cannot be rescued by a fallback title or a visible button label.
      const referencedLabel=ids(labelledBy).map(referenceText).join(' ').trim();
      if(ids(labelledBy).length&&!brokenLabels.length&&!referencedLabel){
       violations.push({rule:'aria-labelledby-empty',severity:'error',component:tag,detail:'Nome acessível aponta somente para referências vazias',html:control.outerHTML.slice(0,190)});
      }
      const label=ids(labelledBy).length?referencedLabel:
       (control.getAttribute('aria-label')?.trim()||control.labels?.[0]?.textContent?.trim()||
       control.getAttribute('title')?.trim()||(tag==='button'?control.textContent.trim():''));
      if(control.closest('[aria-hidden="true"]')&&control.tabIndex>=0&&!control.disabled){
       violations.push({rule:'aria-hidden-focusable',severity:'error',component:tag,detail:'Controle focável dentro de aria-hidden=true',html:control.outerHTML.slice(0,190)});
      }
      if(!label && !['hidden','submit'].includes(control.type)&&!control.closest('[aria-hidden="true"]')){
       violations.push({rule:'accessible-name',severity:'error',component:tag,detail:'Controle visível sem nome acessível',html:control.outerHTML.slice(0,190)});
      }
      const r=rect(control);
      const root=control.closest('.design-inspector,.editor-panel,.preview-panel');
      if(root&&r.width>0){
       const b=rect(root);
       if(r.left<b.left-3||r.right>b.right+3){
        const scroller=control.closest('.markdown-toolbar,[data-scrollable],.overflow-auto');
        const intentional=scroller&&scroller.scrollWidth>scroller.clientWidth+2&&getComputedStyle(scroller).overflowX==='auto';
        violations.push({rule:intentional?'scrollable-toolbar':'control-overflow',severity:intentional?'warning':'error',component:tag,detail:intentional?'Controle fora da área visível dentro de toolbar navegável por rolagem':'Controle ultrapassa a área do painel',html:control.outerHTML.slice(0,190)});
       }
      }
     }
     // Inspect actual rendered control rectangles, not just the row box.
     // This catches stacked steppers, hex fields or segmented buttons while
     // allowing scrollable toolbars and shared one-pixel borders.
     const propertyRows=[...document.querySelectorAll('.design-inspector .ds-property-row')]
      .filter(visible).map((row,index)=>({
       name:row.querySelector('.ds-prop-name')?.textContent?.trim()||'row-'+index,
       controls:[...row.querySelectorAll('button,input,select,textarea,[role="combobox"]')]
        .filter(el=>visible(el)&&!el.closest('[hidden],[aria-hidden="true"],[inert]'))
        .filter(el=>el.getBoundingClientRect().width>=5&&el.getBoundingClientRect().height>=5)
        .map(el=>({
         name:el.getAttribute('aria-label')||el.id||el.textContent?.trim().slice(0,45)||el.tagName,
         rect:(()=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})(),
         html:el.outerHTML.slice(0,160)
        }))
      }));
     const inspector=document.querySelector('.design-inspector');
     const composer=document.querySelector('#inspector-sections');
     return {categories,count:controls.length,violations,propertyRows,inspectorWidth:inspector?.getBoundingClientRect().width||0,
      composerWidth:composer?.getBoundingClientRect().width||0};
    });
    // Keep a viewport screenshot tied to every audited theme/width scenario.
    // Images remain local until a separate, permission-isolated publisher exists.
    const screenshot=`test-results/ux-audit/${theme}-${width}.png`;
    await page.screenshot({path:screenshot,animations:'disabled'});
    screenshots.push({theme,width,path:screenshot});
    coverage.push({theme,width,...{controls:data.count,types:data.categories,inspectorWidth:data.inspectorWidth},screenshot});
    for(const violation of data.violations)emit(violation.rule,violation.severity,violation.component,violation.detail,{theme,width,html:violation.html});
    for(const collision of findInspectorControlOverlaps(data.propertyRows))
     emit('control-overlap','error','inspector',
      'Controles interativos se sobrepõem: '+collision.first+' / '+collision.second+
      ' ('+collision.horizontal+'×'+collision.vertical+'px)',
      {theme,width,row:collision.row,html:collision.html});
    for(const collision of findInspectorCrossRowOverlaps(data.propertyRows))
     emit('cross-row-overlap','error','inspector',
      'Controles de linhas distintas se sobrepõem: '+collision.row+' / '+collision.otherRow+
      ' — '+collision.first+' / '+collision.second+
      ' ('+collision.horizontal+'×'+collision.vertical+'px)',
      {theme,width,row:collision.row,otherRow:collision.otherRow,html:collision.html});
    for(const error of errors)emit('runtime-error','error','app',error,{theme,width});
    const missingCoverage=auditCoverageFinding(data.count,{theme,width});
    if(missingCoverage)findings.push(missingCoverage);
   }finally{await page.close();}
  }
 }
}finally{await browser.close();}
const unique=deduplicateAuditFindings(findings);
const summary=summarizeAuditFindings(unique,coverage);
const report={schema:1,commit:process.env.GITHUB_SHA||'local',generatedAt:new Date().toISOString(),coverage,screenshots,findings:unique,critical:summary.critical,warnings:summary.warnings,scenarioSummary:summary.scenarios};
await mkdir('test-results',{recursive:true});
await writeFile('test-results/component-ux-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('COMPONENT UX AUDIT',JSON.stringify({coverage:coverage.map(x=>x.theme+'/'+x.width+':'+x.controls),critical:report.critical,warnings:report.warnings,scenarioSummary:report.scenarioSummary,findings:unique.slice(0,6)}));
if(report.critical){process.exitCode=1;}
