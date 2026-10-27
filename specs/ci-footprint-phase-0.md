# Fase 0 — Medição preliminar de CI (2026-10-24)

**Estado:** amostra observacional; faturamento real ainda não verificado. Leia também [RFC-001](RFC-001-visual-quality-evidence-and-costs.md) na PR de documentação #49 (ainda não incorporada ao master).

## Fonte e método

Dados consultados na GitHub Actions REST API do repositório privado `murilomattioli/markdown-resume-studio`, em 2026-10-24. Foram inspecionados os **100 workflow runs mais recentes**, dentre **796 runs** informados pela API no momento. O intervalo da amostra foi de 2026-10-24 **16:20:09–20:15:57 UTC** (cerca de 4 horas). Não constitui amostra de um mês, nem de toda a conta.

Tempo medido como `updated_at - run_started_at`: **duração observável do workflow**, não minutos faturados do runner. Arredondamentos, paralelismo, espera e tarifa dependem das regras de GitHub Actions.

## Resultados observados

| Workflow | Runs amostrados | Mediana aproximada de duração | Duração média aproximada | Falhas | Push | PR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Browser Smoke | 50 | 64 s | 87 s | 15 | 32 | 18 |
| Quality | 50 | 12 s | 12 s | 4 | 32 | 18 |

A mediana/contagem derivou dos metadados REST retornados. As falhas podem estar correlacionadas a commits intermediários; **não** calcular flakiness apenas pela contagem.

Foram consultadas listas de artifacts de **8** execuções recentes do Browser Smoke: **0 artifacts retornados**. Em seguida, a inspeção do log real do job **120989133003**, run **40133196226**, comprovou a causa imediata para esta execução: `Failed to CreateArtifact: Artifact storage quota has been hit. Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.` Portanto **há falha de quota confirmada**; isso não determina o tamanho, uso ou cobrança exatos da conta. O passo `upload-artifact@v4` retornou erro, mas o job terminou `success` porque o workflow permite `continue-on-error: true`. Evidências não foram preservadas por artifact nesse run.

A execução recente #40128999346 (PR #49) teve job `smoke` entre **20:15:59 e 20:17:12 UTC** (aproximadamente **73 s**), com conclusão `success`. A mesma PR acionou `Quality`. Existem execuções tanto em eventos `push` quanto `pull_request`; eventos duplicados podem ocorrer na mesma alteração, mas precisam ser correlacionados por commit para quantificar desperdício real.

## Problemas e oportunidades

1. O pipeline executa smoke em mais eventos do que necessário para pequenas mudanças documentais; otimizar `paths` sem mascarar alterações em CSS/DS e sem dispensar checks exigidos pela proteção de branch.
2. **Bloqueador confirmado:** quota de artifact storage atingida e erro de upload mascarado no status geral. Não implementar novos uploads até revisar orçamento, consumo, retenção e forma de comunicação do diagnóstico; não ativar R2 sem aprovação.
3. Não existe evidência de custo pago ou do plano do proprietário nesta leitura. Como o repositório é **privado**, não presumir runners gratuitos ilimitados.
4. Qualquer dashboard de custo precisa registrar **runner job elapsed/billable time**, **artifact bytes**, **retenção** e consumo **da conta**, não apenas tempo dos workflow runs.

## Coleta reproduzível

Na branch desta PR:

```bash
# Token de leitura de Actions do repositório privado (não comitar o token).
GITHUB_TOKEN=... node scripts/measure-ci-footprint.mjs --limit=100 --max-artifact-runs=20
# Opcional: --repo=owner/name --out=test-results/ci-footprint.json
```

O utilitário só faz chamadas GET, grava JSON local, mantém limitações explícitas e não exige nenhum serviço pago.

## Pendências para fechar a Fase 0

- [ ] Executar o utilitário no ambiente Node 20+ com token read-only e validar o JSON; leitura feita nesta conversa, **não** execução do script.
- [ ] Obter plano, minutos faturados e GB-mês de armazenamento pela página de Billing do proprietário (não acessível pelo conector atual).
- [ ] Examinar 10–30 execuções distribuídas pelo mês (não somente últimas horas).
- [x] Identificar causa imediata de ausência de artifacts em um run: armazenamento atingiu quota; evidência nos logs do job 120989133003.\n- [ ] Medir bytes PNGs/traces produzidos localmente e inventariar artifacts antigos no nível permitido pela API.\n- [ ] Definir como informar falha de publicação sem impedir indevidamente a correção do problema em ambiente com quota zerada.
- [ ] Mapear custo marginal dos dois workflows por evento; calcular ganho possível com concurrency e seleção por path.
- [ ] Registrar o diagnóstico final e aprovar revisão da RFC antes de iniciar Fase 1.

## Critério de conclusão

**Fase 0 só será concluída quando existirem medidas confiáveis de uso, tamanho e custo/budget**. Até lá, os dados acima sustentam uma otimização inicial, mas não uma contratação de R2 nem um orçamento final.

## Atualização — causa-raiz de ausência dos artifacts (confirmada)

- **Run:** https://github.com/murilomattioli/markdown-resume-studio/actions/runs/40133196226
- **Job:** 120989133003, Browser Smoke, `success`.
- **Passo:** Preserve UX screenshots for design review, `actions/upload-artifact@v4`.
- **Mensagem inequívoca:** `Failed to CreateArtifact: Artifact storage quota has been hit. Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.`
- **Explicação do falso verde:** `continue-on-error: true` na etapa do upload; sucesso de testes não equivale a evidência publicada. GitHub Actions não demonstra, por esse resultado, que o reporte está disponível.
- **Próxima intervenção mínima proposta para Fase 1:** separar `testsStatus` de `evidenceStatus`, mostrar aviso explícito em summary/PR e bloquear aprovação de release que exija evidência, sem tentar criar mais artifacts enquanto quota permanecer esgotada. A escolha entre limpeza, aumento de quota e R2 requer dados de billing.
- **Limitação:** o valor preciso do excesso e os gastos não são visíveis por esta integração. O problema é confirmado para este run, não necessariamente cada um dos anteriores.
