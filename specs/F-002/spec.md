# F-002 — DS-APP, padrões de interação e AppShell · SDD v0.2

**Status:** `PROPOSED` · **Implementação:** nenhuma validada · **Governança:** preservar requisitos anteriores `REQ-002-001..005`.  
**Objetivo:** Design System completo da interface do produto, testável, independente de temas de currículo, com acessibilidade e ergonomia editorial desktop-first.

## Limite de responsabilidade
F-002 possui *tokens, componentes UI, navegação, painéis, padrões de feedback/teclado, contratos de status e templates*. Parser, armazenamento, salvamento, export real e regras ATS pertencem a F-001/F-004/F-005/F-008/F-009. F-002 recebe estado tipado e dispara ações, não cria lógica de negócio duplicada.

## Referências normativas internas
- `../../design-system/README.md`
- `../../design-system/foundations.md`
- `../../design-system/component-catalog.md`
- `../../design-system/interaction-patterns.md`
- `../../design-system/layouts-and-screens.md`
- `../../design-system/accessibility.md`
- `../../design-system/quality-gates.md`
- `../../design-system/contracts/ui.ts`
- `../../design-system/tokens/app.tokens.json`

## Requisitos com identidade estável

| ID | Obrigatoriedade | Requisito e observação |
|---|---|---|
| REQ-002-001 | MUST | Componentes DS usam semantic tokens e documentam estados realmente aplicáveis. |
| REQ-002-002 | MUST | Shell desktop-first mantém documento dominante e panes ajustáveis/recolhíveis, com fallback responsive. |
| REQ-002-003 | MUST | Ações essenciais têm teclado, foco visível, acesso touch e semântica correta. |
| REQ-002-004 | MUST | Falha persistente não pode depender de toast. |
| REQ-002-005 | MUST | Modo claro/escuro da UI não altera PDF, document rendering nem `THEME-RESUME`. |
| REQ-002-006 | MUST | Tokens de referencia/semantic/component/mode têm namespace DS-APP, sem hardcode de valor nas features. |
| REQ-002-007 | MUST | Cada componente declara API, slots, variants, estados, keyboard/ARIA e story consumível. |
| REQ-002-008 | MUST | Sem nested interativos inválidos (link com menu button dentro), sem controles fake clicáveis. |
| REQ-002-009 | MUST | Foco e landmarks continuam previsíveis entre overlay, rotas, drawers e panes ocultos. |
| REQ-002-010 | MUST | Navigação Source/Design/ATS trata rotas como links e history; Export é ação de workflow. |
| REQ-002-011 | MUST | `SaveStatus` diferencia dirty/saving/saved/failed/conflict por revisão confirmada, sem false-positive. |
| REQ-002-012 | MUST | Ao falhar storage, source permanece editável em memória e download de emergência fica visível. |
| REQ-002-013 | MUST | Preview stale sinalizado fora da folha, preservando última versão válida sem fingir atualidade. |
| REQ-002-014 | MUST | Controle visual de tema não altera markdown; JSON inválido não aplica, mantém draft e mostra diagnóstico. |
| REQ-002-015 | MUST | Diagnóstico com `sourceSpan` navega ao contexto; sem span não inventa linha/exatidão. |
| REQ-002-016 | MUST | Export não apresenta `Ready/Download atual` antes de verificação e correspondência de revision/hash. |
| REQ-002-017 | MUST | Empty, no-results, loading, error, not-found e stale são distintos quando relevantes, com saída acionável. |
| REQ-002-018 | MUST | Modal destrutivo explicita entidade/risco e oferece cancel seguro; foco recuperável inclusive item removido. |
| REQ-002-019 | MUST | Input e importação têm label/ajuda/erro nativos, picker alternativo a drag, validação adequada. |
| REQ-002-020 | MUST | Splitters têm alternativa teclado, limites e reset/colapso/restauração acessíveis. |
| REQ-002-021 | MUST | Browser zoom, text enlargement, light/dark e screen reduced motion não quebram funcionalidades críticas. |
| REQ-002-022 | MUST | Módulos usam `DS-APP` através de API pública; não sobrescrevem estrutura interna de CSS para ajustes locais. |
| REQ-002-023 | MUST | Documento vazio tem ações guiadas, sem inventar conteúdo/estado de sucesso. |
| REQ-002-024 | MUST | ATS issues exibem severidade textual, origem e remediation; não há score mágico. |
| REQ-002-025 | SHOULD | Preferência de largura de panes e visual mode preservável localmente, sem travar quando viewport muda. |
| REQ-002-026 | SHOULD | Atalhos documentados; Ctrl/Cmd+S salva buffer, F6 por regiões sujeito a teste de conflito. |

## Source of truth / efeitos
- `ResumeDocument.markdown` não pode mudar por alternar modo, redimensionar pane, tema da interface ou abrir diálogo.
- Aplicar `themeOverrides` é comando do domínio; `DS-APP` emite novo valor validado.
- `SaveStatus` é projeção de estados de persistência, não sinal cosmético independente.
- `ExportArtifact` verificado e associado a hashes determina botão de download atual.
- Design preview não implementa editing inline no MVP (`D-04` proposta).

## SC-002 — Cenários de aceitação rastreáveis

Cada cenário abaixo remete ao procedimento detalhado DS-T do `quality-gates.md`. Critérios são observáveis, automatizados onde possível; sem execução ainda.

| Scenario | Referência | Requisitos principais | Evidência |
|---|---|---|---|
| SC-002-01 — Desktop | DS-T001 | 001,002,005,010 | visual+E2E |
| SC-002-02 — Compact | DS-T002 | 002,020,021 | visual+E2E |
| SC-002-03 — Mobile | DS-T003 | 002,009,021 | keyboard+E2E |
| SC-002-04 — Dialog | DS-T007 | 003,009,018 | E2E |
| SC-002-05 — Save error | DS-T010 | 004,011,012 | integration+E2E |
| SC-002-06 — Compact small | DS-T004 | 009,021 | visual+keyboard |
| SC-002-07 — UI theme isolation | DS-T005 | 005,006,022 | integration |
| SC-002-08 — Toolbar | DS-T006 | 003,007,009 | keyboard |
| SC-002-09 — Splitter | DS-T008 | 002,020 | keyboard |
| SC-002-10 — Save race | DS-T009 | 011,012 | integration |
| SC-002-11 — Save conflict | DS-T011 | 011,012 | integration |
| SC-002-12 — Stale YAML | DS-T012 | 013,023 | integration |
| SC-002-13 — JSON invalid | DS-T013 | 014 | E2E |
| SC-002-14 — Theme preview cancel | DS-T014 | 014 | integration |
| SC-002-15 — Issue located | DS-T015 | 015,024 | E2E |
| SC-002-16 — Issue location unknown | DS-T016 | 015,024 | unit+E2E |
| SC-002-17 — ATS no issues | DS-T017 | 017,024 | visual |
| SC-002-18 — Export blocked | DS-T018 | 016,017 | E2E |
| SC-002-19 — Export outdated | DS-T019 | 011,016 | integration |
| SC-002-20 — PDF verification error | DS-T020 | 016,017 | E2E |
| SC-002-21 — Home empty | DS-T021 | 017,023 | visual |
| SC-002-22 — Query no results | DS-T022 | 017 | E2E |
| SC-002-23 — Bad import | DS-T023 | 017,019 | E2E |
| SC-002-24 — Focus deleted item | DS-T024 | 009,018 | keyboard |
| SC-002-25 — Zoom/layout | DS-T025 | 003,021 | manual+visual |
| SC-002-26 — Offline | DS-T026 | 011,017 | E2E |
| SC-002-27 — No fake WYSIWYG | DS-T027 | 013,014 | E2E |
| SC-002-28 — Extreme title | DS-T028 | 002,021 | visual |
| SC-002-29 — Repeated loading action | DS-T029 | 007,017 | unit |
| SC-002-30 — Hidden pane focus | DS-T030 | 009,020 | keyboard |

## Invariants / casos extremos
- Não colocar loader genérico sobre a folha em toda digitação.
- Não usar `role=tab` para link de rota Source/Design/ATS.
- Não sequestrar `Ctrl/Cmd+Z` do editor para undo de theme.
- Não permitir keyboard focus em drawer/pane oculto.
- Não inferir sucesso ou % de progresso só pelo estado do botão.
- Não fazer escolha automática da fonte do editor determinar fonte do PDF.
- Não bloquear trabalho por ausência de rede depois do bundle offline preparado.

## Definition of Done para F-002
1. Interfaces e tokens foram revisados e congelados na versão `approved`, ou explicitamente aprovados por mudança ADR.
2. Cada P0/P1 usado no MVP tem story visual de estados aplicáveis e teclado; P2 não entra sem consumidor.
3. SC-002-01..30 têm evidência/teste identificável. Bugs críticos de teclado, perda de source e falsa persistência bloqueiam.
4. A11y manual + automatizada executada em fluxos principais; 2 modos de UI, zoom e locais validados.
5. Theme do currículo e PDF renderizado permanecem idênticos após alternar `uiTheme` no teste de regressão.
6. Docs (`contracts`, `catalog`, `tokens`) e testes estão sincronizados; sem prop clandestina.

## Próximos artefatos só depois de aprovação
`plan.md`, `tasks.md`, testes e PRs. O plano candidato com work packages está em `../../design-system/delivery-sequence.md`. Documento F-002 é executável como specification, não comprovação de código já entregue.