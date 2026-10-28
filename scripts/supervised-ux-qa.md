# UX-023 — revisão supervisionada do inspetor e toolbar

O runner automatiza as interações e gera evidências, **não aprova a UX visual**. A revisão humana das capturas e dos estados interativos continua obrigatória antes de qualquer merge ou publicação.

## Preparar uma instalação nova (PowerShell)

```powershell
cd F:\Projects\lumu\tools\mdress
git status --short # preserve alterações locais antes de trocar de branch
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Abra um segundo terminal na mesma pasta:

```powershell
pnpm qa:supervised
```

O runner faz **um checkpoint por tema e largura (seis ao todo)**, depois de capturar os estados daquele viewport. Não é necessário pressionar Enter a cada screenshot. **Enter** avança ao próximo checkpoint, **m** libera o navegador para intervenção manual e **q** interrompe imediatamente o ciclo (inclusive no prompt de retomada), com código de saída não zero. **Ao terminar a matriz funcional, o modo supervisionado solicita um veredito visual explícito:** `a` aprova as capturas e interações inspecionadas, `r` reprova (exit code não zero), **Enter** mantém a revisão pendente e `q` interrompe. Um resultado funcional `passed` nunca é sinônimo de homologação visual. A interrupção encerra a matriz sem solicitar checkpoints adicionais. O relatório inclui `summary.status` (`passed`, `failed` ou `stopped`) e `humanReview.status` (`approved`, `rejected`, `not-reviewed` ou `not-applicable` no CI) e reprova cobertura incompleta, repetida ou com subauditorias falhas. Capturas incluem estados hover de range e select. A auditoria salva as capturas em `test-results/ux-audit/supervised/` e o relatório em `test-results/supervised-ux-qa.json` (ignorados pelo Git). Se o servidor usar outra porta, configure `$env:MDRESS_AUDIT_URL='http://127.0.0.1:4174'` antes de executar o runner.

## Rastreamento de falhas (Playwright Trace Viewer)

O runner grava um `*-trace.zip` por cenário que **falhar ou for interrompido**. Cenários aprovados descartam o trace para evitar artefatos grandes. O JSON `test-results/supervised-ux-qa.json` lista os arquivos em `traces`, com tema e largura; os ZIPs ficam em `test-results/ux-audit/supervised/`. O Browser Smoke anexa esses traces quando houver falha. Para abrir localmente:

```powershell
pnpm exec playwright show-trace test-results/ux-audit/supervised/graphite-1440-trace.zip
```

Os traces podem conter o conteúdo dos documentos usados nos testes. Não publique esses ZIPs fora de um ambiente de QA controlado sem revisá-los.

## Execução automática (CI ou terminal)

```powershell
pnpm qa:automatic
```

O CI executa Chromium headless, sem interação humana. Checks verdes indicam apenas que as assertivas automatizadas passaram. Avalie screenshots de foco, erros, controles desabilitados, overflow e legibilidade em todos os tamanhos testados. Registre problemas na issue #23, com tema, largura e estado. Não faça merge antes da homologação.

### Estados disabled e nomes acessíveis
Os campos derivados de range e color agora refletem o `disabled` do controle nativo; os steppers do number também são desativados e o input numérico possui nome acessível explícito. A matriz inclui capturas `range-disabled`, `color-disabled` e `number-disabled` em todos os temas e larguras. Isso evita controles aparentemente interativos quando o source of truth está bloqueado.

## Matriz de evidências obrigatórias (issue #23)

O relatório de QA (schema 4) valida **47 estados visuais × 2 temas × 3 larguras = 282 capturas**. Um cenário funcional aprovado não é suficiente se alguma captura obrigatória estiver ausente ou duplicada: `screenshotCoverage.missing`, `duplicates`, `unexpected` e `invalidPaths` geram finding de erro, impedem o veredito positivo do runner e bloqueiam a pergunta de aprovação humana. Os screenshots incluem novos casos de slider com limites/incrementos alterados em tempo real, entrada inválida, `step="any"` e estado desabilitado.

O runner também verifica a existência de cada arquivo PNG, seu cabeçalho e dimensões, e registra erro se alguma captura desaparecer antes do relatório final. A captura `toolbar-last-focus` comprova que o foco por teclado revela a última ação mesmo quando a toolbar exige rolagem horizontal. A captura `color-draft-sync` confirma que uma atualização do inspetor não apaga o valor hexadecimal inválido em edição nem o feedback acessível. `range-native-override` valida que arrastar o slider descarta um draft numérico inválido, e `binary-disabled-focus-handoff` verifica o foco ao desabilitar um controle binário; `select-disabled-trigger-focus-handoff` cobre o combobox fechado com foco ao ser desabilitado. Ranges abaixo de 1e-12 não devem ser apresentados como zero.

A revisão humana precisa verificar legibilidade, foco, hierarquia, ergonomia e clipping das **282 capturas** e interagir no navegador. `humanReview.status=approved` só pode ser registrado após essa revisão explícita. O CI registra `not-applicable` mesmo quando todas as assertivas e evidências automatizadas estão completas. A issue continua aberta até a homologação do usuário.

## Galeria comparativa offline

Ao terminar (inclusive após falha), abra `test-results/ux-audit/supervised/index.html` no navegador. A galeria organiza os **47 estados** com seis capturas lado a lado (tema × largura), filtro por nome e links para as imagens originais. Ela é incluída no artefato temporário do CI, sem publicação pública e sem enviar documentos a serviços externos. **Uma galeria gerada não é aprovação humana**: inspecione ergonomia, foco, legibilidade e clipping e registre seu veredito no terminal supervisionado.

A seleção exibida no combobox mantém nome acessível estável e anuncia o valor selecionado via `aria-describedby`, além de expor `title` para textos truncados. O handoff de foco do controle binário desabilitado exige um destino visível no inspetor, não apenas qualquer elemento tecnicamente focável.
