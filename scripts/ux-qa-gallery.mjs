/** Local-only HTML gallery for reviewing the complete UX-023 screenshot matrix. */
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS,UX_QA_VIEWPORT_HEIGHT} from './ux-qa-coverage.mjs';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);

export function renderUxQaGallery(screenshots,coverage,sessionId='unassigned'){
 const index=new Map(screenshots.map(entry=>[
  entry.theme+':'+entry.width+':'+entry.state,entry
 ]));
 const sections=UX_QA_REQUIRED_SCREENSHOTS.map((state,number)=>{
  const images=UX_QA_MATRIX.map(({theme,width})=>{
   const filename=theme+'-'+width+'-'+state+'.png';
   const entry=index.get(theme+':'+width+':'+state);
   const actual=typeof entry?.path==='string'?entry.path.split(/[\\/]/).pop():'';
   const label=escapeHtml(theme+' · '+width+'px');
   if(actual!==filename)return '<figure class="missing"><figcaption>'+label+'</figcaption><p>Captura ausente ou inválida</p></figure>';
   return '<figure data-viewport-width="'+width+'" data-viewport-height="'+UX_QA_VIEWPORT_HEIGHT+'"><figcaption>'+label+'</figcaption><a href="'+escapeHtml(filename)+'" target="_blank" rel="noopener"><img loading="lazy" src="'+escapeHtml(filename)+'" alt="'+escapeHtml(state+' — '+theme+' '+width)+'"></a></figure>';
  }).join('\n');
  return '<details class="state" data-name="'+escapeHtml(state)+'"'+(number===0?' open':'')+'><summary>'+escapeHtml(state)+' <span class="badge" aria-label="Revisão pendente">Pendente</span></summary><div class="grid">'+images+'</div><p class="image-warning" role="alert" hidden>Não foi possível validar as seis capturas (ausentes, ilegíveis ou com dimensões incorretas). Corrija os arquivos antes de aprovar este estado.</p><div class="review-controls"><label>Revisão do estado <select class="review-status" disabled aria-label="Revisão '+escapeHtml(state)+'"><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="rejected">Reprovado</option></select></label><label>Observações <textarea class="review-note" aria-label="Observações '+escapeHtml(state)+'" placeholder="Contraste, clipping, foco, hierarquia, ergonomia…"></textarea></label></div></details>';
 }).join('\n');
 const css=':root{color-scheme:dark;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#101218;color:#e9ebf3}header{position:sticky;top:0;z-index:2;background:#191d27;padding:16px 24px;border-bottom:1px solid #454c5a}h1{font-size:21px;margin:0 0 8px}p{margin:4px 0;color:#bfc6d6}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}input,button,select,textarea{background:#2b3040;color:white;border:1px solid #737c92;border-radius:7px;padding:9px 12px;font:inherit}input{min-width:220px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #b2a0ff;outline-offset:2px}main{padding:14px 24px}.state{margin:12px 0;background:#1a1e28;border:1px solid #424858;border-radius:10px}.state>summary{cursor:pointer;padding:15px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px;padding:12px}figure{margin:0;min-width:0;background:#0c0e14;border:1px solid #3a4050;border-radius:7px;overflow:hidden}figcaption{padding:9px 12px;color:#d7dceb;font-size:13px}figure img{display:block;width:100%;height:auto}figure a:focus-visible{outline:3px solid #b2a0ff;outline-offset:-3px}.missing{padding-bottom:20px;text-align:center}.missing p{color:#ffb4b4}.review-controls{display:flex;gap:12px;align-items:start;flex-wrap:wrap;padding:12px;border-top:1px solid #424858}.review-controls label{display:flex;flex-direction:column;gap:5px;font-size:13px;flex:1 1 200px}.review-controls label:last-child{flex:3 1 360px}.review-controls textarea{min-height:60px;resize:vertical}.badge{margin-left:8px;padding:3px 7px;border-radius:6px;font-size:11px;background:#383e50;color:#f0f0f0}.state[data-verdict="approved"] .badge{background:#215940;color:#d2ffe3}.state[data-verdict="rejected"] .badge{background:#702f38;color:#ffe1e1}#review-progress{font-weight:600}#review-warning{color:#ffce8b}.image-warning{padding:0 12px 10px;color:#ffb4b4}.image-warning[hidden]{display:none}.review-status:disabled{cursor:wait;opacity:.65}figure a{cursor:zoom-in}#image-viewer{width:min(96vw,1480px);max-width:96vw;max-height:96vh;padding:14px;border:1px solid #737c92;border-radius:12px;background:#161b27;color:#e9ebf3}#image-viewer::backdrop{background:rgba(0,0,0,.82)}.viewer-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}#viewer-label{flex:1 1 240px;font-weight:650}#viewer-image{display:block;max-width:100%;max-height:calc(96vh - 145px);width:auto;height:auto;margin:auto;object-fit:contain}@media(max-width:700px){header,main{padding:12px}}';
 const script=String.raw`
const sessionId=JSON.parse(document.querySelector("#review-session").textContent);
const storageKey="mdress-ux023-review:"+sessionId;
const states=[...document.querySelectorAll(".state")];
const search=document.querySelector("#filter");
const progress=document.querySelector("#review-progress");
const warning=document.querySelector("#review-warning");
let onlyPending=false;
let saved={};
const imageChecks=new WeakMap();
let verificationNonce=0;
try{saved=JSON.parse(localStorage.getItem(storageKey)||"{}");if(!saved||typeof saved!=="object"||Array.isArray(saved))saved={};}catch{saved={};}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{warning.textContent="Armazenamento indisponível. Exporte antes de fechar a página.";}}
async function verifyImages(section,{fresh=false}={}){
 if(fresh)imageChecks.delete(section);
 if(imageChecks.has(section))return imageChecks.get(section);
 const select=section.querySelector(".review-status");
 const warningEl=section.querySelector(".image-warning");
 const check=(async()=>{
  const images=[...section.querySelectorAll("figure img")];
  if(images.length!==6)throw Error("Matriz incompleta");
  // Decode only one full-viewport image at a time to bound Chromium memory.
  for(const img of images){
   // Each export uses fresh URLs, but repeated full-viewport decodes can
   // exhaust browser image memory. Release each temporary image after
   // checking it, and retry transient decode errors once (never dimensions).
   for(let attempt=0;attempt<(fresh?2:1);attempt++){
    const candidate=fresh?new Image():img;
    if(fresh){
     const source=new URL(img.src,location.href);
     source.searchParams.set("mdress-verify",String(++verificationNonce));
     candidate.src=source.href;
    }else img.loading="eager";
    let decoded=false;
    try{await candidate.decode();decoded=true;}
    catch{}
    if(!decoded){
     if(fresh)candidate.removeAttribute("src");
     if(attempt+1<(fresh?2:1))continue;
     throw Error(img.alt+": arquivo indisponível ou ilegível");
    }
    const figure=img.closest("figure");
    const expectedWidth=Number(figure?.dataset.viewportWidth);
    const expectedHeight=Number(figure?.dataset.viewportHeight);
    const actualWidth=candidate.naturalWidth,actualHeight=candidate.naturalHeight;
    if(fresh)candidate.removeAttribute("src");
    if(actualWidth!==expectedWidth||actualHeight!==expectedHeight)
     throw Error(img.alt+": esperado "+expectedWidth+"×"+expectedHeight+
      ", recebido "+actualWidth+"×"+actualHeight);
    return;
   }
  }
  select.disabled=false;
  warningEl.hidden=true;
  return true;
 })().catch(error=>{
  select.disabled=true;
  warningEl.textContent="Não foi possível validar as seis capturas: "+(error?.message||"erro desconhecido");
  warningEl.hidden=false;
  const key=section.dataset.name;
  if(saved[key]?.status==="approved"){
   saved[key]={...saved[key],status:"pending"};
   select.value="pending";
   persist();
  }
  refresh();
  return false;
 });
 imageChecks.set(section,check);
 const result=await check;
 if(!result)imageChecks.delete(section); // Permit retry after files are restored.
 return result;
}
function refresh(){
 let approved=0,rejected=0;
 for(const section of states){
  const key=section.dataset.name;
  const entry=saved[key]||{};
  const status=["approved","rejected"].includes(entry.status)?entry.status:"pending";
  section.dataset.verdict=status;
  section.querySelector(".badge").textContent=status==="approved"?"Aprovado":status==="rejected"?"Reprovado":"Pendente";
  if(status==="approved")approved++;
  if(status==="rejected")rejected++;
  section.hidden=(onlyPending&&status==="approved")||!key.includes(search.value.trim().toLowerCase());
 }
 progress.textContent=approved+"/"+states.length+" estados aprovados · "+rejected+" reprovados · "+(states.length-approved-rejected)+" pendentes";
 warning.textContent=rejected?"Há estados reprovados: não aprove a UX.":approved===states.length?"Todos os estados revisados. Exporte o registro para homologação.":"A aprovação exige revisão explícita de todos os estados.";
}
for(const section of states){
 const key=section.dataset.name;
 const select=section.querySelector(".review-status");
 const note=section.querySelector(".review-note");
 select.value=["approved","rejected"].includes(saved[key]?.status)?saved[key].status:"pending";
 note.value=typeof saved[key]?.note==="string"?saved[key].note:"";
 section.addEventListener("toggle",()=>{if(section.open)void verifyImages(section);});
 if(section.open)void verifyImages(section);
 select.addEventListener("change",()=>{saved[key]={status:select.value,note:note.value};persist();refresh();});
 note.addEventListener("input",()=>{saved[key]={status:select.value,note:note.value};persist();});
}
search.addEventListener("input",()=>{refresh();if(search.value.trim())for(const s of states)if(!s.hidden)s.open=true;});
document.querySelector("#only-pending").addEventListener("click",event=>{onlyPending=!onlyPending;event.currentTarget.setAttribute("aria-pressed",String(onlyPending));refresh();});
document.querySelector("#expand").addEventListener("click",()=>states.forEach(s=>{if(!s.hidden)s.open=true;}));
document.querySelector("#collapse").addEventListener("click",()=>states.forEach(s=>s.open=false));
document.querySelector("#export-review").addEventListener("click",async event=>{
 const exportButton=event.currentTarget;
 exportButton.disabled=true;
 warning.textContent="Verificando as seis capturas de cada estado antes da exportação…";
 try{
  // Decode in bounded batches: 300 full-viewport PNGs at once can exhaust
  // memory on the laptops used for headed visual review.
  for(let offset=0;offset<states.length;offset++){
   warning.textContent="Verificando capturas: "+(offset+1)+"/"+states.length+" estados…";
   await verifyImages(states[offset],{fresh:true});
  }
 }finally{exportButton.disabled=false;}
 const review={schema:1,sessionId,exportedAt:new Date().toISOString(),states:Object.fromEntries(states.map(section=>{
  const key=section.dataset.name,entry=saved[key]||{};
  return [key,{status:entry.status||"pending",note:entry.note||""}];
 }))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)+"\n"],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="mdress-ux023-review.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 refresh();
});
document.querySelector("#reset-review").addEventListener("click",()=>{
 if(!confirm("Apagar avaliações deste conjunto de capturas?"))return;
 saved={};persist();
 for(const s of states){s.querySelector(".review-status").value="pending";s.querySelector(".review-note").value="";}
 refresh();
});
// Review the six variants in one accessible dialog, without opening six tabs.
// Modified clicks retain the original image link for pixel-level inspection.
const viewer=document.querySelector("#image-viewer");
const viewerImage=document.querySelector("#viewer-image");
const viewerLabel=document.querySelector("#viewer-label");
const viewerOriginal=document.querySelector("#viewer-original");
let viewerImages=[],viewerIndex=0,viewerOrigin=null;
function showViewerImage(){
 const img=viewerImages[viewerIndex];
 if(!img)return;
 viewerImage.src=img.src;
 viewerImage.alt=img.alt;
 viewerLabel.textContent=(viewerIndex+1)+"/"+viewerImages.length+" · "+img.alt;
 viewerOriginal.href=img.src;
}
function navigateViewer(step){
 if(!viewerImages.length)return;
 viewerIndex=(viewerIndex+step+viewerImages.length)%viewerImages.length;
 showViewerImage();
}
for(const section of states){
 section.querySelectorAll("figure a").forEach(anchor=>anchor.addEventListener("click",event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  viewerImages=[...section.querySelectorAll("figure img")];
  viewerIndex=viewerImages.indexOf(anchor.querySelector("img"));
  if(viewerIndex<0)return;
  viewerOrigin=anchor;
  showViewerImage();
  viewer.showModal();
 }));
}
viewer.querySelector("#viewer-prev").addEventListener("click",()=>navigateViewer(-1));
viewer.querySelector("#viewer-next").addEventListener("click",()=>navigateViewer(1));
viewer.querySelector("#viewer-close").addEventListener("click",()=>viewer.close());
viewer.addEventListener("keydown",event=>{
 if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
  event.preventDefault();
  navigateViewer(event.key==="ArrowLeft"?-1:1);
 }
});
viewer.addEventListener("close",()=>{viewerImage.removeAttribute("src");viewerOrigin?.focus();});
refresh();
`; 
 return ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mdress — revisão visual UX-023</title><style>'+css+'</style></head><body>',
  '<header><h1>mdress · QA visual supervisionado</h1><p>'+screenshots.length+' capturas registradas; '+coverage.expected+' obrigatórias. Falhas/ausências: '+coverage.missing.length+'. Testes verdes não aprovam a UX.</p><p id="review-progress" role="status" aria-live="polite"></p><p id="review-warning"></p>',
  '<nav><label for="filter">Filtrar estado</label><input id="filter" type="search" placeholder="Ex.: color, focus, range"><button id="only-pending" type="button" aria-pressed="false">Ocultar aprovados</button><button id="export-review" type="button">Exportar revisão JSON</button><button id="reset-review" type="button">Limpar revisão</button><button id="expand" type="button">Expandir</button><button id="collapse" type="button">Recolher</button></nav></header>',
  '<main>'+sections+'</main><dialog id="image-viewer" aria-label="Inspecionar captura"><div class="viewer-toolbar"><span id="viewer-label"></span><a id="viewer-original" target="_blank" rel="noopener">Abrir original</a><button id="viewer-prev" type="button">← Anterior</button><button id="viewer-next" type="button">Próxima →</button><button id="viewer-close" type="button">Fechar</button></div><img id="viewer-image" alt=""><p>Setas ← → alternam entre as seis capturas; Esc fecha.</p></dialog><script id="review-session" type="application/json">'+JSON.stringify(sessionId)+'</script><script>'+script+'</script></body></html>'].join('\n');
}
