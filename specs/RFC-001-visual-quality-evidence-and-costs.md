# RFC-001 — Pipeline de qualidade visual, evidências e custos do mdress

- **Status:** Proposta para revisão (não implementada)
- **Data:** 2026-10-24
- **Escopo:** automação de testes, regressão visual, auditoria UX/a11y, retenção e armazenamento de evidências
- **Prioridade:** reduzir custo e regressões antes de escalar infraestrutura
- **Regra de adoção:** nenhuma dependência paga ou credencial externa é exigida nas Fases 0–2
- **Idioma:** PT-BR

> Esta RFC descreve um plano; não afirma que a arquitetura futura já exista. Valores de fornecedores são referências públicas verificadas em 2026-10-24, não cotação nem medida do consumo atual da conta.

## 1. Resumo executivo e decisão recomendada

**Decisão proposta:** manter GitHub Actions + Playwright como execução inicial; formalizar um contrato de evidências e baselines; deixar GitHub Artifacts como armazenamento transitório; habilitar Cloudflare R2 Standard somente quando houver necessidade demonstrada de histórico duradouro, consulta externa ou redução de custo. Não começar por uma plataforma comercial de visual regression nem por serviço próprio.

**Por quê:** o repositório é **privado**. Minutos gratuitos ilimitados de runners padrão de repositórios públicos **não se aplicam**. Minutos e armazenamento disponíveis dependem do plano e de consumo de outros repositórios do proprietário. O workflow atual já produz dados suficientes para uma primeira medição, mas ainda não oferece um ciclo confiável de baseline → diff → triagem → aprovação.

**Objetivos:** (a) regressões detectadas antes do merge, (b) evidências vinculadas a commit/PR/cenário, (c) custo previsível, (d) nenhuma informação pessoal ou documento real exposto, (e) feedback acionável para humanos e agentes, (f) revisão estética assistida, sem confundi-la com teste determinístico.

**Fora de escopo nesta RFC:** reescrever o aplicativo; transformar mdress em gerenciador de currículos; integrar LLM pago automaticamente; abrir conta Cloudflare; publicar bucket; criar dashboard em produção; alterar master sem review.

> **Atualização validada da Fase 0:** o run [40133196226](https://github.com/murilomattioli/markdown-resume-studio/actions/runs/40133196226), job 120989133003, contém erro explícito em `actions/upload-artifact@v4`: `Artifact storage quota has been hit`. A etapa está com `continue-on-error: true`, portanto o job terminou com sucesso mesmo sem publicar a evidência. É um bloqueador atual, não apenas risco teórico. Ver [relatório da Fase 0 (PR #50)](https://github.com/murilomattioli/markdown-resume-studio/pull/50). Não habilitar novos uploads, R2 ou billing automaticamente para contorná-lo.

## 2. Estado real observado em 2026-10-24

Repositório: `murilomattioli/markdown-resume-studio` (privado; branch principal `master`).

| Arquivo | Situação observada |
| --- | --- |
| `.github/workflows/browser-smoke.yml` | dispara em push master/feat/**/fix/** e PRs para master; job smoke em ubuntu-latest, timeout 15 min |
| `scripts/e2e.mjs` | fluxo Playwright Chromium, navegação e verificações de UI; capturas em `test-results` |
| `scripts/pdf-quality.mjs` | inspeção de extração e tamanho de PDF |
| `scripts/component-ux-audit.mjs` | audita temas `graphite` e `studio` em larguras 1440, 1024 e 768; inventaria controles, nomes acessíveis, overflow e erros runtime |
| `.github/workflows/quality.yml` | `npm run check` e `npm test` |
| `README.md` | app local-first de Markdown, IndexedDB, preview e PDF; currículo é só um modelo opcional |

### 2.1 Lacunas específicas observadas

1. `upload-artifact@v4` atualmente carrega apenas `test-results/**/*.png`, usa `retention-days: 21` e roda **antes** da auditoria de componentes. O JSON desta auditoria fica de fora do upload.
2. `actions/github-script` cria/atualiza uma issue de UX para achados críticos somente em push de `master`; em PRs não há ciclo equivalente de revisão visual.
3. Uma etapa publica PNGs em branch `ux-evidence` criando blobs Git e commits. A árvore aponta para o último conjunto, mas o histórico Git pode reter blobs antigos; force update do ref não equivale a política segura de retenção nem limpeza garantida dos objetos.
4. `continue-on-error: true` em etapas de publicação permite que problemas de evidência sejam silenciosos para o resultado geral.
5. Auditoria heurística existente **não é** avaliação estética, certificação WCAG nem prova de ausência de regressões.
6. Scripts atuais usam Playwright via instalação pontual no workflow; ainda não há suite formal de baselines versionadas e testes de diffs.
7. `permissions: contents: write, issues: write` está no nível do workflow; o desenho futuro deve aplicar permissões mínimas por job/evento.
8. Há risco de execução duplicada em push de branch e abertura de PR; verificar execução real antes de otimizar.

Esses pontos são constatações de leitura de código, não de execução do pipeline. **Ainda não foram medidos** minutos históricos, tamanho real dos artifacts, frequência de falhas, uso da cota do proprietário ou custo efetivo.

## 3. Restrições de produto e princípios

- O mdress é um editor de **qualquer Markdown**; casos de teste incluem artigo, guia, documentação, README, proposta, portfólio, relatório e currículo opcional.
- Testes devem usar conteúdo sintético e determinístico, sem IndexedDB real, credenciais, PII ou documentos do usuário.
- A fonte de verdade do documento é Markdown; configurações visuais são metadados.
- Priorizar verificações determinísticas (DOM, comportamento, a11y, layout, PDF) antes de análises subjetivas.
- Cada falha deve fornecer reprodução verificável: cenário, viewport, tema, passo, commit, imagem/diff e trace quando cabível.
- Não adicionar despesas recorrentes sem medição prévia, aprovação explícita e controles de orçamento.
- Artefatos efêmeros não são fonte de verdade de longo prazo; baselines aprovadas e seus hashes precisam ser reproduzíveis.
- Separar **execução** (runner), **armazenamento** (Artifacts/R2), **revisão** (PR/issues/dashboard) e **avaliação** (determinística/IA).

## 4. Limites e preços — fonte oficial, conferir antes de contratar

### 4.1 GitHub

- Para **repositórios privados**, a franquia de runners hospedados e armazenamento depende do plano e uso compartilhado. GitHub Free: **2.000 minutos/mês** e **500 MB** de artifact storage; GitHub Pro: **3.000 minutos** e **1 GB**; Team: **3.000 minutos** e **2 GB**; Enterprise Cloud: **50.000 minutos** e **50 GB**. Ver regras específicas de cobrança, cache/packages e eventual uso de outros repositórios.
- Para **repositórios públicos**, runners hospedados padrão são gratuitos sob as condições oficiais; não se aplica ao estado privado atual. Runners maiores têm regra própria.
- A cobrança de armazenamento é acumulada por uso ao longo do ciclo; a franquia é capacidade/uso incluído e não significa que se pode manter qualquer volume sem custo.
- O limite de **500 artifacts por job** refere-se ao número de uploads/artefatos, não a PNGs dentro de um único artifact. O período de retenção deve respeitar política do repo/organização e limites atuais do GitHub.
- Referência de custo excedente de artifacts: **US$ 0,25 por GB-mês** (reconfirmar tabela vigente ao contratar); minutos excedentes de runners dependem da plataforma/máquina e tabela vigente. Não embutir preço fixo no código.
- Em orçamento, distinguir alertas de bloqueio efetivo: confirmar configuração de spending limit/budget no proprietário. Nunca pressupor que alerta impede cobrança.

Referências:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/concepts/billing-and-usage
- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts

### 4.2 Cloudflare R2 Standard (USD)

- Armazenamento: **10 GB-mês gratuitos**; excedente **US$ 0,015/GB-mês**.
- Operações Class A: **1 milhão/mês gratuitas**; excedente **US$ 4,50/milhão**.
- Operações Class B: **10 milhões/mês gratuitas**; excedente **US$ 0,36/milhão**.
- Egress do R2: gratuito segundo tabela oficial. Outros serviços na frente dele (Workers, transformação, DNS, domínio, autenticação) podem ter custos próprios.
- Cloudflare arredonda unidades faturáveis; valores calculados abaixo são estimativas nominais, não garantia da fatura.
- Escolher **Standard** inicialmente. Infrequent Access tem cobrança de leitura e duração mínima de armazenamento de 30 dias; não presumir que seja mais barato para screenshots consultadas frequentemente.
- Habilitar R2 requer configuração de faturamento; franquia gratuita **não** é limite duro contra cobranças.

Referências:
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- https://developers.cloudflare.com/r2/api/s3/tokens/

### 4.3 O que entra no TCO

`C_total = C_actions_runner + C_actions_artifacts + C_r2_storage + C_r2_requests + C_dashboard + C_llm + C_egress_outros + C_operacao`.

Custos omitidos por calculadoras simplistas: múltiplos browsers, timeouts/retries, paralelismo, downloads de browser em todo job, upload de traces, mudanças frequentes de baseline, operações API, tempo humano de aprovar diffs, inflação de falso positivo, segurança/manutenção de credenciais.

### 4.4 Cenários meramente ilustrativos

**Armazenamento médio constante por 30 dias**, R2 Standard, operações dentro da franquia:

| GB-mês | R2 mensal aproximado |
| ---: | ---: |
| 5 | US$ 0,00 |
| 10 | US$ 0,00 |
| 25 | US$ 0,23 |
| 50 | US$ 0,60 |
| 100 | US$ 1,35 |
| 500 | US$ 7,35 |

O custo de **runner** num repo privado pode dominar o custo de storage. Simulação de demanda: 80 componentes × 4 cenários × 100 execuções/mês × 180 KB/imagem ≈ **5,76 GB gerados/mês**, antes de compressão, deduplicação, traces ou retenção. **Gerado no mês não equivale a GB-mês faturável:** com retenção média de 7 dias, sem baselines persistentes, o armazenamento médio aproximado em regime estável é 5,76 × 7/30 ≈ **1,34 GB**. É preciso medir duração do job: 100 execuções × 8 minutos = **800 runner-minutos/mês** (hipótese, não dado real).

Política de cálculo: registrar `bytesProduced`, `bytesStoredDaily`, `runnerMinutes`, `requestsA/B`, `LLMCalls`, `costUSD` estimado; revisar mensalmente com números reais.

### 4.5 Política financeira sugerida

- Fases 0–2: **não ativar serviço pago**. Objetivo: custo adicional zero dentro das cotas, não promessa de fatura zero.
- Medir diariamente e comparar com franquia restante de **toda a conta**.
- Adotar limite operacional inicial: quando estimativa atingir 70% da franquia, reduzir cadence/uploads e investigar; com 90%, interromper auditorias não essenciais, preservando qualidade crítica e execução local.
- Para R2, separar bucket/tokens e registrar limite de orçamento externo. Alertas Cloudflare são observabilidade, não hard cap garantido.
- IA multimodal: **desligada por padrão**, somente após orçamento explícito em dólares/mês, modelo/preço atual conferido e política de privacidade.

## 5. Alternativas consideradas e critérios de escolha

| Alternativa | Benefícios | Trade-offs | Decisão |
| --- | --- | --- | --- |
| GitHub Artifacts | integração pronta, zero setup adicional | expiração, custos/cotas privados, consulta histórica limitada | **Adotar Fases 0–2** |
| Branch `ux-evidence` com PNGs | acessível pelo GitHub | histórico Git, blobs e políticas de retenção inadequadas | **Descontinuar após migração controlada** |
| GitHub Releases/Pages | distribuição simples e índice estático | exposição de evidências, governança de armazenamento | opcional para material público e sintético |
| Cloudflare R2 Standard | baixo preço, lifecycle, acesso S3 | credenciais, operações, billing, controle de acesso | **Preferir se houver gatilho** |
| S3/Backblaze B2 | maturidade e API S3-compatible | egress/requests e integração/custos a comparar | fallback a cotar |
| Chromatic/Percy/Argos | revisão/baselines e interface pronta | preço por snapshots/uso, lock-in, integração | POC comparativa se custo operacional próprio crescer |
| Runner próprio | controle e possível economia em escala alta | manutenção, hardening e disponibilidade | não agora |

**Gatilhos para avaliar R2:** artifact storage consistentemente próximo da franquia; necessidade de retenção > limite prático; dashboard histórico; necessidade de APIs para agentes; custo mensal de artifacts superior ao custo total da alternativa. A migração **não é** mandatória simplesmente por atingir certo número de screenshots.

## 6. Arquitetura lógica proposta

```text
PR / push / schedule / execução manual
  -> classificação de arquivos alterados + orçamento + concurrency
  -> testes determinísticos (check/unit/fluxos/PDF/a11y)
  -> Playwright Chromium em matriz selecionada
  -> manifest.json + screenshots + traces sob demanda
  -> compare com baselines aprovadas e versionadas
  -> diff + findings estruturados + resumo do job/PR
  -> upload transitório para GitHub Artifacts
  -> triagem: determinística (gates) / revisão humana
  -> (Fase 3, opcional) sincronização privada em R2
  -> (Fase 4, opcional) painel de consulta e revisão IA seletiva
```

### 6.1 Pipeline por evento

- **PR:** checks obrigatórios, smoke tests e cenários impactados; screenshots/diffs em caso de mudança ou falha; relatório de leitura; **não** atualizar baselines automaticamente.
- **Push em master:** execução abrangente (sujeita a orçamento); criação/atualização de findings estruturados; referência à baseline já aprovada.
- **Nightly/weekly:** matriz mais extensa quando houver valor e orçamento; impedir gasto em cron de baixo sinal.
- **Manual:** disparo com escolha de suite e geração de diagnóstico pontual.
- Usar `concurrency` para cancelar runs obsoletos do **mesmo PR/ref**; evitar cancelamento de release relevante.
- Usar paths filter cuidadosamente: alterações de tokens, DS, fontes, CSS, PDF ou renderer podem impactar todas as telas; não usar filtro que masque regressão global.

### 6.2 Camadas de qualidade

1. **Estática:** syntax/check, unit, integridade de temas/configurações.
2. **Funcional:** fluxos Playwright, alterações de estado, persistência IndexedDB isolada, PDF selecionável, paginação.
3. **Acessibilidade:** axe-core quando incorporado, keyboard/focus/labels/contrast com testes específicos; não declarar conformidade WCAG automática.
4. **Geometria:** bounding boxes, overflow, toque/click target, truncamento, scroll intencional.
5. **Visual regression:** baseline por browser, OS, DPR, viewport, tema e estado; antes/depois/diff; threshold cuidadosamente calibrado.
6. **UX semântica/IA (opcional):** legibilidade, hierarquia, densidade, consistência e caminhos de interação; sempre achados revisáveis por humano, **não** gate estético sem validação.

### 6.3 Determinismo e estabilidade

Fixar versões de Node, Playwright/browser e fontes; viewport e DPR; locale, timezone e relógio de testes; seeds e dados de fixtures; animations/reduced motion; bloquear recursos de rede não determinísticos; aguardar fonts.ready e render estabilizado; limpar IndexedDB/cookies por teste; mascarar conteúdo volátil; usar retries pequenos com observabilidade e evitar “atualizar baseline até passar”.

Baselines geradas em Linux CI podem divergir do ambiente Windows local: definir ambiente de referência único. Manter IDs semânticos estáveis por cenário, mesmo quando títulos/labels mudarem.

## 7. Contrato de arquivos e metadados

Estrutura sugerida para um **único artifact por suite/run**, em vez de upload por imagem:

```text
test-results/
  evidence/
    manifest.json
    findings.json
    report.html
    scenarios/
      editor/preview/graphite/desktop/
        actual.png
        expected.png         # se aplicável e autorizado
        diff.png             # só se houver divergência
        trace.zip            # só se erro, falha ou pedido explícito
```

Exemplo de `manifest.json` (schema v1):

```json
{
  "schemaVersion": 1,
  "application": "mdress",
  "run": {
    "provider": "github-actions",
    "runId": "123456789",
    "commit": "full-commit-sha",
    "branch": "feat/example",
    "pr": 123,
    "createdAt": "2026-10-24T12:00:00Z"
  },
  "environment": {
    "os": "ubuntu-latest",
    "browser": "chromium",
    "playwrightVersion": "pinned-version",
    "deviceScaleFactor": 1
  },
  "scenarios": [
    {
      "id": "editor-preview-graphite-desktop",
      "kind": "visual-regression",
      "theme": "graphite",
      "viewport": { "width": 1440, "height": 900 },
      "state": "preview",
      "status": "passed",
      "evidence": ["scenarios/editor/preview/graphite/desktop/actual.png"],
      "sha256": "actual-file-sha256"
    }
  ]
}
```

`findings.json` deve conter `id` estável (hash de regra+cenário+elemento), `severity`, `confidence`, `source`, `description`, `reproduction`, `commit`, `firstSeen`, `lastSeen`, `status`, `evidencePaths`. Nunca inferir problema estético apenas por porcentagem de pixels mudados.

Definir política de versionamento para schemas. Dashboards/agentes devem tolerar campo desconhecido, validar campos obrigatórios e evitar paths arbitrários (path traversal).

## 8. Baselines e revisão

- Base de comparação: snapshots **aprovadas** da branch principal ou versão estável, nunca do mesmo PR recém-gerado.
- Baselines versionadas em diretório controlado se volume inicial for baixo; se volume crescer, considerar objeto imutável em R2 indexado por SHA e aprovação assinada.
- Revisor aprova cada atualização deliberadamente, com diff e justificativa; atualização em massa exige sumário e amostragem.
- Proteção contra “aceitar visualmente falha” para fazer testes passarem; mudanças visuais legítimas devem constar em PR.
- Threshold inicial conservador por cenário; usar taxa de falsos positivos medida, não um valor global arbitrário.
- Nunca rejeitar um PR só por julgamento subjetivo gerado por IA.

## 9. Retenção, deduplicação e lifecycle

**Política candidata, sujeita a privacidade e requisitos reais:**

| Tipo de evidência | Retenção sugerida | Motivo |
| --- | ---: | --- |
| Passou, idêntico à baseline | 3–7 dias ou apenas metadados | economizar armazenamento |
| Falha transitória + trace | 7–14 dias | diagnóstico |
| Diff relevante de PR aberto | até decisão + 30 dias | review |
| Registros de bugs críticos | até resolução + 30 dias | rastreabilidade |
| Evidências de release | 90 dias | regressão de release |
| Baseline aprovada | até substituição explícita | comparação |
| Manifest/findings compactos | histórico maior conforme política | análise de tendências |

**Limitação importante:** GitHub Artifacts é efêmero e não faz retenção baseada no estado da issue de modo nativo; retenções condicionais exigem serviço de housekeeping externo. No R2, lifecycle simples pode expirar por prefixo/idade; lógica “até issue fechar” requer índice e job de garbage collection que calcula referências vivas. Não confiar em lifecycle apenas para retenção condicional.

Deduplicar pelo hash de conteúdo e referência no manifest; implementar contagem de referências ou política de marcação/varredura antes de apagar objetos compartilhados. Deletar objeto nunca deve invalidar baseline ainda ativa.

## 10. Segurança, permissões e privacidade

- Nunca enviar Markdown pessoal/IndexedDB do usuário, tokens, cookies ou URLs assinadas para artifact, issue ou IA. Fixtures sintéticas exclusivamente.
- GitHub Actions em PR de fork/untrusted branch: tokens de escrita e segredos **não** disponíveis no job que executa código não confiável. Isolar publicação em job/workflow privilegiado com manifest validado e permissões reduzidas.
- Usar `permissions: contents: read` por padrão; habilitar `issues: write` ou `pull-requests: write` só no job de sincronização e quando permitido.
- R2: bucket privado; token restrito ao bucket e operações necessárias; preferir credenciais temporárias quando disponíveis; não expor secret em logs, screenshots, manifests nem comentários de PR.
- Upload só de extensões permitidas e de diretório esperado; limite de tamanho por arquivo e por run; validar checksum.
- Dashboard: autenticação antes de permitir dados de repo privado; URLs assinadas de curta duração se necessárias; CSP e proteção contra HTML arbitrário em relatórios.
- IA: dados sintéticos, consentimento/contrato e budget explícitos, remoção de PII; nunca transmitir docs reais sem política específica.

## 11. Execução por fases e critérios de aceite

### Fase 0 — Medição / baseline operacional (sem serviço externo)
**Entregas:** snapshot do billing/uso real do proprietário (manual), 10–30 runs amostrados, tamanho total artifacts, minutos runner, falhas, taxa de retrabalho, custo estimado, inventário de capturas e métricas de armazenamento.
**Aceite:** planilha/JSON simples com consumos e cenários observados; distinção clara de measured vs estimated.
**Risco:** limitações da API/faturamento para conta privada; solicitar captura de dados ao proprietário se necessário.

### Fase 1 — Hardening da CI (sem mudar comportamento do app)
**Entregas:** reordenar geração de evidências/upload; manifest+findings; retenção 7 dias inicial; upload condicionado `always()`; permissões mínimas; concurrency; rastreabilidade; correção do tratamento de erro (não esconder falhas obrigatórias); review da branch `ux-evidence`.
**Aceite:** run aprovado e run falho ambos produzem manifest coerente; JSON da auditoria aparece no artifact; falha crítica deixa sinal inequívoco; teste de PR não escreve em master; tamanho de upload documentado.
**Rollback:** restaurar workflow anterior e manter Artifact existente até expirar.

### Fase 2 — Visual regression reprodutível
**Entregas:** Playwright Test runner ou adaptador equivalente, matriz representativa, seed determinístico, screenshots aprováveis, diff gerado só quando relevante, baseline review, gates de checks estáveis, documentação de update.
**Aceite:** uma mudança intencional pode ser aprovada; uma regressão não aprovada é bloqueada; múltiplas execuções idênticas têm baixo falso positivo; PR exibe links para evidências.
**Rollback:** rodar suíte em modo informativo enquanto calibrar thresholds.

### Fase 3 — R2 opcional mediante gatilhos
**Pré-condições:** medidas de custo, política de privacidade aprovada, budget e billing verificados, bucket/token preparados pelo proprietário.
**Entregas:** S3-compatible uploader server-side; chaves estruturadas `environment/repo/commit/run/scenario`; checksums; lifecycle; housekeeping; URLs controladas; fallback em GitHub Artifacts.
**Aceite:** upload/download autorizado, acesso anônimo negado, cleanup testado, falha de R2 não elimina evidência essencial, custo monitorado.
**Rollback:** desligar uploader via feature flag e usar artifacts.

### Fase 4 — Consulta, agentes e revisão de UX opcional
**Entregas:** dashboard ou índice leve; busca por tema/componente/PR; visualização before/after/diff; triagem de findings; agente multimodal apenas para alterações relevantes e execuções sob demanda.
**Aceite:** nenhuma issue duplicada; triagem com evidência e reprodução; agente não altera baseline/merge sozinho; cost cap por execução e mensal.
**Rollback:** desligar análise multimodal, manter teste determinístico.

## 12. Priorização de cenários

Matriz inicial (exemplo, calibrar com uso real): `graphite`/`studio` × 1440/1024/768; modo split/editor/preview; empty/loading/content-heavy; painel estilo/seções/página/fundo; componentes DS primitivos e overlays; documentos sintéticos diversos; PDF A4/Letter quando relevante; quebra de página antes de seções e modelos; navegação por teclado e estados inválidos.

Para evitar explosão combinatória, usar pairwise / matriz baseada em risco. Testar todos os componentes isoladamente em um viewport crítico e somente rotas/estados selecionados em múltiplos viewports. Rodar matriz completa em releases ou semanalmente se custo permitir.

## 13. Observabilidade e KPIs

| Indicador | Definição e uso |
| --- | --- |
| Runner-minutes / PR | tempo de execução, por workflow/evento |
| GB-mês artifacts / R2 | uso médio faturável, não apenas bytes gerados |
| Evidências / run | volume e utilidade dos arquivos |
| False-positive rate | diffs aprovados sem bug real / total de alertas |
| Flaky rate | falhas não reproduzíveis / execuções |
| Time to diagnose | duração até identificação da causa |
| Escape rate | regressões reportadas após merge |
| Critical findings open | problemas críticos ainda sem correção |
| LLM cost / review | chamadas, tokens, custo (se habilitada) |
| % cenários cobertos | ID de cenário executado versus catálogo de risco |

Definir limiares de sucesso após Fase 0; não inventar SLA sem baseline.

## 14. Backlog candidato para issues/PRs

1. `ci: measure workflow artifact/runner footprint`
2. `ci: reorder evidence generation and upload JSON/screenshots`
3. `ci: tighten tokens and event permissions`
4. `ci: cancel superseded PR runs`
5. `quality: define evidence schema v1 and validation`
6. `quality: add deterministic visual baseline harness`
7. `quality: add visual review report for PR`
8. `quality: replace ux-evidence branch publication after migration`
9. `storage: evaluate R2 with billing and permission guardrails`
10. `quality: implement R2 lifecycle, dedup and reference-aware cleanup`
11. `quality: add indexed evidence viewer (optional)`
12. `quality: evaluate opt-in AI UX review (optional)`

**Ordem de execução:** Fase 0 → Fase 1 → Fase 2 → reavaliar custos → Fase 3 se justificada → Fase 4 se houver demanda real.

## 15. Decisões pendentes antes de codificar

- Qual plano GitHub e qual orçamento compartilhado efetivamente estão disponíveis?
- Quantos minutos, MB/GB e artefatos foram consumidos nos últimos 30 dias?
- Qual volume de screenshots, traces e imagens por execução?
- Baselines no Git (pequenas) ou object storage desde o início (se grandes)?
- Evidências precisam ser vistas por alguém sem acesso ao repositório privado?
- Qual política formal de retenção e confidencialidade para dados de fixtures?
- Qual o custo humano tolerável de revisar mudanças visuais?
- Há valor suficiente para auditoria multimodal por IA? Se sim, qual limite mensal?

## 16. Regras de implementação para agentes

1. **Ler esta RFC, o README e o workflow atual antes de alterar código.**
2. Abrir PRs pequenos por fase; não implementar fases 3–4 junto das fases 0–2.
3. Não assumir que repo é público ou que ações são gratuitas; consultar billing real antes de decisões de gasto.
4. Não criar contas, cobrar cartão, habilitar billing ou publicar dados sem aprovação explícita.
5. Preservar offline/local-first; teste não transmite dados reais do usuário.
6. Toda mudança de CI deve ser validada com pelo menos execução aprovada e falha simulada controlada.
7. Nunca atualizar visual baselines automaticamente após falhas.
8. Não tratar output de IA como critério final de aceitação.
9. Não remover branch `ux-evidence` ou suas referências históricas sem inventário, transição e aprovação.
10. Atualizar esta RFC quando decisão proposta virar decisão aceita; separar “planejado”, “implementado” e “medido”.

## 17. Referências

- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub Actions limits: https://docs.github.com/en/actions/reference/limits
- GitHub Actions storage and artifacts: https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright traces: https://playwright.dev/docs/trace-viewer
- Playwright CI: https://playwright.dev/docs/ci
- Cloudflare R2 pricing (atualizado em 2026-10-01): https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 lifecycle: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Cloudflare R2 S3 auth: https://developers.cloudflare.com/r2/api/s3/tokens/

---

**Resultado esperado:** ganhos de cobertura e revisão sem dependência inicial de serviço pago; só escalar storage/IA após métricas reais, critérios explícitos e orçamento aprovado.
