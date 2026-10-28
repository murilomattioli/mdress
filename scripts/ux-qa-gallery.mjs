/** Local-only HTML gallery for reviewing the complete UX-023 screenshot matrix. */
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';

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
   return '<figure><figcaption>'+label+'</figcaption><a href="'+escapeHtml(filename)+'" target="_blank" rel="noopener"><img loading="lazy" src="'+escapeHtml(filename)+'" alt="'+escapeHtml(state+' — '+theme+' '+width)+'"></a></figure>';
  }).join('\n');
  return '<details class="state" data-name="'+escapeHtml(state)+'"'+(number===0?' open':'')+'><summary>'+escapeHtml(state)+' <span class="badge" aria-label="Revisão pendente">Pendente</span></summary><div class="grid">'+images+'</div><div class="review-controls"><label>Revisão do estado <select class="review-status" aria-label="Revisão '+escapeHtml(state)+'"><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="rejected">Reprovado</option></select></label><label>Observações <textarea class="review-note" aria-label="Observações '+escapeHtml(state)+'" placeholder="Contraste, clipping, foco, hierarquia, ergonomia…"></textarea></label></div></details>';
 }).join('\n');
 const css=':root{color-scheme:dark;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#101218;color:#e9ebf3}header{position:sticky;top:0;z-index:2;background:#191d27;padding:16px 24px;border-bottom:1px solid #454c5a}h1{font-size:21px;margin:0 0 8px}p{margin:4px 0;color:#bfc6d6}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}input,button,select,textarea{background:#2b3040;color:white;border:1px solid #737c92;border-radius:7px;padding:9px 12px;font:inherit}input{min-width:220px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #b2a0ff;outline-offset:2px}main{padding:14px 24px}.state{margin:12px 0;background:#1a1e28;border:1px solid #424858;border-radius:10px}.state>summary{cursor:pointer;padding:15px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px;padding:12px}figure{margin:0;min-width:0;background:#0c0e14;border:1px solid #3a4050;border-radius:7px;overflow:hidden}figcaption{padding:9px 12px;color:#d7dceb;font-size:13px}figure img{display:block;width:100%;height:auto}figure a:focus-visible{outline:3px solid #b2a0ff;outline-offset:-3px}.missing{padding-bottom:20px;text-align:center}.missing p{color:#ffb4b4}.review-controls{display:flex;gap:12px;align-items:start;flex-wrap:wrap;padding:12px;border-top:1px solid #424858}.review-controls label{display:flex;flex-direction:column;gap:5px;font-size:13px;flex:1 1 200px}.review-controls label:last-child{flex:3 1 360px}.review-controls textarea{min-height:60px;resize:vertical}.badge{margin-left:8px;padding:3px 7px;border-radius:6px;font-size:11px;background:#383e50;color:#f0f0f0}.state[data-verdict="approved"] .badge{background:#215940;color:#d2ffe3}.state[data-verdict="rejected"] .badge{background:#702f38;color:#ffe1e1}#review-progress{font-weight:600}#review-warning{color:#ffce8b}@media(max-width:700px){header,main{padding:12px}}';
 const script=String.raw`
const sessionId=JSON.parse(document.querySelector("#review-session").textContent);
const storageKey="mdress-ux023-review:"+sessionId;
const states=[...document.querySelectorAll(".state")];
const search=document.querySelector("#filter");
const progress=document.querySelector("#review-progress");
const warning=document.querySelector("#review-warning");
let onlyPending=false;
let saved={};
try{saved=JSON.parse(localStorage.getItem(storageKey)||"{}");if(!saved||typeof saved!=="object"||Array.isArray(saved))saved={};}catch{saved={};}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{warning.textContent="Armazenamento indisponível. Exporte antes de fechar a página.";}}
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
 select.addEventListener("change",()=>{saved[key]={status:select.value,note:note.value};persist();refresh();});
 note.addEventListener("input",()=>{saved[key]={status:select.value,note:note.value};persist();});
}
search.addEventListener("input",()=>{refresh();if(search.value.trim())for(const s of states)if(!s.hidden)s.open=true;});
document.querySelector("#only-pending").addEventListener("click",event=>{onlyPending=!onlyPending;event.currentTarget.setAttribute("aria-pressed",String(onlyPending));refresh();});
document.querySelector("#expand").addEventListener("click",()=>states.forEach(s=>{if(!s.hidden)s.open=true;}));
document.querySelector("#collapse").addEventListener("click",()=>states.forEach(s=>s.open=false));
document.querySelector("#export-review").addEventListener("click",()=>{
 const review={schema:1,sessionId,exportedAt:new Date().toISOString(),states:Object.fromEntries(states.map(section=>{
  const key=section.dataset.name,entry=saved[key]||{};
  return [key,{status:entry.status||"pending",note:entry.note||""}];
 }))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)+"\\n"],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="mdress-ux023-review.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.querySelector("#reset-review").addEventListener("click",()=>{
 if(!confirm("Apagar avaliações deste conjunto de capturas?"))return;
 saved={};persist();
 for(const s of states){s.querySelector(".review-status").value="pending";s.querySelector(".review-note").value="";}
 refresh();
});
refresh();
`; 
 return ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mdress — revisão visual UX-023</title><style>'+css+'</style></head><body>',
  '<header><h1>mdress · QA visual supervisionado</h1><p>'+screenshots.length+' capturas registradas; '+coverage.expected+' obrigatórias. Falhas/ausências: '+coverage.missing.length+'. Testes verdes não aprovam a UX.</p><p id="review-progress" role="status" aria-live="polite"></p><p id="review-warning"></p>',
  '<nav><label for="filter">Filtrar estado</label><input id="filter" type="search" placeholder="Ex.: color, focus, range"><button id="only-pending" type="button" aria-pressed="false">Ocultar aprovados</button><button id="export-review" type="button">Exportar revisão JSON</button><button id="reset-review" type="button">Limpar revisão</button><button id="expand" type="button">Expandir</button><button id="collapse" type="button">Recolher</button></nav></header>',
  '<main>'+sections+'</main><script id="review-session" type="application/json">'+escapeHtml(JSON.stringify(sessionId))+'</script><script>'+script+'</script></body></html>'].join('\n');
}
