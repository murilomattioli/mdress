# Studio v3 — Workspace e Design System (redesign estrutural)

**Status:** implementado na branch de redesign; merge condicionado a testes E2E, PDF e responsividade. Não é implementação em React ou uso de um pacote externo; primitivas são componentes web locais + contratos de CSS. Migração completa de estilos legados ainda é trabalho posterior.

## Problema

A interface antiga consistia em grandes painéis estáticos, formulários densos sem hierarquia, controle de zoom limitado e canvas comprimido. A separação entre design da aplicação e do documento era conceitualmente correta, mas não estava representada por uma ferramenta visual profissional.

## Decisões de arquitetura

- **Chrome do aplicativo ≠ tema do documento:** todas as cores/fundamentos da UI usam `--ds-*` e `--panel, --accent` apenas como aliases de migração; o PDF continua com `--resume-*`. Mudança de aparência do app não muda o PDF.
- **Design tokens semânticos:** fundações de spacing, raio, densidade, tipografia, cores, elevação, duração e estados. Temas de app Graphite, OLED, Sand e Neon alteram tokens, não estruturas.
- **Componentes independentes:** `ds-icon` com SVG offline seguro, `ds-splitter` redimensionável e acessível, além de classes reutilizáveis `ds-button`, `ds-segmented`, `ds-badge`, `ds-status`, `ds-rail`, `property-row`.
- **Desktop-first com fallback para viewport estreito:** rail, source editor e canvas físico, com inspector contextual acoplável e foco mobile por alternância em rail. A interface não deve esmagar a página entre painéis fixos.
- **Sem rede e sem dependências externas:** código, ícones, fontes de fallback e backgrounds são locais; IndexedDB e Markdown permanecem como antes.

## Marca no shell

O componente Brand usa a [logo vetorial oficial](../../app/assets/brand/mdress.svg), com wordmark e nome acessível já presentes no shell. O ícone dimensional é reservado às superfícies de instalação/app; o editor mantém sua aparência independente. Referências e regras atuais: [BRAND-001](../BRAND-001/identity-and-app-icons.md).

## Estrutura de componentes

```text
AppShell
├─ CommandBar
│  ├─ Brand
│  ├─ DocumentPicker + DocumentMenu
│  ├─ WorkspaceModeSwitch
│  ├─ SaveStatus / Settings
│  └─ ExportPDFAction
└─ Workbench (grid)
   ├─ NavigationRail
   ├─ SourcePanel
   │  ├─ SourceCommandBar
   │  ├─ MarkdownToolbar
   │  ├─ SourceGutter + MarkdownTextarea
   │  └─ DocumentOutline
   ├─ DSSplitter
   └─ CanvasPanel
      ├─ CanvasToolbar (paper, zoom, fit, inspector toggle)
      └─ CanvasStage (physical A4/Letter pages)
         ├─ PaginationState / PagePlan
         ├─ PageStack
         ├─ PageNavigation
         ├─ DSSplitter
         └─ PropertyInspector
            ├─ Style
            ├─ Page
            ├─ Background (Mesh)
            └─ AI
```

## Comportamentos

- Document menu: mais ações em um popover, teclado Escape fecha, clique fora fecha. CRUD mantém o mesmo contrato.
- Outline: títulos H1–H4 derivados do Markdown; clique seleciona texto na fonte e tenta localizar o heading no canvas. Ainda não substitui source maps semânticos.
- Gutter: numeração de linhas sincronizada com scroll; não desenha marcas de quebra de página não confiáveis.
- Zoom: aumentar, diminuir, enquadrar; altera canvas visual apenas, não dimensões da exportação. Persistência local.
- Splitters: editor e inspector controláveis por ponteiro e teclado, limites min/max, posição salva localmente. Desativar movimentos em viewports estreitos onde inspector passa a overlay.
- State: formulário de tema/IA/Mesh/ATS mantém IDs e listeners. A renderização paginada permanece separada do editor fonte.
- Responsive: desktop amplo mostra rails/painéis; médio prioriza canvas/inspector overlay; estreito tem ação de canvas na rail.

## Erro de paginação reportado: seções longas deslocadas

**Causa observada:** o PagePlan v1 tratava `.semantic-section` como um grande bloco. Se não coubesse no restante da página, tentava movê-lo inteiro para nova página antes de dividi-lo. Isso gerava espaços em branco e seções aparentemente empurradas.

**Correção:** o paginator decompõe o contêiner semântico da seção imediatamente e posiciona cada bloco de conteúdo em sequência. Somente o `section-lead` (título + início) tem comportamento keep-with-next. Listas longas são divididas por item na página atual antes de avançar para a próxima, aproveitando a área restante. Isso preserva a ordem textual e não modifica Markdown.

**Fora do escopo desta correção:** regras editáveis por bloco, gutter com source maps, medição cross-browser, widow/orphan por linha semântica em fontes complexas, virtualização de PDFs enormes.

## Evidência de QA exigida para merge

- Chromium 1600px, 1366px e 390px: toolbar não sobrepõe ações essenciais, canvas acessível em mobile.
- Testes de uso real: edição Markdown, salvar, tema, Mesh, PDF, offline, seleção e outline.
- Splitters teclado/pointer, comandos do menu e zoom fit/zoom in, manter componentes com foco visível.
- PDF: contagem de páginas prévia = arquivo real, extração de texto original, não rasterizar textos.
- Fluxo específico: seção Experiência Profissional longa termina e Formação Acadêmica segue sem páginas vazias; todos os itens 01–31 aparecem.
- Sem alterações ao Markdown ao alterar design do aplicativo ou propriedades do documento.

## Etapas posteriores

1. Unificar CSS legado em módulos por componente (eliminar overrides históricos dos estilos v1/v2).
2. Componentes de propriedade completos: NumericField com scrub + unidade, ColorField, Select, SectionAccordion, Empty/Loading/ErrorState.
3. Auditoria por screenshot e comparação de 3 direções visuais; Figma Design System integrado quando necessário.
4. Mapa AST com source maps reais e políticas editáveis de quebra.
5. Testar leitura de tela, 200% zoom, internacionalização, texto RTL/CJK e documentos com centenas de páginas.
