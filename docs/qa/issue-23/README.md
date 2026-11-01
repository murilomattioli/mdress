## UX-023 — foco ao sair do Color Picker: ordem Tab e fontes pointer-only (01/11/2026)

**Correções verificáveis:** o fechamento por Tab/Shift+Tab agora respeita a ordem sequencial de teclado do documento, inclusive `tabindex` positivo (valores positivos crescentes antes de `tabindex=0`, com desempate pela ordem DOM). Antes, uma fonte com `tabindex=2` e controles vizinhos com `tabindex=1/3` enviava o foco para o controle errado. Para fontes nativas acionáveis pelo ponteiro mas com `tabindex=-1`, o handoff procura o controle anterior/próximo na ordem DOM dos Tab stops regulares, em vez de saltar para o primeiro elemento não relacionado da página.

**Playwright Chromium:** `scripts/color-picker-qa.mjs` inclui quatro regressões adicionais em fixture móvel 390px: Tab/Shift+Tab com `tabindex` positivo em ordem diferente da DOM, e Tab/Shift+Tab a partir de fonte com `tabindex=-1`. Capturas: `tab-exit-positive-{forward,reverse}-390.png` e `tab-exit-pointer-only-{forward,reverse}-390.png`. O Browser Smoke executa o script obrigatoriamente; não confundir execução automatizada com homologação visual.

**PowerShell — verificar sem merge:**
```powershell
cd F:\Projects\lumu\tools\mdress
git status --short
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Outro terminal:
npm test
node scripts/color-picker-qa.mjs
npm run qa:supervised
```

**Homologação humana pendente:** revisar as quatro capturas, navegar por Tab/Shift+Tab em controles reais e conferir os 24 avisos de toolbar. PR #27 permanece draft, issue #23 aberta. Sem merge, release, Cloudflare ou alteração do repositório legado.

---

## UX-023 — identidade de fontes recicladas no color picker (01/11/2026)

**Correção:** o diálogo de cores agora invalida uma sessão quando o próprio `input[type=color]` conectado é reutilizado para outro ponto lógico, alterando `id` ou `data-mdress-source-key`. O mesmo vale após remover e reinserir o nó com outra identidade. A verificação ocorre no momento do commit, sem depender da execução posterior do `MutationObserver`. Uma simples mudança de `aria-label` não revoga o controle, porque rótulos não definem identidade.

**Condição de corrida assíncrona:** o observador acompanha alterações de identidade tanto na fonte original quanto em um input recém-remontado, inclusive antes de anexar o observador individual ao novo nó. Revoga a sessão mesmo se a chave mudar A→B→A dentro de uma única microtask. Isso impede que um resultado tardio do EyeDropper seja aplicado ao ponto lógico incorreto, apesar de a chave final voltar ao valor original.

**Regressão Playwright:** `node scripts/color-picker-source-identity-qa.mjs` inclui casos de reciclagem do mesmo elemento (com ID, chave e origem anônima), reinserção com outra chave, alteração apenas de rótulo e EyeDropper pendente durante A→B→A por ID/chave tanto no nó original quanto no nó remontado. O Browser Smoke executa esse teste obrigatoriamente. Evidência adicional: `test-results/color-picker/source-identity-connected-before-recycle.png`.

**Homologação humana:** testar no editor Mesh a troca rápida de pontos, inclusive exclusão/reordenação enquanto o seletor está aberto; conferir que o popup fecha sem modificar outro ponto e que a edição normal continua utilizável. Capturas e CI não substituem revisão visual/interativa. Manter PR #27 draft e issue #23 aberta; sem merge, release ou Cloudflare.

**PowerShell:**
```powershell
cd F:\Projects\lumu\tools\mdress
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro terminal:
node scripts/color-picker-source-identity-qa.mjs
npm run qa:supervised
```

---

## UX-023 — verificabilidade do overflow da toolbar (01/11/2026)

**QA funcional e visual:** o novo `scripts/toolbar-discoverability-qa.mjs` valida 8 combinações (2 temas × 4 larguras: 1440, 1024, 768 e 390 px). Cada cenário monta uma toolbar de overflow determinístico e verifica **8 ações acessíveis por Tab**, revelação visual do item focado, botões de rolagem com nome acessível e `aria-controls` válido, ativação por Enter e alcance do fim da barra. O Browser Smoke bloqueia o PR se a descoberta funcional falhar.

**Correção de foco da toolbar:** o `MutationObserver` agora observa também `aria-hidden` e `inert` nos descendentes da barra. Antes, ocultar semanticamente uma ação focada ou tornar um grupo inerte podia deixar o foco num controle indisponível até uma rolagem/redimensionamento. `scripts/toolbar-resize-qa.mjs` cobre ambas as revogações sem eventos de layout e gera `toolbar-aria-hidden-action-focus-recovered.png` e `toolbar-inert-group-focus-recovered.png`. A recuperação de foco deve ser validada visualmente e com teclado real.

**Evidências:** 24 screenshots (início, último comando via teclado e fim após rolagem por seta) em `test-results/ux-audit/toolbar-discoverability-{start,keyboard,end}-{theme}-{width}.png`, além de `test-results/ux-audit/toolbar-discoverability.json` no artefato temporário. A auditoria geral continua registrando os avisos `scrollable-toolbar`: **acessibilidade funcional não equivale a aprovação de composição visual**, nem elimina a necessidade de conferir se o usuário percebe que há ferramentas fora da área visível.

**PowerShell — verificar e homologar, sem merge:**
```powershell
cd F:\Projects\lumu\tools\mdress
git status --short
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Outro terminal:
node scripts/toolbar-discoverability-qa.mjs
node scripts/toolbar-resize-qa.mjs
npm run qa:supervised
```

**Revisão humana pendente:** comparar as capturas dos 8 cenários e experimentar rolagem, foco e descoberta de ações em dispositivos reais. Manter PR #27 draft e issue #23 aberta; sem merge, release ou Cloudflare.

---

## UX-023 — color picker: teclado IME e visual viewport (01/11/2026)

**Implementação:** o seletor de cores mantém o foco e não fecha ao receber Escape, Tab ou setas durante composição IME, inclusive quando o navegador omite `isComposing` e `keyCode=229`. Enter continua disponível para confirmar candidatos em campos editáveis, mas não ativa acidentalmente botões/abas. Após `compositionend`, atalhos e edição voltam a funcionar.

**Viewport móvel:** o popup usa o retângulo real de `visualViewport` (dimensões e offsets), limita largura/altura e permite rolagem interna quando o teclado virtual reduz a área útil. Eventos `visualViewport.scroll`/`resize` reposicionam o diálogo; os listeners são liberados ao fechar.

**Regressão Chromium obrigatória:** `node scripts/color-picker-viewport-ime-qa.mjs`, executado pelo Browser Smoke. Exercita teclas nativas durante composição, retomada após IME, mudança de aba e viewport deslocado/reduzido. Evidências: `test-results/color-picker/ime-hex-native-390.png`, `visual-viewport-390.png`, `visual-viewport-keyboard-390.png` e `visual-viewport-resized-390.png`.

**Revisão humana pendente:** testar teclado virtual e IME real em dispositivo; conferir as quatro capturas, legibilidade dos controles com altura útil pequena e rolagem interna. Teste automatizado não aprova UX visual. Sem merge, release ou deploy Cloudflare; PR #27 permanece draft.

**PowerShell:**
```powershell
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Outro terminal:
node scripts/color-picker-viewport-ime-qa.mjs
npm run qa:supervised
```

---

## UX-023 — intenção do ponteiro e movimento reduzido (31/10/2026)

**Correções:** o controlador de overflow não confunde um clique deliberado em espaço não focável com perda de foco causada por ocultação/desabilitação posterior. Cliques fora da toolbar **ou no fundo do shell** descartam o último comando/seta focados, evitando roubar o foco de volta quando o componente é alterado. Cliques nas próprias ações preservam o rastreamento necessário à recuperação legítima. A rolagem com `prefers-reduced-motion: reduce` agora utiliza `behavior: 'auto'` (valor padronizado), em vez de `instant` (não padronizado).

**Regressões Chromium:** `scripts/toolbar-resize-qa.mjs` cria uma toolbar isolada, verifica clique real do ponteiro fora e dentro do shell, perda intencional de foco, posterior ocultação/desabilitação sem captura indevida de foco, e rolagem com movimento reduzido. Evidência: `test-results/ux-audit/toolbar-outside-pointer-reduced-motion.png`.

**Aceite:** os testes automatizados comprovam comportamento, não qualidade visual. Revisar screenshot, teclado, ponteiro e os avisos informativos de overflow antes de homologar. Manter PR #27 draft e issue #23 aberta; sem merge, release, Cloudflare ou alterações no repositório legado.

---

## UX-023 — fieldset disabled: toolbar, foco e reparenting (31/10/2026)

**Correção:** a toolbar Markdown é um contêiner `div`, portanto não herda o pseudoestado CSS `:disabled` de um `fieldset disabled`. O controlador de overflow agora percorre os ancestrais e revoga a interatividade quando a barra pertence a um fieldset desabilitado, respeitando a exceção HTML do primeiro `legend`. Isso oculta as setas de rolagem e evita recuperar foco para comandos indisponíveis.

**Regressões Chromium:** `scripts/toolbar-resize-qa.mjs` verifica (1) desabilitação com comando focado, (2) desabilitação com seta focada e (3) reparenting de um comando focado para um fieldset previamente desabilitado. Em todos os casos, o foco deve sair do fieldset para o editor e as setas devem ficar ocultas. Evidências: `test-results/ux-audit/toolbar-disabled-fieldset-focus.png`, `toolbar-disabled-fieldset-arrow-focus.png` e `toolbar-reparent-disabled-fieldset.png`.

**Homologação:** avaliar as screenshots e testar navegação real por teclado. CI verde não equivale a aprovação visual. Manter PR #27 draft, issue #23 aberta e nenhum merge/release/Cloudflare.

---

## UX-023 — permissões dinâmicas nas abas e deep links (31/10/2026)

**Implementação:** a seleção de abas do inspetor agora recusa cliques sintéticos e chamadas programáticas direcionadas a abas desabilitadas, inertes ou ocultas por CSS. Quando a aba ativa perde permissão, o inspetor escolhe a próxima disponível, atualiza `aria-selected` e os painéis, e recupera o foco do tab ou de um controle do painel anterior. A navegação por ArrowLeft a partir de uma aba revogada começa pela última aba disponível; ArrowRight, pela primeira. O fluxo legítimo de pré-selecionar abas enquanto o painel inteiro está recolhido continua funcionando. Atalhos `revealInspectorControl` não expandem nem rolam controles de uma aba revogada.

**Regressões Playwright:** `scripts/inspector-header-qa.mjs` cobre bloqueio de clique/API, tab oculto por `content-visibility`, revogação da aba selecionada, recuperação de foco de um campo do painel, deep link bloqueado e pré-seleção com inspetor recolhido. Evidências: `test-results/header-revoked-tab-focus-recovery.png` e `test-results/header-revoked-panel-focus-recovery.png`.

**Homologação:** avaliar manualmente o comportamento das abas, a posição do foco e a legibilidade das capturas; CI verde não equivale a aprovação visual. Manter PR #27 em draft e issue #23 aberta até a revisão do usuário. Sem merge, release ou Cloudflare.

---

## UX-023 — lifecycle da toolbar e navegação por abas (31/10/2026)

**Implementação:** `app/toolbar-overflow.js` agora expõe uma função de descarte idempotente por instância, limpa `ResizeObserver`, `MutationObserver`, `requestAnimationFrame` e listeners globais, e desfaz o wrapper sem duplicar as setas. A remoção da toolbar/shell do DOM também descarta os recursos automaticamente; mover apenas a toolbar para outro pai preserva seu novo destino. Alterações de DOM sem relação com a toolbar deixam de disparar recálculo de layout. Os botões de rolagem apontam para o scrollport real via `aria-controls`.

**Acessibilidade:** `app/property-inspector.js` ignora abas ocultas, desabilitadas, inertes ou revogadas por ARIA ao navegar com as setas; mudanças programáticas de aba transferem o foco de um controle no painel que ficará oculto para a aba ativa. Isso evita foco invisível e destinos de teclado indisponíveis.

**Regressões Playwright:** `scripts/toolbar-resize-qa.mjs` verifica attach idempotente, `aria-controls`, descarte explícito, remoção automática, remount e movimentação do scrollport para outro pai. `scripts/inspector-header-qa.mjs` verifica ArrowRight com abas indisponíveis e recuperação de foco após troca programática de painel. Novas capturas: `test-results/ux-audit/toolbar-lifecycle-scroll-controls.png` e `test-results/header-inspector-tabs-focus-recovery.png`.

**Homologação:** conferir visualmente as duas capturas e a galeria supervisionada, com teclado e viewport real. Os avisos informativos de toolbar rolável exigem avaliação humana; testes verdes não são aprovação visual. Não executar merge, release nem deploy antes da homologação.

**PowerShell:**
```powershell
cd F:\Projects\lumu\tools\mdress
git status --short
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro terminal:
npm test
node scripts/toolbar-resize-qa.mjs
node scripts/inspector-header-qa.mjs
npm run qa:supervised
# Se uma captura for interrompida:
npm run qa:resume-capture
```

---

## UX-023 — toolbar: revogação de foco em shell e ancestrais (31/10/2026)

A barra Markdown agora considera o **estado interativo de toda a árvore de ancestrais** antes de exibir os botões de rolagem. Quando o shell ou um wrapper é ocultado por CSS, `content-visibility:hidden` ou revogado por `aria-disabled`, as setas deixam de ser focáveis. Se uma seta ou comando já tinha foco, ele é recuperado para o editor (ou outro controle visível), sem ficar em `<body>`.

O observador também acompanha **reparenting do shell**: deixa de observar os ancestrais antigos e passa a verificar os novos, incluindo alterações de `class`, `style` e permissões. Isso evita que mudanças de modo de workspace preservem comandos inacessíveis.

**Regressões Playwright:** `node scripts/toolbar-resize-qa.mjs` cobre ocultação do shell com seta focada, classe CSS aplicada em `body` com comando focado e revogação no novo wrapper após reparenting. Capturas: `ux-audit/toolbar-hidden-shell-arrow-focus.png`, `ux-audit/toolbar-hidden-ancestor-action-focus.png` e `ux-audit/toolbar-reparented-host-focus.png`. **CI verifica comportamento, não aprova UX visual:** revisar as três capturas e o teclado real antes da homologação.

**PowerShell (sem merge):**
```powershell
cd F:\Projects\lumu\tools\mdress
git status --short
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro PowerShell:
npm test
node scripts/toolbar-resize-qa.mjs
node scripts/inspector-header-qa.mjs
npm run qa:supervised
# Retomar captura interrompida:
npm run qa:resume-capture
```

PR #27 permanece draft e issue #23 aberta. Sem merge, release, Cloudflare ou alteração no repositório legado.

---

## UX-023 — recuperação de foco com content-visibility e revogação (31/10/2026)

A recuperação de foco do menu do inspetor agora valida a visibilidade de **todos os ancestrais** do destino, inclusive `content-visibility:hidden`, `visibility:collapse` e `display:none`. A remoção da última ação em um cabeçalho desabilitado não tenta focar seu toggle inacessível: usa um controle realmente disponível fora do host. A toolbar aplica a mesma regra quando o editor e a barra estão simultaneamente ocultos por CSS, evitando mover o foco para elementos invisíveis.

**Regressões Chromium:** `node scripts/inspector-header-qa.mjs` verifica revogação do host com o editor oculto; `node scripts/toolbar-resize-qa.mjs` verifica recuperação após ocultação simultânea do editor e toolbar. Capturas: `header-revoked-host-hidden-editor-focus.png` e `ux-audit/toolbar-hidden-workspace-focus-recovered.png`. A inspeção visual e interativa humana continua obrigatória.

**Comandos PowerShell:**
```powershell
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro PowerShell:
npm test
node scripts/inspector-header-qa.mjs
node scripts/toolbar-resize-qa.mjs
npm run qa:supervised
# Retomar:
npm run qa:resume-capture
```

PR #27 permanece draft; issue #23 aberta. Sem merge, release, Cloudflare ou alteração no repositório legado.

---

## UX-023 — permissões visuais responsivas sem mutação de DOM (31/10/2026)

O menu de ações agora reconcilia sua disponibilidade durante atualizações de geometria e viewport, além das mutações de atributos. Isso cobre regras `@media` que ocultam **itens individuais** sem modificar seus nós: ao ocultar a ação focada, o foco passa para a próxima; ao ocultar todas, o popover fecha, o gatilho desaparece e o foco retorna ao toggle. Quando a largura é restaurada, as ações reaparecem sem recriar o cabeçalho.

`content-visibility:hidden` também é tratado como indisponibilidade tanto nos ancestrais do cabeçalho quanto nos itens do menu. Um popover aberto não permanece interativo quando o host passa a ter conteúdo oculto.

**Regressões Chromium:** `node scripts/inspector-header-qa.mjs` cobre media queries em 390 → 375 → 350 → 390 px, foco contextual, menu vazio e restauração, além de `content-visibility:hidden` em ação e host. Evidências: `header-responsive-actions-focus-375.png`, `header-responsive-actions-empty-350.png`, `header-content-visibility-action.png` e `header-content-visibility-host-revoked.png`. O Browser Smoke inclui `test-results/header-*.png`. **Capturas exigem revisão humana; CI verde não equivale a homologação.**

**PowerShell (sem merge):**
```powershell
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npm run dev
# Outro terminal:
node scripts/inspector-header-qa.mjs
npm run qa:supervised
```

---

## UX-023 — recuperação de foco em hosts revogados e mudanças responsivas (31/10/2026)

Quando um menu do inspetor está aberto e seu cabeçalho é desativado (`aria-disabled`, `inert`, `fieldset disabled`), ocultado por CSS ou removido do DOM, o foco deve sair do popover para um controle **visível, habilitado e fora do host revogado**. O componente prioriza o editor Markdown quando disponível e usa outro controle acessível como fallback, sem restaurar foco para o gatilho inválido nem deixá-lo em `<body>`.

O observador acompanha remoções de nós ancestrais e libera listeners/ResizeObserver ao desmontar um cabeçalho aberto. O posicionamento também revalida a visibilidade do host durante `resize` e `visualViewport`, cobrindo mudanças de `@media` que não alteram atributos do DOM. Ações antigas continuam bloqueadas.

**Regressões Playwright Chromium:** `scripts/inspector-header-qa.mjs` agora verifica foco fora de hosts desabilitados, inertes, ocultos e removidos durante a abertura; cobre ainda uma media query que oculta o host durante resize e restauração posterior. Novas capturas: `header-revoked-host-focus.png` e `header-responsive-host-revoked-375.png`.

**Homologação humana:** revisar visualmente as capturas e navegar com teclado/IME real. Não confundir aprovação de testes com aprovação de UX. PR #27 permanece draft, issue #23 aberta; não executar merge, release ou deploy antes da homologação.

---

## UX-023 — revogação de ações após fechamento, desativação ou desmontagem (31/10/2026)

O menu compartilhado não executa callbacks de `menuitem` fora de um popover **aberto**, mesmo que um script dispare `.click()` em um botão oculto. Um cabeçalho removido do DOM também não pode executar ações antigas. Ao mudar permissões ou visibilidade de um **ancestral do cabeçalho** (`aria-disabled`, `inert`, `fieldset disabled`, `display:none`), o popover aberto é fechado; o trigger recusa cliques enquanto o host não é interativo. Ao restaurar o host, o mesmo componente pode abrir novamente.

O gate obrigatório `node scripts/inspector-header-qa.mjs` verifica callbacks obsoletos, permissões herdadas, fechamento de popover top-layer, restauração sem reconstrução e saída por Tab sem focar ações em contêineres indisponíveis. Evidência visual adicional: `test-results/header-host-permissions-restored.png`, transportada no artefato temporário do Browser Smoke. **Aprovação visual e interativa humana continua obrigatória**; testes verdes não homologam UX.

# Issue #23 — evidências duráveis

## UX-023 — remoção real de ações e evidências completas (31/10/2026)

Menus do inspetor agora excluem explicitamente **botões desconectados do DOM** da lista de ações disponíveis. O `MutationObserver` observa também `childList`: quando uma atualização de permissões remove a ação focada, o foco passa à próxima ação ainda presente (ou à anterior); ao remover a última ação, o popover fecha, o gatilho desaparece e o foco retorna ao toggle. Reinserir uma ação torna-a novamente utilizável sem reconstruir o cabeçalho. Um callback de botão removido é bloqueado mesmo que outro código invoque `.click()` na referência antiga.

**Regressão Chromium obrigatória:** `node scripts/inspector-header-qa.mjs` cobre remoção sequencial com foco, callbacks de ações desconectadas, fechamento sem ações e reinserção. Captura adicional: `test-results/header-removed-menu-actions-focus.png`.

**Correção do pacote de evidências:** o Browser Smoke agora inclui `test-results/header-*.png`, e não apenas alguns padrões específicos. Isso garante que capturas de permissões dinâmicas, remoção, IME, typeahead e viewport sejam transportadas para a revisão humana. A validação técnica da captura não equivale a aprovação visual.

**PowerShell (sem merge):**
```powershell
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# Em outro terminal:
node scripts/inspector-header-qa.mjs
npm run qa:supervised
# Retomar captura interrompida:
npm run qa:resume-capture
```

**Homologação visual/interativa humana pendente.** PR draft e issue aberta; não efetuar merge, release ou publicação Cloudflare.


## UX-023 — eventos nativos de teclado durante composição IME (31/10/2026)

Os testes anteriores verificavam apenas `KeyboardEvent` sintético durante `compositionstart`. Isso não exercita os comportamentos **nativos** do navegador: Escape pode dispensar um `popover`, Tab pode mover o foco e Enter pode ativar um botão mesmo quando o handler da aplicação retorna cedo.

O menu do inspetor agora cancela o comportamento padrão de **Escape e Tab** durante composição (`compositionstart`/`compositionend`, `isComposing` ou `keyCode=229`), sem cancelar o Enter necessário para confirmar candidatos do IME. A ativação do botão é protegida pelo estado de composição, impedindo que a confirmação de um candidato execute uma ação do menu.

**Regressão Chromium:** `scripts/inspector-header-qa.mjs` pressiona Escape, Tab, Shift+Tab e Enter por meio de `page.keyboard.press` durante uma composição ativa. Verifica popover aberto, foco preservado e ausência de callback; após `compositionend`, verifica que Home funciona novamente. Screenshot `header-ime-native-keys-390.png` é incluído no artefato do Browser Smoke para avaliação visual humana.

**Reprodução (PowerShell):**
```powershell
npm run dev
# Em outro terminal:
node scripts/inspector-header-qa.mjs
```

**Limite:** composição sintetizada + teclado real do Chromium não substitui homologação com um teclado IME real em sistema operacional móvel/desktop. Não fazer merge, release ou publicação antes da revisão humana.


## UX-023 — recuperação de foco após remoção dinâmica de comandos (31/10/2026)

Quando uma ação da toolbar é removida enquanto possui foco (mudança de modo, permissões ou re-render), o navegador pode devolver o foco para `<body>`. A toolbar agora guarda o **índice da última ação focada** e tenta recuperar a ação seguinte na mesma posição, ou a anterior quando não existe sucessora. Antes, uma remoção podia deslocar o usuário para o primeiro comando da toolbar, mesmo quando o vizinho permanecia disponível.

O `ResizeObserver` também deixa de observar grupos removidos e registra novos grupos somente uma vez, evitando reter elementos desconectados durante mudanças repetidas do editor. As ações indisponíveis continuam excluídas da recuperação.

**Regressões obrigatórias:** `scripts/toolbar-resize-qa.mjs` cobre remoção de ação intermediária, remoção da última ação, desabilitação com foco e recuperação sem cair em `<body>`. `tests/toolbar-overflow.test.mjs` cobre limites de rolagem fracionários e padding do comando focado. Evidências do Browser Smoke: `ux-audit/toolbar-removed-action-focus-recovered.png` e `ux-audit/toolbar-disabled-action-focus-recovered.png`. Execute `npm test` e `node scripts/toolbar-resize-qa.mjs` com `npm run dev` ativo. Capturas são evidências para **homologação humana**, não aprovação automática.


## UX-023 — toolbar responsiva e busca de menu após navegação (31/10/2026)

A toolbar do editor mantém o comando que já tinha foco visível quando o painel encolhe ou quando o splitter dispara `studio:resized`. A recuperação ocorre apenas após mudanças de layout (`ResizeObserver`, mutações e resize), **não** durante rolagem manual do usuário. A atualização é coalescida em um `requestAnimationFrame` para não multiplicar reposicionamentos. Ações desabilitadas/ocultas continuam usando a recuperação de foco existente.

O typeahead dos menus do inspetor reinicia ao usar Home/End, setas ou PageUp/PageDown. Uma pesquisa anterior não interfere na primeira tecla digitada após navegar por ações. O Playwright cobre a sequência `b → ArrowDown → r`, que deve alcançar **Ritmo**, e não reutilizar o prefixo anterior.

**Validação reproduzível (PowerShell, app iniciado com `npm run dev`):**
```powershell
node scripts/inspector-header-qa.mjs
node scripts/toolbar-resize-qa.mjs
node scripts/e2e.mjs
npm run qa:supervised
# Se a captura supervisionada foi interrompida:
npm run qa:resume-capture
```

**Evidências adicionais no Browser Smoke:** `header-typeahead-after-arrow.png`, `ux-audit/toolbar-resized-focused-action.png`, `ux-audit/toolbar-manual-scroll-with-focus.png` e `ux-audit/toolbar-splitter-focused-action.png`. Os testes novos são obrigatórios no CI; aprovação visual e interativa permanece humana. Não fazer merge, release nem publicação Cloudflare antes da homologação.


## UX-023 — navegação confinada e saída de menus por teclado (31/10/2026)

O menu de ações do inspetor mantém a rolagem **dentro do popover** durante Home/End, PageUp/PageDown, setas e typeahead: foco com `preventScroll` e deslocamento calculado somente para `menu.scrollTop`. A função pura `menuScrollDelta` tem regressões Node para visibilidade e padding; o Playwright verifica que a navegação não move a página nem outro painel. `scrollIntoView` nativo não é utilizado nos itens do menu.

O estado de composição IME agora acompanha `compositionstart`/`compositionend`, além de `isComposing` e `keyCode=229`: Escape/Tab/setas não encerram a interação durante composição, mesmo quando o navegador emite `keydown` sem flags. Ao concluir a composição, a navegação volta a funcionar.

Itens `role=menuitem` têm `tabIndex=-1`, preservando um único ponto de entrada na ordem de Tab; as setas e typeahead continuam alcançando cada ação. Tab e Shift+Tab fecham o popover e retomam a sequência de foco a partir do botão de opções, sem percorrer todos os comandos.

**Regressões:** `tests/inspector-header.test.mjs` e `scripts/inspector-header-qa.mjs`. Capturas para revisão: `header-typeahead-scroll-contained.png`, `header-typeahead-composition-lifecycle.png` e `header-typeahead-tab-exit.png` no pacote do Browser Smoke. Revisão visual/interativa humana continua obrigatória; não efetuar merge, release ou Cloudflare sem homologação.

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


## Identidade de fontes anônimas no color picker — 01/11/2026

Um `aria-label` é nome acessível, **não** identificador estável. Um picker aberto em um `input[type=color]` sem `id` ou `data-mdress-source-key` não deve migrar para outro campo com o mesmo rótulo (ou ambos sem rótulo) depois de uma remoção. Remontagem só é permitida quando o ID ou a chave lógica identifica **exatamente um** input; chaves/IDs duplicados invalidam a transferência. A fonte original anônima continua editável enquanto conectada.

Regressão obrigatória: `node scripts/color-picker-source-identity-qa.mjs` (Browser Smoke). Casos: sem nome, nome compartilhado, nome exclusivo, remount por chave lógica/ID estável e chave/ID ambíguos. Evidências: `test-results/color-picker/source-identity-*.png`. Esses cenários comprovam segurança de associação, **não** homologação visual; avaliar screenshots e fluxo interativo antes de fechar a issue.

## Color Picker — saída de Tab com radios e fontes sem Tab stop (01/11/2026)

A saída de um picker não modal deve continuar a navegação a partir da fonte original, sem pular para um controle distante nem modificar uma escolha de rádio. O `scripts/color-picker-qa.mjs` verifica, em Chromium móvel de 390 px:

- Fonte `tabindex="-1"` com vizinhos `tabindex` positivos: Tab e Shift+Tab alcançam o vizinho disponível mais próximo na ordem DOM.
- Grupo de rádios com opção marcada: Tab e Shift+Tab alcançam somente a opção marcada, ignorando membros desmarcados.
- Grupo sem opção marcada: foco vai ao primeiro rádio habilitado; com o primeiro desabilitado, avança ao próximo habilitado.
- Evidências: `test-results/color-picker/tab-exit-pointer-positive-*.png` e `tab-exit-radio-*.png` (incluídas no bundle do Browser Smoke).

A aprovação depende de inspeção humana das imagens e interação com teclado real; os testes de foco não substituem homologação visual. Nenhum merge, deploy ou release é autorizado por esses checks.

## Toolbar — direção RTL e setas físicas (01/11/2026)

A toolbar de uma interface RTL pode expor `scrollLeft` negativo (0 na borda direita, `-max` na esquerda). Os botões **Rolar para a esquerda/direita** representam direções físicas, não a ordem lógica de comandos: no início RTL, a seta esquerda deve estar habilitada e a direita desabilitada; na borda oposta, o inverso. Cliques e Enter devem mover o scroll na direção correspondente sem ocultar comandos nem gerar erro.

- Unitário: `tests/toolbar-overflow.test.mjs` valida os limites RTL, o meio do scroll e arredondamento fracionário.
- Chromium: `scripts/toolbar-discoverability-qa.mjs` executa cenário RTL 390px e registra `toolbar-rtl-{right-edge,middle,left-edge}-390.png` em `test-results/ux-audit`.
- Critério humano: inspecionar direção das setas, foco, recorte de comandos e os três screenshots; testes verdes **não** homologam UX.


### Navegação RTL — revisão humana obrigatória

O teste `node scripts/property-rtl-keyboard-qa.mjs` usa Chromium móvel de 390px, alterna a direção sem remontar os controles e registra três evidências em `test-results/ux-audit/`:

- `property-keyboard-ltr-390.png`: botões binários e segmentos no sentido padrão.
- `property-keyboard-rtl-390.png`: ordem visual RTL, foco e segmento intermediário desabilitado.
- `color-picker-tabs-rtl-390.png`: abas do seletor portalled com sentido RTL.

Verificar visualmente ordem, espaçamento, contraste, estados selecionados, foco perceptível e alvos de toque. As setas esquerda/direita seguem a posição **física** dos controles; Home/End preservam as extremidades da sequência. Testes automatizados não constituem homologação de UX.
