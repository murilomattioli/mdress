/** Local-only HTML gallery for reviewing the complete UX-023 screenshot matrix. */
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS} from './ux-qa-coverage.mjs';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);

export function renderUxQaGallery(screenshots,coverage){
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
  return '<details class="state" data-name="'+escapeHtml(state)+'"'+(number===0?' open':'')+'><summary>'+escapeHtml(state)+'</summary><div class="grid">'+images+'</div></details>';
 }).join('\n');
 const css=':root{color-scheme:dark;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#101218;color:#e9ebf3}header{position:sticky;top:0;z-index:2;background:#191d27;padding:16px 24px;border-bottom:1px solid #454c5a}h1{font-size:21px;margin:0 0 8px}p{margin:4px 0;color:#bfc6d6}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}input,button{background:#2b3040;color:white;border:1px solid #737c92;border-radius:7px;padding:9px 12px}input{min-width:220px}button{cursor:pointer}main{padding:14px 24px}.state{margin:12px 0;background:#1a1e28;border:1px solid #424858;border-radius:10px}.state>summary{cursor:pointer;padding:15px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px;padding:12px}figure{margin:0;min-width:0;background:#0c0e14;border:1px solid #3a4050;border-radius:7px;overflow:hidden}figcaption{padding:9px 12px;color:#d7dceb;font-size:13px}figure img{display:block;width:100%;height:auto}figure a:focus-visible{outline:3px solid #b2a0ff;outline-offset:-3px}.missing{padding-bottom:20px;text-align:center}.missing p{color:#ffb4b4}@media(max-width:700px){header,main{padding:12px}}';
 const script='const search=document.querySelector("#filter");const states=[...document.querySelectorAll(".state")];search.addEventListener("input",()=>{const term=search.value.trim().toLowerCase();for(const state of states){state.hidden=!state.dataset.name.includes(term);if(term&&!state.hidden)state.open=true;}});document.querySelector("#expand").addEventListener("click",()=>states.forEach(s=>{if(!s.hidden)s.open=true;}));document.querySelector("#collapse").addEventListener("click",()=>states.forEach(s=>s.open=false));';
 return ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mdress — revisão visual UX-023</title><style>'+css+'</style></head><body>',
  '<header><h1>mdress · QA visual supervisionado</h1><p>'+screenshots.length+' capturas registradas; '+coverage.expected+' obrigatórias. Falhas/ausências: '+coverage.missing.length+'. Testes verdes não aprovam a UX.</p>',
  '<nav><label for="filter">Filtrar estado</label><input id="filter" type="search" placeholder="Ex.: color, focus, range"><button id="expand" type="button">Expandir</button><button id="collapse" type="button">Recolher</button></nav></header>',
  '<main>'+sections+'</main><script>'+script+'</script></body></html>'].join('\n');
}
