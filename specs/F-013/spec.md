# F-013 — Orçamento de peso de PDF & harmonia do randomizador

**Versão:** v0.1 (26/10/2026) · **Estado:** IMPLEMENTED / aguardando homologação · **Dono:** design + frontend + PDF integrator
**Dependências:** F-007 (Theme Engine — presets de seção/fundo, `shuffleTheme`, `surpriseSections`), F-009 (Export PDF — `inspectPDFFile`, harness `scripts/pdf-quality.mjs`).
**Consumidores:** Editor (selo de peso + grupo "Peso do PDF" na aba "Página" no inspector Design), "Surpreenda-me" (`randomizeFullDesign`).

## 1. Intenção

Dar visibilidade clara ao peso estimado do PDF **durante a edição** — total e por página, com os maiores contribuintes — e usar essa mesma noção de custo para limitar o "Surpreenda-me": a variação aleatória deve ficar dentro de um orçamento de peso e seguir um padrão visual coerente entre seções do mesmo tipo, em vez de decorar cada heading de forma independente.

**Evidência concreta (currículo do usuário, 9 páginas, texto puro):** 3,2 MB exportado. Causa raiz identificada em `app/section-surprise.js`: cada heading (nível ≤3) recebe um preset sorteado **independentemente** dos vizinhos (~38% de chance de trocar), produzindo cards/bordas/glass espalhados sem ritmo. Presets como `glass` (backdrop-filter blur) e `surface`/`band` (sombras em camada) são rasterizados pelo motor de impressão do Chromium em alta resolução — e são justamente os que o sorteio espalha sem controle. Harmonia e peso têm a mesma causa raiz.

## 2. Escopo

**Dentro:** estimador de peso offline (sem rede, sem backend) calibrado com medições reais; selo compacto de peso no editor; grupo "Peso do PDF" na aba "Página" no inspector Design com detalhamento por página e maiores contribuintes; reescrita de `surpriseSections`/`shuffleTheme` para sortear de forma harmônica e respeitar um orçamento de peso.
**Fora:** gerar o PDF real no navegador fora do `window.print()` (seria motor de PDF completo, fora de escopo — ver F-009 "Pendências"); medir o byte exato durante a edição (tecnicamente impossível sem o PDF gerado); mudar os presets de seção/fundo existentes; qualquer novo serviço/servidor.

## 3. Por que o peso não pode ser medido em tempo real (constraint aceita)

O export usa `window.print()`; o app não tem acesso ao PDF gerado pelo navegador. Não existe API para capturar os bytes antes do usuário salvar. A única forma de peso **exato** é o fluxo que já existe (`inspectPDFFile`): o usuário seleciona o PDF já exportado e o app mede `File.size` localmente. Este documento propõe um **estimador calibrado**, não uma medição exata — decisão já confirmada com o usuário.

## 4. Modelo de custo

### 4.1 Calibração (build-time, não runtime)

Estender `scripts/pdf-quality.mjs` — que já gera PDFs reais via Playwright/Chromium e mede bytes com `stat()` — com cenários por **preset de seção** (`plain`, `surface`, `glass`, `accent`, `outline`, `band`, `editorial`, `spotlight`, `minimal-grid`) aplicados a um documento fixo de referência, isolando o custo de cada um. Já existe 1 ponto de dado real coletado nesta sessão: currículo de referência (9 headings H3, ~3 páginas) com presets padrão (`plain`) ≈ 60 KiB (≈20 KiB/página) — consistente com a baseline já documentada em `specs/F-009/export-ux-and-pagination.md` (branco simples ≈37 KiB página única, multipágina ≈94 KiB). O caso real do usuário (presets pesados espalhados, 9 páginas) ≈355 KiB/página — ordem de grandeza ~15–18× a baseline. Os números exatos por preset ficam para a calibração completa durante a implementação; este spec define o **método**, não os valores finais.

### 4.2 Tabela de custo (estrutura)

Cada preset de seção e cada preset de fundo ganha uma classe de custo (`leve`/`médio`/`pesado`) e um peso em KiB/ocorrência, derivado da calibração. A tabela em si e a função que soma pesos (`estimateWeight({backgroundPreset, sectionPresetCounts, font}) → {totalKiB, topContributors, band}`) são **puras, sem DOM/IO**, testáveis em Node — isso cobre REQ-013-01 e o F013-03.

A quebra **por página física** é uma camada separada, que roda no editor (não em Node): `paginateDOM` não carrega qual seção caiu em qual página, mas o DOM já renderizado em `#pageStack` tem essa informação (`decorateSections` marca cada wrapper com `data-section-id`/`data-section-variant`). O cálculo por página lê os wrappers decorados dentro de cada `.paper` e atribui o custo de cada preset à página física onde ele está. Isso é aproximado quando uma seção longa se fragmenta em duas páginas (REQ-013-03 cobre só o total/por-preset, nunca o por-página — não há como comparar isso a um PDF real gerado em Node sem o mesmo DOM).

Entrada do estimador por documento:
- nº de páginas (já disponível via `livePagePlan`/`pageGeometry`);
- preset de fundo ativo (1 custo fixo por documento — fundo é a mesma camada em todas as páginas);
- preset efetivo por heading via `resolveSectionPreset` (soma o custo de cada ocorrência);
- fonte ativa (custo marginal pequeno, mesma família já embutida uma vez).

Saída: `{ totalKiB, perPage: [...], topContributors: [{label, kib}], band: 'leve'|'atencao'|'pesado' }`. Recalculado com debounce (mesmo padrão de 350ms já usado no autosave) a cada edição relevante de design ou conteúdo.

### 4.3 Faixas (reaproveitadas, não inventadas)

Reusa os limiares que já existem em `inspectPDFFile`/F-009 em vez de criar novos: **leve** <500 KiB total · **atenção** 500 KiB–2,5 MiB · **pesado** >2,5 MiB (o mesmo limite do parser do Greenhouse já documentado). Por página, usar a baseline da calibração (~20–40 KiB/página em `plain`) como referência de "leve".

## 5. Harmonia do "Surpreenda-me"

`section-design.js` já modela `levelPresets` (um preset por nível de heading, 1–6) — só não é usado pelo randomizador hoje. Mudança proposta em `surpriseSections`:

1. Sortear **um preset por nível de heading presente no documento** (via `levelPresets`), não mais por heading individual via `overrides`. Todas as vagas de emprego (mesmo nível) passam a usar o mesmo preset entre si; a seção-mãe pode ter um preset diferente.
2. **Confirmado com o usuário:** o comportamento atual é intencional e **permanece**. Quando a trava "Seções" não está ativa, "Surpreenda-me" é um reset completo — customizações manuais por seção (botão de pincel) são descartadas junto com o resto, exatamente como hoje. Quem quiser proteger uma seção customizada deve travar "Seções" (o que já faz `surpriseSections` retornar o design inalterado, sem tocar em nada). Não há merge com `overrides` anteriores a implementar; `levelPresets` simplesmente substitui `overrides` como mecanismo de variação do sorteio.
3. Orçamento de peso no sorteio: classificar presets por custo (4.2) e limitar quantos **níveis** podem receber um preset da classe `pesado` por documento (proposta inicial: no máximo 1 nível pesado por documento; ajustável durante calibração). `shuffleTheme` aplica a mesma lógica ao preset de fundo. Como o sorteio (quando não travado) substitui o design de seções inteiro, o orçamento só precisa validar o resultado fresco do próprio sorteio — não há estado manual anterior a considerar.
4. Mensagem de toast do "Surpreenda-me" passa a refletir o resultado (`"Novo visual: harmônico, ~X KiB estimado"`).

## 6. UI

- **Selo compacto** ao lado do botão "Exportar PDF": tamanho estimado + cor por faixa (ex. `~180 KiB · leve`, `~2,8 MiB · pesado`). Sempre visível, sem precisar abrir painel.
- **Aba "Peso"** no inspector Design (`property-inspector.js`, ao lado de Estilo/Seções/Fundo/Página): barra por página (altura proporcional ao custo) + lista dos maiores contribuintes ("Fundo Mesh: ~40 KiB", "3 seções Glass: ~270 KiB") + nota fixa: "Estimativa offline calibrada — não é o byte exato. Confira o real depois de exportar."
- Depois de um export real, o app pode oferecer a comparação com `inspectPDFFile` (o usuário já pode fazer isso manualmente hoje); fechar esse loop na UI é desejável mas não bloqueia a v1.

## 7. Requisitos funcionais

- **REQ-013-01** — Estimador é função pura (sem DOM/IO) dado `{pages, backgroundPreset, sectionPresetsByLevel, font}`; mesma entrada produz mesma saída.
- **REQ-013-02** — Selo de peso visível no editor a qualquer momento, atualizado com debounce ao editar conteúdo ou design, nunca trava a digitação.
- **REQ-013-03** — Aba "Peso" mostra total, por página e os N maiores contribuintes nomeados (não apenas um número).
- **REQ-013-04** — `surpriseSections` sorteia por nível de heading (`levelPresets`), nunca mais por heading individual sem relação com os vizinhos.
- **REQ-013-05** — Quando a trava "Seções" está ativa, o sorteio não altera nada (comportamento atual de `surpriseSections` preservado). Quando não está ativa, o sorteio substitui o design de seções inteiro, incluindo customizações manuais por heading — comportamento atual confirmado como intencional, não um bug a corrigir.
- **REQ-013-06** — Sorteio (seções e fundo) nunca produz um documento cujo custo estimado ultrapasse a faixa "pesado" sem accent/lock explícito do usuário; respeita `themeLocks` existentes.
- **REQ-013-07** — Tabela de custo é dado estático offline, versionado no repo, sem chamada de rede.
- **REQ-013-08** — Trocar a aparência do app (F-002A) nunca afeta o estimador (mesma invariante de isolamento já documentada em F-007/F-009).

## 8. Quality Gate

**Calibração (script novo, sob demanda — não roda no CI padrão a cada build):** `scripts/pdf-weight-calibrate.mjs`, reaproveitando o harness de `pdf-quality.mjs` (Playwright + `page.pdf()` + `stat()`), gera PDF real para cada preset de seção isolado (documento fixo) e registra KiB/página — vira a fonte da tabela de custo em 4.2. Rodado manualmente quando a tabela precisa ser recalibrada (ex. preset novo, mudança no Chromium), não a cada PR — o conjunto de cenários (9 presets × variações) é caro demais pro gate padrão.

**No CI padrão (`scripts/pdf-quality.mjs`), adicionar:**
- **F013-02** Gerar PDF com `levelPresets` sorteado (não mais `overrides` por id) e confirmar que headings do mesmo nível compartilham preset.
- **F013-03** Comparar estimativa do app (função pura `estimateWeight`, chamável em Node) com o byte real do PDF gerado no mesmo cenário, em nível de total/preset (não por página) — divergência documentada, não é precisão garantida, é checagem de calibração.
- **F013-04** "Surpreenda-me" repetido N vezes nunca gera um resultado acima da faixa "pesado" sem lock.

## 9. Pendências / decisões do builder

Chamadas que ficam por minha conta durante a implementação, sinalizadas aqui para revisão:
- Valores exatos da tabela de custo (vêm da calibração real, não advinhados agora).
- Teto exato de "quantos níveis pesados por documento" (proposta: 1; ajustável se a calibração mostrar outro número mais sensato).
- Debounce do recálculo live: 350ms, espelhando o autosave existente.
- Nome/ícone exato do selo e da grupo "Peso do PDF" na aba "Página" na UI (copy final).

## Integração mdress — 29/10/2026

Portada do legado com contagem por elemento dos ajustes locais existentes. Preservadas as quatro abas aprovadas: detalhamento no accordion Peso do PDF da aba Página, acessível pelo selo próximo à exportação. Removida a possibilidade de preset pesado cair implicitamente no default do sorteio: o default é leve; no máximo um nível recebe estilo pesado, com teto de 400 KiB para suas ocorrências.

Recalibração local: 24 cenários Chromium; 3 páginas básicas = 69,2 KiB reais, Glass = 2460,9 KiB (~170,8 KiB/ocorrência), Soft Mesh ~86,5 KiB. Coeficientes conservados, relatório em docs/qa/issue-23/pdf-weight-calibration.json. Custos de elementos seguem aproximações históricas, exceto Glass de bloco medido no legado. Fontes remotas/imagens e diferenças entre motores podem alterar o resultado; o selo não é garantia de limite de bytes. Documentos muito longos ou estilos já travados podem exceder o orçamento; não modificar escolhas manuais para impor o limite. O PDF real é a fonte do tamanho exato.
