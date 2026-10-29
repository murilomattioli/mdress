# Padrões de componentes do mdress

Contrato de implementação para todas as telas. Estes padrões consolidam os ajustes de UX da issue #23. A homologação visual continua pertencendo ao usuário; testes e screenshots não a substituem.

## Princípios

- Reutilizar o componente existente antes de criar outro comportamento ou CSS local.
- Campos dinâmicos também seguem o contrato: pontos de mesh geram `label.property-row` com input direto, permitindo o aprimoramento compartilhado de cores e ranges pelo observer existente. Não criar um segundo visual nativo para campos adicionados após a inicialização.
- Fundos: reunir o seletor de tipo e seus ajustes num grupo com fundo sutil e 6 px entre campos, sem repetir o nome do efeito em um subtítulo. Radial oferece cor central, centro X/Y e alcance; gradiente oferece cor final e ângulo; padrões oferecem cor, escala e intensidade. Não mostrar parâmetros sem efeito no tipo selecionado.
- JavaScript e CSS nativos. Não instalar React, shadcn, bibliotecas de ícones ou animação para reproduzir uma referência.
- Tokens `--ds-*` estilizam a interface; `--resume-*` pertencem ao documento e ao PDF. Não misturar os dois.
- Usar os IDs e eventos nativos como fonte de verdade. Uma representação visual não pode criar estado paralelo.
- Não usar `window.confirm`, `window.prompt`, `window.alert` nem seletores nativos visíveis nos fluxos do app.
- Não usar caracteres como chevrons, checks, fechar ou restaurar. Usar `ds-icon` e caminhos SVG locais. Símbolos de unidade, como ° e ×, continuam sendo texto.
- Corrigir a regra compartilhada responsável antes de acrescentar overrides específicos. Não copiar um componente para cada aba.

## Inventário e fontes

| Componente | Implementação | Uso |
|---|---|---|
| Tokens | `app/design-system/tokens.css` | Cor, fonte, espaço, dimensão e raio semânticos |
| Ícones e botões | `components.js`, `components.css` | Toolbar, navegação, menus, diálogos e ações |
| Select e controles de propriedades | `property-controls.js`, `property-controls.css` | Inspector, zoom, documentos, parágrafos e formulários |
| Ações anterior/próximo/aleatório | `choice-actions.js` | Fontes e presets; ações opcionais com estado disabled |
| Cabeçalho de accordion | `inspector-header.js` | Título, ações, menu opcional e expansão |
| Cor | `color-picker.js`, `color-picker.css` | Dropdown ancorado, paleta, espectro, RGB e HEX |
| Feedback e entrada de texto | `alert-dialog.js`, `alert-dialog.css` | Confirmação, informação, renomear, salvar/importar tema |
| Aparência de blocos | `styleThumbnail` e `syncStyleThumbnail` em `app.js`; `markdown-elements.css` | Dropdown com miniatura distinta por preset |
| Formulários completos | `.app-dialog` em `components.css` | Novo documento, interface, link, exportação e atalhos |

## Dimensões e hierarquia

- Workspace sem coluna lateral de navegação. Modos Editor/Dividido/Canvas e propriedades ficam no cabeçalho; em telas compactas, ocupam uma segunda linha. Editor e canvas usam toda a largura disponível.
- Editor/Análise são abas locais no cabeçalho do painel Markdown, sempre visíveis nas duas vistas. A troca preserva o modo do workspace e o texto; seleção explícita, roles tab/tablist/tabpanel e navegação por setas/Home/End.
- Análise: diagnósticos devem indicar linha, motivo e orientação; clicar seleciona o trecho no editor sem modificá-lo. O mapa de títulos também navega ao texto. Métricas de leitura são estimativas; checagem local de formato de links não implica disponibilidade do destino.
- Campos compactos: **32 px**, **36 px** para toque; toolbar do editor: 30 px, zoom: 27 px dentro de grupo de 33 px.
- Toolbar do editor: uma linha, sem scrollbar visível; setas SVG nas extremidades percorrem os comandos. Preservar rolagem por toque/trackpad e revelar o controle ao receber foco pelo teclado.
- Formulários modais: campos de 36 px, labels acima e 6 px de separação.
- Accordion: cabeçalho de 36 px; inset horizontal de 8 px; corpo com 4 px no início, 8 px entre campos e 12 px no final.
- Coluna de rótulo: 70 px; coluna de ícone: 24 px; distância até o campo: 8 px; valor de slider: 68 px.
- Títulos de grupo: 12 px / peso 600. Rótulos: 12 px / 400. Valores: peso 500. Estados selecionados: 600. Apoio: 11 px / 400.
- Borda direita dos campos alinhada. Uma mesma unidade visual contém os steppers, valor e unidade, ou a amostra, HEX e conta-gotas.
- Evitar campos desabilitados que não se aplicam ao alvo atual. Por exemplo, posição de seção só aparece quando há uma seção específica.

## Selects

`enhancePropertyControls()` atende ao inspector. `enhanceSelects(root = document)` transforma os demais `<select>` e mantém o elemento nativo oculto, seu ID e seus eventos `change`.

```js
import {enhanceSelects, syncPropertyControls} from './design-system/property-controls.js';
// Depois de inserir um formulário dinâmico:
enhanceSelects(form);
// Depois de alterar programaticamente o valor sem disparar change:
syncPropertyControls();
```

- A lista usa a camada superior (`popover`) e funciona também dentro de `<dialog>` modal.
- Nome acessível estável, valor selecionado anunciado, check SVG, hover e foco visíveis.
- Setas, Home/End, digitação, Escape e Tab funcionam; opções/optgroups desabilitados não são selecionáveis.
- Respeitar viewport e rolagem. Não usar somente `z-index` para tentar atravessar um modal.
- `data-searchable` habilita busca interna (usado em fontes). `data-preview="background"` habilita miniaturas de fundo.
- Todos os campos do inspector (selects, cores, números, sliders e toggles) usam rótulo acima e controle abaixo, na largura inteira. Sliders reservam a coluna da direita para valor e unidade. Ações rápidas ficam à direita do rótulo: anterior → próximo → aleatório opcional; o seletor e seu chevron ocupam a linha seguinte.
- Não colocar as ações depois do seletor. Chevron abre a lista; setas percorrem valores.
- Miniaturas devem revelar diferenças reais de composição; não repetir a mesma ilustração com uma cor diferente.
- Estilos prontos têm uma única galeria, reunindo presets clássicos e combinações visuais. Não exibir um segundo seletor de preset concorrente. Seleção é exclusiva; ajustes manuais removem a indicação de preset aplicado.
- Aparência dos blocos: modo Seção/Elemento → alvo → aparência. O seletor visual ocupa a largura inteira; anterior/próximo/restaurar ficam no cabeçalho imediatamente anterior ao campo. Restaurar é ação secundária com confirmação, não um botão destacado de largura inteira.
- Ajustes individuais identificam tipo, ocorrência e trecho do elemento. Visibilidade oculta preserva espaço na composição e na impressão; os elementos ocultos permanecem acessíveis pela lista no modo Elemento para serem reexibidos. O Markdown não é removido.
- Meus temas: exclusão junto ao seletor e desabilitada sem seleção; salvar aparência atual como ação principal; copiar/importar código como ações secundárias separadas. Evitar grades que deem o mesmo peso a salvar, excluir e transferir.

## Cores e números

- Cores: amostra + HEX editável + conta-gotas diretamente no campo. O dropdown abre ancorado, nunca centralizado.
- Conta-gotas só habilitado quando a API existe; cancelar não altera a cor.
- HEX inválido permanece como rascunho e mostra feedback. Não converter texto parcial em preto.
- Cores mantêm HEX6 e opacidade independente (0–100%). O picker usa uma linha compacta com slider e valor numérico. Persistir `colorOpacity` para as cores do documento e `opacity` em cada ponto mesh; aplicar alfa na renderização e impressão, sem alterar o HEX.
- Sliders e steppers respeitam min/max/step, unidades e estado disabled. Branco significa herdar apenas em campos `data-inherit`.
- Toggle deve descrever o estado quando houver significado específico: No fluxo/No rodapé, Continuar/Nova página, Ocultar/Mostrar.

## Accordions, tabs e cards

- Nas quatro abas, separar grupos por títulos e espaço: sem divisores horizontais entre accordions, modos ou subgrupos. Usar 6 px adicionais antes do próximo grupo após um accordion aberto. Preservar bordas de campos interativos e a delimitação da navegação.
- Cabeçalho: ícone de entidade + título + ações opcionais; menu de opções opcional e chevron na borda direita.
- Ações não expandem o accordion. Hover não muda posições nem cria um novo contexto de posicionamento por `filter`/`transform`.
- Tabs do inspector: ícone acima do texto, área própria, separação explícita e indicador de seleção. Navegação por setas/Home/End.
- Cards de preview não se movem nem recebem brilho no hover. A borda comunica interação sem alterar a imagem do resultado.
- Dropdowns de presets exibem miniatura, nome e check, com a mesma miniatura no campo fechado.

## Feedback e texto

```js
import {useAlert} from './design-system/alert-dialog.js';
const alert = useAlert();
const accepted = await alert.confirm({
  type: 'danger', title: 'Excluir tema?',
  description: 'O tema salvo será removido.', confirmLabel: 'Excluir tema'
});
if (accepted) await deleteTheme();

const name = await alert.prompt({
  title: 'Renomear documento',
  input: {label: 'Nome', value: documentName, maxLength: 100}
});
if (name !== null) await renameDocument(name);

await alert.show({type: 'success', title: 'Salvo', description: 'Tema disponível na biblioteca.'});
```

- Variantes: warning, danger, error, neutral, info, success.
- Props: title, description, confirmLabel, cancelLabel, showCancel, showCloseButton, size (`default`/`sm`).
- Entrada opcional: label, value, placeholder, required, maxLength, multiline, readOnly.
- `show`/`confirm` retornam boolean; `prompt` retorna string ou null. Executar mutações só após a resposta.
- Fila impede sobreposição. Cancelar/Escape não executam a ação. Foco começa na ação segura ou no input, permanece no modal e volta à origem.
- Animações respeitam reduced-motion. Conteúdo fornecido é texto, não HTML.
- Toast é retorno curto sem decisão; confirmação é modal; edição complexa usa formulário `.app-dialog`.

## Cobertura atual

| Área | Padrões aplicados |
|---|---|
| Documento, Conteúdo, Página e Temas | Campos, ícones, tabs, accordions, presets, cores, ações e confirmações |
| Cabeçalho | Select de documentos, ícones SVG e formulários de renomear/excluir |
| Editor | Select de parágrafo, toolbar compacta, ações de estrutura com SVG |
| Canvas | Zoom compartilhado e ações flutuantes com SVG |
| Novo documento / Configurações / Exportação | Selects compartilhados na camada superior, campos e botões consistentes |
| Biblioteca e importação | Entrada de texto e confirmação próprias, sem prompt do navegador |
| Mesh | Picker de cor compartilhado, excluir com SVG e confirmação |

## Verificação obrigatória

Renderizar no container real. Verificar largura estreita, tema claro/escuro, foco, hover, disabled, estados vazios/inválidos e persistência conforme o componente. Não afirmar que um layout está corrigido apenas por inspeção de CSS.

```powershell
$env:MDRESS_AUDIT_URL='http://127.0.0.1:4174'
pnpm check
pnpm test
node scripts/app-controls-qa.mjs
node scripts/e2e.mjs
node scripts/alert-dialog-qa.mjs
node scripts/destructive-actions-qa.mjs
node scripts/panel-layout-qa.mjs
```

Outras suítes específicas: `font-select-qa`, `color-picker-qa`, `accordion-hover-qa`, `inspector-header-qa`, `inspector-entities-qa`. Evidências locais ficam em `test-results/`. Não instalar dependências, fazer commit/push ou publicar sem autorização do usuário.

- Exceção contextual: o select de alvo imediatamente abaixo do switch Seção/Elemento não repete o rótulo visual. Manter nome acessível e 8 px entre switch e campo.

## Cores por elemento

A paleta do documento é a base. Conteúdo → Elemento permite sobrescrever texto e fundo por tipo ou ocorrência; listas e itens oferecem cor independente dos marcadores/números. O alcance aparece junto aos campos. Cada cor reutiliza o picker com opacidade e oferece Herdar para remover apenas aquela sobrescrita. Propriedades por ocorrência prevalecem sobre as do tipo; cores aceitam HEX6/HEX8 e acompanham o documento persistido. Marcadores nativos e de presets usam a mesma variável, sem mudar o texto ou o box.

## Exportação PDF

Modal compacto com aparência e papel como escolhas principais. Fundo e texto independentes ficam em Personalizar, recolhido ao abrir. Remover métricas de benchmark e explicações genéricas da jornada. Mostrar aviso contextual apenas quando a combinação exige atenção (cores originais em papel branco). Manter uma orientação curta sobre Salvar como PDF na janela de impressão. Preservar radios nativos acessíveis, selects compartilhados e ações de fechar/cancelar.

Visibilidade segue o mesmo alcance do seletor de elemento: tipo inteiro ou ocorrência. O eye toggle fica fora dos ajustes individuais e indica o alcance no nome acessível. Uma ocorrência pode sobrescrever o tipo e voltar a Herdar. Ocultar mantém o espaço; tipos ocultos continuam acessíveis no seletor e na lista de ocultos.

## Google Fonts

O seletor de fonte mantém fontes locais e pesquisa o catálogo local do Google Fonts. A lista é carregada quando o seletor abre; os resultados são montados em lotes de 60. Não carregar previews de todas as fontes. O catálogo contém apenas metadados (~170 KB), não arquivos de fonte. Atualizar com `node scripts/update-google-fonts.mjs`; o endpoint de metadados do site pode mudar, portanto a aplicação usa o snapshot local, não esse endpoint em runtime.

A seleção usa `google:Nome da Família`, validado e persistido com o tema. Carregamento por família, deduplicado, via CSS2 com `display=swap`, solicitando regular/negrito/itálicos disponíveis; demais pesos são sintetizados pelo navegador. Repaginar após o carregamento e aguardar antes de imprimir. Não alterar a fonte da interface. Primeira utilização requer internet; reuso offline depende do cache do navegador. Em falha, mostrar alternativa na prévia e impedir a exportação com fonte silenciosamente substituída. Não prometer disponibilidade offline de fontes externas.

## Agrupamento das cores globais

Documento reúne as cores em Cores e fundo: Texto e destaque (cores do conteúdo) e Papel e efeito (base do papel, tipo e parâmetros contextuais). Não criar uma segunda paleta global concorrente. Fundos prontos continuam como biblioteca de escolhas. Sobrescritas por tipo/ocorrência ficam em Conteúdo; o atalho Por elemento liga os dois escopos. Preservar IDs e os controles compartilhados.

## Campo numérico com slider integrado

Ranges e números com limites explícitos usam uma superfície de 32 px: menos à esquerda, área de arraste com preenchimento de fundo, valor editável/unidade e mais à direita. Compartilhar limites, incremento, eventos e estado disabled com o input original. Preservar validação da entrada numérica e navegação por setas. Números com herança/Auto ou sem limites definidos mantêm stepper sem slider, pois não há faixa finita aplicável. O preenchimento não deve cobrir o texto nem interceptar cliques.
