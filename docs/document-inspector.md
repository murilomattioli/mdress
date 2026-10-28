# Painel de design do documento

## Inventário por aba e entidade

| Aba | Entidade / alcance | Campos e ações existentes |
| --- | --- | --- |
| Estilo | Tema do documento | Galeria `themeRecipeGallery`; preset `resumeTheme`; randomização `shuffleTheme` (visual e seções), `shuffleColors` (cores); prévia `surpriseColorSwatches`; travas colors, typography, spacing, background, sections; resumo `themeLockSummary` |
| Estilo | Tipografia global | `fontChoice`, `fontSize` (pt), `lineHeight` (multiplicador), `titleScale` (multiplicador) |
| Estilo | Paleta global | `accentColor`, `backgroundColor` (papel), `textColor` |
| Estilo | Biblioteca local | `savedThemePicker`, salvar `saveThemePreset`, excluir `deleteThemePreset`, compartilhar `shareTheme`, importar `importTheme` |
| Estilo | Documento | Restaurar `resetResumeTheme` |
| Seções → Blocos | Seções, nível de título ou seção individual | Modo section; alvo `sectionStyleTarget`; preset anterior/próximo, galeria `sectionStyleGallery`, seleção atual `sectionStyleCurrent`; restaurar `sectionStyleReset` |
| Seções → Blocos | Tipo de elemento ou ocorrência selecionada | Modo element; `markdownElementTarget`, alcance `markdownElementScope`, voltar ao tipo `markdownElementAll`; preset anterior/próximo, galeria `markdownElementGallery`, seleção `elementStyleCurrent` |
| Seções → Blocos | Densidade global das seções | `data-section-density`: compact, normal, airy. Não depende do alvo selecionado |
| Página | Folha | `marginMm` (mm). Formato A4/Letter vive no cabeçalho do preview e exportação |
| Página | Ritmo global das seções | `sectionGapEm` (em), `sectionRule` (linha, sem borda, bloco) |
| Página | Posição de uma seção | `bottomSectionTarget`, `bottomSectionEnabled`; depende da seção caber na página |
| Página | Paginação | `inspectorPageCount`, `inspectorLayoutWarning`, `showPageGuides`, `pageBreakList`: quebra explícita por seção |
| Fundo | Receita de fundo | `backgroundGallery`: 15 presets |
| Fundo | Superfície do documento | `bgKind`, `bgSecondary`, `bgAngle` (graus), `bgPatternSize` (px), `bgOpacity` |
| Fundo | Mesh / pontos individuais | `meshAddPoint`, `meshCanvas`: arrastar ou setas; `meshPointControls`: cor, X/Y (%), raio, intensidade, remover; `meshSoftness` (%) |
| IA | Briefing | Seis sugestões `data-ai-brief`, `agentBrief`, `tryWithoutAI`, `copyAgentPrompt` |
| IA | Proposta de tema | `agentJSON`, validar `previewAgentTheme`, aplicar `applyAgentTheme`. Sem provedor LLM conectado; aplicação depende da validação |

## Estrutura harmonizada

- Estilo: tipografia → paleta → estilos prontos (preset e galeria) → variações e travas → meus temas → restauração.
- Blocos: selecionar seção/elemento e alvo → aparência do alvo; densidade global em grupo explicitamente identificado.
- Página: margens → ritmo das seções → posição vertical → paginação.
- Fundo: propriedades editáveis → galeria → pontos Mesh condicionais.
- IA: direção visual → proposta e validação.

IDs, eventos e fontes de verdade são preservados. A estrutura está declarada diretamente no HTML; não há módulo de movimentação de campos no carregamento. As abas mantêm as chaves internas para preservar navegação contextual e integrações.

## Regras visuais

Usar os tokens de cor e fonte existentes; alinhamento à esquerda; 16 px de recuo horizontal (somente no grupo), 4 px acima do conteúdo, 12 px entre filhos e 16 px abaixo. Os filhos não acumulam margens. Uma única linha divide os grupos; campos não são cartões. Labels em linha própria evitam truncamento, com cores em linhas compactas. Valores e unidades permanecem juntos. Galerias usam a rolagem do painel, sem uma segunda rolagem interna. Foco, disabled e erros continuam sob responsabilidade dos componentes existentes. Ícones são SVG do Design System.

Validação específica: `node scripts/panel-layout-qa.mjs`, com `MDRESS_AUDIT_URL` apontando para o servidor, percorre todos os accordions das cinco abas, verifica padding/gap, ausência de overflow horizontal e altura fechada, e captura cada grupo em `test-results/group-*.png`.

## Limites e dependências

Editor flutuante de elementos: tamanho (px), peso, entrelinha, espaço abaixo (px), alinhamento, preset e restauração. Mesh: remoção exige pelo menos dois pontos remanescentes; X/Y de 0 a 100, raio de 15 a 120, intensidade de 0,05 a 1.

As propriedades detalhadas de um elemento selecionado ficam no editor flutuante do preview, fora das cinco abas. O formato do papel e opções de exportação também são externos ao painel. Cor do papel em Estilo e propriedades de Fundo compartilham a superfície do documento; não duplicar estado. A densidade das seções não deve ser apresentada como propriedade da ocorrência de elemento selecionada.
