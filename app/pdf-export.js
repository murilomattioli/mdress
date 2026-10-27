/** General Markdown publishing profiles; presentation never certifies parser compatibility. */
export const PDF_PRESETS=Object.freeze({
 full:Object.freeze({name:'Design completo',backgroundMode:'full',textMode:'document'}),
 light:Object.freeze({name:'Design simplificado',backgroundMode:'solid',textMode:'document'}),
 contrast:Object.freeze({name:'Alto contraste',backgroundMode:'none',textMode:'dark'})
});
export const PDF_PROFILES=Object.freeze({
 visual:Object.freeze({id:'visual',label:'Visual',description:'Preserva as escolhas de apresentação.'}),
 readable:Object.freeze({id:'readable',label:'Alto contraste',description:'Remove o fundo e usa texto escuro.'}),
 custom:Object.freeze({id:'custom',label:'Personalizado',description:'Controles independentes de fundo e texto.'})
});
const paperChoices=['a4','letter'];
export function resolvePDFExport(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['profile','includeBackground','backgroundMode','textMode','paper'].includes(k)))throw Error('Configuração de PDF inválida');
 const profile=raw.profile??'visual';
 if(!Object.hasOwn(PDF_PROFILES,profile))throw Error('Perfil de PDF desconhecido');
 if(raw.includeBackground!==undefined&&typeof raw.includeBackground!=='boolean')throw Error('Opção de fundo inválida');
 const bg=raw.backgroundMode??(profile==='readable'?'none':raw.includeBackground===false?'none':'full');
 const text=raw.textMode??(profile==='readable'?'dark':'document');
 if(!['full','solid','none'].includes(bg))throw Error('Opção de decoração inválida');
 if(!['document','dark'].includes(text))throw Error('Opção de texto inválida');
 const paper=raw.paper??'a4';
 if(!paperChoices.includes(paper))throw Error('Formato de página inválido');
 return Object.freeze({profile,includeBackground:bg!=='none',backgroundMode:bg,textMode:text,paper});
}
export function pdfExportNotes(input,backgroundKind='solid'){
 const options=resolvePDFExport(input),notes=[
  'Todos os modos mantêm o mesmo conteúdo Markdown como elementos textuais; nenhuma opção garante leitura perfeita em todos os leitores de PDF.',
  'A leitura por bots depende também de estrutura, ordem, fontes e do PDF final.'
 ];
 if(options.backgroundMode==='full'&&backgroundKind!=='solid')notes.push('Gradientes e padrões podem aumentar o PDF ou ser rasterizados pela impressão.');
 if(options.backgroundMode==='none'&&options.textMode==='document')notes.push('Atenção: cores claras do tema original podem ficar ilegíveis no fundo branco. Considere Texto escuro.');
 notes.push('Para PDF, escolha Salvar como PDF e desative cabeçalhos/rodapés do navegador.');
 return notes;
}
export function configurePDFPrint(root,raw){
 const config=resolvePDFExport(raw);
 if(!root||typeof root.setAttribute!=='function')throw Error('Container de impressão indisponível');
 root.setAttribute('data-pdf-profile',config.profile);
 root.setAttribute('data-print-background',config.backgroundMode);
 root.setAttribute('data-print-text',config.textMode);
 root.setAttribute('data-print-clean',String(config.backgroundMode==='none')); // backwards compatibility
 root.setAttribute('data-print-paper',config.paper);
 return config;
}
export function clearPDFPrint(root){
 if(root)for(const k of ['data-pdf-profile','data-print-background','data-print-text','data-print-clean','data-print-paper'])root.removeAttribute(k);
}
/** A file voluntarily selected by the user is measured locally; no upload, no PDF parsing claims. */
export function inspectPDFFile(file){
 if(!file||file.type!=='application/pdf'&& !/\.pdf$/i.test(file.name??''))throw Error('Selecione um arquivo PDF.');
 if(!Number.isFinite(file.size)||file.size<=0)throw Error('Arquivo vazio ou inválido.');
 const mib=file.size/(1024*1024);
 return Object.freeze({bytes:file.size,kib:Math.round(file.size/1024),label:mib>=1?mib.toFixed(2)+' MB':(file.size/1024).toFixed(1)+' KB',above500KiB:file.size>500*1024,aboveGreenhouseParserLimit:file.size>2.5*1024*1024});
}
