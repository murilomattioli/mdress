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
 const lines=md.split(/\r?\n/),problems=[],heads=[];
 let fenced=false,openFence='';
 for(const [i,line] of lines.entries()){
  const trimmed=line.trimStart();
  const fenceMatch=trimmed.match(/^(\x60{3,}|~{3,})/);
  if(fenceMatch){if(!fenced){fenced=true;openFence=fenceMatch[1][0];}else if(fenceMatch[1][0]===openFence)fenced=false;continue;}
  if(fenced)continue;
  const h=trimmed.match(/^(#{1,6})\s+(.+?)\s*$/);
  if(h)heads.push({level:h[1].length,title:h[2],line:i+1});
  if(line.length>2000)problems.push({type:'warning',title:'Linha muito longa',description:'Linha '+(i+1)+' possui mais de 2.000 caracteres. Pode não quebrar bem entre páginas.'});
 }
 if(!md.trim())problems.push({type:'info',title:'Documento vazio',description:'Adicione conteúdo ou escolha um modelo inicial.'});
 else if(!heads.length)problems.push({type:'info',title:'Sem títulos',description:'Use # para definir um título e ## para organizar as seções.'});
 for(let i=1;i<heads.length;i++)if(heads[i].level>heads[i-1].level+1)problems.push({type:'warning',title:'Nível de título saltado',description:'O título da linha '+heads[i].line+' pula um nível na hierarquia.'});
 if(fenced)problems.push({type:'warning',title:'Código não encerrado',description:'Encerre o bloco de código com o mesmo tipo de cerca de abertura.'});
 if(/!\[[^\]]*\]\([^)]*\)/.test(md))problems.push({type:'info',title:'Imagem no Markdown',description:'Imagens externas ainda não são renderizadas. Prefira texto para informações essenciais.'});
 if(/<\/?(script|iframe)\b/i.test(md))problems.push({type:'warning',title:'HTML não suportado',description:'Scripts e iframes não são executados na prévia.'});
 return {headings:heads,lines:lines.length,characters:md.length,diagnostics:problems};
}
