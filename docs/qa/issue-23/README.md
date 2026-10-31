# Issue #23 — evidências duráveis

## UX-023 — viewport visual móvel e composição IME (31/10/2026)

O menu compartilhado do inspetor usa o retângulo de `window.visualViewport` (largura, altura e deslocamentos), e não apenas `innerHeight`, para limitar altura/largura e posicionar ações quando teclado virtual, zoom ou deslocamento do viewport reduzem a área visível. Eventos `visualViewport.scroll` e `resize` reposicionam o popover aberto; os listeners são removidos ao fechar. Teclas de navegação e Escape com `isComposing` ou `keyCode=229` não alteram foco nem fecham o menu durante composição IME.

**QA Chromium obrigatório:** `node scripts/inspector-header-qa.mjs` simula uma área visual móvel deslocada, verifica limites após scroll e cobre Escape/setas/Home/End/PageUp/PageDown/Tab durante composição. Evidências: `header-edge-menu-visual-390.png`, `header-edge-menu-visual-scrolled-390.png` e `header-typeahead-ime.png` (capturadas no Browser Smoke quando o workflow passa). `npm run check` também valida sintaxe de `inspector-header.js`.

**Homologação:** screenshots e testes automatizados não aprovam a UX. Revisar visualmente e interagir em um dispositivo com teclado virtual/IME real antes de autorizar merge, release ou publicação. PR #27 permanece draft e a issue #23 aberta.

## UX-023 — navegação em menus extensos (30/10/2026)

Menus do inspetor com muitas ações agora oferecem **typeahead** por prefixo, ignorando acentos (ex.: `arvore` alcança **Árvore**), repetição de letras para alternar resultados, expiração de sequência após 700 ms e navegação por `PageUp`/`PageDown` (5 ações). `Home`, `End` e setas continuam disponíveis. A ação focada rola para a área visível do popover sem aumentar a altura do cabeçalho; itens do menu passam a ter alvo mínimo de 36 px. A composição IME (`isComposing`/`keyCode=229`) não ativa a busca por teclas.

**Regressão obrigatória:** `node scripts/inspector-header-qa.mjs` valida sequência de prefixo, diacríticos, letras repetidas, PageUp/PageDown, rolagem em 390×320, Escape e composição IME. Nova evidência `test-results/header-typeahead-focused.png`. Esse PNG é evidência técnica, **não homologação humana**. Os checks válidos são os do commit HEAD da branch; não inferir aprovação a partir de resultados de commits anteriores.

**PowerShell (sem merge):**
```powershell
cd F:\\Projects\\lumu\\tools\\mdress
git status --short
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro terminal:
node scripts/inspector-header-qa.mjs
npm run qa:supervised
# Para retomar a captura interrompida:
npm run qa:resume-capture
```

**Pendente:** avaliação visual e interativa humana da galeria e dos controles. PR draft e issue aberta; não realizar merge, release ou publicação Cloudflare antes da homologação.

## UX-023 — menus do cabeçalho do inspetor (30/10/2026)

O menu de ações de cada acordeão agora possui `aria-controls` estável, ignora ações desabilitadas na navegação por setas/Home/End e não exibe um trigger sem nenhuma ação disponível. O popover abre acima do gatilho quando falta espaço inferior, limita a altura a `100dvh - 16px` e permite rolagem interna sem ultrapassar a janela.

O teste `node scripts/inspector-header-qa.mjs` agora é um **gate obrigatório do Browser Smoke**: verifica ordem de título/ações/chevron, ativação por teclado, foco após Escape, navegação circular, ausência de ações disponíveis e geometria do menu em viewports 390×320 e 1024×420. Capturas `header-edge-menu-390.png`, `header-edge-menu-1024.png`, `header-pattern-390.png` e `header-pattern-1024.png` são anexadas ao pacote temporário do CI.

**Validação:** consultar os checks do HEAD do PR #27; esta seção documenta o contrato, não substitui o resultado do workflow. A revisão visual humana permanece pendente. Não executar merge/release/publicação antes da homologação.


> **Estado atual (30/10/2026):** a matriz UX-023 exige **115 estados × 2 temas × 4 larguras = 920 screenshots**. Os números menores abaixo são registros históricos de execuções anteriores, não o contrato vigente. A implementação e os testes automatizados não substituem a revisão visual/interativa do usuário. PR #27 continua draft, sem merge, release ou publicação.


Capturadas localmente em 29/10/2026, sobre a integração de `7d2688b`, `c341201`, `7e2e19f` e `0a0870c`. Documento sintético padrão; nenhum documento pessoal do usuário.

- [Desktop graphite, 1440 × 900](desktop-fonts.png): busca de fonte, painel e editor.
- [Mobile studio, 390 × 900](mobile-fonts.png): listbox dentro do viewport e foco visível.
- [PDF Soft Mesh](pdf-mesh.png): primeira página renderizada do PDF real, após corrigir a regra responsiva que ocultava o canvas na impressão com o inspetor aberto.

Estas três imagens foram inspecionadas pelo agente. Não representam aprovação humana das 544 capturas. A matriz automática completa passou em 8/8 cenários, sem findings, e está em `test-results/ux-audit/supervised/index.html` (gerada localmente, não versionada). Os artefatos de CI expiram em dois dias; estas imagens permanecem no Git.

## Reproduzir sem instalar dependências

Com Node e Playwright já disponíveis:

```powershell
$env:PORT='4174'
npm run dev
# Outro terminal:
$env:MDRESS_AUDIT_URL='http://127.0.0.1:4174'
npm run check
npm test
node scripts/e2e.mjs
node scripts/component-ux-audit.mjs
npm run qa:automatic
node scripts/ux-qa-gallery-smoke.mjs
npm run qa:supervised
```

No runner headed: ENTER avança, `m` permite intervenção no navegador, ENTER retoma, `q` interrompe sem aprovar. Para não sobrescrever outra sessão, configure `MDRESS_QA_DIRECTORY` e `MDRESS_QA_REPORT`. Exporte a revisão na galeria e use `npm run qa:resume-review -- CAMINHO_DO_JSON` para retomar a homologação vinculada às capturas.

`node scripts/pdf-quality.mjs` requer `pdfinfo` e `pdftotext` existentes. Alternativamente, `MDRESS_PDF_PYTHON` pode apontar para um Python existente com pypdf, sem instalação. A suíte verifica texto extraível, tamanho, paginação física, títulos/primeiro parágrafo e quebras explícitas; não certifica acessibilidade PDF/UA.

## F-013 — peso e sorteio harmônico

Integração de 29/10/2026: [desktop](pdf-weight-1440.png), [mobile](pdf-weight-390.png), [24 medições reais](pdf-weight-calibration.json). Capturas inspecionadas pelo agente; homologação do usuário pendente. `npm run qa:pdf-weight` valida abertura do detalhe, largura, alteração de custo ao aplicar Glass e persistência após recarregar. `node scripts/pdf-weight-calibrate.mjs` gera a calibração sob demanda. Ambos aceitam `MDRESS_AUDIT_URL`.

## UX-023 — composição IME em opções e paginação (30/10/2026)

O bloqueio de teclas de composição IME foi estendido para **todos os alvos do select portalled**: busca, opções, botão **Mostrar mais**, trigger e listener global. Eventos `isComposing` e teclados legados com `keyCode=229` não podem disparar navegação, typeahead, seleção, expansão ou fechamento do popover. A navegação normal por teclado continua ativa quando não há composição.

Atualizações assíncronas do catálogo são **adiadas durante a composição ativa**: o campo de busca não é substituído antes do evento `compositionend` e da última edição `input`. O Playwright valida o mesmo nó de busca durante a mutação, a atualização posterior do popover, o foco e o texto final. Capturas adicionais: `inspector-font-ime-catalog-pending.png` e `inspector-font-ime-catalog-resumed.png`.

O E2E Chromium verifica os dois formatos de eventos nos três tipos de botão, sem perder foco nem fechar a lista, e registra `inspector-font-ime-option.png` e `inspector-font-ime-pagination.png`. O runner supervisionado também registra os estados `select-ime-option-focus` e `select-ime-pagination-focus` em todos os temas e viewports. **Contrato: 115 estados × 8 combinações = 920 PNGs**, sujeitos a revisão humana. Eventos sintéticos verificam o tratamento do componente, mas não substituem testes manuais com um teclado IME real.

## UX-023 — navegação da paginação do seletor de fontes (30/10/2026)

O botão **Mostrar mais** pertence ao popover portalled ao `body`, não à ordem DOM do inspetor. Pressionar **Tab** ou **Shift+Tab** nesse botão agora fecha o popover e continua a navegação a partir do seletor nativo aprimorado, sem saltar para o começo/fim da página. O E2E Chromium cobre ambas as direções, com PNGs `inspector-font-pagination-tab-forward.png` e `inspector-font-pagination-tab-backward.png`. O runner supervisionado reproduz os dois estados em cada tema/largura, com 65 fontes sintéticas e verificação de foco acessível. O contrato de QA exige **888 PNGs**, mas apenas o CI pode confirmar sua execução; a aprovação visual continua reservada ao usuário.

## UX-023 — busca de fontes durante atualização assíncrona (30/10/2026)

O carregamento do catálogo também possui uma trava de concorrência: aberturas repetidas durante o mesmo fetch não criam optgroups duplicados. O E2E utiliza uma resposta de catálogo deliberadamente atrasada para verificar esse contrato.

O combobox compartilhado preserva **texto da busca, foco do teclado e quantidade de resultados expandidos** quando as opções nativas são adicionadas, removidas ou reordenadas com o popover aberto (inclusive durante o carregamento do catálogo Google Fonts). Se a busca não encontrar opções, o aviso tem `role="status"` para leitores de tela. O E2E Chromium injeta/remove optgroups com a busca aberta, verifica a preservação do rascunho e do foco, e gera `inspector-font-search-live-insert.png`, `inspector-font-search-live-focus.png` e `inspector-font-search-live-pagination.png` para inspeção humana. O teste também expande a segunda página de resultados e verifica que uma atualização assíncrona não a reduz novamente para 60 itens. A matriz supervisionada permanece em **840 capturas**; nenhuma evidência recebe aprovação automática.

## UX-023 — paginação acessível e contagem compacta de fontes (30/10/2026)

A busca no combobox de fontes agora apresenta **quantidade carregada / quantidade encontrada dentro da altura existente do campo**, sem acrescentar uma linha ao painel. Uma região de status fora do `role=listbox` anuncia os totais para leitores de tela; a mensagem vazia continua visível quando não há resultados.

Com mais de 60 opções, **Seta para baixo** na última opção leva a **Mostrar mais**, **Seta para cima** retorna à última opção e **Enter** carrega a próxima página. A ação possui indicador de foco visível. Se uma opção recém-revelada estiver desabilitada, o foco procura a próxima opção habilitada em vez de se perder no botão oculto.

O E2E Chromium valida os totais durante inserção assíncrona de optgroups, posição do contador dentro do campo, anúncio de acessibilidade, navegação por teclado, foco visível e expansão sem mouse. Capturas dedicadas: `inspector-font-search-count.png` e `inspector-font-pagination-focused.png` em `test-results/ux-audit/`, disponíveis no artefato temporário do Browser Smoke. **A matriz supervisionada permanece em 840 capturas**; os novos PNGs de regressão também requerem avaliação humana.

## UX-023 — troca de Color Picker e foco assíncrono (30/10/2026)

**30/10/2026 — conta-gotas inline:** o campo HEX aprimorado invalida a captura nativa já no primeiro `input`, inclusive para rascunhos inválidos. Respostas e erros tardios não apagam o rascunho nem seu feedback acessível. Transições `disabled → enabled` no mesmo task também invalidam a captura. Regressões Chromium e três estados de evidência humana (`color-eyedropper-inline-valid-draft`, `color-eyedropper-inline-invalid-draft`, `color-eyedropper-inline-rapid-reenable`) elevam a matriz para **105 estados × 2 temas × 4 larguras = 840 screenshots**. Homologação humana pendente.

O Color Picker não pode devolver o foco ao campo anterior quando outro seletor já está aberto. Cada instância possui IDs próprios para tabs, painéis e erros durante o fechamento assíncrono. O gate Chromium cobre Destaque → Texto → Destaque em 1440/768/390/320px, com capturas `switch-text-*.png` e `switch-back-*.png`. A matriz supervisionada exige **83 estados × 2 temas × 4 larguras = 664 capturas**. Checks verdes não substituem a revisão visual humana.


### Conta-gotas inline e amostras obsoletas
A captura nativa no inspetor mantém o foco do botão durante a espera e usa `aria-busy`/`aria-disabled`, sem abrir requisições concorrentes. Desabilitar/reabilitar a origem ou alterar a cor invalida a amostra pendente; respostas antigas não sobrescrevem edições recentes. O botão tem alvo de toque de 44px no mobile. A matriz supervisionada inclui três estados de foco, cancelamento e amostra obsoleta, sem homologação automática.


## UX-023 — slider auxiliar e rascunhos inválidos (30/10/2026)

Scrub desabilitado durante edição numérica inválida ou vazia, com posição anterior preservada e reativação após Escape/correção. E2E Chromium e matriz supervisionada exigem **86 estados × 2 temas × 4 larguras = 688 capturas**. Revisão visual humana continua obrigatória.


## UX-023 — amostras assíncronas do Color Picker (30/10/2026)

O conta-gotas do **popover completo** agora preserva a edição mais recente quando uma solicitação nativa pendente retorna depois de mudanças feitas no HEX, RGB, espectro, paleta ou opacidade. O resultado também é descartado se o input de origem mudar externamente, mesmo em uma sequência A → B → A, se a origem for substituída ou se houver uma transição rápida disabled → enabled. Cancelar ou fechar o seletor nunca concede aprovação nem aplica uma amostra obsoleta.

O gate `node scripts/color-picker-qa.mjs` cobre amostras pendentes, edições manuais, externas, opacidade, ABA, disabled → enabled e descarte após fechamento, com PNGs em `test-results/color-picker/`. A matriz supervisionada exige três novos estados (`color-picker-eyedropper-stale-manual`, `color-picker-eyedropper-stale-external`, `color-picker-eyedropper-stale-opacity`) em cada tema e viewport: **94 estados × 2 temas × 4 larguras = 752 capturas**. Nenhum resultado automatizado equivale à revisão visual humana.

No Windows/PowerShell, após atualizar a branch e iniciar `npm run dev`, execute em outro terminal:

```powershell
node scripts/color-picker-qa.mjs
npm run qa:supervised
# Se interrompido:
npm run qa:resume-capture
```

A galeria fica em `test-results/ux-audit/supervised/index.html`. Revisão humana pendente; PR draft, sem merge, release ou Cloudflare.

## UX-023 — falhas assíncronas e validação preservada (30/10/2026)

Rejeições tardias do EyeDropper seguem o mesmo contrato de obsolescência das amostras bem-sucedidas: edições posteriores de HEX/opacidade, mudanças externas e substituição do seletor impedem que uma falha antiga substitua feedback atual. Uma falha da captura ainda vigente continua visível; cancelar com `AbortError` não exibe erro.

Salvar a cor já confirmada enquanto um campo HEX contém rascunho inválido não apaga a mensagem de validação nem sua associação `aria-errormessage`. O gate `node scripts/color-picker-qa.mjs` inclui screenshots de erro atual, erro obsoleto descartado, preservação de validação e cancelamento. A matriz supervisionada exige quatro novos estados por tema e viewport: `color-picker-save-preserves-error`, `color-picker-eyedropper-stale-failure`, `color-picker-eyedropper-current-failure` e `color-picker-eyedropper-error-owner`. Total: **98 estados × 2 temas × 4 larguras = 784 capturas**. O CI valida execução e integridade, não aprova a UX; avaliação humana permanece obrigatória.

### Rascunhos não confirmados e EyeDropper (30/10/2026)

Amostras nativas pendentes não substituem texto digitado mas ainda não confirmado nos campos HEX, RGB ou opacidade. Rejeições obsoletas também não geram mensagens durante a edição. O gate Chromium cobre os quatro casos com capturas específicas; o runner supervisionado exige quatro novos estados em cada tema e largura (total: **816 capturas**). As imagens exigem inspeção humana; CI verde não homologa UX.


## UX-023 — buscas vazias e paginação durante atualização do catálogo (30/10/2026)

O combobox de fontes mantém o popover e o foco no campo de busca quando uma atualização assíncrona das opções nativas continua sem resultados, ou quando os únicos resultados filtrados estão desabilitados. A lista só fecha automaticamente quando **nenhuma opção habilitada existe no select inteiro**, preservando a recuperação de foco existente. O botão **Mostrar mais** também mantém o foco após inserções, remoções e renomeações de fontes; se a paginação deixa de existir, o foco volta à busca. A rolagem interna da lista de resultados é restaurada após uma atualização do catálogo, evitando saltos para o topo enquanto a pessoa pesquisa. A posição do cursor e a seleção de texto na busca também são preservadas quando o usuário está editando no meio da consulta.

O E2E Chromium cobre buscas vazias durante inserção de optgroup, filtro com opção desabilitada e atualização enquanto o botão de paginação está focado. PNGs: `inspector-font-search-live-empty.png`, `inspector-font-search-live-disabled.png` e `inspector-font-pagination-live-focus.png`. A matriz supervisionada exige mais quatro estados (`select-live-search-empty`, `select-live-search-disabled`, `select-live-pagination-focus`, `select-live-search-scroll`) em todos os temas e viewports: **109 estados × 2 temas × 4 larguras = 872 screenshots**. São evidências automatizadas para revisão humana, não homologação visual.

**PowerShell, sem merge:** `git fetch origin; git switch feat/23-property-controls-ux-qa; git pull --ff-only origin feat/23-property-controls-ux-qa; npm install --include=dev; npx playwright install chromium; npm run dev`. Em outro terminal: `node scripts/e2e.mjs; npm run qa:supervised`. Para retomar uma captura interrompida: `npm run qa:resume-capture`. Galeria: `test-results/ux-audit/supervised/index.html`.

## UX-023 — menus de acordeão com permissões dinâmicas e resize (30/10/2026)

O menu compartilhado de cabeçalhos do inspetor agora acompanha alterações de `disabled`, `hidden` e `aria-disabled` nas ações após a renderização. Quando a ação focada fica indisponível, o foco migra para uma ação habilitada; quando todas ficam indisponíveis, o popover fecha e o foco retorna ao toggle do acordeão. O mesmo retorno de foco ocorre quando o trigger está focado e perde sua última ação. Atributos `aria-disabled` bloqueiam também o callback, não apenas a navegação por teclado.

O popover reposiciona-se em `resize`, `scroll` e resize do `visualViewport` enquanto aberto, evitando coordenadas obsoletas em layouts responsivos. O nome acessível utiliza o texto do toggle quando não há `aria-label` explícito.

**Gate Chromium:** `node scripts/inspector-header-qa.mjs`. Testa atualização de permissões sem reconstrução do cabeçalho, recuperação de foco, bloqueio de callback, fallback do nome acessível e resize com popover aberto. Evidência adicional: `test-results/header-edge-menu-resized-390.png` (além das capturas existentes). A matriz supervisionada permanece com **115 estados × 2 temas × 4 larguras = 920 capturas**; estas evidências do gate são complementares, não contam como aprovação visual humana.

**PowerShell para homologação:** `git fetch origin; git switch feat/23-property-controls-ux-qa; git pull --ff-only origin feat/23-property-controls-ux-qa; npm install --include=dev; npx playwright install chromium; npm run dev`. Em outro terminal: `node scripts/inspector-header-qa.mjs; npm run qa:supervised`. Retomada: `npm run qa:resume-capture`. Galeria: `test-results/ux-audit/supervised/index.html`.

Não há aprovação automática da UX, merge, release ou publicação Cloudflare.
