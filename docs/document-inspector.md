# Painel de design do documento

## Inventário por aba, entidade e alcance

| Aba | Entidade / alcance | Campos e ações |
| --- | --- | --- |
| Documento | Tipografia global | `fontChoice` e ações de escolha; `fontSize` (pt), `lineHeight`, `titleScale` |
| Documento | Cores do conteúdo | `accentColor`, `textColor` |
| Documento | Papel e fundo | `backgroundColor`, `bgKind`; `bgSecondary`, `bgAngle`, `bgPatternSize`, `bgOpacity` somente quando aplicáveis |
| Documento | Pontos Mesh | `meshControls`, `meshAddPoint`, `meshCanvas`, `meshPointControls` (cor, X/Y, raio, intensidade, remoção), `meshSoftness`; aparecem dentro de Papel e fundo quando o tipo é mesh |
| Documento | Receitas de superfície | `backgroundGallery` e anterior/próximo/aleatório |
| Conteúdo | Seções: todas, nível ou ocorrência | `sectionStyleTarget`, `sectionStyleCurrent`, `sectionStyleGallery`, anterior/próximo, `sectionStyleReset` |
| Conteúdo | Posição da seção selecionada | `bottomSectionEnabled`, `selectedSectionBreak`; o alvo vem de `sectionStyleTarget`. `bottomSectionTarget` é apenas um adaptador interno oculto, sem segundo seletor visual |
| Conteúdo | Tipo de elemento ou ocorrência | `markdownElementTarget`, `markdownElementScope`, `markdownElementAll`, `elementStyleCurrent`, `markdownElementGallery`, anterior/próximo |
| Conteúdo | Propriedades individuais da ocorrência | `previewPropertyPanel`: fontSize (px), fontWeight, lineHeight, spacing (px), align e restaurar propriedades. Clique no elemento na prévia abre este contexto |
| Conteúdo | Ritmo global das seções | `data-section-density`: compact/normal/airy; `sectionGapEm` (em), `sectionRule` (linha/nenhum/bloco). Escopo global explícito, independente da seleção |
| Página | Folha | `paperSize` (A4/Letter), `marginMm` (mm). O seletor real saiu do cabeçalho e foi movido para esta aba; exportação preserva sua configuração |
| Página | Fluxo e paginação | `inspectorPageCount`, `inspectorLayoutWarning`, `showPageGuides`: diagnóstico e marcações de paginação. A lista `pageBreakList` fica em Estrutura → Quebras de página, no editor |
| Temas | Presets globais | `resumeTheme`, `themeRecipeGallery`, anterior/próximo/aleatório |
| Temas | Biblioteca local | `savedThemePicker`, `saveThemePreset`, `deleteThemePreset`, `shareTheme`, `importTheme` |
| Temas | Variações e proteção | `shuffleTheme`, `shuffleColors`, `surpriseColorSwatches`, `themeLockSummary`, travas colors/typography/spacing/background/sections |
| Temas | Criação assistida | Sugestões `data-ai-brief`, `agentBrief`, `tryWithoutAI`, `copyAgentPrompt`, `agentJSON`, `previewAgentTheme`, `applyAgentTheme`; briefing e proposta no mesmo grupo |
| Temas | Restauração global | `resetResumeTheme`, com confirmação |

## Navegação e relações

- Quatro abas reais: `document`, `content`, `page`, `themes`. Fundo é propriedade do documento; IA cria um tema, portanto não são abas independentes.
- Estrutura estática em HTML, preservando os IDs e handlers dos controles. Nenhuma cópia concorrente de estado de tema.
- A navegação lembra a rolagem de cada aba durante a sessão. Setas/Home/End navegam as abas.
- Selecionar uma seção ou elemento na prévia abre Conteúdo e revela o grupo correspondente, mesmo se estava recolhido.
- Uma única seleção de seção serve para estilo, rodapé e quebra. Rodapé exige ocorrência H1/H2; quebra exige uma ocorrência. Todas/nível continuam válidos para aplicar estilos.
- Os ajustes individuais saíram do popover flutuante para Conteúdo. O atalho na prévia leva a esses mesmos campos. O toolbar flutuante fica oculto em telas sem prévia disponível.
- Sólido mostra apenas cor do papel e tipo. Gradiente mostra cor auxiliar e ângulo; radial mostra cor auxiliar; padrões mostram escala e intensidade (linhas também ângulo); mesh mostra pontos e suavidade.
- Galerias, variações e criação assistida começam recolhidas quando não existe preferência salva. O usuário mantém controle da expansão.
- `setInspectorTab` aceita aliases antigos para chamadas externas: style/background → document; sections → content; ai → themes. O DOM e os testes usam as novas entidades.

## Verificação da reorganização

`node scripts/inspector-entities-qa.mjs` verifica a propriedade única dos campos, navegação por teclado, seleção compartilhada de seção, sincronização de quebras, ajustes de ocorrência, campos condicionais e persistência. Gera 24 capturas das quatro abas em 1440/768/390 px nos temas mdress/graphite em `test-results/inspector-entities/`. A aprovação final de UX continua sendo do usuário.

## Regras visuais

Usar os tokens de cor e fonte existentes; 16 px de recuo horizontal por grupo, cabeçalhos de 36 px, 6 px entre campos e 10 px abaixo. Labels e controles compartilham uma linha; labels longos podem quebrar sem truncamento. Sliders usam label, trilho e valor com unidade. Campos têm aproximadamente 32 px, com áreas ampliadas para selects e ações em telas de toque. Sem cartões ou rolagem interna nas galerias. Estilos prontos e Fundos prontos possuem ações SVG de anterior, próximo e aleatório no cabeçalho, independentes da expansão; aplicam as mesmas opções das galerias e anunciam a seleção. As galerias começam fechadas quando ainda não existe preferência salva; a escolha de expansão do usuário é preservada.

Validação específica: `node scripts/panel-layout-qa.mjs`, com `MDRESS_AUDIT_URL` apontando para o servidor. Percorre as quatro abas, verifica geometria e ausência de overflow, exercita anterior/próximo/aleatório com o grupo fechado e captura o painel em 1440, 768 e 390 px (`test-results/compact-inspector-*.png`).

## Limites e dependências

### Confirmação de ações sensíveis

Redefinir o estilo do documento, aplicar um código de tema importado, restaurar seções/propriedades/personalizações individuais e remover pontos Mesh exigem confirmação antes da mutação. Exclusão de documento e de tema salvo mantém a confirmação existente. As mensagens descrevem o alcance da alteração; código importado é validado antes de pedir confirmação. Cancelar não altera o histórico nem os dados. Salvar novo tema, copiar código e ajustes de edição continuam diretos. Verificação: `node scripts/destructive-actions-qa.mjs` cobre cancelar/confirmar, persistência após recarga e preservação do Markdown.

### Ações de escolha reutilizáveis

`createInspectorHeader({toggle, actions, menuItems, menuVisibility})` em `inspector-header.js` define a ordem título → ações opcionais → espaço flexível → menu opcional → chevron fixo à direita. O menu é omitido quando vazio; `menuVisibility: 'hover'` revela por hover/foco e permanece visível em touch. Itens aceitam `label`, `disabled` e `onSelect`. O grupo de escolhas aceita `actions` com ícone/título próprios, `onSelect`, `disabled` e `visible` (também funções). A navegação padrão continua compartilhada. `scripts/inspector-header-qa.mjs` verifica o menu com opções de teste, sem adicioná-las ao produto.

`app/design-system/choice-actions.js` fornece `createChoiceActions({label, source, readChoices})` para anterior/próximo/aleatório. Cada adaptador retorna opções habilitadas com `label`, `selected` e `apply`. O componente concentra navegação circular, sorteio sem repetir a opção atual, tooltips, anúncio acessível e desabilitação quando existem menos de duas opções. Fonte, estilos prontos e fundos prontos compartilham essa implementação. Para habilitar em outro select do inspector, adicionar `data-choice-actions`; o adaptador usa os eventos nativos e respeita options e optgroups desabilitados. Setas com haste e um divisor visual distinguem as ações do chevron de expansão.

### Seletor de cores

As amostras abrem o popover compartilhado, ancorado na amostra, em `app/design-system/color-picker.js`, com CSS próprio e ícones SVG locais. Adaptação da referência Apple sem React, Tailwind ou dependências novas: grade navegável pelas setas, espectro de saturação/valor com matiz separado, canais RGB e HEX validado. O popover abre abaixo, acima ou ao lado conforme o espaço disponível, sem bloquear o editor. Escape devolve o foco à origem; clique externo e saída por Tab fecham o seletor. Também atende aos pontos Mesh recriados durante a edição.

As alterações alimentam os inputs e eventos existentes, preservando a persistência do documento. Até 12 cores salvas ficam em `localStorage` (`mdress.saved-colors.v1`). O conta-gotas usa a API nativa quando disponível; a ausência de suporte desabilita o botão. Cores do documento continuam opacas em HEX de seis dígitos: a opacidade do fundo continua no controle específico de Papel e fundo, sem um controle de alpha que não seria persistido/exportado pelo modelo atual.

QA: `node scripts/color-picker-qa.mjs` (URL padrão `http://127.0.0.1:4174`, configurável por `MDRESS_AUDIT_URL`). Exercita 1440/768/390 px, modos claro/escuro, teclado, toque, HEX inválido, RGB, seleção, recarga após salvamento, cores salvas, popover não modal, clique externo e saída por Tab, disabled e Mesh. Conta-gotas é testado com API simulada e sem API; a captura real depende do navegador e de interação humana. Evidências: `test-results/color-picker/*.png`. Essas capturas não representam homologação visual do usuário.

Propriedades de elementos em Conteúdo: tamanho (px), peso, entrelinha, espaço abaixo (px), alinhamento, preset e restauração. Mesh: remoção exige pelo menos dois pontos remanescentes; X/Y de 0 a 100, raio de 15 a 120, intensidade de 0,05 a 1.

As propriedades individuais ficam em Conteúdo; o formato em Página; a cor do papel e a superfície em Documento. A exportação continua externa ao painel. Densidade e ritmo das seções são globais, independentemente do alvo selecionado.

### Busca de fontes

O select de fonte usa o atributo reutilizável data-searchable: dropdown de 320 px limitado ao viewport, busca fixa por nome/família, grupos filtrados e estado vazio. Setas percorrem resultados, Enter aplica e Escape retorna ao campo; a seleção mantém a persistência existente. Validação: node scripts/font-select-qa.mjs (1440, 768 e 390 px).

### Fluxo da aba Conteúdo

Aparência dos blocos reúne modo (Seção/Elemento), alvo e estilo. O nome do estilo abre sua galeria; as setas percorrem as opções. Posição aparece apenas para uma seção específica, com estados No fluxo/No rodapé e Continuar/Nova página. Ritmo do documento reúne densidade, espaçamento e separador globais. Campos de elemento usam a mesma coluna de ícones e controles alinhados.

O seletor de aparência usa dropdown nativo popover com miniaturas SVG distintas por preset, marca de seleção e navegação por setas/Home/End. A prévia também aparece no campo fechado; selecionar fecha a lista. A mesma apresentação atende Seção e Elemento.


### Alertas reutilizáveis

`app/design-system/alert-dialog.js` substitui todas as chamadas a `window.confirm`. O componente usa `<dialog>` modal estilizado, sem dependências. `showAlert(props)` e `confirmAlert(props)` retornam `Promise<boolean>`; `useAlert()` oferece os atalhos `show` e `confirm` para qualquer módulo (não requer React).

Props: `type` (`warning`, `danger`, `error`, `neutral`, `info`, `success`), `title`, `description`, `confirmLabel`, `cancelLabel`, `showCancel`, `showCloseButton` e `size` (`default`, `sm`). `confirmAlert` usa warning e Cancelar por padrão. Fechar/Escape retornam false; confirmar retorna true. Chamadas simultâneas entram em fila; foco permanece no modal e retorna à origem. Texto é inserido como texto, sem interpretar HTML. Animação respeita reduced-motion.

```js
import {useAlert} from './design-system/alert-dialog.js';
const alert = useAlert();
if (await alert.confirm({
  type: 'danger', title: 'Excluir tema?',
  description: 'O tema salvo será removido.', confirmLabel: 'Excluir tema'
})) {
  // Executar a exclusão somente depois da confirmação.
}
await alert.show({type: 'success', title: 'Tema salvo', description: 'Disponível na biblioteca.'});
```

Validação: `node scripts/alert-dialog-qa.mjs` e `node scripts/destructive-actions-qa.mjs`.
