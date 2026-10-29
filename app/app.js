import {ensureGoogleFont,ensureFontOption,initializeFontCatalog} from './google-fonts.js';
import {syncPropertyControls} from './design-system/property-controls.js';
import {confirmAlert,requestText} from './design-system/alert-dialog.js';
import {defaults,fonts,resolveFont,validateTheme,selectPreset,themeCode,decodeTheme,backgroundCSS,backgroundSize,themeColor} from './resume-themes.js';
import {createThemeAgentPrompt,parseThemeAgentResponse} from './theme-agent.js';
import {applyMarkdownCommand} from './markdown-commands.js';
import {markdownToHTML as renderMarkdown} from './markdown-render.js';
import {DocumentHistory} from './document-history.js';
import {backgroundPresets,applyBackgroundPreset,getBackgroundPreset} from './background-presets.js';
import {drawMeshEditor} from './mesh-editor.js';
import {PDF_PRESETS,resolvePDFExport,configurePDFPrint,clearPDFPrint} from './pdf-export.js';
import {groupSemanticLeads,groupShortSections,refreshShortSectionPolicies} from './semantic-flow.js';
import {paginateDOM,pageGeometry} from './page-plan.js';
import {initializeInspector,setInspectorTab,revealInspectorControl,updatePropertyReadouts,inspectorPageSummary} from './property-inspector.js';
import {documentTemplates,getDocumentTemplate,inspectMarkdown} from './document-templates.js';
import {parseSectionPolicies,toggleSectionBreak,resolveSectionPolicies,decoratePageBreaks} from './section-pagination.js';
import {themeRecipes,lockGroups,normalizeThemeLocks,recipeTheme,shuffleTheme} from './theme-explorer.js';
import {shuffleColors,colorPreview} from './color-surprise.js';
import {markdownElements,elementPresets,parseElementStyles,setElementStyle,setElementInstanceStyle,setElementProperty,clearElementInstance,decorateMarkdownElements} from './element-styles.js';
import {surpriseSections} from './section-surprise.js';
import {sectionPresets,parseSectionDesign,resolveSectionPreset,setSectionPreset,setSectionDensity,decorateSections} from './section-design.js';
import {createIcon} from './design-system/components.js';
import {parsePageLayout,setBottomAlignment,decoratePageLayout,applyPageLayout} from './page-layout.js';

const $=id=>document.getElementById(id);
const sample=getDocumentTemplate('article').markdown;
const appThemes=['mdress','studio','graphite','oled','sand','neon'];
let db,documents=[],savedThemes=[],agentCandidate=null,activeId='',saveTimer=0,revision=0,queue=Promise.resolve();
const history=new DocumentHistory();
let pendingLinkSelection=null,forceNextHistory=false,selectedSectionId='all',selectedElementId='';
let livePagePlan=null,layoutTicket=0,layoutTimer=0,activePage=1;
function setPageStatus(label,state='busy'){$('paginationStatus').textContent=label;$('paginationStatus').dataset.status=state;}
function updateNavigation(){
 const count=livePagePlan?.pages?.length||1;
 activePage=Math.max(1,Math.min(activePage,count));
 $('pageCounter').textContent=count+' '+(count===1?'página':'páginas');
 $('currentPage').textContent=activePage+' / '+count;
 $('prevPage').disabled=activePage<=1;$('nextPage').disabled=activePage>=count;
}
function navigateToPage(next){
 activePage=next;updateNavigation();
 const target=document.querySelectorAll('#pageStack > .paper')[activePage-1];
 target?.scrollIntoView({behavior:'smooth',block:'start'});
}
function runPaginationNow(t){
 clearTimeout(layoutTimer);layoutTicket++;
 const stack=$('pageStack'),mode=document.querySelector('.workspace').dataset.mode;
 // Display:none cannot be measured. Temporarily enable layout in editor-only mode.
 if(mode==='edit')document.querySelector('.workspace').dataset.mode='split';
 try{
  livePagePlan=paginateDOM(stack,{paper:t.paper,marginMm:t.layout.marginMm});
   applyPageLayout(stack,current()?.pageLayout);
  const invalid=livePagePlan.diagnostics.length;
  setPageStatus(invalid?'Paginação: '+invalid+' aviso(s)':'Paginação atualizada',invalid?'needs-review':'ready');
  updateNavigation();
  inspectorPageSummary(livePagePlan.pages.length,livePagePlan.diagnostics);
  return livePagePlan;
 }catch(error){
  livePagePlan={pages:[{index:1}],status:'needs-review',diagnostics:[{type:'error',message:String(error)}]};
  setPageStatus('Falha na paginação: confira o conteúdo','needs-review');
  updateNavigation();return livePagePlan;
 }finally{
  if(mode==='edit')document.querySelector('.workspace').dataset.mode=mode;
 }
}
function schedulePagination(t){
 clearTimeout(layoutTimer);const ticket=++layoutTicket;
 setPageStatus('Calculando páginas…','busy');
 layoutTimer=setTimeout(()=>{
  if(ticket!==layoutTicket)return;
  runPaginationNow(t);
 },90);
}

function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeURL(url){try{const u=new URL(url,'https://invalid.example');return ['http:','https:','mailto:'].includes(u.protocol)?escapeHTML(url):'#';}catch{return '#';}}
function inlineMD(s){return escapeHTML(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,label,url)=>'<a href="'+safeURL(url)+'" rel="noopener noreferrer" target="_blank">'+label+'</a>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/&#96;(.+?)&#96;/g,'<code>$1</code>');}
function markdownToHTML(md){let items=[],result=[];const flush=()=>{if(items.length){result.push('<ul>'+items.map(x=>'<li>'+inlineMD(x)+'</li>').join('')+'</ul>');items=[];}};for(const raw of md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').split(/\r?\n/)){const s=raw.trim();if(!s){flush();continue;}const h=s.match(/^(#{1,6})\s+(.+)$/);if(h){flush();const n=Math.min(4,h[1].length);result.push('<h'+n+'>'+inlineMD(h[2])+'</h'+n+'>');continue;}const bullet=s.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);if(bullet){items.push(bullet[1]);continue;}flush();result.push('<p>'+inlineMD(s)+'</p>');}flush();return result.join('\n');}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3000);}
function status(s){$('saveStatus').textContent=s;}
function uid(){return crypto.randomUUID();}
function openDatabase(){return new Promise((resolve,reject)=>{const r=indexedDB.open('resume-studio',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('documents'))r.result.createObjectStore('documents',{keyPath:'id'});if(!r.result.objectStoreNames.contains('themes'))r.result.createObjectStore('themes',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function write(record){return new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(record);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
function removeRecord(id){return new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').delete(id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
function readAll(){return new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function listStoredThemes(){return new Promise((resolve,reject)=>{const r=db.transaction('themes').objectStore('themes').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function saveStoredTheme(item){return new Promise((resolve,reject)=>{const tx=db.transaction('themes','readwrite');tx.objectStore('themes').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function removeStoredTheme(id){return new Promise((resolve,reject)=>{const tx=db.transaction('themes','readwrite');tx.objectStore('themes').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function refreshSavedThemePicker(){const node=$('savedThemePicker'),selected=node.value;node.replaceChildren(new Option('Selecionar tema salvo',''));for(const item of savedThemes)node.add(new Option(item.name,item.id));node.value=selected;$('deleteThemePreset').disabled=!node.value;$('themeLibraryEmpty').hidden=savedThemes.length>0;node.closest('.theme-library-selection').hidden=!savedThemes.length;}
function persist(record){const snapshot=structuredClone(record);queue=queue.catch(()=>{}).then(()=>write(snapshot));return queue;}
function current(){return documents.find(d=>d.id===activeId);}
function picker(){const select=$('docPicker');select.replaceChildren();documents.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));for(const d of documents){const opt=document.createElement('option');opt.value=d.id;opt.textContent=d.name;select.append(opt);}select.value=activeId;}
function themeControls(){const t=validateTheme(current()?.appearance||defaults);
 for(const [id,key] of [['accentColor','accent'],['backgroundColor','background'],['textColor','text'],['bgSecondary','secondary']])$(id).dataset.opacity=t.colorOpacity[key]??1;
 $('resumeTheme').value=t.theme;$('accentColor').value=t.accent;$('backgroundColor').value=t.background;$('textColor').value=t.text;
 ensureFontOption($('fontChoice'),t.font);$('fontChoice').value=t.font;$('fontSize').value=t.size;$('fontSizeValue').textContent=t.size+' pt';$('paperSize').value=t.paper;
 for(const id of ['marginMm','lineHeight','sectionGapEm','titleScale','sectionRule'])$(id).value=t.layout[id];
 for(const key of ['X','Y','Radius'])$('bgRadial'+key).value=t.backgroundStyle['radial'+key];
 $('bgKind').value=t.backgroundStyle.kind;$('bgSecondary').value=t.backgroundStyle.secondary;$('bgAngle').value=t.backgroundStyle.angle;$('bgPatternSize').value=t.backgroundStyle.patternSize;$('bgOpacity').value=t.backgroundStyle.opacity;
 renderBackgroundGallery(t);
 renderThemeExplorer(t);
 updatePropertyReadouts();
 drawMeshEditor(t,patch=>applyAppearance(patch),previewTheme=>render(previewTheme));
}
function renderThemeExplorer(theme){
 const gallery=$('themeRecipeGallery'),doc=current();
 if(!gallery||!doc)return;
 gallery.replaceChildren();
 const basic=[...$('resumeTheme').options].map(option=>({id:'base:'+option.value,name:option.textContent,tag:'Clássico',base:option.value}));
 for(const recipe of [...basic,...themeRecipes]){
  const visual=recipe.base?selectPreset(recipe.base,theme):recipeTheme(recipe,theme);
  const card=document.createElement('button');card.type='button';
  card.className='theme-recipe-card';
  card.dataset.recipeId=recipe.id;
  card.setAttribute('aria-label','Aplicar tema '+recipe.name);
  card.setAttribute('aria-pressed',String(doc.recipeId===recipe.id));
  const preview=document.createElement('span');preview.className='theme-recipe-preview';
  preview.style.backgroundColor=visual.background;
  preview.style.backgroundImage=backgroundCSS(visual);
  preview.style.backgroundSize=backgroundSize(visual);
  preview.style.color=visual.text;
  const monogram=document.createElement('strong');monogram.textContent='Aa';monogram.style.color=visual.accent;
  monogram.style.fontFamily=resolveFont(visual.font);
  const line=document.createElement('span');line.className='theme-preview-line';line.style.backgroundColor=visual.text;
  const small=document.createElement('span');small.className='theme-preview-line theme-preview-line--short';small.style.backgroundColor=visual.accent;
  preview.append(monogram,line,small);
  const meta=document.createElement('span');meta.className='theme-recipe-label';
  const title=document.createElement('strong');title.textContent=recipe.name;
  const tag=document.createElement('small');tag.textContent=recipe.tag;
  meta.append(title,tag);card.append(preview,meta);
  card.onclick=()=>applyAppearance(recipe.base?selectPreset(recipe.base,doc.appearance):recipeTheme(recipe,validateTheme(doc.appearance),doc.themeLocks),recipe.id);
  gallery.append(card);
 }
 const locks=normalizeThemeLocks(doc.themeLocks);
 for(const element of document.querySelectorAll('[data-theme-lock]')){
  const group=element.dataset.themeLock;
  const active=locks[group]===true;
  element.setAttribute('aria-pressed',String(active));
  element.dataset.locked=String(active);
  element.setAttribute('aria-label',(active?'Destravar ':'Travar ')+({colors:'paleta',typography:'tipografia',spacing:'espaçamento',background:'fundo',sections:'composição de seções'}[group])+' no Surpreenda-me');
  element.title=active?'Travado: Surpreenda-me não modifica esta parte. Clique para liberar.':'Livre: Surpreenda-me pode variar esta parte. Clique para travar.';
  const icon=element.querySelector('.theme-lock-icon ds-icon');
  if(icon)icon.setAttribute('name',active?'lock':'lock-open');
 }
 const total=lockGroups.filter(key=>locks[key]).length;
 $('themeLockSummary').textContent=total===lockGroups.length?total+'/'+lockGroups.length+' protegidos':total?total+'/'+lockGroups.length+' protegidos':'0/'+lockGroups.length+' protegidos';
 $('themeLockSummary').setAttribute('aria-label',total+' grupos protegidos contra mudanças automáticas');
 $('shuffleTheme').disabled=total===lockGroups.length;
 $('shuffleColors').disabled=locks.colors&&locks.background;
 $('shuffleColors').title=locks.colors&&locks.background?'Destrave Paleta ou Fundo para variar as cores':'Trocar apenas cores, respeitando as travas';
 const swatches=$('surpriseColorSwatches'),palette=colorPreview(theme);
 swatches.replaceChildren();
 for(const [name,key] of [['Papel','paper'],['Texto','text'],['Destaque','accent'],['Detalhes','secondary']]){
  const sample=document.createElement('span');sample.className='theme-palette-swatch';
  sample.style.backgroundColor=palette[key];
  sample.title=name+': '+palette[key].toUpperCase();
  sample.setAttribute('role','img');sample.setAttribute('aria-label',sample.title);
  swatches.append(sample);
 }
}
function setThemeLock(group){
 if(!lockGroups.includes(group))return;
 const d=current();if(!d)return;
 const old=normalizeThemeLocks(d.themeLocks);
 d.themeLocks={...old,[group]:!old[group]};recordHistory('Travar propriedades');
 d.updatedAt=new Date().toISOString();revision++;const r=revision;
 renderThemeExplorer(validateTheme(d.appearance));status('Alterações pendentes…');
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d).then(()=>{if(r===revision)status('Salvo localmente');}),300);
}
function renderBackgroundGallery(theme){
 const gallery=$('backgroundGallery');if(!gallery)return;
 gallery.replaceChildren();
 for(const preset of backgroundPresets){
  const next=validateTheme(applyBackgroundPreset(theme,preset));
  const chosen=preset.kind===theme.backgroundStyle.kind&&preset.background===theme.background&&preset.secondary===theme.backgroundStyle.secondary&&
  (preset.kind!=='mesh'||JSON.stringify(preset.points)===JSON.stringify(theme.backgroundStyle.points));
  const button=document.createElement('button');button.type='button';button.className='bg-preset'+(chosen?' selected':'');
  button.setAttribute('aria-label','Usar fundo '+preset.name);button.setAttribute('aria-pressed',String(chosen));
  const swatch=document.createElement('span');swatch.className='bg-swatch';swatch.style.backgroundColor=next.background;swatch.style.backgroundImage=backgroundCSS(next);swatch.style.backgroundSize=backgroundSize(next);
  const label=document.createElement('span');label.textContent=preset.name;
  button.append(swatch,label);
  button.addEventListener('click',()=>applyAppearance({background:next.background,text:next.text,accent:next.accent,backgroundStyle:next.backgroundStyle}));
  gallery.append(button);
 }
}
function historySnapshot(d){return {markdown:d.markdown,appearance:d.appearance,pagination:d.pagination,sectionDesign:d.sectionDesign,elementStyles:d.elementStyles,pageLayout:d.pageLayout,themeLocks:d.themeLocks,recipeId:d.recipeId,name:d.name};}
function recordHistory(label='Alteração',merge=false){const d=current();if(!d)return;history.record(historySnapshot(d),label,merge);refreshHistoryButtons();}
function refreshHistoryButtons(){
 $('undoEdit').disabled=!history.canUndo;$('redoEdit').disabled=!history.canRedo;
 $('undoEdit').title=history.canUndo?'Desfazer: '+history.undoLabel+' (Ctrl+Z)':'Nada para desfazer';
 $('redoEdit').title=history.canRedo?'Refazer: '+history.redoLabel+' (Ctrl+Shift+Z)':'Nada para refazer';
}
function runMarkdownCommand(command,arg='',selection=null){
 const source=$('source'),start=selection?.start??source.selectionStart,end=selection?.end??source.selectionEnd;
 try{
  const output=applyMarkdownCommand(source.value,start,end,command,arg);
  if(output.text===source.value)return;
  source.value=output.text;source.focus();source.setSelectionRange(output.start,output.end);
  forceNextHistory=true;markDirty();
 }catch(err){toast(err.message);}
}
function restoreHistory(kind){
 const snap=kind==='undo'?history.undo():history.redo();if(!snap)return;
 const d=current();if(!d)return;
 Object.assign(d,snap,{updatedAt:new Date().toISOString()});
 $('source').value=d.markdown;agentCandidate=null;$('applyAgentTheme').disabled=true;
 revision++;const version=revision;clearTimeout(saveTimer);
 themeControls();render();picker();refreshHistoryButtons();status('Alterações pendentes…');
 saveTimer=setTimeout(()=>persist(d).then(()=>{if(version===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),250);
 document.dispatchEvent(new CustomEvent('mdress:pagination-changed',{detail:{breakBefore:parseSectionPolicies(d.pagination).breakBefore}}));
}
function bindEditorToolbar(){
 const source=$('source');
 document.querySelectorAll('[data-md-command]').forEach(button=>{
  button.addEventListener('pointerdown',e=>e.preventDefault());
  button.addEventListener('click',()=>{
   const command=button.dataset.mdCommand;
   if(command==='link'){
    pendingLinkSelection={start:source.selectionStart,end:source.selectionEnd};
    $('linkURL').value='https://';$('linkDialog').showModal();$('linkURL').focus();return;
   }
   runMarkdownCommand(command);
  });
 });
 $('headingCommand').addEventListener('change',e=>{if(e.target.value)runMarkdownCommand(e.target.value);e.target.value='';});
 $('undoEdit').onclick=()=>restoreHistory('undo');
 $('redoEdit').onclick=()=>restoreHistory('redo');
 $('cancelLink').onclick=()=>{$('linkDialog').close();pendingLinkSelection=null;};
 $('linkForm').onsubmit=e=>{e.preventDefault();const selection=pendingLinkSelection;pendingLinkSelection=null;$('linkDialog').close();runMarkdownCommand('link',$('linkURL').value,selection);};
 $('openShortcuts').onclick=()=>{
  const dialog=$('shortcutsDialog');
  const modifier=/Mac|iPhone|iPad/.test(navigator.platform)?'Cmd':'Ctrl';
  dialog.querySelectorAll('[data-shortcut-mod]').forEach(key=>key.textContent=modifier);
  dialog.showModal();
 };
 const shortcuts=$('shortcutsDialog');
 let backdropPointer=null;
 const outsideShortcuts=event=>{
  const rect=shortcuts.getBoundingClientRect();
  return event.target===shortcuts&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);
 };
 shortcuts.addEventListener('pointerdown',event=>{backdropPointer=event.button===0&&outsideShortcuts(event)?event.pointerId:null;});
 shortcuts.addEventListener('pointerup',event=>{
  if(backdropPointer===event.pointerId&&outsideShortcuts(event))shortcuts.close();
  backdropPointer=null;
 });
 shortcuts.addEventListener('pointercancel',()=>{backdropPointer=null;});
 shortcuts.addEventListener('close',()=>{backdropPointer=null;});
 document.querySelectorAll('[data-workspace-mode]').forEach(button=>button.onclick=()=>{
  const mode=button.dataset.workspaceMode;
  document.querySelector('.workspace').dataset.mode=mode;
  document.querySelectorAll('[data-workspace-mode]').forEach(b=>{b.classList.toggle('mode-active',b===button);b.setAttribute('aria-pressed',String(b===button));});
 });
 source.addEventListener('keydown',e=>{
  const mod=e.metaKey||e.ctrlKey;
  if(mod){
   const key=e.key.toLowerCase();
   if(key==='b'||key==='i'||key==='k'){e.preventDefault();
    if(key==='k'){$('linkURL').value='https://';pendingLinkSelection={start:source.selectionStart,end:source.selectionEnd};$('linkDialog').showModal();$('linkURL').focus();}
    else runMarkdownCommand(key==='b'?'bold':'italic');
    return;
   }
   if(key==='z'||key==='y')return;
  }
  if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();const a=source.selectionStart;source.setRangeText('  ',a,source.selectionEnd,'end');forceNextHistory=true;markDirty();}
 });
}
let requestedFont='';
function render(temporaryTheme=null,{immediate=false}={}){const d=current();if(!d)return;const t=validateTheme(temporaryTheme||d.appearance||defaults);if(requestedFont!==t.font){requestedFont=t.font;ensureGoogleFont(t.font).then(()=>{if(current()?.appearance?.font===t.font) schedulePagination(validateTheme(current().appearance));}).catch(err=>{if(current()?.appearance?.font===t.font)toast(err.message+' Usando fonte alternativa.');});}const p=$('paper');p.className='paper print-page'+(t.paper==='letter'?' letter':'');for(const [k,v] of Object.entries({accent:themeColor(t,'accent'),background:themeColor(t,'background'),text:themeColor(t,'text'),size:t.size+'pt',font:resolveFont(t.font)})){p.style.setProperty('--resume-'+k,v);}
 p.style.backgroundImage=backgroundCSS(t);p.style.backgroundSize=backgroundSize(t);
 p.style.padding=t.layout.marginMm+'mm';
 p.style.setProperty('--resume-line-height',t.layout.lineHeight);
 p.style.setProperty('--resume-title-scale',t.layout.titleScale);
 p.style.setProperty('--resume-section-gap',t.layout.sectionGapEm);
 $('rendered').dataset.sectionRule=t.layout.sectionRule;
 $('printPageStyle').textContent='@page{size:'+(t.paper==='letter'?'letter':'A4')+';margin:0}';$('pageStack').querySelectorAll('.paper:not(#paper)').forEach(node=>node.remove());$('rendered').innerHTML=renderMarkdown(d.markdown);groupSemanticLeads($('rendered'));groupShortSections($('rendered'),((t.paper==='letter'?279.4:297)-2*t.layout.marginMm)*96/25.4);decoratePageBreaks($('rendered'),d.markdown,d.pagination);decorateSections($('rendered'),d.markdown,d.sectionDesign);decorateMarkdownElements($('rendered'),d.elementStyles);for(const node of $('rendered').querySelectorAll('[data-md-element-id]'))node.dataset.mdInstanceSelected=String(node.dataset.mdElementId===selectedElementId);decoratePageLayout($('rendered'),d.markdown,d.pageLayout);renderPageLayoutControls();renderSectionBreakList();renderSectionStyleInspector();renderElementStyleInspector();requestAnimationFrame(positionPreviewStyleControl);$('charCount').textContent=d.markdown.length+' caracteres';renderATS();if(immediate)return runPaginationNow(t);schedulePagination(t);}
function renderSectionStyleInspector(){
 const d=current(),select=$('sectionStyleTarget'),gallery=$('sectionStyleGallery');
 if(!d||!select||!gallery)return;
 const design=parseSectionDesign(d.sectionDesign),sections=resolveSectionPolicies(d.markdown,null).anchors;
 const valid=selectedSectionId==='all'||/^level:[1-6]$/.test(selectedSectionId)||sections.some(a=>a.id===selectedSectionId);
 if(!valid)selectedSectionId='all';
 select.replaceChildren();
 const globalGroup=document.createElement('optgroup');globalGroup.label='Escopo';
 globalGroup.append(new Option('Todas as seções','all'));
 for(let level=1;level<=6;level++){
  const count=sections.filter(a=>a.level===level).length;
  if(count)globalGroup.append(new Option('Todas H'+level+' ('+count+')','level:'+level));
 }
 select.append(globalGroup);
 const individualGroup=document.createElement('optgroup');individualGroup.label='Seções individuais';
 for(const section of sections){
  const option=new Option('H'+section.level+' · '+section.title,section.id);option.dataset.elementKind='h'+section.level;individualGroup.append(option);
 }
 select.append(individualGroup);
 select.value=selectedSectionId;
 const active=resolveSectionPreset(design,selectedSectionId);
 syncStyleThumbnail('section',active);
 $('sectionStyleCurrent').textContent=sectionPresets.find(p=>p.id===active)?.name||'Essencial';
 gallery.replaceChildren();
 for(const preset of sectionPresets){
  const button=document.createElement('button');button.type='button';
  button.className='section-style-preset';button.dataset.sectionPreset=preset.id;
  button.setAttribute('aria-label','Aplicar estilo '+preset.name);
  button.setAttribute('aria-pressed',String(active===preset.id));
  button.title=preset.description;
  const art=styleThumbnail(preset.id);
  const label=document.createElement('span');label.className='section-style-preset-title';
  const text=document.createElement('span');text.textContent=preset.name;label.append(text);
  if(active===preset.id)label.append(createIcon('check',13));
  button.append(art,label);
  button.onclick=()=>{gallery.hidePopover();changeSectionDesign(preset.id);};
  gallery.append(button);
 }
 for(const btn of document.querySelectorAll('.section-style-density button[data-section-density]')){
  btn.setAttribute('aria-pressed',String(btn.dataset.sectionDensity===design.density));
 }
 $('sectionStyleStatus').textContent=selectedSectionId==='all'
  ?'Estilo para todas as seções Markdown.'
  :selectedSectionId.startsWith('level:')?'Todas as seções H'+selectedSectionId.slice(-1)+'; personalizações individuais prevalecem.'
  :'Somente esta seção; as demais não mudam.';
 $('sectionStyleReset').title=selectedSectionId==='all'?'Restaurar todas as seções ao padrão':'Remover personalização desta seção';
}
function setComposerMode(mode){
 const scroller=document.querySelector('.inspector-scroll');
 const scrollTop=scroller?.scrollTop||0;
 const elementMode=mode==='element';
 $('sectionComposerView').hidden=elementMode;
 $('elementComposerView').hidden=!elementMode;
 for(const button of document.querySelectorAll('[data-composer-mode]'))button.setAttribute('aria-pressed',String(button.dataset.composerMode===mode));
 if(scroller)scroller.scrollTop=scrollTop;
}
function styleThumbnail(preset){
 const art=document.createElement('span');art.className='block-style-thumbnail';art.dataset.variant=preset;art.setAttribute('aria-hidden','true');
 const shapes={
 plain:'<path d="M9 12h25M9 22h40M9 28h34M9 34h38"/>',
 surface:'<rect x="4" y="5" width="52" height="34" rx="7" fill="#e2e6f4" stroke="#abb6ce"/><path d="M12 14h22M12 23h35M12 29h29"/>',
 glass:'<circle cx="16" cy="15" r="13" fill="#94bbdc" stroke="none"/><circle cx="43" cy="30" r="13" fill="#c8a3d8" stroke="none"/><rect x="7" y="8" width="46" height="29" rx="5" fill="#ffffff99" stroke="#ffffff"/><path d="M14 17h22M14 25h32"/>',
 accent:'<rect x="5" y="6" width="49" height="33" rx="3" fill="#eef0f7" stroke="none"/><path d="M7 7v31" stroke="#7763ae" stroke-width="5"/><path d="M16 15h23M16 24h32M16 30h26"/>',
 outline:'<rect x="5" y="5" width="50" height="34" rx="1" fill="white" stroke="#7763ae" stroke-width="2"/><path d="M13 14h23M13 23h33M13 30h28"/>',
 band:'<rect x="4" y="5" width="52" height="34" rx="3" fill="white" stroke="#b8afcf"/><path d="M5 6h50v12H5z" fill="#7763ae" stroke="none"/><path d="M12 12h25" stroke="white"/><path d="M12 25h35M12 32h29"/>',
 editorial:'<text x="7" y="23" fill="#50416e" stroke="none" font-family="Georgia,serif" font-size="23">Aa</text><path d="M37 13h15M37 20h15M8 31h44M8 37h36" stroke-width="1"/>',
 spotlight:'<rect x="4" y="5" width="52" height="34" rx="4" fill="#dcd5ef" stroke="none"/><path d="M6 7h48" stroke="#7763ae" stroke-width="4"/><path d="M13 18h32M13 26h34M13 32h25"/>',
 'minimal-grid':'<rect x="4" y="5" width="52" height="34" fill="white" stroke="#aab2c6"/><path d="M4 17h52M4 28h52M23 17v22" stroke="#aab2c6" stroke-width="1"/><path d="M10 11h20M9 23h8M29 23h20M9 34h8M29 34h17"/>',
 marker:'<path d="M7 18h46v13H7z" fill="#e9d38d" stroke="none"/><path d="M11 24h36"/>',
 pill:'<rect x="6" y="13" width="48" height="20" rx="10" fill="#ded6ed" stroke="none"/><path d="M15 23h30"/>',
 underline:'<path d="M9 19h42M9 29h42"/><path d="M9 33h42" stroke="#7763ae" stroke-width="2"/>'
 };
 art.innerHTML='<svg viewBox="0 0 60 44" fill="none" stroke="#7b8191" stroke-width="2" stroke-linecap="round">'+(shapes[preset]||shapes.plain)+'</svg>';return art;
}
function syncStyleThumbnail(kind,preset){
 const button=document.querySelector('[data-style-gallery="'+kind+'"]');button.querySelector('.block-style-thumbnail')?.remove();button.prepend(styleThumbnail(preset));
}
function refreshElementColors(){
 const kind=selectedElementId.split(':')[0]||$('markdownElementTarget').value||'p';
 const target=selectedElementId||kind,styles=parseElementStyles(current()?.elementStyles);
 const own=styles.properties[target]||{},effective={...styles.properties[kind],...own};
 const visible=effective.visibility!=='hidden',toggle=$('elementVisibilityToggle');
 toggle.setAttribute('aria-pressed',String(visible));
 toggle.setAttribute('aria-label',visible?'Ocultar '+(selectedElementId?'esta ocorrência':'todos deste tipo'):'Exibir '+(selectedElementId?'esta ocorrência':'todos deste tipo'));
 toggle.title=visible?'Ocultar (mantém espaço)':'Exibir';
 toggle.querySelector('ds-icon').setAttribute('name',visible?'eye':'eye-off');
 $('elementVisibilityInherit').hidden=!selectedElementId||!Object.hasOwn(own,'visibility');
 $('elementColorScope').textContent=selectedElementId?'desta ocorrência':'de todos deste tipo';
 for(const input of document.querySelectorAll('[data-element-color]')){
  const key=input.dataset.elementColor,value=effective[key];
  input.closest('[data-color-field]').hidden=key==='markerColor'&&!['ul','ol','li'].includes(kind);
  input.value=value?.slice(0,7)||(key==='backgroundColor'?current()?.appearance?.background:current()?.appearance?.text)||'#151a20';
  input.dataset.opacity=String(value?.length===9?parseInt(value.slice(7),16)/255:1);
  const reset=document.querySelector('[data-inherit-color="'+key+'"]');
  reset.disabled=!own[key];reset.textContent=own[key]?'Herdar':'Herdado';
 }
 syncPropertyControls();
}
function renderElementStyleInspector(){
 const d=current(),select=$('markdownElementTarget'),gallery=$('markdownElementGallery');
 const hiddenList=$('hiddenElements');hiddenList.replaceChildren();
 for(const [id,props] of Object.entries(parseElementStyles(d?.elementStyles).properties)){
  if(props.visibility!=='hidden')continue;
  const button=document.createElement('button');button.type='button';button.className='ds-button ds-button--quiet';
  const meta=markdownElements.find(item=>item.id===id.split(':')[0]);
  button.textContent='Oculto: '+(meta?.label||id)+(id.includes(':')?' · '+id.split(':')[1]:' · todos');
  button.onclick=()=>{selectedElementId=id.includes(':')?id:'';select.value=id.split(':')[0];refreshPreviewProperties();renderElementStyleInspector();};
  hiddenList.append(button);
 }
 hiddenList.hidden=!hiddenList.childElementCount;
 if(!d||!select||!gallery)return;
 const currentKind=selectedElementId.split(':')[0]||select.value||'p',existing=new Set(markdownElements.map(x=>x.id));
 select.replaceChildren();
 for(const element of markdownElements)select.add(new Option(element.label,element.id));
 select.value=existing.has(currentKind)?currentKind:'p';
 const element=markdownElements.find(x=>x.id===select.value);
 const styles=parseElementStyles(d.elementStyles),currentPreset=(selectedElementId?styles.instances[selectedElementId]:null)??styles.rules[element.id]??'plain';
 syncStyleThumbnail('element',currentPreset);
 $('elementStyleCurrent').textContent=elementPresets[element.inline?'inline':'block'].find(p=>p.id===currentPreset)?.label||'Original';
 refreshElementColors();
 const status=$('markdownElementScope');if(status)status.textContent=selectedElementId?'Somente '+element.label+' #'+selectedElementId.split(':')[1]:'Todos os elementos: '+element.label;
 gallery.replaceChildren();
 for(const preset of elementPresets[element.inline?'inline':'block']){
  const button=document.createElement('button');button.type='button';button.className='section-style-preset';
  button.dataset.elementPreset=preset.id;
  button.setAttribute('aria-pressed',String(preset.id===currentPreset));
  const label=document.createElement('span');label.className='section-style-preset-title';label.textContent=preset.label;
  if(currentPreset===preset.id)label.append(createIcon('check',13));
  button.append(styleThumbnail(preset.id),label);
  button.onclick=()=>{gallery.hidePopover();applyElementPreset(preset.id);};
  gallery.append(button);
 }
}
function applyElementPreset(preset){
 const doc=current();if(!doc)return;
 const kind=selectedElementId.split(':')[0]||$('markdownElementTarget').value;
 try{
  doc.elementStyles=selectedElementId?setElementInstanceStyle(doc.elementStyles,selectedElementId,preset):setElementStyle(doc.elementStyles,kind,preset);
  doc.updatedAt=new Date().toISOString();recordHistory('Estilizar elemento Markdown');
  revision++;const version=revision;render();status('Alterações pendentes…');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>persist(doc).then(()=>{if(version===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),320);
  positionPreviewStyleControl();
 }catch(err){toast(err.message);}
}
function updateElementOverrides(operation,label,target=selectedElementId){
 const doc=current();if(!doc||!target)return;
 try{
  doc.elementStyles=operation(doc.elementStyles,target);
  doc.updatedAt=new Date().toISOString();recordHistory(label);
  revision++;const version=revision;render();status('Alterações pendentes…');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>persist(doc).then(()=>{if(version===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),320);
 }catch(err){toast(err.message);}
}
function refreshPreviewProperties(){
 const panel=$('previewPropertyPanel');if(!panel)return;
 panel.hidden=!selectedElementId;$('elementSelectionHint').hidden=Boolean(selectedElementId);
 if(!selectedElementId)return;
 const props=parseElementStyles(current()?.elementStyles).properties[selectedElementId]||{};
 const kind=selectedElementId.split(':')[0],meta=markdownElements.find(item=>item.id===kind);
 const selected=$('pageStack').querySelector('[data-md-element-id="'+selectedElementId+'"]');
 $('elementPropertiesTitle').textContent=(meta?.label||kind)+' · '+selectedElementId.split(':')[1];
 $('elementPropertiesExcerpt').textContent=(selected?.textContent?.trim()||selected?.getAttribute('alt')||'Elemento sem texto').slice(0,160);
 for(const input of panel.querySelectorAll('[data-element-property]'))input.value=props[input.dataset.elementProperty]??'';
 const hasOverride=(()=>{
  const styles=parseElementStyles(current()?.elementStyles);
  return Object.hasOwn(styles.instances,selectedElementId)||Object.hasOwn(styles.properties,selectedElementId);
 })();
 $('previewStyleControl').querySelector('[data-preview-style-reset]').disabled=!hasOverride;
 updatePropertyReadouts();
}
function cycleStyle(kind,direction){
 const doc=current();if(!doc)return;
 let options,active;
 if(kind==='section'){
  options=sectionPresets;active=resolveSectionPreset(doc.sectionDesign,selectedSectionId);
 }else{
  const elementKind=selectedElementId.split(':')[0]||$('markdownElementTarget').value;
  const meta=markdownElements.find(e=>e.id===elementKind);if(!meta)return;
  options=elementPresets[meta.inline?'inline':'block'];
  const currentStyles=parseElementStyles(doc.elementStyles);
  active=(selectedElementId?currentStyles.instances[selectedElementId]:null)??currentStyles.rules[elementKind]??'plain';
 }
 const pos=Math.max(0,options.findIndex(p=>p.id===active));
 if(options.length<2)return;
 const step=direction==='random'?1+Math.floor(Math.random()*(options.length-1)):direction;
 const next=options[(pos+step+options.length)%options.length]?.id;
 if(kind==='section')changeSectionDesign(next);else applyElementPreset(next);
}
function positionPreviewStyleControl(){
 const toolbar=$('previewStyleControl');if(!toolbar)return;
 refreshPreviewProperties();
 const selected=$('pageStack').querySelector('[data-md-instance-selected=true]');
 if(!selected||!selectedElementId){toolbar.hidden=true;return;}
 toolbar.hidden=false;
 const rect=selected.getBoundingClientRect(),margin=8;
 toolbar.style.left=Math.max(margin,Math.min(window.innerWidth-toolbar.offsetWidth-margin,rect.right-toolbar.offsetWidth))+'px';
 toolbar.style.top=Math.max(margin,Math.min(window.innerHeight-toolbar.offsetHeight-margin,rect.top-toolbar.offsetHeight-7))+'px';
 const kind=selectedElementId.split(':')[0],meta=markdownElements.find(e=>e.id===kind);
 const styles=parseElementStyles(current()?.elementStyles),preset=styles.instances[selectedElementId]??styles.rules[kind]??'plain';
 toolbar.querySelector('.preview-style-name').textContent=(meta?.label||kind)+' · '+(elementPresets[meta?.inline?'inline':'block'].find(p=>p.id===preset)?.label||'Original');
 refreshPreviewProperties();
}
function persistSectionDesign(next){
 const d=current();if(!d)return;
 try{
  d.sectionDesign=parseSectionDesign(next);d.updatedAt=new Date().toISOString();recordHistory('Estilizar seção');
  revision++;const r=revision;render();status('Alterações pendentes…');
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d).then(()=>{
   if(r===revision)status('Salvo localmente');
  }).catch(()=>status('Falha ao salvar')),320);
 }catch(err){toast(err.message);}
}
function changeSectionDesign(preset){
 const d=current();if(!d)return;
 persistSectionDesign(setSectionPreset(d.sectionDesign,selectedSectionId,preset));
}
function selectSectionToStyle(id='all'){
 const d=current();if(!d)return;
 if(id!=='all'&&!/^level:[1-6]$/.test(id)&&!resolveSectionPolicies(d.markdown,null).anchors.some(a=>a.id===id))return;
 selectedSectionId=id;
 setDesignerOpen(true);setInspectorTab('content');setComposerMode('section');
 renderSectionStyleInspector();
 renderPageLayoutControls();updatePropertyReadouts();revealInspectorControl('sectionStyleTarget');
}
function renderSectionBreakList(){
 const list=$('pageBreakList'),d=current();if(!list||!d)return;
 const resolved=resolveSectionPolicies(d.markdown,d.pagination);
 list.replaceChildren();
 const candidates=resolved.anchors;
 for(const section of candidates){
  const row=document.createElement('button');row.type='button';row.className='page-break-option';
  const checked=resolved.breakBefore.includes(section.id);
  row.setAttribute('aria-pressed',String(checked));row.dataset.sectionBreakId=section.id;
  const name=document.createElement('span');name.textContent='H'+section.level+' · '+section.title;
  const state=document.createElement('span');state.className='page-break-option-state';state.textContent=checked?'Nova página':'Automático';
  row.append(name,state);row.addEventListener('click',()=>setSectionBreak(section.id,!checked));
  list.append(row);
 }
 $('pageBreakDescription').textContent=resolved.orphaned.length
  ?resolved.orphaned.length+' regra(s) sem seção correspondente. Revise os títulos renomeados.'
  :candidates.length?'Escolha uma seção para começar em folha nova. Não altera o Markdown.':'Use títulos Markdown de # a ###### para controlar as quebras.';
}
function renderPageLayoutControls(){
 const d=current(),select=$('bottomSectionTarget'),enabled=$('bottomSectionEnabled');
 if(!d||!select||!enabled)return;
 const anchors=resolveSectionPolicies(d.markdown,null).anchors.filter(x=>x.level<=2);
 select.replaceChildren(new Option('Selecione uma seção',''));
 for(const anchor of anchors)select.add(new Option(anchor.title,anchor.id));
 select.value=anchors.some(x=>x.id===selectedSectionId)?selectedSectionId:'';
 enabled.checked=!!select.value&&parsePageLayout(d.pageLayout).alignBottom.includes(select.value);
 enabled.disabled=!select.value;
 const section=resolveSectionPolicies(d.markdown,d.pagination).anchors.find(x=>x.id===selectedSectionId);
 document.querySelector('.section-placement').hidden=!section;
 const pageBreak=$('selectedSectionBreak');pageBreak.disabled=!section;pageBreak.checked=!!section&&parseSectionPolicies(d.pagination).breakBefore.includes(section.id);
 $('sectionPlacementHint').textContent=section?(select.value?'Posição aplicada somente a esta seção.':'O alinhamento ao rodapé está disponível para seções H1 e H2.'):'Selecione uma seção específica para ajustar posição e quebra.';
}
function setSectionBottom(id,enabled){
 const d=current();if(!d||!id)return;
 try{
  if(!resolveSectionPolicies(d.markdown,null).anchors.some(x=>x.id===id))throw Error('Seção não encontrada');
  d.pageLayout=setBottomAlignment(d.pageLayout,id,enabled);recordHistory('Alinhar seção');
  d.updatedAt=new Date().toISOString();revision++;const r=revision;
  render();status('Alterações pendentes…');
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d).then(()=>{if(r===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),300);
 }catch(error){toast(error.message);}
}
function setSectionBreak(id,enabled){
 const d=current();if(!d)return;
 try{
  const resolved=resolveSectionPolicies(d.markdown,d.pagination);
  if(!resolved.anchors.some(x=>x.id===id))throw Error('Seção não encontrada');
  d.pagination=toggleSectionBreak(d.pagination,id,enabled);recordHistory('Quebra de página');
  d.updatedAt=new Date().toISOString();revision++;const r=revision;
  render();status('Alterações pendentes…');
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d).then(()=>{if(r===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),300);
  document.dispatchEvent(new CustomEvent('mdress:pagination-changed',{detail:{breakBefore:d.pagination.breakBefore}}));
 }catch(error){toast(error.message);}
}
function renderATS(){
 const report=inspectMarkdown(current()?.markdown||$('source').value||'');
 const panel=$('atsResults');panel.replaceChildren();
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 const jump=line=>{
  view('source');const source=$('source'),lines=source.value.split('\n');
  const start=lines.slice(0,line-1).reduce((sum,text)=>sum+text.length+1,0);
  source.focus();source.setSelectionRange(start,start+(lines[line-1]?.length||0));
  source.scrollTop=Math.max(0,(line-3)*parseFloat(getComputedStyle(source).lineHeight));
  source.dispatchEvent(new Event('scroll'));
 };
 const metrics=node('dl',null,'analysis-metrics');
 for(const [value,label] of [[report.words,'palavras'],[report.readingMinutes?`~${report.readingMinutes} min`:'—','leitura'],[report.links,'links'],[report.images,'imagens']]){
  const item=node('div');item.append(node('dd',String(value)),node('dt',label));metrics.append(item);
 }
 panel.append(metrics);
 const review=node('section',null,'analysis-section');review.append(node('h3',`Revisar · ${report.diagnostics.length}`));
 if(!report.diagnostics.length)review.append(node('p','Nenhum alerta nas verificações locais. Links são verificados pelo formato, sem consultar os destinos.','analysis-empty'));
 for(const diagnostic of report.diagnostics){
  const row=node('button',null,'analysis-finding');row.type='button';
  row.append(node('span',`Linha ${diagnostic.line} · ${diagnostic.type==='warning'?'Atenção':'Sugestão'}`,'analysis-location'),node('strong',diagnostic.title),node('span',diagnostic.description),node('span','Ver no editor','analysis-jump'));
  row.onclick=()=>jump(diagnostic.line);review.append(row);
 }
 panel.append(review);
 const outline=node('section',null,'analysis-section');outline.append(node('h3',`Mapa do documento · ${report.headings.length} títulos`));
 if(!report.headings.length)outline.append(node('p','Os títulos aparecerão aqui conforme você organiza o texto.','analysis-empty'));
 for(const heading of report.headings){
  const button=node('button',null,'analysis-heading');button.type='button';button.style.setProperty('--heading-depth',heading.level-1);
  button.append(node('span',`H${heading.level}`,'analysis-level'),node('span',heading.title),node('small',`L${heading.line}`));button.onclick=()=>jump(heading.line);outline.append(button);
 }
 panel.append(outline,node('p',`${report.lines} linhas · ${report.characters} caracteres · ${report.codeBlocks} blocos de código. Leitura estimada a 200 palavras/min, sem blocos de código.`,'analysis-note'));
}

function markDirty(skipHistory=false){const source=$('source');if(!skipHistory){forceNextHistory=false;}clearTimeout(saveTimer);const d=current();if(!d)return;d.markdown=$('source').value;d.updatedAt=new Date().toISOString();recordHistory('Editar Markdown',true);revision++;const r=revision;status('Alterações pendentes…');render();saveTimer=setTimeout(()=>persist(d).then(()=>{if(r===revision)status('Salvo localmente');}).catch(e=>{status('Falha ao salvar');toast(e.message);}),400);}
async function flush(){clearTimeout(saveTimer);await queue;const d=current();if(d){d.markdown=$('source').value;await persist(d);status('Salvo localmente');}}
async function switchTo(id){if(activeId)await flush();selectedSectionId='all';selectedElementId='';const d=documents.find(x=>x.id===id);if(!d)return;activeId=id;try{localStorage.setItem('mdress.activeDocument',id);}catch{}revision++;agentCandidate=null;$('applyAgentTheme').disabled=true;$('source').value=d.markdown;history.reset(historySnapshot(d));refreshHistoryButtons();picker();themeControls();render();document.dispatchEvent(new CustomEvent('mdress:document-changed',{detail:{breakBefore:parseSectionPolicies(d.pagination).breakBefore}}));status('Salvo localmente');}
async function create(markdown=sample,name='Novo documento',appearance=defaults,pagination=null){if(activeId)await flush();const now=new Date().toISOString();const d={id:uid(),name,markdown,appearance:validateTheme(appearance),pagination:parseSectionPolicies(pagination),themeLocks:normalizeThemeLocks(),recipeId:null,sectionDesign:parseSectionDesign(),elementStyles:parseElementStyles(),pageLayout:parsePageLayout(),createdAt:now,updatedAt:now};await persist(d);documents.unshift(d);activeId='';await switchTo(d.id);toast('Documento criado');}
function applyAppearance(patch,recipeId=null){const d=current();if(!d)return;agentCandidate=null;$('applyAgentTheme').disabled=true;try{d.appearance=validateTheme({...d.appearance,...patch});d.recipeId=recipeId;d.updatedAt=new Date().toISOString();recordHistory('Alterar aparência');themeControls();render();revision++;const r=revision;status('Alterações pendentes…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d).then(()=>{if(r===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),350);}catch(e){toast(e.message);}}
function appTheme(theme){if(!appThemes.includes(theme))return;document.body.dataset.theme=theme;$('appTheme').value=theme;try{localStorage.setItem('resume-app-theme',theme);}catch{}}
function download(content,name,mime){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function filename(s){return (s||'documento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,60)||'documento';}
function view(name){
 for(const tab of document.querySelectorAll('[data-view]')){
  const selected=tab.dataset.view===name;
  tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
 }
 for(const key of ['source','ats'])$(key+'View').classList.toggle('hidden',key!==name);
 if(name==='ats')renderATS();
}
function setDesignerOpen(open){$('themesView').classList.toggle('hidden',!open);$('designToggle').setAttribute('aria-expanded',String(open));const label=$('designToggle').querySelector('span');if(label)label.textContent=open?'Fechar painel':'Propriedades';else $('designToggle').setAttribute('aria-label',open?'Fechar painel':'Propriedades');}

function bind(){
 bindEditorToolbar();
 initializeInspector();
 $('bottomSectionTarget').addEventListener('change',e=>selectSectionToStyle(e.target.value||'all'));
 $('bottomSectionEnabled').addEventListener('change',e=>setSectionBottom($('bottomSectionTarget').value,e.target.checked));
 $('selectedSectionBreak').addEventListener('change',e=>setSectionBreak(selectedSectionId,e.target.checked));
 $('source').addEventListener('input',()=>markDirty());
 document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey||event.isComposing)return;
  const key=event.key.toLowerCase();if(key!=='z'&&key!=='y')return;
  if(event.target?.matches?.('input[type=text],input[type=search],input[type=email],input[type=url],input[type=number],input[type=password],textarea:not(#source),[contenteditable=true]'))return;
  event.preventDefault();restoreHistory(key==='y'||(key==='z'&&event.shiftKey)?'redo':'undo');
 });
 $('pageStack').addEventListener('click',event=>{
  const element=event.target.closest('[data-md-element-id]');
  if(element&&$('pageStack').contains(element)&&!event.target.closest('button,.section-break-actions,.section-design-tools')){
   if(event.target.closest('a'))event.preventDefault();
   if(selectedElementId!==element.dataset.mdElementId){$('previewPropertyPanel').hidden=true;$('previewStyleControl').querySelector('[data-preview-style-properties]').setAttribute('aria-expanded','false');}
   selectedElementId=element.dataset.mdElementId;
   $('pageStack').querySelectorAll('[data-md-element-id]').forEach(node=>node.dataset.mdInstanceSelected=String(node.dataset.mdElementId===selectedElementId));
   setDesignerOpen(true);setInspectorTab('content');setComposerMode('element');renderElementStyleInspector();revealInspectorControl('markdownElementTarget');
   positionPreviewStyleControl();
   return;
  }
  const designButton=event.target.closest('[data-edit-section]');
  if(designButton){
   selectSectionToStyle(designButton.dataset.editSection);return;
  }
  const button=event.target.closest('[data-section-break-id]');
  if(!button||!$('pageStack').contains(button))return;
  const d=current();if(!d)return;
  const id=button.dataset.sectionBreakId,checked=parseSectionPolicies(d.pagination).breakBefore.includes(id);
  setSectionBreak(id,!checked);
 });
 document.addEventListener('mdress:toggle-page-break',event=>{
  const d=current();if(!d)return;
  const id=event.detail?.id;
  if(!id)return;
  setSectionBreak(id,!parseSectionPolicies(d.pagination).breakBefore.includes(id));
 });

 for(const button of document.querySelectorAll('[data-style-nav]'))button.onclick=()=>{
  const [kind,direction]=button.dataset.styleNav.split(':');
  cycleStyle(kind,direction==='random'?'random':Number(direction));
 };
 for(const button of document.querySelectorAll('[data-style-gallery]')){
  const target=$(button.dataset.styleGallery==='section'?'sectionStyleGallery':'markdownElementGallery');
  target.hidden=false;target.setAttribute('popover','auto');target.classList.add('block-style-dropdown');
  button.popoverTargetElement=target;
  button.popoverTargetAction='toggle';
  target.addEventListener('toggle',()=>{
   const open=target.matches(':popover-open');
   button.setAttribute('aria-expanded',String(open));
   if(!open)return;
   const r=button.getBoundingClientRect(),width=Math.min(280,innerWidth-16);
   target.style.width=width+'px';target.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';
   target.style.top=Math.max(8,Math.min(r.bottom+5,innerHeight-Math.min(target.scrollHeight,360)-8))+'px';
   (target.querySelector('[aria-pressed=true]')||target.querySelector('button'))?.focus({preventScroll:true});
  });
  target.addEventListener('keydown',event=>{
   const items=[...target.querySelectorAll('button')],i=items.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}
   if(event.key==='Escape'){event.preventDefault();target.hidePopover();button.focus();}
  });
 }
 const floating=$('previewStyleControl');
 floating.addEventListener('click',async event=>{
  const button=event.target.closest('[data-preview-style-step]');
  if(button){event.preventDefault();cycleStyle('element',Number(button.dataset.previewStyleStep));}
  if(event.target.closest('[data-preview-style-reset]')){
   if(!await confirmAlert('Limpar a personalização deste elemento? Ele voltará a herdar o estilo padrão.'))return;
   updateElementOverrides(clearElementInstance,'Limpar estilo individual');
   floating.querySelector('[data-preview-style-properties]').setAttribute('aria-expanded','false');
  }
  if(event.target.closest('[data-preview-style-properties]')){
   setDesignerOpen(true);setComposerMode('element');revealInspectorControl('markdownElementTarget');refreshPreviewProperties();
   $('previewPropertyPanel').querySelector('input')?.focus();
  }
  if(event.target.closest('[data-preview-style-close]')){
   floating.hidden=true;$('previewPropertyPanel').hidden=true;
   selectedElementId='';$('pageStack').querySelectorAll('[data-md-instance-selected]').forEach(node=>node.dataset.mdInstanceSelected='false');
  }
 });
 $('previewPropertyPanel').querySelector('[data-preview-property-reset]').onclick=async()=>{
  if(await confirmAlert('Restaurar as propriedades deste elemento? Os ajustes individuais serão removidos.'))updateElementOverrides((value,id)=>{
   const parsed=parseElementStyles(value),properties={...parsed.properties};delete properties[id];return {...parsed,properties};
  },'Restaurar propriedades individuais');
 };
 $('editElementColors').onclick=()=>{document.querySelector('[data-inspector-tab=content]').click();setComposerMode('element');const group=$('elementColorPanel').closest('.ds-accordion');const toggle=group?.querySelector('.ds-accordion-toggle');if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();$('elementColorPanel').scrollIntoView({block:'nearest'});};
 for(const input of document.querySelectorAll('[data-element-color]')){
  const apply=()=>{const alpha=Math.round(Number(input.dataset.opacity??1)*255).toString(16).padStart(2,'0');
   updateElementOverrides((design,id)=>setElementProperty(design,id,input.dataset.elementColor,input.value+(alpha==='ff'?'':alpha)),'Alterar cor do elemento',selectedElementId||$('markdownElementTarget').value);
   refreshElementColors();
  };
  input.addEventListener('change',apply);input.addEventListener('coloropacitychange',apply);
 }
 for(const button of document.querySelectorAll('[data-inherit-color]'))button.onclick=()=>{
  updateElementOverrides((design,id)=>setElementProperty(design,id,button.dataset.inheritColor,null),'Herdar cor',selectedElementId||$('markdownElementTarget').value);refreshElementColors();
 };
 $('elementVisibilityToggle').onclick=()=>{
  const target=selectedElementId||$('markdownElementTarget').value;
  const hidden=$('elementVisibilityToggle').getAttribute('aria-pressed')==='true';
  updateElementOverrides((design,id)=>setElementProperty(design,id,'visibility',hidden?'hidden':selectedElementId?'visible':null),'Alterar visibilidade',target);
  renderElementStyleInspector();
 };
 $('elementVisibilityInherit').onclick=()=>{
  updateElementOverrides((design,id)=>setElementProperty(design,id,'visibility',null),'Herdar visibilidade');renderElementStyleInspector();
 };
 for(const input of $('previewPropertyPanel').querySelectorAll('[data-element-property]'))input.addEventListener('change',()=>{
  const key=input.dataset.elementProperty,raw=input.value.trim();
  const value=raw===''?null:['align','visibility'].includes(key)?raw:Number(raw);
  updateElementOverrides((design,id)=>setElementProperty(design,id,key,value),'Ajustar '+key);
 });
 document.querySelector('.preview-scroll')?.addEventListener('scroll',()=>requestAnimationFrame(positionPreviewStyleControl),{passive:true});
 window.addEventListener('resize',()=>requestAnimationFrame(positionPreviewStyleControl));
 $('sectionStyleTarget').onchange=e=>selectSectionToStyle(e.target.value);
 for(const button of document.querySelectorAll('[data-composer-mode]'))button.onclick=()=>setComposerMode(button.dataset.composerMode);
 $('markdownElementTarget').onchange=()=>{selectedElementId='';positionPreviewStyleControl();$('pageStack').querySelectorAll('[data-md-instance-selected]').forEach(node=>node.dataset.mdInstanceSelected='false');renderElementStyleInspector();};
 $('markdownElementAll').onclick=()=>{selectedElementId='';positionPreviewStyleControl();$('pageStack').querySelectorAll('[data-md-instance-selected]').forEach(node=>node.dataset.mdInstanceSelected='false');renderElementStyleInspector();};
 for(const btn of document.querySelectorAll('.section-style-density button[data-section-density]'))btn.onclick=()=>persistSectionDesign(setSectionDensity(current()?.sectionDesign,btn.dataset.sectionDensity));
 $('sectionStyleReset').onclick=async()=>{if(await confirmAlert('Restaurar o estilo '+(selectedSectionId==='all'?'de todas as seções':'da seção selecionada')+'? A aparência personalizada será substituída pelo estilo básico.'))changeSectionDesign('plain');};
 document.addEventListener('mdress:style-section',e=>selectSectionToStyle(e.detail?.id));
 $('docPicker').addEventListener('change',e=>switchTo(e.target.value).catch(err=>toast(err.message)));
 $('newDoc').onclick=()=>$('newDocumentDialog').showModal();
 $('cancelNewDocument').onclick=()=>$('newDocumentDialog').close();
 $('newDocumentForm').onsubmit=async e=>{e.preventDefault();try{const name=$('newDocumentName').value.trim()||'Novo documento';await create(getDocumentTemplate($('newDocumentStarter').value).markdown,name,selectPreset($('newDocumentTheme').value));$('newDocumentDialog').close();setDesignerOpen(true);}catch(err){toast(err.message);}};
 $('siteSettings').onclick=()=>$('settingsDialog').showModal();
 $('designToggle').onclick=()=>setDesignerOpen($('themesView').classList.contains('hidden'));
 $('renameDoc').onclick=async()=>{const d=current();if(!d)return;const n=await requestText({title:'Renomear documento',input:{label:'Nome do documento',value:d.name,maxLength:100}});if(n===null)return;if(!n.trim())return toast('Nome não pode estar vazio');d.name=n.trim().slice(0,100);d.updatedAt=new Date().toISOString();recordHistory('Renomear documento');await persist(d);picker();toast('Renomeado');};
 $('duplicateDoc').onclick=async()=>{const d=current();if(d)await create(d.markdown,d.name+' (cópia)',d.appearance,d.pagination);const duplicated=current();if(duplicated){duplicated.themeLocks=normalizeThemeLocks(d.themeLocks);duplicated.recipeId=d.recipeId||null;duplicated.sectionDesign=parseSectionDesign(d.sectionDesign);duplicated.elementStyles=parseElementStyles(d.elementStyles);duplicated.pageLayout=parsePageLayout(d.pageLayout);await persist(duplicated);themeControls();}};
 $('deleteDoc').onclick=async()=>{const d=current();if(!d||!await confirmAlert({type:'danger',title:'Excluir documento?',description:'O documento “'+d.name+'” será excluído permanentemente.',confirmLabel:'Excluir documento'}))return;await flush();await removeRecord(d.id);documents=documents.filter(x=>x.id!==d.id);activeId='';if(documents.length)await switchTo(documents[0].id);else await create('','Novo documento');toast('Excluído');};
 $('exportMD').onclick=()=>{const d=current();if(d)download(d.markdown,filename(d.name)+'.md','text/markdown;charset=utf-8');};
 $('exportJSON').onclick=()=>{const d=current();if(d)download(JSON.stringify({format:'mdress-backup',version:1,name:d.name,markdown:d.markdown,appearance:d.appearance,pagination:parseSectionPolicies(d.pagination),themeLocks:normalizeThemeLocks(d.themeLocks),recipeId:d.recipeId||null,sectionDesign:parseSectionDesign(d.sectionDesign),elementStyles:parseElementStyles(d.elementStyles),pageLayout:parsePageLayout(d.pageLayout)},null,2),filename(d.name)+'.mdress.json','application/json');};
 function currentPDFOptions(){
  const preset=document.querySelector('input[name="pdfPreset"]:checked')?.value;
  return resolvePDFExport({
    profile:preset==='contrast'?'readable':preset==='full'?'visual':'custom',
    backgroundMode:$('pdfBackgroundMode').value,
    textMode:$('pdfTextMode').value,
    paper:$('pdfPaper').value
  });
 }
 function updatePDFNotes(){
  const options=currentPDFOptions();
  const match=Object.entries(PDF_PRESETS).find(([,preset])=>preset.backgroundMode===options.backgroundMode&&preset.textMode===options.textMode);
  $('pdfSelectionStatus').textContent=match?.[1].name||'Personalizado';
  const note=$('pdfProfileNotes'),warn=options.backgroundMode==='none'&&options.textMode==='document';
  note.hidden=!warn;note.textContent=warn?'Texto claro pode desaparecer no papel branco. Use texto escuro.':'';
  syncPropertyControls();
 }
 $('printPDF').onclick=()=>{
  const name='full';document.querySelector('input[name="pdfPreset"][value="'+name+'"]').checked=true;
  $('pdfBackgroundMode').value=PDF_PRESETS[name].backgroundMode;
  $('pdfTextMode').value=PDF_PRESETS[name].textMode;
  $('pdfPaper').value=current()?.appearance?.paper||'a4';
  document.querySelector('.pdf-custom-settings').open=false;
  updatePDFNotes();$('exportSettingsDialog').showModal();
 };
 for(const radio of document.querySelectorAll('input[name="pdfPreset"]'))radio.addEventListener('change',event=>{
  const preset=PDF_PRESETS[event.target.value];if(!preset)return;
  $('pdfBackgroundMode').value=preset.backgroundMode;
  $('pdfTextMode').value=preset.textMode;
  updatePDFNotes();
 });
 for(const id of ['pdfBackgroundMode','pdfTextMode','pdfPaper'])$(id).addEventListener('change',()=>{
  const match=Object.entries(PDF_PRESETS).find(([,preset])=>preset.backgroundMode===$('pdfBackgroundMode').value&&preset.textMode===$('pdfTextMode').value);
  for(const radio of document.querySelectorAll('input[name="pdfPreset"]'))radio.checked=radio.value===match?.[0];
  updatePDFNotes();
 });
 $('confirmPrint').onclick=async()=>{
  try{
   await flush();await ensureGoogleFont(current()?.appearance?.font);const options=currentPDFOptions();
   $('exportSettingsDialog').close();
   const currentTheme=validateTheme(current()?.appearance||defaults);
   const result=render({...currentTheme,paper:options.paper},{immediate:true});
   if(result?.status!=='ready'){toast('Aviso: layout exige revisão; confira o PDF antes de compartilhar.');}
   configurePDFPrint(document.body,options);
   $('printPageStyle').textContent='@page{size:'+(options.paper==='letter'?'letter':'A4')+';margin:0}';
   toast('Escolha Salvar como PDF e confira páginas e texto antes de enviar.');
   window.print();
  }catch(err){clearPDFPrint(document.body);render();toast('Não foi possível preparar impressão: '+err.message);}
 };
 window.addEventListener('beforeprint',()=>{
  const t=validateTheme(current()?.appearance||defaults);
  const paper=document.body.dataset.printPaper||t.paper;
  refreshShortSectionPolicies($('rendered'),((paper==='letter'?279.4:297)-2*t.layout.marginMm)*96/25.4);
 });
 window.addEventListener('afterprint',()=>{clearPDFPrint(document.body);render();});
 $('importMD').onclick=()=>$('fileInput').click();
 $('fileInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw Error('Limite de 2 MB');const content=await f.text();if(f.name.toLowerCase().endsWith('.json')){const data=JSON.parse(content);if(!['resume-studio-backup','mdress-backup'].includes(data.format)||typeof data.markdown!=='string')throw Error('Backup incompatível');await create(data.markdown,data.name||'Documento importado',data.appearance||defaults,data.pagination);const imported=current();if(imported){imported.themeLocks=normalizeThemeLocks(data.themeLocks);imported.recipeId=typeof data.recipeId==='string'?data.recipeId:null;imported.sectionDesign=parseSectionDesign(data.sectionDesign);imported.elementStyles=parseElementStyles(data.elementStyles);imported.pageLayout=parsePageLayout(data.pageLayout);await persist(imported);themeControls();}}else await create(content,f.name.replace(/\.md$/i,''));}catch(err){toast('Falha na importação: '+err.message);}e.target.value='';};
 for(const b of document.querySelectorAll('[data-view]')){
  b.onclick=()=>view(b.dataset.view);
  b.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const tabs=[...document.querySelectorAll('.editor-view-tabs [role=tab]')];
   const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(b)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   view(tabs[index].dataset.view);tabs[index].focus();
  });
 }
 for(const button of document.querySelectorAll('[data-theme-lock]'))button.addEventListener('click',()=>setThemeLock(button.dataset.themeLock));
 $('shuffleColors').onclick=()=>{
  const d=current();if(!d)return;
  const before=validateTheme(d.appearance);
  const next=shuffleColors(before,d.themeLocks);
  if(JSON.stringify(next)===JSON.stringify(before)){
   toast('Nenhuma combinação legível disponível com estas travas. Libere Paleta ou Fundo.');
   return;
  }
  d.recipeId=null;
  applyAppearance(next);
  toast('Nova paleta aplicada! Tipografia, layout e padrão de fundo preservados.');
 };
 function randomizeFullDesign(){
  const d=current();if(!d)return;
  try{
   const seed=Math.random();
   const before=validateTheme(d.appearance);
   const next=shuffleTheme(before,d.themeLocks,seed);
   const nextSections=surpriseSections(d.markdown,d.sectionDesign,d.themeLocks,(seed+.41421356237)%1);
   const changed=JSON.stringify(before)!==JSON.stringify(next)||JSON.stringify(parseSectionDesign(d.sectionDesign))!==JSON.stringify(nextSections);
   if(!changed){toast('Destrave alguma propriedade para variar.');return;}
   d.appearance=next;
   d.sectionDesign=nextSections;
   d.recipeId=null;
   d.updatedAt=new Date().toISOString();
   agentCandidate=null;$('applyAgentTheme').disabled=true;
   recordHistory('Surpreender visual e seções');
   revision++;const r=revision;
   themeControls();render();status('Alterações pendentes…');
   clearTimeout(saveTimer);
   saveTimer=setTimeout(()=>persist(d).then(()=>{if(r===revision)status('Salvo localmente');}).catch(()=>status('Falha ao salvar')),350);
   toast('Novo visual: tipografia, composição, espaçamentos e fundo, respeitando as travas.');
  }catch(error){toast(error.message);}
 }
 $('shuffleTheme').onclick=randomizeFullDesign;
  $('resumeTheme').onchange=e=>{const d=current();if(d)applyAppearance(selectPreset(e.target.value,d.appearance));};
 for(const [id,key] of [['accentColor','accent'],['backgroundColor','background'],['textColor','text'],['bgSecondary','secondary']])$(id).addEventListener('coloropacitychange',e=>applyAppearance({colorOpacity:{...validateTheme(current().appearance).colorOpacity,[key]:e.detail}}));
 for(const [control,key] of [['accentColor','accent'],['backgroundColor','background'],['textColor','text']])$(control).oninput=e=>applyAppearance({[key]:e.target.value});
 $('fontChoice').onchange=e=>applyAppearance({font:e.target.value});
 $('fontSize').oninput=e=>applyAppearance({size:Number(e.target.value)});
 $('paperSize').onchange=e=>applyAppearance({paper:e.target.value});
 $('zoom').onchange=e=>$('pageStack').style.setProperty('--preview-zoom',e.target.value);
 $('prevPage').onclick=()=>navigateToPage(activePage-1);
 $('nextPage').onclick=()=>navigateToPage(activePage+1);
 for(const key of ['marginMm','lineHeight','sectionGapEm','titleScale','sectionRule'])$(key).addEventListener('change',e=>applyAppearance({layout:{...validateTheme(current().appearance).layout,[key]:key==='sectionRule'?e.target.value:Number(e.target.value)}}));
 $('bgKind').addEventListener('change',e=>{
  if(e.target.value==='mesh'){
   const preset=getBackgroundPreset('mesh-soft');
   applyAppearance(applyBackgroundPreset(validateTheme(current().appearance),preset));
  }else applyAppearance({backgroundStyle:{...validateTheme(current().appearance).backgroundStyle,kind:e.target.value}});
 });
 for(const [control,key] of [['bgRadialX','radialX'],['bgRadialY','radialY'],['bgRadialRadius','radialRadius'],['bgSecondary','secondary'],['bgAngle','angle'],['bgPatternSize','patternSize'],['bgOpacity','opacity']])$(control).addEventListener('change',e=>applyAppearance({backgroundStyle:{...validateTheme(current().appearance).backgroundStyle,[key]:['radialX','radialY','radialRadius','angle','patternSize','opacity'].includes(key)?Number(e.target.value):e.target.value}}));
 $('themeTransferMenu').addEventListener('toggle',()=>{
  const menu=$('themeTransferMenu'),toggle=$('themeTransferToggle'),open=menu.matches(':popover-open');toggle.setAttribute('aria-expanded',String(open));
  if(open){const r=toggle.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.right-menu.offsetWidth))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,r.bottom+4))+'px';}
 });
 for(const id of ['shareTheme','importTheme'])$(id).addEventListener('click',()=>$('themeTransferMenu').hidePopover());
 $('saveThemePreset').onclick=async()=>{const d=current();if(!d)return;const name=await requestText({title:'Salvar tema',input:{label:'Nome do tema',value:'Meu tema',maxLength:80}});if(!name||!name.trim())return;const entry={id:uid(),name:name.trim().slice(0,80),appearance:validateTheme(d.appearance),createdAt:new Date().toISOString()};try{await saveStoredTheme(entry);savedThemes.push(entry);refreshSavedThemePicker();$('savedThemePicker').value=entry.id;$('deleteThemePreset').disabled=false;syncPropertyControls();toast('Tema salvo na biblioteca');}catch(err){toast('Falha ao salvar tema: '+err.message);}};
 $('savedThemePicker').onchange=e=>{$('deleteThemePreset').disabled=!e.target.value;const item=savedThemes.find(x=>x.id===e.target.value);if(item)applyAppearance(item.appearance);};
 $('deleteThemePreset').onclick=async()=>{const id=$('savedThemePicker').value,item=savedThemes.find(x=>x.id===id);if(!item)return toast('Selecione um tema salvo');if(!await confirmAlert({type:'danger',title:'Excluir tema salvo?',description:'O tema “'+item.name+'” será excluído. O documento não será alterado.',confirmLabel:'Excluir tema'}))return;try{await removeStoredTheme(id);savedThemes=savedThemes.filter(t=>t.id!==id);refreshSavedThemePicker();toast('Tema salvo excluído');}catch(err){toast(err.message);}};
 $('copyAgentPrompt').onclick=async()=>{try{const promptText=createThemeAgentPrompt($('agentBrief').value,current()?.appearance);try{await navigator.clipboard.writeText(promptText);toast('Prompt copiado; cole no seu LLM');}catch{await requestText({title:'Copiar pedido para IA',confirmLabel:'Concluir',input:{label:'Pedido',value:promptText,multiline:true,readOnly:true}});}}catch(err){toast(err.message);}};
 for(const chip of document.querySelectorAll('[data-ai-brief]'))chip.addEventListener('click',()=>{
  $('agentBrief').value=chip.dataset.aiBrief;
  for(const other of document.querySelectorAll('[data-ai-brief]'))other.setAttribute('aria-pressed',String(other===chip));
  $('agentBrief').focus();$('agentBrief').setSelectionRange($('agentBrief').value.length,$('agentBrief').value.length);
 });
 $('tryWithoutAI').onclick=()=>{
  const d=current();if(!d)return;
  randomizeFullDesign();setInspectorTab('themes');
  toast('Variação aplicada localmente, sem IA nem internet.');
 };
  $('agentJSON').addEventListener('input',()=>{$('applyAgentTheme').disabled=true;agentCandidate=null;});
 $('previewAgentTheme').onclick=()=>{try{agentCandidate=parseThemeAgentResponse($('agentJSON').value);render(agentCandidate);$('applyAgentTheme').disabled=false;toast('Prévia temporária; clique em Aplicar para salvar');}catch(err){agentCandidate=null;$('applyAgentTheme').disabled=true;render();toast(err.message);}};
 $('applyAgentTheme').onclick=()=>{if(!agentCandidate)return;applyAppearance(agentCandidate);agentCandidate=null;$('applyAgentTheme').disabled=true;toast('Tema aplicado ao documento');};
 $('resetResumeTheme').onclick=async()=>{if(await confirmAlert('Redefinir o estilo do documento? Cores, tipografia e configurações de página e fundo serão substituídas pelos valores padrão. O conteúdo Markdown e os temas salvos serão mantidos.'))applyAppearance(defaults);};
 $('shareTheme').onclick=async()=>{const code=themeCode(current().appearance);try{await navigator.clipboard.writeText(code);toast('Código do tema copiado');}catch{await requestText({title:'Copiar código do tema',confirmLabel:'Concluir',input:{label:'Código',value:code,multiline:true,readOnly:true}});}};
 $('importTheme').onclick=async()=>{const code=await requestText({title:'Importar tema',confirmLabel:'Continuar',input:{label:'Código do tema',placeholder:'Cole o código RST1…',multiline:true}});if(!code)return;try{const theme=decodeTheme(code.trim());if(!await confirmAlert('Aplicar o tema importado? O estilo atual do documento será substituído. O conteúdo Markdown será mantido.'))return;applyAppearance(theme);toast('Tema importado');}catch(e){toast(e.message);}};
 $('appTheme').onchange=e=>appTheme(e.target.value);
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();flush().then(()=>toast('Salvo localmente')).catch(err=>toast(err.message));}});
}
async function init(){bind();initializeFontCatalog($('fontChoice'),toast);try{appTheme(localStorage.getItem('resume-app-theme')||'mdress');}catch{appTheme('studio');}try{db=await openDatabase();documents=await readAll();savedThemes=await listStoredThemes();refreshSavedThemePicker();if(!documents.length)await create();else {let preferred='';try{preferred=localStorage.getItem('mdress.activeDocument')||'';}catch{}const selected=documents.find(d=>d.id===preferred)||documents.reduce((a,d)=>!a||d.updatedAt>a.updatedAt?d:a,null);await switchTo(selected.id);}}catch(err){status('Storage indisponível');$('source').value=sample;$('rendered').innerHTML=markdownToHTML(sample);toast('IndexedDB indisponível: '+err.message);}}
init();
