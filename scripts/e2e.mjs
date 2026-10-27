import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:950}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
 await page.locator('#source').waitFor();
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent!=='Carregando…');
 const source=page.locator('#source');
 assert.ok((await source.inputValue()).includes('O título do artigo'));
 // The Markdown editor must visibly indicate keyboard focus, not suppress its outline.
 await source.focus();
 const editorFocus=await source.evaluate(el=>({visible:el.matches(':focus-visible'),width:getComputedStyle(el).outlineWidth,style:getComputedStyle(el).outlineStyle}));
 assert.equal(editorFocus.visible,true,'Markdown editor should match :focus-visible');
 assert.equal(editorFocus.width,'2px','Markdown editor needs a visible 2px focus ring');
 assert.equal(editorFocus.style,'solid','Markdown editor focus ring must not be suppressed');
 await mkdir('test-results/ux-audit',{recursive:true});
 await page.screenshot({path:'test-results/ux-audit/source-editor-focused.png',animations:'disabled'});
 // The document picker suppresses the native select outline; its container must
 // show focus for keyboard users without highlighting mouse-only or sibling focus.
 await page.locator('#newDoc').focus();
 await page.keyboard.press('Shift+Tab');
 const pickerFocused=await page.locator('#docPicker').evaluate(el=>el.matches(':focus-visible'));
 assert.equal(pickerFocused,true,'Document picker must receive keyboard-visible focus');
 const pickerRing=await page.locator('.document-selector').evaluate(el=>({
  width:getComputedStyle(el).outlineWidth,
  style:getComputedStyle(el).outlineStyle
 }));
 assert.equal(pickerRing.width,'2px','Document picker needs a 2px focus ring');
 assert.equal(pickerRing.style,'solid','Document picker focus ring must be visible');
 await page.locator('.topbar').screenshot({path:'test-results/ux-audit/document-picker-focused.png',animations:'disabled'});
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('.document-selector').evaluate(el=>getComputedStyle(el).outlineStyle),'none','Picker ring must not persist on sibling button focus');
 // Wrap complete groups at split widths, preserving scroll arrows as a narrow-width fallback.
 await page.setViewportSize({width:1024,height:900});
 const toolbar=page.locator('.markdown-toolbar');
 const nextTools=page.getByRole('button',{name:'Rolar ferramentas para a direita'});
 const previousTools=page.getByRole('button',{name:'Rolar ferramentas para a esquerda'});
 await page.waitForFunction(()=>{
  const el=document.querySelector('.markdown-toolbar');
  return el.scrollWidth<=el.clientWidth+2;
 });
 const groupRows=await toolbar.locator('.tool-group').evaluateAll(groups=>groups.map(el=>Math.round(el.getBoundingClientRect().top)));
 assert.ok(groupRows[2]>groupRows[0],'Block actions should wrap onto a visible second row');
 assert.equal(await nextTools.isVisible(),false,'No scroll arrows needed when all groups fit');
 // At exceptionally narrow editor widths, keep overflow discoverable and keyboard reachable.
 await toolbar.evaluate(el=>{el.parentElement.style.width='180px';});
 await nextTools.waitFor({state:'visible'});
 assert.equal(await previousTools.isDisabled(),true);
 await nextTools.click();
 await page.waitForFunction(()=>document.querySelector('.markdown-toolbar').scrollLeft>10);
 assert.equal(await previousTools.isDisabled(),false);
 await previousTools.click();
 await page.waitForFunction(()=>document.querySelector('.markdown-toolbar').scrollLeft<2);
 await toolbar.evaluate(el=>{el.parentElement.style.removeProperty('width');});
 await page.waitForFunction(()=>{
  const el=document.querySelector('.markdown-toolbar');
  return el.scrollWidth<=el.clientWidth+2;
 });
 await page.locator('#headingCommand').focus();
 for(let i=0;i<11;i++)await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.mdCommand),'rule');
 const focusVisible=await toolbar.evaluate(root=>{
  const viewport=root.getBoundingClientRect(),control=document.activeElement.getBoundingClientRect();
  return control.left>=viewport.left-2&&control.right<=viewport.right+2;
 });
 assert.equal(focusVisible,true,'Last toolbar action must be visible on keyboard focus');
 await page.setViewportSize({width:1600,height:950});

 await source.evaluate(el=>el.setSelectionRange(0,0));
 await page.locator('[data-md-command="bold"]').click();
 assert.ok((await source.inputValue()).startsWith('**'));
 await page.locator('#undoEdit').click();
 await page.locator('#redoEdit').click();
 await page.locator('[data-workspace-mode="preview"]').click();
 assert.equal(await page.locator('.workspace').getAttribute('data-mode'),'preview');
 await page.locator('[data-workspace-mode="split"]').click();
 await page.locator('#designToggle').click();
 assert.equal(await page.locator('[data-inspector-tab="style"]').getAttribute('aria-selected'),'true');
 await page.locator('[data-inspector-tab="page"]').click();
 assert.equal(await page.locator('#inspector-page').isVisible(),true);
 assert.ok((await page.locator('#inspectorPageCount').textContent()).includes('página'));
 await page.locator('[data-inspector-tab="background"]').click();
 assert.equal(await page.locator('.bg-preset').count(),15);
 await page.locator('.bg-preset[aria-label="Usar fundo Soft Mesh"]').click();
 assert.equal(await page.locator('#bgKind').inputValue(),'mesh');
 assert.equal(await page.locator('.mesh-handle').count(),3);
 const paper=page.locator('#paper');
 assert.match(await paper.evaluate(el=>getComputedStyle(el).backgroundImage),/radial-gradient/);
 const first=page.locator('.mesh-handle').first();
 await first.scrollIntoViewIfNeeded();
 const before=await first.evaluate(el=>el.style.left);
 const bounds=await first.boundingBox();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 await page.mouse.down();
 await page.mouse.move(bounds.x+bounds.width/2+25,bounds.y+bounds.height/2+15,{steps:5});
 await page.mouse.up();
 assert.notEqual(await page.locator('.mesh-handle').first().evaluate(el=>el.style.left),before);
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
 const beforeAppTheme=await paper.evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.locator('#siteSettings').click();
 await page.locator('#appTheme').selectOption('oled');
 assert.equal(await paper.evaluate(el=>getComputedStyle(el).backgroundColor),beforeAppTheme);
 await page.locator('#settingsDialog button[value="close"]').click();
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
 await page.locator('#designToggle').click();
 await page.locator('[data-inspector-tab="background"]').click();
 assert.equal(await page.locator('#bgKind').inputValue(),'mesh');
 assert.equal(await page.locator('.mesh-handle').count(),3);

 // PDF settings are appearance choices, not a fake "ATS accepted" toggle.

 // Precision property input and keyboard-accessible tab switching.
 await page.locator('[data-inspector-tab="style"]').click();
 const precise=page.locator('.ds-property-range').filter({has:page.locator('#fontSize')}).locator('.ds-prop-number');
 assert.ok(await precise.count());
 await precise.fill('11');
 await precise.dispatchEvent('change');
 assert.equal(await page.locator('#fontSize').inputValue(),'11');

 // Real DS components: select popover, color hex, segmented choices and accordion.
 assert.ok(await page.locator('.ds-property-range').count()>=3);
 assert.ok(await page.locator('.ds-property-select').count()>=1);
 const titleSection=page.locator('#inspector-style .ds-accordion-toggle').first();

 const headingHeight=await titleSection.evaluate(el=>Math.round(el.getBoundingClientRect().height));
 assert.ok(headingHeight>=40&&headingHeight<=46,'Accordion header is too tall: '+headingHeight);
 assert.equal(await titleSection.locator('.ds-accordion-chevron svg path').getAttribute('d'),'m6 9 6 6 6-6');
 assert.equal((await titleSection.locator('.ds-accordion-meta').count()),0,'Non-informative section subtitle should be omitted');
 await titleSection.click();assert.equal(await titleSection.getAttribute('aria-expanded'),'false');
 await titleSection.click();assert.equal(await titleSection.getAttribute('aria-expanded'),'true');
 const themePicker=page.locator('#inspector-style .ds-property-select').filter({has:page.locator('#resumeTheme')}).locator('.ds-select-trigger');
 await themePicker.click();
 assert.equal(await themePicker.getAttribute('aria-expanded'),'true');
 assert.ok(await page.locator('.ds-select-popover [role="option"]').count()>=7);
 // Arrow navigation must expose a visible focus indicator inside the portaled listbox.
 await page.keyboard.press('ArrowDown');
 const focusedThemeOption=page.locator('.ds-select-popover [role="option"]:focus-visible');
 assert.equal(await focusedThemeOption.count(),1,'Inspector listbox needs keyboard-visible option focus');
 const optionFocus=await focusedThemeOption.evaluate(el=>({
  width:getComputedStyle(el).outlineWidth,
  style:getComputedStyle(el).outlineStyle
 }));
 assert.equal(optionFocus.width,'2px','Inspector option needs a 2px focus ring');
 assert.equal(optionFocus.style,'solid','Inspector option focus ring must not be suppressed');
 await page.locator('.ds-select-popover').screenshot({path:'test-results/ux-audit/inspector-select-option-focused.png',animations:'disabled'});
 await page.locator('.ds-select-option').filter({hasText:'Swiss'}).click();
 assert.equal(await page.locator('#resumeTheme').inputValue(),'swiss');
 const colorControl=page.locator('.ds-property-color').filter({has:page.locator('#accentColor')});
 const colorHex=colorControl.locator('.ds-color-hex');
 const previousAccent=await page.locator('#accentColor').inputValue();
 await colorHex.fill('#BAD');await colorHex.dispatchEvent('change');
 assert.equal(await colorHex.inputValue(),'#BAD','Invalid hex must stay editable instead of silently reverting');
 assert.equal(await colorHex.getAttribute('aria-invalid'),'true','Invalid color needs accessible feedback');
 assert.equal(await page.locator('#accentColor').inputValue(),previousAccent,'Invalid hex must not update document color');
 await colorControl.screenshot({path:'test-results/ux-audit/inspector-color-invalid.png',animations:'disabled'});
 await colorHex.fill('#A1744B');await colorHex.dispatchEvent('change');
 assert.equal(await colorHex.getAttribute('aria-invalid'),null,'Valid color must clear the error state');
 assert.equal((await page.locator('#accentColor').inputValue()).toLowerCase(),'#a1744b');
 await colorHex.fill('invalid');await colorHex.dispatchEvent('change');
 await colorHex.press('Escape');
 assert.equal(await colorHex.getAttribute('aria-invalid'),null,'Escape must clear the error state');
 assert.equal((await colorHex.inputValue()).toLowerCase(),'#a1744b','Escape must restore the committed color');
 const fontPicker=page.locator('.ds-property-select').filter({has:page.locator('#fontChoice')});
 await fontPicker.locator('.ds-select-trigger').click();
 await page.locator('.ds-select-popover .ds-select-option').filter({hasText:'Consolas'}).click();
 assert.equal(await page.locator('#fontChoice').inputValue(),'mono');
 await fontPicker.locator('.ds-select-trigger').click();
 await page.locator('.ds-select-popover .ds-select-option').filter({hasText:'Palatino'}).click();
 assert.equal(await page.locator('#fontChoice').inputValue(),'palatino');
 await page.locator('[data-inspector-tab="page"]').click();
 const paginationAccordion=page.locator('#inspector-page .ds-accordion-toggle').filter({hasText:'Paginação'});
 await paginationAccordion.click();
 assert.equal(await paginationAccordion.getAttribute('aria-expanded'),'false');
 assert.ok(await paginationAccordion.locator('.ds-accordion-meta').count()===0);
 const closedHeight=await paginationAccordion.locator('..').evaluate(el=>el.getBoundingClientRect().height);
 assert.ok(closedHeight<=47,'Closed accordion leaves empty section spacing: '+closedHeight);
 await paginationAccordion.click();
 assert.equal(await paginationAccordion.getAttribute('aria-expanded'),'true');
 assert.ok(await page.locator('#inspectorPageCount').isVisible(),'Page status hidden in expanded panel');
 const marginInput=page.locator('#marginMm');
 const marginControl=page.locator('.ds-property-number').filter({has:marginInput});
 const beforeMargin=Number(await marginInput.inputValue());
 await marginControl.getByRole('button',{name:'Aumentar Margens'}).click();
 assert.equal(Number(await marginInput.inputValue()),beforeMargin+1);
 const savedMargin=await marginInput.inputValue();
 await marginInput.fill('99');await marginInput.dispatchEvent('change');
 assert.equal(await marginInput.inputValue(),'99','Out-of-range margin must remain editable');
 assert.equal(await marginInput.getAttribute('aria-invalid'),'true','Invalid numeric value needs accessible feedback');
 assert.equal(await marginControl.getByRole('button',{name:'Aumentar Margens'}).isDisabled(),true,'Stepper must not commit an invalid draft');
 await marginControl.screenshot({path:'test-results/ux-audit/inspector-number-invalid.png',animations:'disabled'});
 await marginInput.press('Escape');
 assert.equal(await marginInput.inputValue(),savedMargin,'Escape must restore the committed numeric value');
 assert.equal(await marginInput.getAttribute('aria-invalid'),null);
 await marginInput.fill('');await marginInput.dispatchEvent('change');
 assert.equal(await marginInput.getAttribute('aria-invalid'),'true','Empty numeric value must be rejected');
 await marginInput.fill('12.5');await marginInput.dispatchEvent('change');
 assert.equal(await marginInput.getAttribute('aria-invalid'),'true','Numeric step mismatch must be rejected');
 await marginInput.fill(String(beforeMargin));await marginInput.dispatchEvent('change');
 assert.equal(await marginInput.getAttribute('aria-invalid'),null,'Valid numeric correction must clear the error');
 assert.equal(Number(await marginInput.inputValue()),beforeMargin);
 const rules=page.locator('.ds-property-segment').filter({has:page.locator('#sectionRule')});
 await rules.getByRole('button',{name:'Bloco'}).click();
 assert.equal(await page.locator('#sectionRule').inputValue(),'block');
 const guides=page.locator('.ds-property-binary').filter({has:page.locator('#showPageGuides')});
 await guides.getByRole('button',{name:'Marcações de página desligado'}).click();
 assert.equal(await page.locator('#showPageGuides').isChecked(),false);
 assert.ok(await page.locator('#pageStack').evaluate(el=>el.classList.contains('hide-page-guides')));
 await guides.getByRole('button',{name:'Marcações de página ligado'}).click();
 assert.equal(await page.locator('#showPageGuides').isChecked(),true);

 await page.locator('[data-inspector-tab="style"]').click();
 await page.locator('[data-inspector-tab="style"]').focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('[data-inspector-tab="sections"]').getAttribute('aria-selected'),'true');
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('[data-inspector-tab="page"]').getAttribute('aria-selected'),'true');
 await page.locator('[data-inspector-tab="background"]').click();
 assert.ok(await page.locator('.ds-property-range').filter({has:page.locator('#bgOpacity')}).count());
 await page.locator('#printPDF').click();
 await page.locator('input[name="pdfPreset"][value="light"]').check();
 assert.equal(await page.locator('#pdfBackgroundMode').inputValue(),'solid');
 await page.locator('input[name="pdfPreset"][value="contrast"]').check();
 assert.equal(await page.locator('#pdfBackgroundMode').inputValue(),'none');
 assert.equal(await page.locator('#pdfTextMode').inputValue(),'dark');
 await page.locator('#pdfBackgroundMode').selectOption('full');
 assert.equal(await page.locator('#pdfSelectionStatus').textContent(),'Personalizado');
 await page.locator('#pdfPaper').selectOption('letter');
 await page.locator('#pdfCheckFile').setInputFiles([
  {name:'visual.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(43296,0)},
  {name:'simplified.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(37483,0)}
 ]);
 assert.match(await page.locator('#pdfSizeResult').textContent(),/42.3 KB/);
 assert.match(await page.locator('#pdfSizeResult').textContent(),/Diferença entre maior e menor/);
 await page.locator('#exportSettingsDialog button[value="cancel"]').click();
 // Heading + first paragraph/list item are grouped for print without modifying Markdown.
 assert.ok(await page.locator('#rendered .section-lead').count()>0);

 // Actual page stack—not a continuous A4-looking sheet.
 await page.locator('[data-workspace-mode="split"]').click();
 assert.equal(await page.locator('.workspace').getAttribute('data-mode'),'split');
 const longDoc='# Paginação real\n\n'+Array.from({length:125},(_,i)=>'## Seção '+(i+1)+'\nConteúdo da seção '+(i+1)+' com texto selecionável, Markdown real e fluxo paginado.').join('\n\n')+'\n\n## Final\nMARCADOR TESTE ULTIMA PAGINA';
 // A 125-section fixture is injected as one native input event; real interactive
 // typing/selection was verified earlier in this test, so no 30s actionability
 // wait is needed for an artificial bulk paste.
 await source.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},longDoc);
 await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready',{timeout:15000});
 const sheets=page.locator('#pageStack > .paper');
 const count=await sheets.count();
 assert.ok(count>=3,'Expected 3+ real preview sheets, got '+count);
 assert.equal(await page.locator('#pageCounter').textContent(),count+' páginas');
 const check=await page.locator('.page-content').evaluateAll(elements=>elements.map(el=>({height:el.clientHeight,scroll:el.scrollHeight,text:el.textContent.length})));
 for(const p of check)assert.ok(p.scroll<=p.height+2,'Page overflow: '+JSON.stringify(p));
 const text=await page.locator('#pageStack .page-content').allTextContents();
 assert.match(text.join(' '),/MARCADOR TESTE ULTIMA PAGINA/);
 await page.locator('#nextPage').click();assert.equal(await page.locator('#currentPage').textContent(),'2 / '+count);
 await page.locator('#paperSize').selectOption('letter');
 await page.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
 assert.ok((await page.locator('#pageStack > .paper').count())>=3);

 // Studio v3 visual layout contract and actual component behaviors.
 assert.ok(await page.locator('ds-icon svg').count()>=12,'Design System icons failed to mount');
 assert.ok(await page.locator('.brand-wordmark').isVisible(),'Brand wordmark missing');
 assert.ok(await page.locator('.source-gutter span').count()>=3,'Editor line gutter missing');
 assert.ok(await page.locator('#outlineList button').count()>=1,'Markdown headings outline missing');
 const beforeWidth=await page.locator('.editor-panel').evaluate(el=>el.getBoundingClientRect().width);
 const separator=page.locator('#editorSplitter');await separator.focus();await page.keyboard.press('ArrowRight');
 const newWidth=await page.locator('.editor-panel').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(newWidth>beforeWidth,'Editor splitter keyboard resize failed');
 await page.locator('#documentMenuToggle').click();
 assert.equal(await page.locator('#documentMenu').isVisible(),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#documentMenu').isVisible(),false);
 await page.locator('#zoomFit').click();
 const fitted=Number(await page.locator('#zoom').inputValue());
 assert.ok(fitted>=0.4&&fitted<=1,'Canvas fit produced invalid zoom: '+fitted);
 await page.locator('#zoomIn').click();
 assert.ok(Number(await page.locator('#zoom').inputValue())>fitted,'Zoom-in button not functional');
 if(!(await page.locator('.design-inspector').isVisible()))await page.locator('#designToggle').click();
 assert.ok(await page.locator('.design-inspector').isVisible(),'Inspector toggle failed');
 const inspectorWidth=await page.locator('.design-inspector').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(inspectorWidth>=260&&inspectorWidth<=480,'Inspector dimensions invalid');
 await page.locator('#inspectorSplitter').focus();
 await page.keyboard.press('ArrowLeft');
 const resizedInspector=await page.locator('.design-inspector').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(resizedInspector>inspectorWidth,'Inspector splitter keyboard resize failed');
 // No inaccessible overflow at standard desktop widths.
 for(const width of [1366,1600]){
  await page.setViewportSize({width,height:900});
  const chrome=await page.evaluate(()=>{
   const header=document.querySelector('.topbar'),left=document.querySelector('.appbar-leading'),right=document.querySelector('.appbar-actions');
   return {header:header.getBoundingClientRect().width,leftRight:left.getBoundingClientRect().right,rightLeft:right.getBoundingClientRect().left};
  });
  assert.ok(chrome.leftRight+10<chrome.rightLeft,'Top bar controls overlap at '+width+'px: '+JSON.stringify(chrome));
 }
 // On narrow viewport, the user can explicitly switch to the page canvas.
 await page.setViewportSize({width:390,height:844});
 await page.locator('#railCanvas').click();
 assert.equal(await page.locator('.workspace').getAttribute('data-mode'),'preview');
 assert.ok(await page.locator('.preview-panel').isVisible(),'Mobile canvas entry failed');
 await page.setViewportSize({width:1600,height:950});
 await page.locator('[data-workspace-mode="split"]').click();
 await page.locator('#designToggle').click();

 // mdress: Any Markdown document. Preview section breaks, theme locks and IA guidance.
 const mdress=await browser.newPage({viewport:{width:1500,height:900}});
 try{
  await mdress.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await mdress.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  assert.match(await mdress.title(),/mdress/);
  assert.match(await mdress.locator('#source').inputValue(),/O título do artigo/);
  await mdress.locator('#designToggle').click();
  await mdress.locator('[data-inspector-tab="style"]').click();
  assert.ok(await mdress.locator('.theme-recipe-card').count()>=9);
  const beforeAccent=await mdress.locator('#accentColor').inputValue();
  await mdress.locator('[data-theme-lock="colors"]').click();
  const colorLock=mdress.locator('[data-theme-lock="colors"]');
  assert.equal(await colorLock.getAttribute('aria-pressed'),'true');
  assert.equal(await colorLock.locator('.theme-lock-icon ds-icon').getAttribute('name'),'lock');
  assert.match(await colorLock.getAttribute('title'),/Travado/);
  await mdress.locator('.theme-recipe-card[data-recipe-id="noir-copper"]').click();
  assert.equal(await mdress.locator('#accentColor').inputValue(),beforeAccent,'Palette lock failed');
  await mdress.locator('#shuffleTheme').click();
  assert.equal(await mdress.locator('#accentColor').inputValue(),beforeAccent,'Shuffle ignored palette lock');

  // One-click color-only variation must preserve ALL non-color design properties.
  await mdress.locator('[data-theme-lock="colors"]').click();
  const beforeColors=await mdress.evaluate(()=>{
   const d=window.indexedDB; // assertions read rendered native controls, not DB internals
   const input=id=>document.getElementById(id).value;
   return {font:input('fontChoice'),size:input('fontSize'),margin:input('marginMm'),line:input('lineHeight'),
    section:input('sectionGapEm'),titleScale:input('titleScale'),rule:input('sectionRule'),
    kind:input('bgKind'),angle:input('bgAngle'),patternSize:input('bgPatternSize'),
    opacity:input('bgOpacity'),accent:input('accentColor'),background:input('backgroundColor')};
  });
  await mdress.locator('#shuffleColors').click();
  const afterColors=await mdress.evaluate(()=>{
   const input=id=>document.getElementById(id).value;
   return {font:input('fontChoice'),size:input('fontSize'),margin:input('marginMm'),line:input('lineHeight'),
    section:input('sectionGapEm'),titleScale:input('titleScale'),rule:input('sectionRule'),
    kind:input('bgKind'),angle:input('bgAngle'),patternSize:input('bgPatternSize'),
    opacity:input('bgOpacity'),accent:input('accentColor'),background:input('backgroundColor')};
  });
  for(const key of ['font','size','margin','line','section','titleScale','rule','kind','angle','patternSize','opacity'])
   assert.equal(afterColors[key],beforeColors[key],'Color-only shuffle changed '+key);
  assert.ok(afterColors.background!==beforeColors.background||afterColors.accent!==beforeColors.accent,'Color-only shuffle did not change any visible palette color');
  assert.equal(await mdress.locator('#surpriseColorSwatches .theme-palette-swatch').count(),4);
  // Lock paper/background: palette changes must preserve document paper color.
  await mdress.locator('[data-theme-lock="background"]').click();
  const lockedPaper=await mdress.locator('#backgroundColor').inputValue();
  await mdress.locator('#shuffleColors').click();
  assert.equal(await mdress.locator('#backgroundColor').inputValue(),lockedPaper,'Color-only ignored background lock');
  // Lock the foreground palette too: there are no unlocked colors to change.
  await mdress.locator('[data-theme-lock="colors"]').click();
  assert.equal(await mdress.locator('#shuffleColors').isDisabled(),true);
  await mdress.locator('[data-theme-lock="colors"]').click();
  await mdress.locator('[data-theme-lock="background"]').click();

  await mdress.locator('[data-inspector-tab="ai"]').click();
  await mdress.locator('[data-ai-brief]').first().click();
  assert.match(await mdress.locator('#agentBrief').inputValue(),/Editorial sofisticado/);
  await mdress.locator('[data-inspector-tab="page"]').click();
  const heading=mdress.locator('#pageBreakList .page-break-option[data-section-break-id^="2:"]').first();
  assert.ok(await heading.count(),'No section break choices');
  await heading.click();
  assert.equal(await heading.getAttribute('aria-pressed'),'true');
  await mdress.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  assert.ok((await mdress.locator('#pageStack > .paper').count())>=2,'New section did not start page');
  await mdress.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  await mdress.reload({waitUntil:'networkidle'});
  await mdress.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  await mdress.locator('#designToggle').click();
  await mdress.locator('[data-inspector-tab="page"]').click();
  assert.equal(await mdress.locator('#pageBreakList .page-break-option[data-section-break-id^="2:"]').first().getAttribute('aria-pressed'),'true','Page break not persisted');

  // The same policy can be changed from the source outline; no Markdown edits.
  const sourceBefore=await mdress.locator('#source').inputValue();
  await mdress.locator('#outlineDisclosure > summary').click();
  const outlineBreak=mdress.locator('.outline-break-toggle[data-section-break-id^="2:"]').first();
  assert.equal(await outlineBreak.getAttribute('aria-pressed'),'true');
  await outlineBreak.click();
  assert.equal(await outlineBreak.getAttribute('aria-pressed'),'false');
  await mdress.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  assert.equal(await mdress.locator('#source').inputValue(),sourceBefore);
  // Activate a rule directly on its preview heading.
  const previewAction=mdress.locator('#pageStack .section-break-control[aria-label*="O contexto"]');
  await mdress.locator('#pageStack .section-lead').filter({has:mdress.locator('h2')}).first().hover();
  await previewAction.click();
  assert.equal(await mdress.locator('#source').inputValue(),sourceBefore);
  await mdress.locator('[data-inspector-tab="page"]').click();
  const toggled=mdress.locator('#pageBreakList .page-break-option[aria-pressed=true]');
  assert.ok(await toggled.count()>=1);

  await mdress.locator('#newDoc').click();
  await mdress.locator('#newDocumentStarter').selectOption('documentation');
  await mdress.locator('#newDocumentName').fill('Meu guia de configuração');
  await mdress.locator('#newDocumentForm button[type="submit"]').click();
  await mdress.waitForFunction(()=>document.querySelector('#source')?.value.startsWith('# Guia do projeto'));
  assert.match(await mdress.locator('#source').inputValue(),/Instalação/);

  // Per-section styling: first a global recipe, then a local override.
  await mdress.locator('[data-inspector-tab="sections"]').click();
  const composer=mdress.locator('#inspector-sections');
  const composerDimensions=await composer.evaluate(root=>{
    const bounds=root.getBoundingClientRect();
    const nodes=['.composer-mode-switch','#sectionStyleTarget','#sectionStyleControl'].map(query=>root.querySelector(query));
    return nodes.map(node=>{const r=node.getBoundingClientRect();return {overflow:r.left<bounds.left-2||r.right>bounds.right+2,height:r.height};});
  });
  assert.ok(composerDimensions.every(x=>!x.overflow),'Composer controls must fit inspector width');
  assert.ok(composerDimensions[2].height<=43,'Preset control is too tall');

  assert.ok(await composer.locator('.section-style-preset').count()>=8);
  await composer.locator('[data-style-gallery="section"]').click();
  await composer.locator('[data-section-preset="surface"]').click();
  await mdress.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  assert.ok(await mdress.locator('#pageStack .semantic-section[data-section-variant="surface"]').count()>=1);
  const secondNamedSection=await composer.locator('#sectionStyleTarget').evaluate(el=>[...el.options].filter(option=>option.value.startsWith('2:'))[1]?.value);
  assert.ok(secondNamedSection,'Named H2 sections should remain selectable alongside level scopes');
  await composer.locator('#sectionStyleTarget').selectOption(secondNamedSection);
  await composer.locator('[data-section-preset="band"]').click();
  assert.ok(await mdress.locator('#pageStack .semantic-section[data-section-variant="band"]').count()>=1);
  assert.ok(await mdress.locator('#pageStack .semantic-section[data-section-variant="surface"]').count()>=1,'Local styling changed sibling sections');
  await composer.locator('[data-section-density="airy"]').click();
  assert.equal(await composer.locator('[data-section-density="airy"]').getAttribute('aria-pressed'),'true');
  const sourceBeforeComposer=await mdress.locator('#source').inputValue();
  await mdress.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  await mdress.reload({waitUntil:'networkidle'});
  await mdress.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='Salvo localmente');
  await mdress.locator('#designToggle').click();
  await mdress.locator('[data-inspector-tab="sections"]').click();
  assert.equal(await mdress.locator('#source').inputValue(),sourceBeforeComposer,'Styling mutated Markdown');
  assert.equal(await mdress.locator('.section-style-density button[data-section-density="airy"]').getAttribute('aria-pressed'),'true','Section density not persisted');
  assert.ok(await mdress.locator('#pageStack .semantic-section[data-section-variant="band"]').count()>=1,'Section override not persisted');
  const button=mdress.locator('#pageStack .section-design-action').first();
  assert.ok(await button.count(),'Preview must offer a section styling affordance');
  await button.click({force:true});
  assert.equal(await mdress.locator('[data-inspector-tab="sections"]').getAttribute('aria-selected'),'true');
  await mdress.locator('[data-view="ats"]').click();
  assert.match(await mdress.locator('#atsView').textContent(),/Revisão do Markdown/);
 } finally {await mdress.close();}
 // Regression: a short H2 section fits on page 1, but a nested H3 has an explicit page break.
 const regression=await browser.newPage({viewport:{width:1500,height:960}});
 try{
  await regression.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await regression.locator('#source').waitFor();
  await regression.locator('#source').fill('# Documento\n\n## Experiência Profissional\nIntrodução da seção.\n\n### Big2be\nConteúdo da empresa.\n\n### Outra empresa\nConteúdo seguinte.');
  await regression.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  await regression.locator('#designToggle').click();
  await regression.locator('[data-inspector-tab="page"]').click();
  await regression.locator('#pageBreakList .page-break-option[data-section-break-id^="3:big2be:"]').click();
  await regression.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready'&&document.querySelectorAll('#pageStack>.paper').length>=2);
  const pages=await regression.locator('#pageStack>.paper').allTextContents();
  assert.match(pages[0],/Experiência Profissional/);
  assert.doesNotMatch(pages[0],/Big2be/,'Explicit H3 break must prevent nested heading from staying on previous page');
  assert.match(pages[1],/Big2be/);
  // The parent H2 should also be able to start its own page independently.
  await regression.locator('#pageBreakList .page-break-option[data-section-break-id^="2:experiência profissional:"]').click();
  await regression.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready'&&document.querySelectorAll('#pageStack>.paper').length>=3);
  const parentPages=await regression.locator('#pageStack>.paper').allTextContents();
  assert.doesNotMatch(parentPages[0],/Experiência Profissional/);
  assert.match(parentPages[1],/Experiência Profissional/);
  assert.doesNotMatch(parentPages[1],/Big2be/);
  assert.match(parentPages[2],/Big2be/);
  const original=await regression.locator('#source').inputValue();
  assert.ok(original.includes('### Big2be'),'Page breaks must not rewrite Markdown');
 }finally{await regression.close();}
 // Bidirectional scroll sync follows rendered heading landmarks across physical pages.
 const syncPage=await browser.newPage({viewport:{width:1600,height:900}});
 try{
  await syncPage.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await syncPage.locator('#source').waitFor();
  const markdown=Array.from({length:8},(_,i)=>'## Capítulo '+(i+1)+'\n\n'+Array.from({length:6},(_,j)=>'Parágrafo '+j+' '+('Texto de exemplo para testar a paginação e o alinhamento. '.repeat(2))).join('\n\n')).join('\n\n');
  await syncPage.locator('#source').fill('# Documento\n\n'+markdown);
  await syncPage.locator('[data-workspace-mode="split"]').click();
  await syncPage.waitForFunction(()=>document.querySelectorAll('#pageStack [data-section-id]').length>=3&&document.querySelector('#source').scrollHeight>document.querySelector('#source').clientHeight);
  await syncPage.locator('#pageStack').evaluate(el=>el.style.setProperty('--preview-zoom','1.5'));
  await syncPage.waitForFunction(()=>document.querySelector('.preview-scroll').scrollHeight>document.querySelector('.preview-scroll').clientHeight);
  await syncPage.locator('#source').evaluate(el=>{el.scrollTop=el.scrollHeight*.65;el.dispatchEvent(new Event('scroll'));});
  await syncPage.waitForFunction(()=>document.querySelector('.preview-scroll').scrollTop>30);
  await syncPage.locator('.preview-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight*.9;el.dispatchEvent(new Event('scroll'));});
  await syncPage.waitForFunction(()=>document.querySelector('#source').scrollTop>document.querySelector('#source').scrollHeight*.45);
 }finally{await syncPage.close();}
 // Individual preview styling: only the clicked item changes, including its marker.
 const elementPage=await browser.newPage({viewport:{width:1600,height:950}});
 try{
  await elementPage.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await elementPage.locator('#source').fill('# Lista\n\n- Primeiro item\n- Segundo item\n- Terceiro item');
  await elementPage.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  await elementPage.locator('#pageStack li[data-md-element-id="li:2"]').click();
  assert.match(await elementPage.locator('#markdownElementScope').textContent(),/Somente Item de lista #2/);
  assert.ok(await elementPage.locator('#previewStyleControl').isVisible());
  for(let step=0;step<4;step++)await elementPage.locator('#previewStyleControl [data-preview-style-step="1"]').click();
  assert.match(await elementPage.locator('#elementStyleCurrent').textContent(),/Glass/);
  await elementPage.waitForFunction(()=>document.querySelector('#paginationStatus')?.dataset.status==='ready');
  assert.equal(await elementPage.locator('#pageStack li[data-md-element-id="li:2"]').getAttribute('data-md-element-style'),'glass');
  assert.equal(await elementPage.locator('#pageStack li[data-md-element-id="li:1"]').getAttribute('data-md-element-style'),null);
  const markerStyle=await elementPage.locator('#pageStack li[data-md-element-id="li:2"]').evaluate(el=>({
   position:getComputedStyle(el,'::before').position,content:getComputedStyle(el,'::before').content,
   padding:getComputedStyle(el).paddingLeft
  }));
  assert.equal(markerStyle.position,'absolute');
  assert.ok(markerStyle.content.includes('●'));
  assert.ok(parseFloat(markerStyle.padding)>20);
  await elementPage.locator('[data-preview-style-properties]').click();
  await elementPage.locator('[data-element-property="fontSize"]').fill('24');
  await elementPage.locator('[data-element-property="fontSize"]').dispatchEvent('change');
  await elementPage.waitForFunction(()=>document.querySelector('#pageStack li[data-md-element-id="li:2"]')?.style.fontSize==='24px');
  assert.notEqual(await elementPage.locator('#pageStack li[data-md-element-id="li:1"]').evaluate(el=>el.style.fontSize),'24px');
  await elementPage.locator('[data-preview-style-reset]').click();
  await elementPage.waitForFunction(()=>!document.querySelector('#pageStack li[data-md-element-id="li:2"]')?.dataset.mdElementStyle);
  assert.equal(await elementPage.locator('#pageStack li[data-md-element-id="li:2"]').evaluate(el=>el.style.fontSize),'');
  assert.ok((await elementPage.locator('#source').inputValue()).includes('- Segundo item'));
  await elementPage.locator('#markdownElementAll').click();
  assert.match(await elementPage.locator('#markdownElementScope').textContent(),/Todos os elementos/);
 }finally{await elementPage.close();}
 // Source toolbar must form one contiguous editing cluster, never split ends.
 const toolbarPage=await browser.newPage({viewport:{width:1700,height:900}});
 try{
  await toolbarPage.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await toolbarPage.locator('#source').waitFor();
  const metrics=await toolbarPage.locator('.markdown-toolbar').evaluate(el=>{
   const groups=[...el.querySelectorAll('.tool-group')].map(node=>node.getBoundingClientRect());
   const container=el.getBoundingClientRect();
   return {gap:groups[2].left-groups[1].right,first:groups[0].left-container.left,last:groups[2].right-container.left,width:container.width};
  });
  assert.ok(metrics.gap<20,'Block editing actions should sit next to inline formatting');
  assert.ok(metrics.last<700,'Formatting actions should not be aligned to opposite edge');
  await toolbarPage.setViewportSize({width:770,height:760});
  const scroll=await toolbarPage.locator('.markdown-toolbar').evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));
  assert.ok(scroll.content>=scroll.width,'Toolbar must remain independently scrollable on narrower viewports');
 }finally{await toolbarPage.close();}
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/workspace-mesh.png',fullPage:true});

 // UX review evidence is a separate artifact from functional smoke assertions.
 const ux=await browser.newPage({viewport:{width:1440,height:900}});
 try{
  await ux.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await ux.locator('#source').waitFor();
  await ux.locator('#designToggle').click();
  await ux.locator('[data-inspector-tab="sections"]').click();
  // Capture component states as actual rendered browser images for design review.
  await ux.locator('body').evaluate(el=>el.dataset.theme='graphite');
  await ux.setViewportSize({width:1440,height:900});
  const sourceToolbar=ux.locator('.markdown-toolbar');
  await sourceToolbar.screenshot({path:'test-results/component-toolbar-default.png',animations:'disabled'});
  await ux.locator('[data-md-command="bold"]').hover();
  await sourceToolbar.screenshot({path:'test-results/component-toolbar-hover.png',animations:'disabled'});
  await ux.locator('[data-md-command="bold"]').focus();
  await sourceToolbar.screenshot({path:'test-results/component-toolbar-focus.png',animations:'disabled'});
  const inspector=ux.locator('.design-inspector');
  if(await inspector.isVisible())await inspector.screenshot({path:'test-results/component-inspector-graphite.png',animations:'disabled'});
  const sectionControl=ux.locator('#sectionStyleControl');
  if(await sectionControl.isVisible())await sectionControl.screenshot({path:'test-results/component-preset-picker.png',animations:'disabled'});
  await ux.locator('body').evaluate(el=>el.dataset.theme='studio');
  if(await inspector.isVisible())await inspector.screenshot({path:'test-results/component-inspector-studio.png',animations:'disabled'});
  for(const [name,width,height,theme] of [
   ['desktop-graphite',1440,900,'graphite'],
   ['desktop-oled',1440,900,'oled'],
   ['compact-graphite',1024,768,'graphite'],
   ['narrow-graphite',768,800,'graphite']
  ]){
   await ux.setViewportSize({width,height});
   await ux.locator('body').evaluate((el,value)=>el.dataset.theme=value,theme);
   await ux.screenshot({path:'test-results/ux-'+name+'.png',fullPage:true,animations:'disabled'});
  }
 }finally{await ux.close();}

 assert.deepEqual(errors,[],'Page errors: '+errors.join('; '));
 console.log('E2E passed: toolbar, modes, draggable mesh, persistence and app theme separation');
} finally {await browser.close();}
