# F-004 — Markdown Parser e Semantic Compiler (spec funcional)

**Versão:** 0.5.0 · 2026-10-22  
**Status:** PROPOSED / REVIEW REQUIRED / NOT IMPLEMENTED  
**Dependências:** F-001 (infra e limites), integra F-005 (sessão), F-006 (documento visual), F-008 (ATS), F-009 (PDF), F-010 (importação/exportação).  
**Escopo:** Parser CommonMark/GFM → AST posicionado → projeção semântica com proveniência → diagnósticos localizados.  
**Fora do escopo:** edição do source; inferência via IA; tradução; verificação de currículo por vaga; renderizador/PDF; uso da web.

## 1. Problema e princípio invariável

O usuário escreve Markdown livre e portátil. O compilador interpreta sua intenção **sem alterar nem substituir o texto**. AST e SemanticResume são *views* derivadas: nunca há 'auto-conserto' de MD, reserialização geral, autocompletar fatos ou fallback que esconda blocos. Se o texto é desconhecido, deve permanecer acessível como bloco custom/unclassified; se a interpretação é incerta, devemos nos abster e explicar.

- **LOCKED:** `markdown` de ResumeDocument é a única fonte de conteúdo; não há CRUD semântico independente.
- **LOCKED:** source inválido continua editável/salvável e pode ser exportado como `.md`; PDF `ready` depende de preflight próprio.
- **LOCKED:** preview/diagnósticos gerados de source antigo nunca são anunciados como atuais.
- **PROPOSED:** UTF-16 half-open, regras de reconhecimento de seções, léxico limitado, `success/partial/invalid/failed/cancelled`, prioridade de campos de frontmatter.
- **SPIKE:** engine concreta mdast, budget de processamento, estabilidade de positions e worker behavior.

## 2. Pipeline e contratos

```text
raw Markdown string [imutável] + provenance (docId, draftSeq, sourceHash)
        ├─ reconhecer BOM/delimitadores de frontmatter
        ├─ YAML parse seguro, sem aliases/tags/exec → metadata tipada + issues
        ├─ Markdown parser CommonMark/GFM → block/inline AST posicionado
        ├─ árvores de seção + classifier configurado por locale
        ├─ compilador de records tipados + SemanticResume
        ├─ source map de nós e campos + coverage check
        └─ CompilerOutput (status, normalized records, issues, provenance, policyVersion)
             ↙ F-005 F-006 F-008 F-009 F-010 ↘
```

Contratos verificáveis em [contracts/parser-semantic.ts](contracts/parser-semantic.ts), [contracts/parser-result.schema.json](contracts/parser-result.schema.json) e [integration.md](integration.md). O resultado **não** contém uma nova versão serializada do Markdown. A UI não pode persistir `semantic` como source.

## 3. Requisitos funcionais e não funcionais

- **REQ-004-001** — **Fidelidade do Markdown bruto.** Nenhuma etapa de parsing/compilação reescreve o source; LF, CRLF, tabs, espaços, BOM, emoji, escapes e Markdown desconhecido são preservados integralmente.
- **REQ-004-002** — **Frontmatter delimitado.** Reconhecer YAML somente no início (permitindo BOM inicial), dentro de delimitadores de linha completos `---`; `---` no corpo não é YAML.
- **REQ-004-003** — **YAML restrito.** Decodificar apenas mapa simples de metadados com strings/listas de strings/links; rejeitar tags customizadas, aliases/anchors, merges, múltiplos documentos e chaves duplicadas; sem execução ou protótipos injetados.
- **REQ-004-004** — **Metadados tipados.** Validar name/headline/email/phone/location/website/links/locale; campos desconhecidos permanecem raw sem serem atribuídos à entidade; erro de campo não invalida os demais campos seguros.
- **REQ-004-005** — **YAML inválido recuperável.** Frontmatter malformado emite erro com trecho apontável; source intacto; body permitido como projeção parcial, marcado inválido; não confiar em campos YAML inválidos.
- **REQ-004-006** — **Sintaxe Markdown portátil.** Suportar CommonMark e subset explícito de GFM (listas, links, tabelas, ênfase, strike/autolinks) sem tornar extensões proprietárias obrigatórias.
- **REQ-004-007** — **HTML e URLs não executáveis.** HTML bruto é tratado como dado textual, nunca executado; bloquear links javascript:, data: e file: na apresentação clicável. URL em source permanece intacta.
- **REQ-004-008** — **Classificação de seções.** Reconhecer aliases configurados pt-BR/en-US (incluindo variações comuns) com normalização apenas para comparação, sem traduzir nem reordenar texto.
- **REQ-004-009** — **Seções desconhecidas.** Preservar headings não reconhecidos e respectivos blocos como customSections na ordem em que aparecem, inclusive texto/code/tabelas.
- **REQ-004-010** — **Hierarquia de headings.** Delimitar seções por níveis reais H1–H6, respeitar headings internos e impedir que subseção seja confundida com seção irmã.
- **REQ-004-011** — **Identidade sem invenções.** Identificar nome/headline apenas por marcadores explícitos e heurísticas comprováveis; não inferir informações pessoais a partir de email, URI ou título genérico.
- **REQ-004-012** — **Contatos sem perda.** Ler contatos e links do frontmatter/corpo com proveniência individual; rejeitar esquema inseguro para clique, não remover link raw nem seguir URLs.
- **REQ-004-013** — **Resumo profissional.** Reconhecer seção de resumo/sobre/perfil e preservar parágrafos e rich-text com ordem intacta.
- **REQ-004-014** — **Experiência profissional.** Associar cargo, empresa, local, datas e bullets somente quando sustentados por evidência explícita; manter campos desconhecidos ausentes.
- **REQ-004-015** — **Formação.** Associar instituição, curso, período e descrição sem alucinar grau/local ou confundir com experiências.
- **REQ-004-016** — **Competências.** Reconhecer listas/bullets/linhas separadas com grupos opcionais; preservar categorias e ordem; não gerar habilidades a partir de conhecimento de produto.
- **REQ-004-017** — **Projetos.** Extrair título, cargo, URL e descrição quando explícitos; sem abrir links, sem assumir status profissional.
- **REQ-004-018** — **Idiomas.** Reconhecer idiomas e níveis apenas quando declarados; não presumir proficiência a partir do idioma do documento.
- **REQ-004-019** — **Datas e temporalidade.** Conservar a expressão literal e oferecer normalização opcional somente se determinística; ranges abertos/"Atual" com locale explícito; ambiguidade vira issue, não data fabricada.
- **REQ-004-020** — **Política de abstenção.** Ambiguidade de segmentação ou campo vira `unknown`/`candidate` com issue e evidência; não trocar empresa/cargo baseado em padrões frágeis.
- **REQ-004-021** — **Source offsets UTF-16.** Spans são intervalos half-open [start,end) em unidades UTF-16 da string JS, line/column 1-based com coluna UTF-16; CRLF é dois code units e LF um.
- **REQ-004-022** — **Source map navegável.** Cada nó derivado possui origem de bloco; campo extraído tem range próprio quando identificável; caso impreciso expor `block` e não selecionar caracteres falsos.
- **REQ-004-023** — **Ordem e IDs determinísticos.** ReadingOrder reflete a ordem lógica do source, IDs são determinísticos para mesmo source/config/versão; não prometer estabilidade de IDs entre revisões.
- **REQ-004-024** — **Issues estruturados.** Diagnósticos possuem ruleId, severity, issue id estável por snapshot, range, explicação, remediation e provenance quando publicados no workspace.
- **REQ-004-025** — **Recuperação parcial.** Erro de nó/bloco não derruba parsing de conteúdo independente; fatal reserva-se a crash/limites ou indisponibilidade do compilador; preview sinaliza stale/invalid.
- **REQ-004-026** — **Locale controlado.** Resolver locale: opção explícita do usuário > frontmatter válido > preferência app > pt-BR default; não inferir automaticamente de palavras isoladas.
- **REQ-004-027** — **Pureza e determinismo.** Mesma string/config/versão gera mesma projeção e diagnósticos (salvo metadados de execução externos); não utilizar rede, tempo, aleatoriedade ou IA.
- **REQ-004-028** — **Cancelamento e concorrência.** Compilação abortável; outputs com `documentId`,`draftSeq`,`sourceHash`,`compilerVersion`; resultados obsoletos não entram no workspace (F-005).
- **REQ-004-029** — **Limites de recursos.** Aplicar limites de bytes/nesting/tokens/tempo definidos por spike com error recoverable e source intacto; worker isolável e não bloquear digitação.
- **REQ-004-030** — **Cache derivado seguro.** Cache derivado invalidado por sourceHash + policyVersion + compilerVersion + locale; não persistir conteúdo sensível sem necessidade; nunca usar cache de outro documento.
- **REQ-004-031** — **Contrato com consumidores.** F-005, F-006, F-008, F-009 e F-010 consomem uma projeção versionada com estados explícitos, não o AST mutável do parser.
- **REQ-004-032** — **Cobertura de origem.** Cada bloco raw semanticamente relevante pertence a pelo menos um nó mapeado ou fallback custom/unclassified, com relatório de cobertura; sem sumir conteúdo silenciosamente.
- **REQ-004-033** — **Semântica e segurança separadas.** Validade estrutural do source não implica confiança de clique/render/ATS; validação de URLs/HTML pertence também às fronteiras consumidoras.
- **REQ-004-034** — **Conflitos entre candidatos.** Quando frontmatter e corpo discordarem, não sobrescrever valores silently: campo explícito de frontmatter possui prioridade proposta com issue de divergência e evidência dupla.
- **REQ-004-035** — **Resultado tipado.** `success | partial | invalid | failed | cancelled` distinguem projeção incompleta, source inválido e falha técnica; nenhum estado apaga texto.
- **REQ-004-036** — **Observabilidade mínima.** Métricas de duração, quantidade de nós/issues e motivo de falha sem armazenar Markdown, emails ou conteúdos brutos em logs.

## 4. Estados e semântica de resultado

| Status compilador | Significado | Pode usar preview? | Pode salvar source? |
|---|---|---|---|
| `success` | parsing e classificação sem issues que limitem completude | sim (com validação visual) | sim |
| `partial` | source válido, algumas estruturas não reconhecidas/ambíguas; conteúdo íntegro | sim, **rotular parcial** | sim |
| `invalid` | frontmatter/estrutura viola contrato e saída parcial pode existir | apenas last-good rotulado stale ou projeção parcial claramente invalid; nunca silenciosa | sim |
| `failed` | exceção técnica capturada ou limite excedido | último preview válido **stale**, se existir | sim |
| `cancelled` | task abortada; saída não publicada | preservar estado anterior | sim |

`no-results`/`not-found` são estados de busca/rota, **não** do parser. `empty` é entrada válida sem seções e produz projeção parcial/sintética sem inventar identidade. `blocked` para PDF é decisão do F-009, nunca do F-004 isoladamente.

## 5. Regras de interpretação

- **Seções:** H1 de nome, H2 de categoria, H3 de entry funcionam como padrão recomendado, mas classificador respeita *níveis relativos* e fixtures alternativas. Headings conhecidos não bastam para afirmar que uma linha seguinte tem cargo ou data.
- **Campos:** preservar `(raw, normalized?, confidence, evidenceSpan, precision)`; não inserir campo `normalized` se input ambíguo. Conteúdo em linha não assume semântica de campo apenas pela posição.
- **Ordem:** `readingOrder` baseia-se no source, não na disposição CSS. Blocos sem classe devem seguir na ordem que ocupam no arquivo.
- **Locale:** classificador textual possui dicionário explícito pt-BR/en-US; configuração do editor vence metadado válido, sem identificar por geolocalização.
- **Frontmatter:** se válido, metadados explícitos podem ter prioridade PROPOSED sobre texto da página; em divergência mostrar dupla proveniência e issue, nunca apagar alternativa.
- **Segurança:** nada no parse executa HTML, JS, CSS, tag YAML, shell, network nem embute recursos externos.

Regras formais e exemplos: [grammar-and-detection.md](grammar-and-detection.md), [source-maps.md](source-maps.md), [security-and-performance.md](security-and-performance.md).

## 6. Responsabilidades e fluxos externos

- **F-005** fornece texto, hash e sequência. F-004 devolve output tagueado; F-005 descarta resultado obsoleto ao comparar documento/seq/hash (mesmo após cancel falho).
- **F-006** só recebe dados semânticos + fallback de blocos, source map e status; nunca monta HTML direto do Markdown bruto. Não deve omitir seções customizadas.
- **F-008** usa diagnóstico estrutural como entrada; regras de ATS específicas são outro módulo e não devem transformar *confidence* de parser em nota mágica.
- **F-009** recebe reading order e informação de campo/coverage; preflight decide se uma exportação é bloqueada, degradada ou permitida.
- **F-010** preserva raw `.md` e encoding declarado: importar/exportar nunca passa por serializer do AST.

## 7. Cenários obrigatórios — rastreabilidade principal

| ID | Dado/disparo | Resultado esperado | Requisitos |
|---|---|---|---|
| SC-004-01 | pt-BR completo | `success`: identity/experience/skills/education; ranges e readingOrder | REQ-004-001, REQ-004-006, REQ-004-008, REQ-004-010, REQ-004-011, REQ-004-014, REQ-004-015, REQ-004-016, REQ-004-023, REQ-004-032 |
| SC-004-02 | en-US completo | `success`: aliases e fechas como declaradas; não traduz source | REQ-004-008, REQ-004-013, REQ-004-014, REQ-004-017, REQ-004-018, REQ-004-026 |
| SC-004-03 | Seção desconhecida | `success`: customSections capturam subseções, fence e tabela | REQ-004-009, REQ-004-010, REQ-004-032 |
| SC-004-04 | YAML malformed | `invalid`: issue no frontmatter; body parse parcial e source intacto | REQ-004-002, REQ-004-005, REQ-004-025, REQ-004-035 |
| SC-004-05 | YAML inseguro | `invalid`: tags/aliases/merge rejeitados; nenhum objeto materializado perigoso | REQ-004-003, REQ-004-033 |
| SC-004-06 | YAML com duplicidade | `invalid`: campo duplicado não é resolvido silenciosamente | REQ-004-003, REQ-004-004, REQ-004-024 |
| SC-004-07 | Delimitador horizontal | `success`: --- em meio ao corpo é thematicBreak, não YAML | REQ-004-002, REQ-004-006 |
| SC-004-08 | CRLF e emoji | `success`: spans UTF-16 half-open em source original | REQ-004-001, REQ-004-021, REQ-004-022 |
| SC-004-09 | Espaços e tabs | `success`: bytes de whitespace preservados em source export | REQ-004-001, REQ-004-021 |
| SC-004-10 | HTML bruto e JS link | `partial`: HTML visível como texto; schemes desabilitados | REQ-004-007, REQ-004-033 |
| SC-004-11 | Falta nome | `partial`: identity null; issue; zero nome fabricado | REQ-004-011, REQ-004-020, REQ-004-024 |
| SC-004-12 | Cargo/empresa ambíguos | `partial`: candidate + explicit unknown; valores não invertidos arbitrariamente | REQ-004-014, REQ-004-020, REQ-004-024 |
| SC-004-13 | Datas ambíguas | `partial`: datas raw; sem ISO fabricada | REQ-004-019, REQ-004-020 |
| SC-004-14 | Idiomas não declarados | `success`: sem proficiência inventada | REQ-004-018, REQ-004-020 |
| SC-004-15 | Links seguros | `success`: https/mailto safe; sem request externo | REQ-004-012, REQ-004-033 |
| SC-004-16 | Sections repetidas | `success`: ambas aparecem na ordem, com nós distintos | REQ-004-010, REQ-004-023, REQ-004-032 |
| SC-004-17 | Headings profundos | `success`: filiação H1/H2/H3 correta | REQ-004-010, REQ-004-022, REQ-004-032 |
| SC-004-18 | Sem headings | `partial`: texto não some; unknown/unclassified | REQ-004-009, REQ-004-011, REQ-004-020, REQ-004-032 |
| SC-004-19 | Source vazio | `partial`: empty sem crash; issue informativo só se pertinente | REQ-004-025, REQ-004-035 |
| SC-004-20 | Code fence com keywords | `success`: Experience em código não vira seção | REQ-004-006, REQ-004-008, REQ-004-032 |
| SC-004-21 | Tabela GFM | `success`: células renderizáveis e ranges de bloco | REQ-004-006, REQ-004-009, REQ-004-022 |
| SC-004-22 | Frontmatter BOM | `success`: detecta YAML após BOM sem remover BOM | REQ-004-001, REQ-004-002 |
| SC-004-23 | Locale explícito override | `success`: config explícita vence frontmatter | REQ-004-026, REQ-004-027 |
| SC-004-24 | Mesmo input duas vezes | `success`: IDs/order/issues iguais com mesma config | REQ-004-023, REQ-004-027 |
| SC-004-25 | Prefix edit offsets | `success`: novo hash gera ranges atualizados; IDs antigos não são prometidos | REQ-004-021, REQ-004-023, REQ-004-028 |
| SC-004-26 | Duas versões fora de ordem | `stale-discard`: F-005 descarta seq 3 após seq 4 | REQ-004-024, REQ-004-028, REQ-004-031 |
| SC-004-27 | Abort antes da resposta | `cancelled`: cancel não publica parse antigo | REQ-004-028, REQ-004-035 |
| SC-004-28 | Token budget excedido | `failed`: com `maxTokens=12` injetado no teste: resource-limit issue; editor preserva raw | REQ-004-025, REQ-004-029, REQ-004-035 |
| SC-004-29 | Crash controlado | `failed`: outcome tipado; últimas projeções stale | REQ-004-025, REQ-004-035, REQ-004-036 |
| SC-004-30 | Fail unknown frontmatter type | `invalid`: issue de field, valores válidos mantidos; raw preservado | REQ-004-004, REQ-004-005, REQ-004-024 |
| SC-004-31 | Chave __proto__ | `invalid`: não polui prototype; issue tipado | REQ-004-003, REQ-004-033 |
| SC-004-32 | URL file/data | `partial`: não recebe href clicável; source preservado | REQ-004-007, REQ-004-012 |
| SC-004-33 | Sem rede | `success`: zero fetch/resolução DNS | REQ-004-012, REQ-004-027, REQ-004-033 |
| SC-004-34 | Cache da mesma origem | `success`: hit somente mesmo documentId/hash/locale/policy | REQ-004-027, REQ-004-030 |
| SC-004-35 | Cache cross-doc | `success`: sem vazamento entre documento A e B | REQ-004-030, REQ-004-036 |
| SC-004-36 | Alterar policy version | `success`: miss determinístico; rerun | REQ-004-027, REQ-004-030 |
| SC-004-37 | Fonte duplicada | `partial`: frontmatter vence por política e issue com 2 evidências | REQ-004-011, REQ-004-020, REQ-004-034 |
| SC-004-38 | Bullets mixed nesting | `success`: hierarquia e bullet ranges preservados | REQ-004-014, REQ-004-016, REQ-004-022 |
| SC-004-39 | Sem seção Skills | `partial`: skills vazio; sem inferência | REQ-004-016, REQ-004-020 |
| SC-004-40 | GitHub nested URL | `success`: URL é literal; sem baixar nada | REQ-004-012, REQ-004-017, REQ-004-033 |
| SC-004-41 | Projeção ATS com stale | `invalid`: consumidor não indica current se parse invalid | REQ-004-025, REQ-004-028, REQ-004-031, REQ-004-035 |
| SC-004-42 | Download Markdown | `success`: F-010 recebe raw inalterado | REQ-004-001, REQ-004-031 |
| SC-004-43 | Span exato vs bloco | `success`: fallback explicita precisão block para campos compostos | REQ-004-021, REQ-004-022, REQ-004-024 |
| SC-004-44 | Marcador extra de documento YAML | `invalid`: marcador YAML explicitamente proibido dentro do frontmatter; sem parse silencioso | REQ-004-003, REQ-004-005 |
| SC-004-45 | Bullet com emoji | `success`: offset após surrogate pair coerente com textarea JS | REQ-004-021, REQ-004-022 |
| SC-004-46 | Sem imagem remota | `partial`: imagem URL não carrega/requisita recurso | REQ-004-007, REQ-004-027, REQ-004-033 |
| SC-004-47 | Observabilidade safe | `partial`: logs sem nome, contato, conteúdo | REQ-004-034, REQ-004-036 |
| SC-004-48 | Nenhum campo reconhecido | `partial`: unclassified raw block com coverage; não perde dados | REQ-004-009, REQ-004-025, REQ-004-032, REQ-004-035 |

Consulte [test-matrix.md](test-matrix.md) para níveis, fixtures e evidências. **Nenhum teste de parser real foi executado**; testes do pacote avaliam integridade documental, contratos e fixtures, não o comportamento do código futuro.

## 8. Critérios de aceite (gates)

| Gate | Saída exigida antes da implementação/release |
|---|---|
| F004-G0 Spec Review | resolver decisões bloqueantes e aprovar ordem/precisão/estados |
| F004-G1 Raw Fidelity | round-trip exato Unicode/CRLF/BOM/tab em fonte e download |
| F004-G2 Semantic | fixtures pt-BR/en-US, secções custom/unknown/ambiguidades; nenhuma invenção |
| F004-G3 Source Map | offsets UTF-16 válidos, seleção segura, stale position rejeitado |
| F004-G4 Safe YAML/HTML | alias, tags, keys, URLs e HTML maliciosos sem execução/rede |
| F004-G5 Concurrency | cancel, reordenamento e cache sem vazamento entre docs |
| F004-G6 Recovery | YAML inválido, dados incompletos, crash/limites; raw íntegro |
| F004-G7 Performance | worker e latências medidas sob fixtures 1MiB/10k linhas no hardware referência; thresholds definidos após spike |

## 9. Não objetivos e pendências

Sem edição inline semantic-first, sem detecção de verdade factual, sem checagem automatizada de datas com fontes externas, sem IA/OCR, sem tradução, sem embeddings. Ver [open-decisions.md](open-decisions.md) para itens ainda não aprovados. `plan.md`/`tasks.md` serão gerados somente após revisão das decisões bloqueantes, conforme constituição SDD.