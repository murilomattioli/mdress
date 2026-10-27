# F-007 — Theme Engine e Customização (Spec)

**SDD:** v0.6.0 · **Status:** `PROPOSED / REVIEW REQUIRED / NOT IMPLEMENTED`  
**Dependências:** F-002 (componentes do painel), F-003 (CAS / persistência), F-004 (blocos e source provenance), F-005 (sessão de workspace).  
**Consumidores:** F-006 (layout), F-008 (inspector ATS), F-009 (export PDF), F-011 (preferências locais).

## 1. Resultado e invariantes

Permitir aplicar e personalizar estilos de currículo a partir de **presets versionados offline**, por controles visuais ou JSON estrito, sem reescrever nem normalizar Markdown. A customização configura **apresentação do documento**, não a estrutura semântica nem o Design System do app.

**LOCKED:** Markdown canônico, modo offline, dados locais, PDF textual/verificável, DS-APP separado de THEME-RESUME, sem execução de CSS/HTML/JS arbitrários. **PROPOSED:** referências `<slug>@<semver>` dentro do `themeId` legado, limites numéricos, paleta e fonts, máximo de herança, política de warnings, UX de troca e reset.

### Regras de ownership

| Item | Owner de escrita | F-007 faz |
|---|---|---|
| `ResumeDocument.markdown`, parser AST/sourceHash | F-005/F-004 | lê somente provenance; nunca grava |
| `ResumeDocument.themeId/themeOverrides` | F-003 CAS | altera por comando explícito com expectedRevision |
| App tokens/components | F-002 | consome UI, nunca sobrescreve |
| ResolvedTheme | F-007 | calcula projeção somente leitura com hash |
| Rendered pages/zoom/overflow | F-006 | fornece valores de apresentação; não mede layout |
| ATS rules | F-008 | fornece dados/riscos de tema; sem score |
| PDF/font validation | F-009 | fornece identidade/contrato do tema; não marca export como verificado |

### Pipeline

```text
Versioned Theme Registry (offline) ─┐
   ancestors → selected preset      ├─ schema/policy → resolver → ResolvedTheme / themeHash
ResumeDocument.themeOverrides ──────┘                               │
                                                         ┌──────────┴──────────┐
                                              Design preview F-006       Export F-009
                                                       (source hash)      (verified PDF)
```

**ThemeSelectionDraft / JSONDraft** ficam na sessão; não são gravações automáticas do documento. Fonte canônica raw nunca vira conteúdo do tema.

## 2. Requisitos auditáveis


### Catálogo e compatibilidade

- **REQ-007-001 — Preset registry:** Catálogo local carrega ao menos 3 presets versionados, sem rede, com label/description e identidade estável.
- **REQ-007-002 — Pinned ref:** Documentos apontam `themeId=<slug>@<semver>`; presets publicados são imutáveis, versões antigas permanecem enquanto referenciadas; legado tem migração explícita.
- **REQ-007-003 — Inheritance:** `extends` de preset só permite uma referência versionada instalada; resolver em ordem ancestor→descendant, com limite e detecção de ciclos.
- **REQ-007-004 — Catalog errors:** Preset ausente/corrompido não apaga overrides, não salva fallback como novo themeId e oferece recuperação segura.
- **REQ-007-005 — Offline assets:** Fontes de render são pacotes locais allowlisted com licença verificada; nenhuma URL remota ou dependência de system font para PDF reproduzível.
- **REQ-007-006 — Isolation:** Tokens DS-APP light/dark não entram na árvore THEME-RESUME; alternar aparência do app não altera themeHash nem PDF.

### Modelo e resolução

- **REQ-007-007 — Pure resolver:** Resolver é função pura do preset versionado, ancestors, overrides e versão de contrato; sem DOM, storage, locale do OS ou clock.
- **REQ-007-008 — Merge semantics:** Merge recursivo apenas para registros conhecidos; arrays são substituídos, valores inválidos bloqueados e chave ausente usa herdado.
- **REQ-007-009 — Effective model:** ResolvedTheme contém tokens completos, sectionStyles completos, font IDs, provenance, policy de leitura fixa e diagnósticos separados.
- **REQ-007-010 — Canonical hash:** `themeHash` usa serialização canônica ordenada + digest SHA-256 de versão do algoritmo, referências e valores efetivos; independente de ordem JSON.
- **REQ-007-011 — Section scope:** Overrides por seção aceitam somente oito escopos semânticos conhecidos; seções desconhecidas usam escopo `custom`, preservando conteúdo.
- **REQ-007-012 — Safety boundaries:** Não permitir layout absoluto, colunas que alterem ordem de leitura, texto invisível, CSS arbitrário ou alteração da source semantic AST pelo tema.

### Editor e galerias

- **REQ-007-013 — Gallery states:** Galeria apresenta presets, busca/seleção, preview, estados loading/empty/no-results/error e seleção atual distinta de hover.
- **REQ-007-014 — Preview isolation:** Hover/preview/tentativa de mudança não persistem dados; exibem resultado identificado por fonte e tema e são descartáveis.
- **REQ-007-015 — Switch policy:** Trocar preset com customizações oferece opções explícitas manter overrides ou usar padrão do novo; aplicar só após confirmação.
- **REQ-007-016 — Controls coverage:** Controles permitem editar página, paleta, tipografia, spacing e seções em tokens validados, refletindo herdado vs personalizado.
- **REQ-007-017 — Two-way sync:** JSON e controles representam um só ThemeOverrides confirmado; alterações confirmadas em um aparecem no outro sem reescrever Markdown.
- **REQ-007-018 — Responsive UI:** Inspector é painel redimensionável no desktop e drawer responsivo; canvas mantém prioridade e controles acessíveis em touch.
- **REQ-007-019 — Accessible controls:** Label/unidade/range/min/max/reset e feedback via teclado/aria; controles não dependem somente de cor/drag.

### JSON avançado e validação

- **REQ-007-020 — Safe JSON:** Editor avançado usa JSON estrito, tamanho máximo, profundidade limitada, duplicate keys rejeitadas e sem execução de JS/HTML.
- **REQ-007-021 — JSON draft isolation:** Buffer JSON inválido permanece editável e local; não altera overrides válidos nem preview válido nem banco.
- **REQ-007-022 — Path diagnostics:** Erros de parse/schema indicam severity, JSON Pointer e linha/coluna quando possível; erros não são suprimidos.
- **REQ-007-023 — Unknown keys:** Schema rejeita keys desconhecidas e propriedades perigosas (`__proto__`, `constructor`, `prototype`), sem silently ignore.
- **REQ-007-024 — Units policy:** Inteiros/floats finitos e unidades explícitas (`pt`/`mm` nas labels, números nos dados), limites coerentes e sem CSS strings.
- **REQ-007-025 — Semantic constraints:** Preflight de tema sinaliza contraste, riscos ATS e paginação como issues explicáveis; issues `error` impedem Apply, `warning` é tratada segundo policy.
- **REQ-007-026 — JSON apply:** Aplicar JSON válido é transação única; Cancelar/Fechar não aplica e dirty JSON pede confirmação para descarte.

### Reset, preservação e histórico

- **REQ-007-027 — Field reset:** Reset de campo elimina apenas o path do override, revelando valor herdado; não regrava default literal.
- **REQ-007-028 — Group reset:** Reset de grupo remove apenas respectivo subtree, preserva outros grupos e fonte raw.
- **REQ-007-029 — All reset:** Reset geral tem preview de impacto e confirmação quando há overrides; resultado `{}` e preset ainda vinculado.
- **REQ-007-030 — Theme undo:** Histórico de transações de tema da sessão é separado do undo do Markdown; nunca manipula `draftSeq` textual.
- **REQ-007-031 — Fidelity:** Qualquer mutação de tema conserva byte a byte `ResumeDocument.markdown` e seu `sourceHash`.

### Persistência e concorrência

- **REQ-007-032 — Atomic CAS:** Comandos de theme usam F-003 CAS com expectedRevision, documentId, commandId, patch e política de idempotência.
- **REQ-007-033 — Safe feedback:** Salvar status só após commit de theme concluído; falha de quota/storage mantém última configuração confirmada e draft de edição recuperável.
- **REQ-007-034 — Cross-tab conflict:** Theme update concorrente (ou edição source/rename) dá conflito observável, sem overwrite silencioso; reload, comparar ou descartar são explícitos.
- **REQ-007-035 — Stale responses:** Render/resolve async tardios são descartados por `documentId`, `draftSeq`, `sourceHash`, `themeHash` e `attemptId`/epoch.
- **REQ-007-036 — Atomic mode switch:** Navegação Source/Design/ATS/Export preserva preview e edição de theme; fechamento dirty pede confirmação e não força persistência.

### Integrações, export e segurança

- **REQ-007-037 — Renderer contract:** F-006 consome ResolvedTheme imutável e layout tokens em unidades definidas, sem consultar DS-APP ou gravar estado do tema.
- **REQ-007-038 — Export contract:** F-009 recebe `themeHash`, fontPack refs e resolved values do mesmo snapshot validado; falha de fonte bloqueia PDF verificado.
- **REQ-007-039 — ATS contract:** F-008 recebe riscos estruturais, não score subjetivo; tema não muda ordem semântica nem esconde informação essencial.
- **REQ-007-040 — Cache/invalidation:** Mudança de theme invalida layout/PDF conforme themeHash, mas não refaz parser sem mudança de sourceHash; controles transitórios não invalidam durable cache.
- **REQ-007-041 — Security/locality:** Sem fetch, CSS/HTML externo, imports remotos, fontes externas, execução de config ou logs de conteúdo pessoal.
- **REQ-007-042 — Recovery:** Tema não reconhecido, fontes ausentes, overrides legacy e pacote defeituoso levam a fallback apenas de visualização, sem alteração automática do documento.

## 3. Cenários de aceitação

Cada linha é um contrato Given/When/Then condensado. Setup, fixture, teste e owner em [test-matrix.md](test-matrix.md). **Não são testes de aplicação já executados.**

| Cenário | Requisitos | Dado / Quando | Então (oráculo observável) |
|---|---|---|---|

| SC-007-01 | REQ-007-001 | Catálogo embutido em modo avião | Os 3 presets aparecem sem request de rede |
| SC-007-02 | REQ-007-001, REQ-007-002 | Muda versão do catálogo local mantendo documento pinado | ResolvedTheme permanece na versão referida até upgrade explícito |
| SC-007-03 | REQ-007-002, REQ-007-042 | Abre documento legado com themeId=Minimal | Interface expõe proposta de migração sem sobrescrever automaticamente |
| SC-007-04 | REQ-007-003, REQ-007-007, REQ-007-008 | Resolve Swiss herdando Minimal | Tokens-base ausentes são herdados e tokens declarados no filho prevalecem |
| SC-007-05 | REQ-007-003, REQ-007-004 | Preset extends cíclico A→B→A | Resolução falha com THEME_CYCLE; nenhum commit |
| SC-007-06 | REQ-007-003, REQ-007-004 | Preset extends referência inexistente | Erro MISSING_BASE e fallback somente para preview |
| SC-007-07 | REQ-007-004, REQ-007-042 | Documento referencia preset não instalado | Permanecem themeId, source e overrides, com recovery visual rotulado |
| SC-007-08 | REQ-007-005, REQ-007-038 | Font pack não instalado ao renderizar PDF | Export bloqueado; preview usa fallback visível; nenhum PDF “verified” |
| SC-007-09 | REQ-007-006 | Alterna app light↔dark | themeHash e modelo de página permanecem iguais |
| SC-007-10 | REQ-007-007, REQ-007-008 | Resolve tema duas vezes com mesmos inputs | Saídas profundamente idênticas; sem side effects |
| SC-007-11 | REQ-007-008 | Override com valor 0 dentro do range | 0 não é tratado como false/ausente; aparece no ResolvedTheme |
| SC-007-12 | REQ-007-008, REQ-007-024 | Override inválido com número NaN/Infinity | Config rejeitada, sem coerção e sem mutation |
| SC-007-13 | REQ-007-009, REQ-007-011 | Personaliza estilo da seção experience | Só experience muda; custom fallback preservado |
| SC-007-14 | REQ-007-010 | JSON com mesmas keys em ordens diferentes | Hashes SHA-256 idênticos |
| SC-007-15 | REQ-007-010, REQ-007-040 | Altera um único token efetivo | themeHash muda, parser cache de source permanece |
| SC-007-16 | REQ-007-011, REQ-007-012 | Input custom section e tentativa de unknown scope | Usa escopo custom; override arbitrário é rejeitado |
| SC-007-17 | REQ-007-012, REQ-007-039 | Preset contém `layoutMode=two-columns` | Bloqueia schema/policy, ordem semântica protegida |
| SC-007-18 | REQ-007-013 | Abre galeria de presets | Mostra seleção atual, cards e preview utilizável |
| SC-007-19 | REQ-007-013 | Busca nome inexistente na galeria | Estado no-results e limpar busca disponíveis |
| SC-007-20 | REQ-007-013, REQ-007-042 | Catálogo falha no carregamento | Estado error e retry; nenhuma gravação |
| SC-007-21 | REQ-007-014, REQ-007-035 | Hover sucessivo A→B com render A atrasado | A descartado; preview de B permanece atual |
| SC-007-22 | REQ-007-014, REQ-007-031 | Fecha galeria após visualizar preview diferente | Document themeId, raw source e overrides iguais |
| SC-007-23 | REQ-007-015 | Troca Minimal para Swiss com overrides existentes | Escolhe manter ou descartar antes de aplicar; não assume política |
| SC-007-24 | REQ-007-015, REQ-007-032 | Confirma mudança para Swiss + reset overrides | CAS atômico grava novo themeId e `{}` |
| SC-007-25 | REQ-007-016, REQ-007-019 | Muda tamanho tipográfico por teclado | Value, unidade, override indicator e preview consistentes |
| SC-007-26 | REQ-007-016, REQ-007-017 | Altera section spacing no controle | JSON confirmado contém path correspondente exatamente |
| SC-007-27 | REQ-007-017 | Abre JSON com valores modificados no controle | Representação única e sem defaults materializados em overrides |
| SC-007-28 | REQ-007-018 | Viewport pequeno e teclado virtual | Drawer não cobre ação Save/Cancel e viewport do documento |
| SC-007-29 | REQ-007-019 | Foco teclado em reset e color field | Focus visível, labels/aria, sem dependência exclusiva do mouse |
| SC-007-30 | REQ-007-020 | Digita JSON malformado/objeto duplicado | Erro distinto com localização; sem executar código |
| SC-007-31 | REQ-007-020, REQ-007-023 | Cola `__proto__` e chave desconhecida | Rejeição explícita; nenhuma propriedade dinâmica aplicada |
| SC-007-32 | REQ-007-021, REQ-007-026 | Digita JSON inválido após válido e fecha modal | Preview confirmado inalterado; confirmação de descarte |
| SC-007-33 | REQ-007-022 | Cola JSON com margem -2 e coloração inválida | Lista múltiplos erros com JSON Pointer e orientação |
| SC-007-34 | REQ-007-024 | BodyPt fora do range, margem em string `18mm` | Apontar tipo/range; sem coerção |
| SC-007-35 | REQ-007-025 | Tema com contraste de texto insuficiente | Issue explicável com papel da cor/ratio, ação de correção |
| SC-007-36 | REQ-007-025, REQ-007-039 | Tema tenta ocultar texto principal | Erro bloqueante; não publica ResolvedTheme válido |
| SC-007-37 | REQ-007-026, REQ-007-032 | JSON válido aplica exatamente uma transação | Novo revision após CAS, markdown intocado |
| SC-007-38 | REQ-007-027 | Reseta somente bodyPt | Caminho eliminado, herdado reaparece, accent permanece |
| SC-007-39 | REQ-007-028 | Reseta grupo spacing | Spacing overrides somem, typography preservada |
| SC-007-40 | REQ-007-029, REQ-007-031 | Reset all com ajustes em três grupos | Confirmação mostra impacto; `{}`, markdown hash igual |
| SC-007-41 | REQ-007-030 | Undo theme após troca e Ctrl+Z no Source | Históricos separados; Raw Markdown não se modifica por theme undo |
| SC-007-42 | REQ-007-031 | Muda cor e reabre source | Markdown idêntico a antes, inclusive BOM/CRLF |
| SC-007-43 | REQ-007-032, REQ-007-033 | Commit CAS retorna sucesso atrasado | “Salvo” só depois do commit atual |
| SC-007-44 | REQ-007-033, REQ-007-042 | IndexedDB retorna QUOTA_EXCEEDED | Preserva último tema durável, JSON draft recuperável e retry |
| SC-007-45 | REQ-007-034 | Duas abas salvam versões de tema | Uma falha REVISION_CONFLICT; nenhuma substituição silenciosa |
| SC-007-46 | REQ-007-034, REQ-007-036 | Altera Source na outra aba enquanto tema dirty | Conflito e comparação; não sobrescreve o source remoto |
| SC-007-47 | REQ-007-035 | Source muda entre preview temático e render | Preview antigo rotulado stale, sem confundir com atual |
| SC-007-48 | REQ-007-036 | Vai de Design para ATS com inspector dirty | Mesma sessão/aviso apropriado, nenhum commit implícito |
| SC-007-49 | REQ-007-037 | Renderer recebe tokens em pt/mm | Construção de layout independe de theme UI e CSS livre |
| SC-007-50 | REQ-007-038, REQ-007-040 | Gera PDF depois de alterar fonts/spacing | Artigo associado ao themeHash corrente; verificação posterior necessária |
| SC-007-51 | REQ-007-039 | Tema com headings decorativos | ATS recebe ordem de leitura inalterada e warning de risco |
| SC-007-52 | REQ-007-040 | Muda somente uiTheme e faz novo parse | Não deve invalidar SemanticResume e layout de documento |
| SC-007-53 | REQ-007-041 | Preset/JSON tenta remote url em font/css | Input é rejeitado e network monitor permanece sem requests |
| SC-007-54 | REQ-007-042 | Preset corrompido ao reabrir workspace | Fallback preview identificado e opção de selecionar preset íntegro |

## 4. Estados e transições obrigatórios

Theme catalog: `idle → loading → ready | empty | error`; busca em `ready` pode produzir `no-results`, sem confundir com catálogo vazio.  
Session: `clean → previewing → editing-controls | editing-json → validating → ready-to-apply → committing → clean | failed | conflict`; `invalid-json` é estado local não persistível; `stale-preview` é derivado de provenance, não uma confirmação.

- **Preview**: muda apenas theme selecionado na sessão; ao Cancelar deve restaurar seleção confirmada e visual anterior.
- **Apply**: primeiro valida, solicita compare-and-swap, aguarda resultado; somente após commit pode anunciar `salvo neste dispositivo`.
- **Error**: erro visível e persistente com Retry/Copy JSON; nunca esconder buffers dirty sob toast temporário.
- **Conflict**: compare `saved`, `local draft`, `remote`, escolhendo explicitamente manter, descartar, exportar overrides ou reabrir.
- **Modal cancel**: JSON inválido não é aplicado e não é silenciosamente apagado.
- **Export**: exige vínculo exato entre `sourceHash`, `themeHash`, font references e revision, conforme F-009; layout preview **não** prova validade de PDF.

## 5. Critérios não funcionais / gates

- Persistência offline no mesmo IndexedDB F-001; nenhuma store extra é necessária para presets embutidos.
- Perf: controls não bloqueiam digitação do Source; preview cancelável e debounced, sem falsa confirmação.
- A11y: painel e diálogo WCAG 2.2 AA como alvo; valores de tokens de currículo são auditados separadamente pelo inspector.
- Segurança: JSON puro, schema fechado, font allowlist, sem `style=` interpolado sem sanitização e sem CSS/HTML arbitrários.
- Compatibilidade: contratos F-003 e F-005 permanecem; migração de referências não é feita por `GET`.
- Qualidade: testes de theme resolver, schema, mocks transacionais, e snapshots de PDF/preview **quando implementação existir**.

## 6. Implementação não autorizada ainda

Resolver decisões [`THEME-D01..D14`](open-decisions.md), aprovar schema/token ranges e definir desenho do inspector antes de `plan.md`/`tasks.md`. Testes de runtime, PDF, IndexedDB e a11y não estão realizados nesta entrega.