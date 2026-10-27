# F-005 — Workspace e editor Markdown (contrato funcional)

**Versão:** v0.4.0 — 2026-10-22  
**Status:** PROPOSED / REVIEW REQUIRED / NOT IMPLEMENTED  
**Dependências:** F-001 (CAS/IndexedDB), F-002 (DS-APP + shell), F-003 (documentos/revisões), F-004 (parser/source maps); integração com F-006/007/008/009.  
**Produto:** Web/PWA/Tauri, 100% offline, desktop-first responsivo.  
**Owners de revisão:** UX, front-end/DS, domínio, storage, parser, QA/a11y.

## 1. Resultado e limites

O editor deve permitir escrever um currículo real em `.md` e visualizar informações derivadas sem aprisionar conteúdo numa estrutura WYSIWYG. O **buffer raw atual é a referência para a edição**; só o commit validado no IndexedDB constitui versão persistida. Frontmatter e AST são projeções derivadas, não um modelo editável paralelo.

**Dentro do módulo:** rota `/resume/:id/source`, sessão viva do workspace, input, find/replace, undo/redo, navegação Source↔Design↔ATS, autosave, diagnostics, source offsets, recoverability, conflitos, atalhos, drawers e copy/paste.  
**Delegado a outros módulos:** parser/semântica em F-004; layout/paginação em F-006; edição de tokens de tema em F-007; regras ATS em F-008; export e verificação PDF em F-009; import de arquivo em F-010; persistência do IndexedDB e transações em F-001; biblioteca CRUD em F-003.  
**Não objetivos:** edição inline em tela Design, blocks WYSIWYG proprietários, rich-text paste, sincronização cloud/CRDT, IA, programação de export, armazenamento de buffer em backend, prometer undo durável após fechar o app.

## 2. Vocabulário e invariantes operacionais

- **draft**: sequência completa do Markdown tal como está no editor, mesmo não salva; nunca reconstruída do AST.
- **savedSnapshot**: última versão confirmada pela persistência (`revision` + markdown + theme); o número local de digitação não é revision de banco.
- **draftSeq**: contador monotônico da sessão, aumenta a cada transação textual; identifica snapshots in-memory.
- **committedSeq**: última versão textual da sessão que o IndexedDB confirmou; sempre `<= draftSeq`.
- **dirty**: `draftSeq != committedSeq` **ou** Markdown atual diferente de snapshot confirmado; salvar metadados sem tocar Markdown não limpa dirty.
- **save attempt**: snapshot `{draftSeq, markdown, expectedRevision}` congelado; nunca recebe novos chars após disparar.
- **last-good preview**: renderização de origem explicitamente identificada e possivelmente stale; nunca chamada de atual quando `sourceHash` mudou.
- **parser output**: pode falhar e nunca impede persistência de Markdown raw. Somente saída com `draftSeq/sourceHash` corrente pode se dizer atual.
- **conflict**: CAS falhou ou documento remoto mudou/deletou; não fazer merge/overwrite silencioso.

**Invariantes LOCKED:** Constituição C-01/02/03/05/07/10/18. Ações de edição não mudam theme automaticamente; edição visual inline fica fora deste módulo salvo decisão de produto futura.

## 3. Áreas do workspace

| Região | Fonte | Ações | Falhas e estados |
|---|---|---|---|
| Header compartilhado | F-003 + SaveStatus | voltar, nome, Source/Design/ATS, Export | conflito e erro persistente perto de status |
| Outline colapsável | F-004 semantic/source spans | localizar seção atual | vazio, parsing, stale, range indisponível |
| Source editor (principal) | `draft` raw | texto, seleção, paste, undo, find/replace | vazio, readonly de recovery, erro interno |
| Toolbar contextual | EditorSession | buscar, replace, wrap, lines, baixar .md | disable/feedback contextual |
| Diagnostics panel/drawer | F-004 issue set com provenance | filtros, localizar, dismiss não destrutivo | nenhum, em análise, stale, parse error |
| Statusbar | workspace + editor | save, linha/col, idioma, issues | badge salvo apenas pós-commit |

A navegação entre `/source`, `/design`, `/ats`, `/export` carrega o **mesmo agregado** e não refaz o draft do banco enquanto houver sessão montada. Um hard refresh reconstrói do snapshot persistido e não pode insinuar que o histórico de undo sobreviverá.

## 4. Regras de armazenamento e revisão

1. F-003 `AtomicRepositoryPort.updateExisting(id, expectedRevision, {markdown})` é o único caminho de commit raw; deve fazer compare-and-swap na transação. Nenhum upsert em documento removido.
2. A UX serializa commits do mesmo documento. Enquanto uma operação está in-flight, o próximo save fica agendado e captura o **último** `draftSeq`, nunca a cópia antiga.
3. `SaveStatus=salvo` somente se o draft atual é comprovadamente o snapshot confirmado; erro ao salvar mantém dirty + buffer e permite retry.
4. Outra aba/rota/rename/theme alterando revision gera revalidação. Sem evidência de compatibilidade, **não** aplicar rebase automático.
5. `Ctrl/Cmd+S` faz flush; mudança de modo não equivale a autorização para descartar draft. Navegação com salvamento pendente retém sessão.
6. Se usuário escolhe `Duplicar última versão salva` em F-003, deixar claro que alterações locais não entram. `Salvar e duplicar` exige flush com sucesso antes de duplicar.
7. Parser falho não modifica commit raw; export PDF atual exige snapshot persistido que F-009 consiga verificar.

## 5. Requisitos auditáveis

### Conteúdo e editor

- **REQ-005-001 — Canonical source:** Exibir/editar o Markdown completo, inclusive whitespace, frontmatter e conteúdo desconhecido, sem transformação automática e sem salvamento de AST.
- **REQ-005-002 — Text fidelity:** Preservar sequências de linha, BOM/Unicode e Markdown literal durante edição/salvamento/cópia; não normalizar sem comando explícito e preview das diferenças.
- **REQ-005-003 — Editor isolation:** Fornecer editor de texto acessível com caret, seleção, composição IME, navegação e paste de texto, sem permitir que parser ou preview substitua buffer.
- **REQ-005-004 — Load and route:** Abrir rota existente com documento validado e distinguir loading, missing, corrupt, migration failure e storage unavailable; nunca criar documento por GET.
- **REQ-005-005 — Editor session:** Preservar draft, caret, seleção, viewport, histórico undo/redo e preferências de sessão entre Source/Design/ATS/Export enquanto workspace estiver montado; restaurar posicionamento com cautela.

### Persistência e integridade

- **REQ-005-006 — Dirty identity:** Distinguir `savedRevision`, `draftSeq`, `committedSeq`, writes em andamento e `dirty`; qualquer alteração posterior a um snapshot impede `Salvo` prematuro.
- **REQ-005-007 — Autosave queue:** Debounce configurável e serialização por documento com 1 write in flight, CAS `expectedRevision`, coalescing da versão mais recente e flush explícito; jamais permitir write antigo depois de novo.
- **REQ-005-008 — Save feedback:** Exibir estados fiéis `carregando`, `editando`, `salvando`, `salvo`, `erro`, `conflito`, `sem acesso` e explicações sem toast spam; falha fica persistente.
- **REQ-005-009 — Manual flush:** `Ctrl/Cmd+S` / ação Salvar agora dispara flush da versão atual, com confirmação só após commit real; se nenhum delta, retornar salvo sem incrementar revisão desnecessariamente.
- **REQ-005-010 — Storage failure:** Em quota, transação abortada e storage unavailable, manter buffer íntegro e habilitar retry e download de emergência `.md` sem falsa persistência.
- **REQ-005-011 — Optimistic conflict:** Conflitos CAS nunca sobrescrevem automaticamente revisão remota; manter draft/última base, expor comparação e ações explícitas para carregar, salvar como novo ou exportar.
- **REQ-005-012 — Cross-tab change:** Reconhecer mudança/deleção por outra aba com revalidação em foco/visibilidade e antes de commit; se sujo, nunca trocar conteúdo sem decisão.
- **REQ-005-013 — Delete integration:** Ao documento ser excluído no outro contexto, impedir upsert/recriação; oferecer preservar draft fora do documento, criar novo explícito ou download.

### Parser, source maps e diagnóstico

- **REQ-005-014 — Parser integration:** Enviar snapshots imutáveis rotulados com `draftSeq`/hash ao F-004; diagnósticos retornados fora de ordem não sobrescrevem o estado mais recente.
- **REQ-005-015 — Invalid content:** YAML inválido ou Markdown incompleto não bloqueiam input, autosave ou backup raw; marcar preview/semântica inválidos ou desatualizados sem apagar último bom.
- **REQ-005-016 — Diagnostics:** Exibir issues de parser com severidade, mensagem, range válido e localização; issue sem span não habilita navegação falsa.
- **REQ-005-017 — Source maps:** Converter source ranges do F-004 a posições do editor com semântica de offset formalizada, inclusive emoji, CRLF, tabs, linhas grandes e documento vazio.
- **REQ-005-018 — Issue navigation:** Localizar issue/outline/elemento visual retorna ao source e seleciona a origem somente quando sourceHash/seq coincide; se stale, recalcular ou explicar.

### Busca, substituição e histórico

- **REQ-005-019 — Find:** Busca no documento raw com próximo/anterior, count, resultado zero, case sensitivity e navegação de foco; escopo é buffer atual, não biblioteca F-003.
- **REQ-005-020 — Replace:** Substituir um/todos preserva histórico undo como transação reversível, seleção/foco e exige confirmação contextual para replace-all muito amplo.
- **REQ-005-021 — Undo redo:** Histórico de Source inclui operações de texto apenas, suporta composição/colar/substituir sem quebrar grupos, respeita rotas e não inclui theme/global undo.
- **REQ-005-022 — Clipboard:** Copiar source inteiro/seleção produz `text/plain` idêntico ao raw; colar texto não executa HTML e não adiciona formatação proprietária.

### Experiência e plataforma

- **REQ-005-023 — Keyboard and focus:** Navegação keyboard-only, rótulos, foco visível, região editor, menu de atalhos, prevenção de conflitos do navegador/sistema e restore focus de drawers/dialogs.
- **REQ-005-024 — Responsive workspace:** Desktop-first com editor prioritário, outline e diagnostics colapsáveis, drawers no mobile, sem sobrepor caret/teclado ou esconder feedback de falha.
- **REQ-005-025 — Settings scoped:** Preferências de visualização (wrap, line numbers, tamanho do editor) não modificam Markdown nem tokens do PDF; scoped de forma explícita.
- **REQ-005-026 — Offline and safety:** Toda edição/validação/salvamento funciona com rede bloqueada; texto do usuário não executa HTML/script nem é enviado a terceiros.
- **REQ-005-027 — Performance:** Digitação, seleção, IME e undo permanecem responsivos com fixture grande; parse/render pesado é cancelável/descartável, sem bloquear input.
- **REQ-005-028 — External navigation:** Ao sair do workspace/trocar doc/fechar host com dirty ou erro, sinalizar risco; `beforeunload` é esforço adicional, nunca única proteção.

### Integração, estados e recuperação

- **REQ-005-029 — Snapshot consistency:** Design/ATS recebem fonte da mesma revisão de draft que UI apresenta, e labels mostram dirty/stale; PDF final exige snapshot persistido e verificado pelo F-009.
- **REQ-005-030 — Empty and no diagnostics:** Documento vazio permite escrever imediatamente; outline vazio e nenhum resultado de busca/issue têm estados distintos sem canvas quebrado.
- **REQ-005-031 — Source download:** Disponibilizar `Baixar Markdown` do draft atual mesmo em erro (sem exigir salvar); arquivo conserva texto exato e extensão `.md`.
- **REQ-005-032 — Error boundaries:** Falhas de parser, editor extension, render ou read não causam perda de draft; proporcionar fallback Source e recuperação local.
- **REQ-005-033 — Observability:** Logs locais não contêm currículo, clipboard, seleções nem PII; erros e estados têm IDs verificáveis e suporte offline.
- **REQ-005-034 — Source session lifecycle:** Descartar buffer só após confirmação de navegação/descarte, ou após commit seguro quando sair; nova abertura reconcilia revision e não presume histórico de undo durável.

## 6. Cenários BDD e critérios observáveis

A lista a seguir define comportamento verificável, **não** testes já executados. Mapeamentos detalhados em [`test-matrix.md`](test-matrix.md).

| Cenário | Requisitos | Dado / Quando | Então (oráculo) |
|---|---|---|---|
| SC-005-01 | REQ-005-001, REQ-005-002, REQ-005-022 | fixture bytes: fenced code, YAML, emoji, CRLF, tabs | abrir/copiar/salvar preserva conteúdo exato e text/plain |
| SC-005-02 | REQ-005-001, REQ-005-003 | texto Unicode, colar multiline, seleção | caret/seleção íntegros; nenhum autoformat implícito |
| SC-005-03 | REQ-005-004 | abrir /resume/valid/source | loading seguido de ready com id e revision corretos |
| SC-005-04 | REQ-005-004 | ID inexistente / URL inválida | not-found e nenhum upsert |
| SC-005-05 | REQ-005-004, REQ-005-032 | registro corrompido / DB indisponível | erro diferenciado com saída segura, sem wipe |
| SC-005-06 | REQ-005-005, REQ-005-034 | edita; troca Source→Design→ATS→Source | draft, seleção, scroll e histórico preservados |
| SC-005-07 | REQ-005-006, REQ-005-007, REQ-005-008 | digitação durante save lento | salvo apenas quando draft mais recente confirma commit |
| SC-005-08 | REQ-005-007 | 3 alterações rápidas com latência variável | máximo 1 write in flight e último draft persistido |
| SC-005-09 | REQ-005-007, REQ-005-009 | Ctrl+S com debounce pendente | flush imediato; status apenas após commit |
| SC-005-10 | REQ-005-009 | Ctrl+S sem alterações | nenhuma revisão extra nem regravação |
| SC-005-11 | REQ-005-006, REQ-005-008 | write promise pendente | status salvando, jamais salvo |
| SC-005-12 | REQ-005-010, REQ-005-031 | falha QUOTA_EXCEEDED | banner persistente + retry + .md idêntico ao draft |
| SC-005-13 | REQ-005-010, REQ-005-032 | STORAGE_UNAVAILABLE após digitar | buffer acessível com recuperação; DB original intacto |
| SC-005-14 | REQ-005-011 | duas abas salva em mesmo revision | REVISION_CONFLICT; revisão remota intacta |
| SC-005-15 | REQ-005-011, REQ-005-012 | conflito enquanto sujo | comparar e opções explícitas; sem merge silencioso |
| SC-005-16 | REQ-005-012 | aba remota renomeia sem mudar markdown | aviso/revalidação; sem descartar draft |
| SC-005-17 | REQ-005-013 | aba remota deleta durante save | NOT_FOUND; não ressuscita ID; salvar como novo explícito |
| SC-005-18 | REQ-005-014 | parse(seq 2) chega após parse(seq 3) | resultado 2 descartado; diagnóstico da seq 3 |
| SC-005-19 | REQ-005-015 | YAML inválido | edita e salva raw; preview stale rotulado |
| SC-005-20 | REQ-005-016 | issue severity+range válido | listagem localiza seletivamente, aria label legível |
| SC-005-21 | REQ-005-017 | emoji e CRLF com tabs | ranges em UTF-16 convertidos sem deslocamento |
| SC-005-22 | REQ-005-018 | issue de hash antigo | não navega para range incorreto; revalida |
| SC-005-23 | REQ-005-018 | clicar issue atual com sourceSpan | Source focado e range selecionado sem alteração |
| SC-005-24 | REQ-005-019 | busca acento/case/0 ocorrências | contador, next/prev, no-results sem perder seleção |
| SC-005-25 | REQ-005-020, REQ-005-021 | Replace all em 20 matches | 1 transação undo restaura source integral |
| SC-005-26 | REQ-005-020 | Replace all muito amplo | escopo informado, confirmação antes de mutação |
| SC-005-27 | REQ-005-021 | Ctrl+Z em editor após paste/IME | undo source respeita transações, sem undo theme |
| SC-005-28 | REQ-005-022, REQ-005-026 | paste HTML com script | tratado como texto; nada executa; zero rede |
| SC-005-29 | REQ-005-023 | keyboard-only dialogs/navigation | foco consistente, atalhos não capturam browser zoom |
| SC-005-30 | REQ-005-024 | 320,390,768,1024,1440 CSS pixels | editor útil, status presente, nenhum overlay no caret |
| SC-005-31 | REQ-005-025 | toggle wrap/line numbers/editor zoom | Markdown hash imutável; PDF não afetado |
| SC-005-32 | REQ-005-026 | network=offline após instalação | carregar/editar/salvar/achar e alternar modo sem request remoto |
| SC-005-33 | REQ-005-027 | fixture 1MB/10k linhas, IME e typing | tempo input dentro do budget calibrado; benchmark report |
| SC-005-34 | REQ-005-028, REQ-005-034 | navegar Home com dirty+falha save | aviso e opções seguras; cancel preserva |
| SC-005-35 | REQ-005-028 | fechar janela/refresh com dirty | best effort guard e download disponível |
| SC-005-36 | REQ-005-029 | Preview solicitado enquanto save falha | preview com rótulo não salvo; export não marca versão atual |
| SC-005-37 | REQ-005-030 | source vazio, outline vazio | editor ativo; placeholders sem falsos problemas |
| SC-005-38 | REQ-005-030 | busca sem match vs diagnostics saudáveis | estados distintos; sem toast spam |
| SC-005-39 | REQ-005-031 | download draft com newline CRLF | arquivo .md conteúdo literal, sem HTML |
| SC-005-40 | REQ-005-032 | parser crashes, renderer fails | editor permanece; fallback e stale explícitos |
| SC-005-41 | REQ-005-033 | erro de persistência com dados sensíveis | logs sem markdown/PII |
| SC-005-42 | REQ-005-034 | navega de volta e reabre depois de commit | revisão correta, undo durável não prometido |
| SC-005-43 | REQ-005-006, REQ-005-007, REQ-005-011 | comando rename concorre com autosave | CAS e dados íntegros; conflito ou sequenciamento seguro |
| SC-005-44 | REQ-005-003, REQ-005-023, REQ-005-027 | IME pt/jp longa composição e navegação tabs | não grava parcial inadvertido nem perde composição |
| SC-005-45 | REQ-005-015, REQ-005-029 | parser válido seq 5, inválido seq 6 | último preview válido rotulado como desatualizado |
| SC-005-46 | REQ-005-004, REQ-005-028, REQ-005-032 | migration failure com draft anterior | diagnóstico persistente + saída de emergência sem wipe |

## 7. Máquina de estados e eventos

Ver [`state-machine.md`](state-machine.md). Estados ortogonais: `loadState`, `saveState`, `parseState`, `workspaceMode`, `diagnosticState`, `findState`, `overlayState`. Um único enum gigante gera combinações impossíveis e não deve ser usado. `saved` e `dirty` são derivados do estado/commit, não flags arbitrárias.

## 8. Contratos

- [`contracts/editor-workspace.ts`](contracts/editor-workspace.ts): sessão, portas, snapshots imutáveis, comandos, outcomes, source offsets e estados.
- [`contracts/editor-workspace.schema.json`](contracts/editor-workspace.schema.json): validação de mensagens de fronteira (save snapshots + navegação); contratos TS não validam dados runtime automaticamente.
- [`fixtures/`](fixtures/): Markdown sintético que testa CRLF, Unicode, YAML inválido, situações de conflito e endereços de origem.

## 9. QA / rollout

- Critérios: [`test-matrix.md`](test-matrix.md), incluindo riscos e evidências obrigatórias.
- Estados e interações: [`ux-flows.md`](ux-flows.md), [`state-machine.md`](state-machine.md) e [`recovery-and-conflicts.md`](recovery-and-conflicts.md).
- Riscos/candidatas: [`open-decisions.md`](open-decisions.md).
- `plan.md`, `tasks.md`, código de editor, pacote npm e evidências de testes reais **ainda não existem**. Gerá-los somente após o review das decisões bloqueantes.