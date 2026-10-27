# F-006 — Visual Renderer & Pagination — Especificação funcional

**Versão:** v0.7 (22/10/2026) · **Estado:** PROPOSED / NOT IMPLEMENTED · **Dono:** design + frontend + PDF integrator
**Dependências:** F-004 Compiler, F-007 Resume Theme, F-005 Workspace, F-002 App DS; F-009 consome a saída deste módulo.

## 1. Intenção / contrato da capacidade

Transformar Markdown interpretado e tema resolvido em um **PagePlan físico, imutável e rastreável** e numa visualização DOM selecionável. O renderer é uma projeção, não editor de texto; não corrige conteúdo nem gera o PDF definitivo. Visualização de currículo é diferente do tema OLED/Graphite do aplicativo.

### Separação canônica

```text
Markdown raw + provenance (F-005)
  → CompilerOutput + source maps (F-004)
  → DocumentModel [conteúdo derivado, ordem lógica, fragments permitidos]
  + ResolvedTheme [F-007 tokens físicos e font hashes]
  → MeasuredLayout / PagePlan [pontos tipográficos, fontes, page breaks]
      ├── Visual DOM pages (zoom apenas viewport)
      ├── ATS logical reading order (F-008)
      └── PDF adapter (F-009, consome o MESMO PagePlan)
```

**Fonte da verdade:** somente Markdown + metadados operacionais F-003; DocumentModel e PagePlan nunca viram source persistido.

## 2. Escopo e limites

**Dentro:** modelo visual do currículo, dimensionamento A4/Letter, medidas de fontes offline, fragmentação sem perda, quebras, UI de preview/zoom/foco/seleção e integração rastreável.
**Fora:** edição WYSIWYG livre, drag de blocos, CSS arbitrário, layout multi-coluna, arquivos remotos, composição de PDF, otimização e verificação final de extração (F-009).

## 3. Invariantes arquiteturais

1. `sourceHash` e `themeHash` distintos: alterar um deles invalida apenas suas projeções. F-002A AppTheme jamais entra no hash.
2. Uma página física é calculada em **pt**; CSS px/zoom somente apresentação. Sem repaginar por largura do viewport.
3. Renderer entrega layout completo ou erro tipado. Nunca uma página truncada silenciosamente marcada pronta.
4. `PagePlan` é adaptado para visual e PDF; se PDF não conseguir honrar geometria, o export falha e pede decisão explícita.
5. Conteúdo desconhecido aparece como custom/unclassified na ordem de origem; conteúdo decorativo nunca pode se passar por texto de ATS.
6. `SourceSpan` usa offsets UTF-16 [start,end) e nunca identifica posição sem evidência.
7. Presets do currículo F-007 e Theme Studio da UI F-002A são mecanismos independentes.

## 4. Requisitos funcionais — IDs estáveis

### Source & contracts

- **REQ-006-001 — Source read-only:** Receber source/CompilerOutput como projeção imutável; nunca editar, serializar ou normalizar Markdown durante layout.
- **REQ-006-002 — Resolved theme only:** Aceitar apenas ResolvedTheme F-007 validado/pinado; layout não interpreta overrides nem CSS arbitrário.
- **REQ-006-003 — App theme isolation:** Tokens F-002/F-002A, OLED ou aparência do editor nunca influenciam medidas, cores ou fontes do documento.
- **REQ-006-004 — DocumentModel contract:** Derivar DocumentModel tipado do CompilerOutput mais source correspondente, sem materializar campos sem evidência ou descartar seções não reconhecidas.
- **REQ-006-005 — Provenance identity:** Relacionar layout a documentId + draftSeq + sourceHash + themeHash + engine/metrics/policy version; expor fingerprint inequívoco.
- **REQ-006-006 — Out-of-order result:** Descartar resultados obsoletos/cancelados e nunca marcar current um layout de hash diferente do draft/theme em tela.
- **REQ-006-007 — Source map preservation:** Preservar sourceSpan UTF-16 half-open e precisão F-004 por bloco, fragmento e hit; nunca inventar intervalo exato.
- **REQ-006-008 — Fallback completeness:** Renderizar blocos custom/unclassified legíveis na ordem original ou emitir blocker explícito se não houver representação segura.

### Content semantics

- **REQ-006-009 — Reading order invariant:** Ordem lógica de leitura e IDs canônicos permanecem iguais entre DocumentModel, layout, visual e adaptador PDF.
- **REQ-006-010 — Supported primitives:** Modelar identity, summary, heading, paragraph, lists/bullets, experience/education/project entries, links e custom blocks.
- **REQ-006-011 — Inline safety:** Marcar ênfase e links de forma declarativa, desabilitar javascript/data/fetch e HTML remoto; texto nunca executa scripts.
- **REQ-006-012 — No ghost content:** Não duplicar, omitir ou criar conteúdo essencial ao dividir entre páginas; continuations são metadados, não source.
- **REQ-006-013 — Accessible text:** Preview utiliza texto DOM selecionável e hierarquia semântica; canvas rasterizado/screenshot não substitui texto.
- **REQ-006-014 — Font availability:** Fonte usada deve estar instalada no bundle offline e com hash/verificação; ausência gera fallback explícito e invalida métricas anteriores.
- **REQ-006-015 — Font metrics contract:** Medição exige font family, version, weight, size, glyph metrics e shaping consistentes; não usar estimativa por média de caracteres.

### Geometry & units

- **REQ-006-016 — Paper dimensions:** A4 = 210×297 mm e Letter = 8.5×11 in; tamanho em pt correto e registrado por página.
- **REQ-006-017 — Page margins:** Aplicar marginMm F-007 a todas as páginas e reservar conteúdo somente na área útil; impedir margens negativas/inválidas.
- **REQ-006-018 — Unit conversions:** Converter mm↔pt por 72/25.4 com precisão interna e quantização somente nas bordas de serialização.
- **REQ-006-019 — Box constraints:** Todo bloco/fragments possui bounds finitos dentro da área útil, salvo issue de overflow; não ocultar conteúdo por CSS overflow hidden.
- **REQ-006-020 — Deterministic geometry:** Input/font metrics/policy iguais produzem mesmo page plan e fingerprint; ambiente distinto deve invalidar ou diagnosticar.
- **REQ-006-021 — No hidden auto-fit:** Não reduzir silenciosamente fonte, escala, line height, margin ou conteúdo para caber numa página.

### Pagination

- **REQ-006-022 — Break plan:** Construir PagePlan explícito contendo páginas, fragments, custos de quebra e diagnostics sem depender do zoom do canvas.
- **REQ-006-023 — Sequential pagination:** Paginar no fluxo lógico original, produzindo índices e page numbers estáveis de 1 a N sem gaps e sem reordenação.
- **REQ-006-024 — Heading keep-with-next:** Evitar heading órfão no rodapé mantendo-o com conteúdo seguinte; se inviável, registrar fallback justificado.
- **REQ-006-025 — Entry-aware breaks:** Preservar cargo/empresa/período com pelo menos primeira atividade quando possível; permitir dividir restante em página seguinte.
- **REQ-006-026 — Widows and orphans:** Política padrão PROPOSED: mínimo 2 linhas de parágrafo por fragmento, quando fisicamente possível; expor exceção.
- **REQ-006-027 — List integrity:** Preservar bullets, numeração e ordem ao quebrar; não deixar bullet marker isolado sem primeira linha.
- **REQ-006-028 — Long tokens and URLs:** Aplicar wrap seguro de palavras/URLs longas com posição de quebra documentada sem alterar source nem extrair texto truncado.
- **REQ-006-029 — Oversized indivisible:** Quando um elemento não puder caber integralmente, dividir apenas se semanticamente permitido; do contrário, blocker e alternativa ao usuário.
- **REQ-006-030 — No clipping:** Nenhum texto fora do recorte útil pode desaparecer silenciosamente; detectar bounding, glyph overflow e colisões.
- **REQ-006-031 — Resource limits:** Limites de tempo/pages/blocks são configuráveis e geram RESOURCE_LIMIT tipado; jamais exportar layout truncado como ready.
- **REQ-006-032 — Whitespace policy:** Espaçamento entre blocos e page starts é determinístico; evitar espaço duplicado em quebras e respeitar tokens do Theme.
- **REQ-006-033 — Empty state:** Source vazio não cria página PDF/exportável e mantém preview empty contextual, sem zero division ou bloco fantasma.
- **REQ-006-034 — Unresolved assets:** Links e imagens não suportadas/indisponíveis geram diagnóstico ou fallback seguro; não fazer fetch automático nem mascarar sua ausência.

### Preview UX

- **REQ-006-035 — Zoom independence:** Zoom 50–200%, fit-page/fit-width e densidade da UI alteram apenas viewport; não PagePlan/pageCount/themeHash.
- **REQ-006-036 — Viewport navigation:** Fornecer page navigation, current/total, scroll preserve/restore, zoom reset e feedback em listas longas.
- **REQ-006-037 — Hit to source:** Clique em fragmento com map válido navega a F-005 no sourceSpan correspondente; se precisão block, selecionar bloco e sinalizar aproximação.
- **REQ-006-038 — Selection safety:** Seleção/cópia do preview conserva texto real e evita forçar navegação ao Source durante drag/seleção de texto.
- **REQ-006-039 — Stale feedback:** Manter último preview íntegro no erro/cancel e sinalizar explicitamente stale com hashes/versão; bloquear alegação de atual.
- **REQ-006-040 — Invalid preview:** Se source ou theme inválidos, permitir edição e usar empty/invalid/stale apropriado; não sobrescrever último layout bom.
- **REQ-006-041 — Progress and cancellation:** Exibir progresso não enganoso e permitir cancelar; cancelamento não compromete dados nem publica resultado parcial.
- **REQ-006-042 — Keyboard and accessibility:** Canvas e page list possuem rótulos, foco, atalhos não conflitantes e semântica para leitores de tela; reduced motion respeitado.
- **REQ-006-043 — Responsive layout:** Desktop-first; tablets/mobile mantêm controles operáveis e scroll sem corte de página, compatíveis com DS-APP.

### Integration & lifecycle

- **REQ-006-044 — Offline render:** Todas as fontes, regras e medição executam offline após instalação; nenhuma telemetria/export de conteúdo por rede.
- **REQ-006-045 — PDF adapter contract:** F-009 recebe PagePlan imutável de mesma provenance e não repagina silenciosamente; divergência retorna PDF_LAYOUT_MISMATCH.
- **REQ-006-046 — ATS integration:** F-008 recebe readingOrder e relações source↔fragment, inclusive custom/unclassified, com diagnósticos verificáveis.
- **REQ-006-047 — Error envelope:** Expor erros tipados de parser/theme/font/metrics/worker/resource/layout e ações de remediação, sem falhas brutas na tela.
- **REQ-006-048 — Derived-only cache:** Cache de layout é derivado por fingerprint; invalidar ao mudar source/theme/font/policy e nunca persistir como documento editável.
- **REQ-006-049 — Performance budget:** Medição grande/repaginação não trava input; usar worker/fragmentação incremental quando aplicável, provar com benchmarks.
- **REQ-006-050 — Observability privacy:** Logs locais incluem códigos, duração e fingerprints não reversíveis; jamais conteúdo bruto, contato pessoal ou spans textuais.
- **REQ-006-051 — Stable visual regression:** Fixar corpus, fonts e ambiente para snapshots determinísticos; a mudança visual intencional requer revisão de golden.
- **REQ-006-052 — Import independence:** Atualizações em zoom, OLED Theme Studio ou painel não invalidam fonte, layout ou PDF; mudança em resume theme invalida somente projeções derivadas.

## 5. Layout em unidades físicas

`1 in = 25,4 mm = 72 pt` (exato); page size A4 = 210 × 297 mm; Letter = 612 × 792 pt. Converter para pt com float64. Rounding no envelope de saída será testado/negociado com F-009; regra candidata: até 0,01 pt para serialização, sem rounding acumulativo na paginação. CSS usa fator `96/72` apenas ao **desenhar** PagePlan (não medir o documento).

| Propriedade | Fonte | Unidade | Regra |
|---|---|---|---|
| paper | `theme.tokens.page.size` | A4/Letter | Sem `orientation` no MVP; portrait |
| margin | `theme.tokens.page.marginMm` | mm → pt | 10–30 mm conforme F-007 |
| body text | `theme.tokens.typography.bodyPt` | pt | Não reduzir automaticamente |
| line height | `bodyPt × lineHeight` | pt | Medição por font runs |
| section/item/paragraph | F-007 | pt | Coalescer espaço em quebra determinística |
| heading | `theme.sections.*` | pt | Keep-with-next |
| zoom | preferência do workspace | % | Nunca muda PagePlan |

**Area útil:** `[marginPt, pageWidthPt-marginPt] × [marginPt, pageHeightPt-marginPt]`; toda caixa textual deve caber, ser dividida ou causar issue. Normalizar boxes inválidos não é permitido sem aviso.

## 6. Políticas de paginação candidatas (PROPOSED)

1. Construir uma lista de blocos na `readingOrder` de F-004 com IDs estáveis e permissão explícita de split.
2. Medir linhas com fonte/weight/fontpack fixos (não `charCount × avgWidth`). A implementação exata da shaping engine depende de spike.
3. Resolver breaks priorizando: segurança sem clipping > preservar conteúdo > keep-with-next > widows/orphans > economia de páginas.
4. Título de seção acompanha ao menos o primeiro bloco quando viável; entrada de experiência mantém cargo/empresa/período + 1º bullet quando viável; bullet marker nunca é órfão.
5. Parágrafos podem quebrar por linha (órfãs/viúvas 2/2 como ponto de partida). Conteúdo indivisível maior que área útil resulta em blocker, não overlay invisível.
6. URLs longas têm oportunidades de quebra sem alteração do source. Soft break é apenas layout; texto extraído mantém informação verificável.
7. Não há page-break syntax arbitrária pelo usuário no MVP; `<div style=...>` e CSS não criam regras confiáveis de página.
8. PagePlan contém N páginas completas; renderização DOM pode virtualizar telas fora de foco **sem** mudar contagem nem omitir blocos no PDF.
9. Recursos gigantes retornam `RESOURCE_LIMIT` com instrução de recuperação; nenhum truncamento automático.

## 7. Estado de preview — máquina finita

```text
idle → measuring → current
                   ↘ failed
      ↘ cancelling → cancelled
current --sourceHash/themeHash changes--> measuring + previous stale
measuring --parser/theme invalid--> invalid + previous stale
failed/invalid → retry/measuring
```

- `current`: hashes, métricas e policy iguais aos valores em uso.
- `stale`: último layout bom visível, com banner e export bloqueado até novo preflight.
- `invalid`: source/tema não compila de modo seguro; mantém Source acessível.
- `failed`: engine/worker/font/asset/resource; manter buffer e último bom se disponível.
- `cancelled`: nenhuma alteração no documento; último layout continua stale se não coincide.
- `empty`: sem conteúdo de currículo; não fingir uma página exportável.

## 8. UX / acessibilidade

**Workspace desktop-first:** canvas central com folhas, toolbar superior com zoom, fit page/width, page index e total, painel lateral inspector vinculado a tokens de currículo F-007. Em dispositivos estreitos, inspector em drawer, foco devolvido ao trigger e canvas com scroll independente. Controles da UI usam DS-APP + tema OLED/Graphite opcional, sem contaminar a folha.

**Clique versus seleção:** clique simples em texto mapeado abre origem; seleção de texto com arraste não navega; teclado encontra ação de “Ir para Markdown” em blocos focáveis. Quando a origem só tem precisão `block`, nunca selecionar caractere exato. Issue de fonte ou clipping aparece no canvas e no painel com ação objetiva.

## 9. Contratos, erros e integração

- [`contracts/layout-renderer.ts`](contracts/layout-renderer.ts): envelope de PagePlan, fragments, provenance, ports e estados.
- [`layout-engine.md`](layout-engine.md): algoritmo, ordem de quebras e medidas; `integration.md` define fronteiras.
- [`ux-flows.md`](ux-flows.md): navegação, estados, ações de recuperação.
- [`error-and-recovery.md`](error-and-recovery.md): taxonomia e políticas de não perda.
- [`test-matrix.md`](test-matrix.md): 65 cenários; fixtures e oráculos sem inventar resultados de runtime.

## 10. Definition of Done (pendente de execução)

- [ ] Contratos F-004/F-005/F-007/F-009 alinhados e aprovados; decisões `LAY-D*` resolvidas.
- [ ] Spike real medição/font metrics/PDF visual em Web + Tauri offline; tolerâncias formalmente aprovadas.
- [ ] Cada um dos 65 SC executado com resultado e evidência (sem confundir fixtures com testes).
- [ ] Parser/renderer lidam com source Unicode, custom, longo e input malicioso sem clipping silencioso.
- [ ] Fontes incluídas legalmente/empacotadas; sem requests de rede.
- [ ] Print/PDF text extraction, ordem, páginas e clipping validados em F-009 por oráculo independente.
- [ ] A11y, responsivo, loading/stale/error e performance validados em devices suportados.

## 11. O que ainda não está comprovado

As métricas de fontes, a estratégia de impressão vs. engine PDF, a paridade entre Chromium/WebView Windows/Linux e o budget de performance **não foram testados**. Este documento propõe contratos; não confirma precisão de PDF nem compatibilidade ATS universal.