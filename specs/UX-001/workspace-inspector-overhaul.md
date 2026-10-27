# UX-001 — Redesenho profissional do workspace e dos painéis de propriedades

**Status:** planejado. A auditoria visual e o redesenho ainda não foram executados. A implementação deve começar após estabilizar o contrato de exportação PDF F-009.

## Problema observado
A ferramenta acumula formulários e controles sem hierarquia clara: toolbar Markdown dispersa, editor textarea, preview comprimido, inspector de propriedades longo e excessivamente denso, controles numéricos/swatch separados, painéis com scroll independente e pouca conexão entre seleção e propriedades. Embora ofereça recursos técnicos, ainda não entrega a experiência e precisão de um design tool.

## Objetivo do redesenho
Converter o produto de "formulário ao lado do PDF" para um **document design workspace** profissional, com affordances comparáveis a Figma/Framer/Canva, sem copiar interface ou código de terceiros. Regras absolutas: Markdown como fonte do conteúdo; tema e geometry como dados de apresentação; export PDF usando conteúdo textual; app appearance independente do tema do documento.

## Plano por frentes de trabalho

| Frente | Missão | Entrega testável |
|---|---|---|
| UX-Audit | Capturar estado atual e mapear fluxos realistas e pontos de falha | Screenshots anotados e severity/impact de cada problema |
| IA & Flows | Redesenhar arquitetura de informação: Editor, Documento, Design, Exportação | Mapa de rotas, jornada e estados |
| DS Foundations | Definir tokens de densidade, spacing, tipografia, áreas, superfícies e ícones | Spec de componentes reutilizáveis e variantes |
| Workspace | Novo app shell e resize split view; canvas central e painel contextual | Wireframes responsivos + regras de resize e foco |
| Property Inspector | Padrões profissionais de campo numérico com unidade, scrubber, swatch, presets, agrupamentos e resets | Estados e contratos dos controles |
| Background Studio | Painel especial para Mesh: miniatura/canvas, camadas e controles de pontos | Interações mouse, teclado, empty/limits/error |
| QA/A11y | Validar design por cenários e breakpoints reais | Screenshots, testes E2E e relatório de regressões |

## Direção proposta (não aprovada como design final)
1. **Command Bar** superior: documento, salvar/status, undo/redo global, preview/export; ações raras no menu.
2. **Left Rail** com biblioteca de documentos, outline e editor Markdown; não exibir navegação redundante.
3. **Center Stage** privilegiado para página A4/Letter; zoom, fit-width, page navigation e canvas.
4. **Right Inspector** redimensionável (aprox. 296–420 CSS px, com resize e colapso), tabs `Design`, `Página`, `Fundo`, `Exportação` e seções accordion em vez de um formulário infinito.
5. **Property Rows** com label curta, input compacto, sufixo de unidade (pt/mm/%), botão de reset, estado dirty, tooltip e popovers; não usar slider isolado para cada propriedade sem entrada numérica.
6. **Background Gallery** com cards de miniatura, categorias, filtros e ações sobre preset; separação explícita de `Estilo de fundo` e `Editar pontos`.
7. **AI Theme** como ação contextual em `Design`, gerando preview temporário diffável e confirmação explícita.

## Cenários UX mandatórios
- Criar/importar documento e escolher estilo sem entrar em Configurações do site.
- Selecionar texto e aplicar bold/heading/link com feedback claro e undo/redo estável.
- Ajustar tipografia e espaçamento com unidade e preview em tempo real.
- Criar Soft Mesh, mover pontos, ajustar cores, duplicar e salvar preset com poucos cliques.
- Abrir um currículo longo, navegar páginas e exportar Visual/Leitura mantendo conteúdo.
- Abrir inspector em 1366×768 sem esmagar o canvas e sem scroll horizontal indesejado.
- Usar apenas teclado, IME, zoom 200% e leitores de tela.
- Falha no autosave, tema inválido, quota IndexedDB e export cancelado — estados explícitos.

## Critérios de aceite da força-tarefa
- Três propostas visuais contrastantes (utilitarista / editorial / advanced-tool) **antes de escolher direção definitiva**.
- Não implementar um redesenho sem auditoria com screenshots de origem e comparação com nova implementação.
- Testes de usabilidade por tarefas (passos, tempo, erros, discoverability).
- Tokens e componentes documentados com API, estado, foco e disabled.
- Testes Playwright para navegação do editor, propriedades, undo/redo, background e export.
- O redesenho não pode alterar o Markdown original em operações de personalização nem fazer downgrade na legibilidade do PDF.

## Critério técnico para iniciar
F-009 com pipeline automático que gere PDFs, meça bytes/páginas, extraia texto e valide os dois perfis; com limites de confiabilidade explicitados. Até haver Source Maps funcionais, inspector deve controlar o **documento**, não fingir seleção de blocos que ainda não existe.

## Sequenciamento recomendado
UX-01 Baseline/auditoria -> UX-02 Design system/padrões -> UX-03 3 alternativas de workspace -> decisão -> UX-04 protótipo -> UX-05 implementação -> UX-06 visual regression e E2E.
