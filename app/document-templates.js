/** mdress: Markdown starters, no implicit document purpose. */
const fence=String.fromCharCode(96).repeat(3);
export const documentTemplates=Object.freeze([
 {id:'blank',name:'Em branco',description:'Comece do zero',markdown:''},
 {id:'article',name:'Artigo',description:'Textos e conteúdo editorial',markdown:'# O título do artigo\n\nUma introdução para o leitor.\n\n## O contexto\n\nDesenvolva sua ideia em parágrafos.\n\n## Pontos principais\n\n- Primeira ideia\n- Segunda ideia\n\n## Conclusão\n\nUma mensagem clara.'},
 {id:'documentation',name:'Documentação',description:'Guias técnicos e referências',markdown:'# Guia do projeto\n\n> Tudo que você precisa para começar.\n\n## Visão geral\n\nDescreva o projeto.\n\n## Instalação\n\n'+fence+'bash\nnpm install\n'+fence+'\n\n## Como usar\n\n1. Prepare o ambiente.\n2. Configure o projeto.\n3. Execute a aplicação.'},
 {id:'readme',name:'README',description:'Apresente um projeto',markdown:'# Nome do projeto\n\nDescrição curta e objetiva.\n\n## Funcionalidades\n\n- Fácil de usar\n- Configurável\n\n## Primeiros passos\n\n'+fence+'bash\nnpm install\nnpm run dev\n'+fence+'\n\n## Licença\n\nDefina a licença aqui.'},
 {id:'proposal',name:'Proposta',description:'Apresentações e propostas',markdown:'# Proposta de projeto\n\n**Preparado para:** Empresa ou pessoa\n\n## Objetivo\n\nExplique o problema e o resultado esperado.\n\n## Escopo\n\n- Entrega principal\n- Validação\n\n## Cronograma\n\n### Fase 1 — Descoberta\n\nAtividades iniciais.\n\n### Fase 2 — Implementação\n\nDesenvolvimento e revisão.\n\n## Próximos passos\n\nComo aprovar a proposta.'},
 {id:'portfolio',name:'Portfólio',description:'Projetos e estudos de caso',markdown:'# Meu portfólio\n\nApresentação do seu trabalho.\n\n## Projeto em destaque\n\n### O desafio\n\nQual problema precisava ser resolvido?\n\n### A solução\n\nComo a solução foi criada?\n\n### Resultados\n\n- Resultado mensurável\n- Aprendizado principal'},
 {id:'resume',name:'Currículo',description:'Modelo opcional de currículo',markdown:'# Nome Sobrenome\n\n**Especialidade profissional**\n\nCidade · contato@example.com\n\n## Sobre\n\nResumo da trajetória.\n\n## Experiência profissional\n\n### Cargo — Organização\n\n- Realização importante\n- Resultado alcançado\n\n## Competências\n\n- Competência 1\n- Competência 2\n\n## Formação\n\nInstituição · curso'}
]);
export function getDocumentTemplate(id){
 const item=documentTemplates.find(t=>t.id===id);
 if(!item)throw Error('Modelo de Markdown desconhecido');
 return item;
}
export function inspectMarkdown(md){
 if(typeof md!=='string')throw Error('Markdown inválido');
 const lines=md.split(/\r?\n/),diagnostics=[],headings=[],prose=[];
 let fence=null,links=0,images=0,codeBlocks=0;
 const add=(line,type,title,description)=>diagnostics.push({line,type,title,description});
 for(const [index,line] of lines.entries()){
  const number=index+1,trim=line.trim();
  const marker=trim.match(/^(`{3,}|~{3,})/);
  if(marker){
   if(!fence){fence={char:marker[1][0],length:marker[1].length,line:number};codeBlocks++;}
   else if(marker[1][0]===fence.char&&marker[1].length>=fence.length&&trim===marker[1])fence=null;
   continue;
  }
  if(fence)continue;
  prose.push(line);
  const heading=trim.match(/^(#{1,6})\s+(.+?)\s*#*$/);
  if(heading){
   const item={level:heading[1].length,title:heading[2],line:number};
   const previous=headings.at(-1);
   if(previous&&item.level>previous.level+1)add(number,'warning','Nível de título saltado',`Use H${previous.level+1} antes de H${item.level} para manter a hierarquia.`);
   headings.push(item);
  }
  if(line.length>2000)add(number,'warning','Linha muito longa','Divida o trecho em parágrafos para facilitar a leitura e a paginação.');
  for(const match of line.replace(/`[^`]*`/g,'').matchAll(/(!?)\[([^\]]*)\]\(([^)]*)\)/g)){
   const image=Boolean(match[1]),target=match[3].trim();
   if(image){images++;if(!match[2].trim())add(number,'warning','Imagem sem descrição','Preencha o texto entre colchetes para descrever a imagem.');}else links++;
   if(!target)add(number,'warning',image?'Imagem sem endereço':'Link sem destino','Preencha o endereço entre parênteses.');
   else {let supported=false;try{supported=['https:','http:','mailto:'].includes(new URL(target).protocol);}catch{}
    if(!supported)add(number,'warning','Endereço não suportado','A prévia aceita endereços completos http, https ou mailto. Revise este destino.');
   }
   if(!image&&!match[2].trim())add(number,'warning','Link sem texto','Dê ao link um nome que explique seu destino.');
  }
  if(/<\/?(script|iframe)\b/i.test(line))add(number,'warning','HTML não suportado','Scripts e iframes não são executados na prévia.');
 }
 if(fence)add(fence.line,'warning','Código não encerrado','Feche o bloco com uma cerca do mesmo tipo e tamanho da abertura.');
 if(!md.trim())add(1,'info','Documento vazio','Comece pelo editor ou importe um arquivo Markdown.');
 else if(!headings.length)add(1,'info','Organize a leitura com títulos','Use # para o título e ## para as seções, quando fizer sentido para este documento.');
 const words=(prose.join(' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)||[]).length;
 return {headings,lines:lines.length,characters:md.length,diagnostics,words,readingMinutes:Math.ceil(words/200),links,images,codeBlocks};
}
