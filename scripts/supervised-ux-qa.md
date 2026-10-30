# UX-023 — revisão supervisionada do inspetor e toolbar

O runner automatiza as interações e gera evidências, **não aprova a UX visual**. A revisão humana das capturas e dos estados interativos continua obrigatória antes de qualquer merge ou publicação.

## Preparar uma instalação nova (PowerShell)

```powershell
cd F:\Projects\lumu\tools\mdress
git status --short # preserve alterações locais antes de trocar de branch
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
```

Abra um segundo terminal na mesma pasta:

```powershell
npm run qa:supervised
```

O runner faz **um checkpoint por tema e largura (oito ao todo)**, depois de capturar os estados daquele viewport. Não é necessário pressionar Enter a cada screenshot. **Enter** avança ao próximo checkpoint, **m** libera o navegador para intervenção manual e **q** interrompe imediatamente o ciclo (inclusive no prompt de retomada), com código de saída não zero. **Ao terminar a matriz funcional, o modo supervisionado solicita um veredito visual explícito:** `a` solicita o arquivo JSON exportado da galeria (a aprovação só é registrada se todos os 89 estados tiverem sido marcados como aprovados na sessão atual); `r` reprova (exit code não zero), **Enter** mantém a revisão pendente e `q` interrompe. Arquivo ausente, sessão divergente ou estados pendentes/reprovados impedem a aprovação, mas não transformam checks automatizados verdes em falhas funcionais. Um resultado funcional `passed` nunca é sinônimo de homologação visual. A interrupção encerra a matriz sem solicitar checkpoints adicionais. O relatório inclui `summary.status` (`passed`, `failed` ou `stopped`) e `humanReview.status` (`approved`, `rejected`, `not-reviewed` ou `not-applicable` no CI) e reprova cobertura incompleta, repetida ou com subauditorias falhas. Capturas incluem estados hover de range e select. A auditoria salva as capturas em `test-results/ux-audit/supervised/` e o relatório em `test-results/supervised-ux-qa.json` (ignorados pelo Git). Se o servidor usar outra porta, configure `$env:MDRESS_AUDIT_URL='http://127.0.0.1:4174'` antes de executar o runner.

## Retomar uma matriz interrompida (sem repetir os viewports aprovados)

Se você digitou `q` ou um cenário falhou antes de completar a matriz, mantenha o diretório `test-results/` e execute no mesmo checkout, com o servidor `npm run dev` aberto:

```powershell
npm run qa:resume-capture
```

A retomada reutiliza **somente viewports concluídos e aprovados** na sessão anterior. Para cada viewport reutilizado, verifica os 89 nomes de estado, caminhos exatos, dimensões PNG, integridade dos arquivos e SHA-256. Capturas incompletas, modificadas, ausentes, duplicadas ou cenários com erro são **executados novamente**. O ID de sessão é preservado apenas quando o código-fonte, os scripts de QA, o `package.json`, a URL e o diretório de evidências correspondem exatamente à execução anterior (fingerprint SHA-256). Mudou o código? Inicie uma captura nova com `npm run qa:supervised` — misturar imagens de versões diferentes não é homologação.

A retomada exige `test-results/supervised-ux-qa.json` da execução interrompida/reprovada, com `sourceFingerprint`; relatórios antigos sem fingerprint não são elegíveis. O runner revalida a integridade novamente ao concluir e recusa aprovação visual automática. **A homologação humana também confere o fingerprint do código atual**: um app ou script alterado depois da captura exige novas evidências antes de aprovar. Relatórios antigos sem fingerprint são recusados na homologação, mesmo que as imagens ainda existam: uma nova captura supervisionada é obrigatória. `qa:resume-capture` **não** substitui `qa:resume-review`: este último apenas registra o veredito humano de uma matriz já concluída. O CI sempre começa uma captura nova, sem reutilizar evidências.

## Rastreamento de falhas (Playwright Trace Viewer)

O runner grava um `*-trace.zip` por cenário que **falhar ou for interrompido**. Cenários aprovados descartam o trace para evitar artefatos grandes. O JSON `test-results/supervised-ux-qa.json` lista os arquivos em `traces`, com tema e largura; os ZIPs ficam em `test-results/ux-audit/supervised/`. O Browser Smoke anexa esses traces quando houver falha. Para abrir localmente:

```powershell
npx playwright show-trace test-results/ux-audit/supervised/graphite-1440-trace.zip
```

Os traces podem conter o conteúdo dos documentos usados nos testes. Não publique esses ZIPs fora de um ambiente de QA controlado sem revisá-los.

## Execução automática (CI ou terminal)

```powershell
npm run qa:automatic
```

O CI executa Chromium headless, sem interação humana. Checks verdes indicam apenas que as assertivas automatizadas passaram. Avalie screenshots de foco, erros, controles desabilitados, overflow e legibilidade em todos os tamanhos testados. Registre problemas na issue #23, com tema, largura e estado. Não faça merge antes da homologação.

### Estados disabled e nomes acessíveis
Os campos derivados de range e color agora refletem o `disabled` do controle nativo; os steppers do number também são desativados e o input numérico possui nome acessível explícito. A matriz inclui capturas `range-disabled`, `color-disabled` e `number-disabled` em todos os temas e larguras. Também verifica a **transferência de foco ao desabilitar controles enquanto estão focados**: precisão do range, hexadecimal da cor, input numérico e botões de incremento/decremento (`range-disabled-focus-handoff`, `color-disabled-focus-handoff`, `number-disabled-focus-handoff`, `number-stepper-disabled-focus-handoff`). Isso evita controles aparentemente interativos quando o source of truth está bloqueado.

### Conta-gotas do inspetor: cancelamento e foco
Falhas reais de permissão/dispositivo do conta-gotas inline permanecem visíveis em um aviso `role=alert` próprio, associado ao botão por `aria-describedby`; não marcam o HEX válido como inválido. O aviso some ao tentar novamente, editar a cor ou desabilitar o controle. O estado `color-eyedropper-failure-feedback` exige uma captura em cada combinação de tema e largura, para homologação visual humana.

O botão de captura permanece focável durante a solicitação nativa e anuncia `aria-busy`/`aria-disabled`. A solicitação é invalidada imediatamente quando a cor de origem é desabilitada ou alterada por outro controle; uma resolução antiga não pode sobrescrever a cor, encerrar a captura mais recente nem roubar o foco. O botão tem área de toque de **44 × 44px** em telas estreitas. O E2E registra capturas de foco pendente, transferência ao desabilitar e retomada após reabilitar; a matriz supervisionada inclui `color-eyedropper-pending-focus`, `color-eyedropper-disabled-focus-handoff` e `color-eyedropper-stale-ignored` em todos os temas e larguras.

## Matriz de evidências obrigatórias (issue #23)

Cada captura registra uma impressão SHA-256 no relatório. O runner verifica integridade e dimensões após a captura e **novamente no momento da aprovação humana**; `qa:resume-review` exige o mesmo SHA-256 em todos os PNGs. Substituir uma imagem por outra PNG válida, mesmo com dimensões idênticas, invalida a homologação. Relatórios anteriores ao schema 6 precisam de nova sessão supervisionada para obter fingerprints confiáveis; não há migração automática de aprovação.

O relatório de QA (schema 6) valida **89 estados visuais × 2 temas × 4 larguras = 712 capturas**. Os estados `color-picker-error-handoff` e `color-picker-error-owner` registram, respectivamente, a troca de campo inválido HEX → RGB com referências ARIA consistentes e a preservação do erro HEX quando Escape cancela um campo RGB não relacionado. O estado `range-live-empty-draft` registra o campo de precisão vazio sem mutação do slider, com steppers temporariamente desabilitados; corrigir a entrada restaura as ações. O estado `number-disabled-invalid-draft` confirma que desabilitar um campo numérico durante uma edição inválida descarta o rascunho e limpa o feedback de erro, preservando o último valor confirmado. Os estados `toolbar-disabled-focus-handoff`, `toolbar-hidden-focus-handoff` e `toolbar-detached-focus-handoff` comprovam que desabilitar, ocultar ou remover um comando focado não perde o foco de teclado; grupos adicionados dinamicamente também são observados. Os estados `select-accordion-collapse-focus-handoff`, `select-tab-switch-focus-handoff` e `select-inspector-close-focus-handoff` verificam que o popup é fechado e o foco retorna a um controle visível quando um acordeão, uma aba ou o inspetor inteiro é ocultado programaticamente. O estado `select-long-option` comprova que nomes de opções extensos não provocam overflow horizontal, permanecem acessíveis via tooltip e são encontrados com busca sem acentos (`arv` → `Árvore`). Um cenário funcional aprovado não é suficiente se alguma captura obrigatória estiver ausente ou duplicada: `screenshotCoverage.missing`, `duplicates`, `unexpected` e `invalidPaths` geram finding de erro, impedem o veredito positivo do runner e bloqueiam a pergunta de aprovação humana. A matriz também cobre a atualização dinâmica de segmentos (inserção, remoção, renomeação, ocultação e transferência de foco), com capturas `segment-live-options`, `segment-live-focus-handoff`, `segment-removed-disabled-neighbor` e `segment-disabled-focus-handoff`. Os screenshots incluem novos casos de slider com limites/incrementos alterados em tempo real, entrada inválida, `step="any"` e estado desabilitado.

O runner também verifica a existência de cada arquivo PNG, **assinatura, chunks, CRC, descompressão e filtros do raster**, além das **dimensões exatas do viewport (largura da matriz × 900px)**, e registra erro se alguma captura desaparecer antes do relatório final. A galeria revalida as dimensões de todas as oito variantes ao abrir um estado e novamente ao exportar o JSON: PNGs 1×1, imagens cortadas ou capturas de outra largura invalidam a aprovação mesmo que o arquivo seja decodificável. Os novos estados `range-escape-focused` e `color-escape-focused` exigem que cancelar um rascunho inválido com Escape restaure o valor anterior **sem perder o foco do campo**, em cada tema e largura. O E2E também cobre a transferência de foco entre as setas de rolagem da toolbar nos limites esquerdo/direito, com capturas adicionais, e a rolagem respeita a preferência por movimento reduzido. Quando o editor oculta a toolbar inteira com uma seta de rolagem focada, o foco deve retornar a um controle visível (preferencialmente o editor), sem tentar focar comandos invisíveis; o E2E registra `toolbar-hidden-arrow-focus-handoff.png`. A captura `toolbar-last-focus` comprova que o foco por teclado revela a última ação mesmo quando a toolbar exige rolagem horizontal. A captura `color-draft-sync` confirma que uma atualização do inspetor não apaga o valor hexadecimal inválido em edição nem o feedback acessível. `range-native-override` valida que arrastar o slider descarta um draft numérico inválido, e `binary-disabled-focus-handoff` verifica o foco ao desabilitar um controle binário; `select-disabled-trigger-focus-handoff` cobre o combobox fechado com foco ao ser desabilitado. Ranges abaixo de 1e-12 não devem ser apresentados como zero.

A revisão humana precisa verificar legibilidade, foco, hierarquia, ergonomia e clipping das **712 capturas** e interagir no navegador. `humanReview.status=approved` só pode ser registrado após essa revisão explícita. O CI registra `not-applicable` mesmo quando todas as assertivas e evidências automatizadas estão completas. A issue continua aberta até a homologação do usuário.

## Galeria comparativa offline

A galeria também permite **Importar revisão JSON** para recuperar um rascunho exportado da mesma sessão, por exemplo após perda do armazenamento local. A importação rejeita IDs de sessão diferentes, estados extras/ausentes e formatos inválidos; antes de restaurar qualquer aprovação, revalida as oito imagens daquele estado. Um arquivo importado não constitui homologação automática.

Ao terminar (inclusive após falha), abra `test-results/ux-audit/supervised/index.html` no navegador. A galeria organiza os **89 estados** com oito capturas lado a lado (tema × largura), filtro por nome e links para as imagens originais. Ela é incluída no artefato temporário do CI, sem publicação pública e sem enviar documentos a serviços externos. **Uma galeria gerada não é aprovação humana**: revise as oito capturas de cada estado, selecione **Aprovado/Reprovado/Pendente** e registre observações. A galeria mostra o progresso e permite ocultar estados já aprovados; as marcações ficam no `localStorage` do navegador, isoladas por ID de sessão. Ao terminar, clique **Exportar revisão JSON**. No terminal supervisionado, digite `a` e informe o caminho completo do JSON exportado (por exemplo, `C:\Users\<usuario>\Downloads\mdress-ux023-review.json`). Somente 89 estados aprovados e o ID de sessão correto permitem `humanReview.status=approved`. A revisão exportada é um registro de avaliação humana, não uma inferência automática de qualidade. **Antes de liberar a avaliação de um estado, a galeria precisa decodificar suas oito imagens PNG.** Se uma captura estiver ausente, corrompida ou não puder ser aberta, a seleção de aprovação fica indisponível e qualquer aprovação anterior desse estado volta para `Pendente`. A exportação revalida as imagens de todos os 89 estados, inclusive aqueles aprovados antes de recarregar a página; não é possível homologar a sessão usando apenas nomes de arquivos ou miniaturas quebradas. Reabra o estado ou exporte novamente após restaurar as capturas para tentar a validação outra vez.

A galeria agora possui um visualizador ampliado: clique em uma captura para abrir as oito variantes no mesmo diálogo, use as setas esquerda/direita para alternar as oito variantes, **Shift + ←/→ para comparar a mesma variante (tema e largura) entre estados**, Esc para fechar e **Abrir original** para inspeção em resolução nativa. O próprio diálogo permite **registrar o veredito e as observações do estado**, com sincronização imediata com a galeria. **Estado anterior** e **Próximo estado →** percorrem os estados visíveis nos dois sentidos sem fechar o visualizador, com contador de posição e layout responsivo (inclusive 390px); o foco retorna à miniatura do estado atual ao fechar. As setas do teclado não interferem na edição das observações. Nenhum estado é aprovado automaticamente pela navegação, e a seleção de revisão só é habilitada após decodificar as oito imagens. Na exportação, as 696 imagens são requisitadas novamente com URL exclusiva; aprovações anteriores são revertidas para pendentes caso um PNG tenha sido apagado ou substituído por um recurso inválido desde a revisão inicial. Restaurar a imagem não reaplica a aprovação automaticamente. Verificações de imagem simultâneas usam uma versão por estado: um resultado antigo não pode reabilitar a aprovação depois de uma verificação mais recente ter detectado evidência inválida. A invalidação também atualiza imediatamente o veredito e a disponibilidade dos controles no visualizador ampliado.

A seleção exibida no combobox mantém nome acessível estável e anuncia o valor selecionado via `aria-describedby`, além de expor `title` para textos truncados. O handoff de foco do controle binário desabilitado exige um destino visível no inspetor, não apenas qualquer elemento tecnicamente focável.


## Retomar a homologação após fechar o terminal

Se a matriz supervisionada **já terminou com `summary.status=passed`**, mas você fechou o terminal ou escolheu deixar a revisão visual pendente, **não precisa repetir as 712 capturas**. Abra a galeria já gerada, revise todos os estados, exporte o JSON da mesma sessão e execute no PowerShell:

```powershell
cd F:\Projects\lumu\tools\mdress
npm run qa:resume-review -- "C:\Users\<usuario>\Downloads\mdress-ux023-review.json"
```

O comando reabre `test-results/supervised-ux-qa.json`, exige uma sessão **supervisionada e concluída**, valida o ID do JSON exportado e todos os 87 vereditos, e **relê os 696 arquivos PNG do disco**, verificando integridade e dimensões antes de registrar `humanReview.status=approved`. Captura ausente, corrompida, renomeada, sessão interrompida, resultado funcional falho ou JSON de outra sessão bloqueiam a aprovação sem modificar o relatório anterior. Não executa navegador nem CI, não cria capturas e **não realiza merge ou publicação**. A revisão visual e interativa precisa ter sido feita por você; esse comando apenas registra o veredito humano após verificar as evidências.

Se a execução foi interrompida **antes de concluir a matriz**, o status permanece `stopped` e a homologação é recusada: execute `npm run qa:resume-capture` para retomar apenas os viewports ainda não aprovados (ou `npm run qa:supervised` para iniciar uma sessão nova). Preserve o diretório `test-results/ux-audit/supervised/` e o relatório original enquanto revisa, pois uma nova captura gera outro ID de sessão e invalida o JSON anterior.


### Slider auxiliar de números e limites dinâmicos
O slider de um campo numérico com limites explícitos desabilita quando o controle nativo é desabilitado ou quando seus limites deixam de formar uma faixa válida. O foco do slider é transferido para outro controle visível do inspetor; o progresso inválido não exibe NaN. Os estados `number-slider-disabled-focus-handoff` e `number-slider-invalid-bounds` são obrigatórios nos oito cenários, com regressões E2E independentes.


### Troca de seletor de cores sem perda de foco (UX-023)

Os estados `color-picker-switch-text` e `color-picker-switch-back` comprovam a transição **Destaque → Texto → Destaque** sem evento de ponteiro. O diálogo antigo pode disparar `close` depois que o novo já recebeu foco; nesse caso, não deve devolver o foco ao controle anterior nem fechar o novo seletor. Os identificadores de abas, painéis e erros são exclusivos por instância, inclusive enquanto os dois elementos de diálogo coexistem durante o fechamento assíncrono. O gate `node scripts/color-picker-qa.mjs` testa essas transições e grava `switch-text-*.png` / `switch-back-*.png` em 1440, 768, 390 e 320px. Naquela etapa, a matriz exigia 86 estados e 664 capturas; atualmente são 89 estados e 712 capturas. A revisão humana permanece obrigatória.

### Conta-gotas assíncrono e foco (UX-023)

O conta-gotas do diálogo de cores aceita **uma única solicitação nativa pendente**: o botão continua navegável por teclado, anuncia `aria-busy` e `aria-disabled` e recebe feedback visual sem perder o foco. Respostas tardias, inclusive após Escape e abertura de outro seletor, não podem alterar a cor do documento nem fechar o novo diálogo. `scripts/color-picker-qa.mjs` exercita resolução adiada, cliques repetidos, encerramento durante a solicitação e produz `eyedropper-pending.png` e `eyedropper-stale-ignored.png`.

No controle de cor do inspetor, uma resolução assíncrona só devolve o foco ao botão quando o navegador deixou o foco em `body` ou no próprio botão. Se a pessoa navegou deliberadamente para o campo HEX, esse foco é preservado. `scripts/e2e.mjs` verifica as duas situações e gera `inspector-eyedropper-preserved-focus.png` e `inspector-eyedropper-restored-focus.png`.

Essas quatro capturas são **evidências funcionais adicionais** dos gates Chromium, não vereditos humanos nem estados novos da matriz de 672 imagens. A revisão visual da galeria supervisionada e das interações continua obrigatória antes de qualquer merge ou publicação.


### UX-023 — rascunhos numéricos e slider auxiliar (30/10/2026)

O scrub fica indisponível enquanto o rascunho está vazio, fora dos limites ou fora da grade de passos. A régua preserva a posição do último valor confirmado, sem transformar vazio em zero nem pintar `NaN%`; Escape ou correção válida reativam o gesto. Os estados `number-slider-invalid-draft` e `number-slider-empty-draft` exigem revisão visual humana nas oito combinações. Matriz: **89 estados × 2 temas × 4 larguras = 712 capturas**.

### Integridade da homologação (UX-023)

`qa:resume-review` exige um relatório de captura **schema 6 com `sourceFingerprint` SHA-256 válido**. Relatórios antigos sem fingerprint não podem receber aprovação retroativa: recapture com `npm run qa:supervised`. O comando também confere novamente o fingerprint após verificar todos os PNGs, evitando aprovar evidências enquanto o código é alterado. Os caminhos personalizados `MDRESS_QA_REPORT` e `MDRESS_QA_DIRECTORY` são compartilhados entre captura e homologação. A aprovação humana continua obrigatória; nenhum CI substitui a revisão visual.

### Proteção de homologação durante a revisão (UX-023)

Tanto a aprovação no terminal supervisionado quanto `npm run qa:resume-review`
verificam o fingerprint SHA-256 do código **antes e depois** da leitura
integral dos PNGs. Se `app/`, `scripts/` ou `package.json` mudar enquanto
a galeria está sendo revisada ou durante a validação, a aprovação é recusada.
Arquivos de evidência simbólicos (symlinks) também são recusados, mesmo quando
apontam para PNGs válidos. Testes de contrato cobrem alterações antes/depois
da validação e tentativas de reutilização de links simbólicos.

### Recuperação após encerramento inesperado

O runner supervisionado salva um relatório de retomada **atomicamente após cada
viewport**, mesmo antes da conclusão da matriz. Se o processo ou terminal fechar
inesperadamente, `npm run qa:resume-capture` pode reaproveitar os viewports
completos, desde que o código, a URL e os PNGs ainda correspondam. Um viewport
interrompido durante sua execução será recapturado integralmente. O relatório
intermediário sempre registra `summary.status=stopped` e
`humanReview.status=not-reviewed`: um checkpoint não é aprovação humana.
A gravação usa arquivo temporário e rename, para evitar JSON truncado em
interrupções durante a escrita. Uma execução completa substitui esse checkpoint
pelo relatório final habitual.

### Revisões antigas não aprovam capturas refeitas

Quando `qa:resume-capture` precisa refazer **qualquer** viewport, o runner
gera um novo ID de sessão para a revisão humana. Assim, um JSON exportado
anteriormente ou aprovações armazenadas no navegador não podem homologar
screenshots substituídos sem inspeção. Se os oito viewports forem reutilizados
sem nenhuma recaptura, o ID anterior é preservado e a revisão pode continuar.

### Range: incremento sobre rascunho válido (30/10/2026)

Quando a precisão contém um valor **válido, ainda não confirmado** (por exemplo, faixa 2–14, passo 3, valor nativo 8 e rascunho 11), clicar em `+` deve produzir **14**, e não 11 nem uma exceção de JavaScript. Os steppers continuam bloqueados para rascunhos inválidos ou vazios. O E2E Chromium testa a ativação programática sem blur (que antes acionava um `TypeError` devido a uma variável `valid` sombreada). A matriz supervisionada inclui `range-live-valid-draft` e `range-live-valid-draft-stepper` em todos os temas/larguras: **89 estados × 8 variantes = 712 screenshots**. A revisão humana segue obrigatória.
