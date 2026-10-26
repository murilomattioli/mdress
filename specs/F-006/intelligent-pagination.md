# F-006P — Intelligent Pagination & Source-Linked Breaks

**Status:** design contract, with Phase-0 print CSS only. Shared PagePlan, policy inspector, and source gutter are NOT yet implemented.

## Contract

Markdown -> semantic AST with stable block IDs and source maps -> measured blocks with actual font metrics + theme + page size -> deterministic PagePlan -> page preview, editor gutter, PDF exporter.

**Never insert page markers into the Markdown automatically.** Forced breaks and keep policies live in document presentation metadata, tied to stable semantic block anchors, rather than brittle line numbers. A page gutter must come from PagePlan; raw line estimation is not trustworthy under font, page or theme changes.

## Semantic rules

| Block | Default policy |
|---|---|
| Heading | Keep with first following content when feasible |
| Experience entry header / dates | Keep group together when feasible |
| Short paragraph or list item | Prefer to avoid split |
| Paragraph | Min 2 lines before and after break |
| Table | Prefer break between rows and repeat header |
| Code block | Short blocks stay together; long code splits at line boundaries |
| Section smaller than a page | Prefer keep together without excessive whitespace |
| Large section | Split children; do not enter infinite loops |
| Explicit page-before | Force next physical page; warn when visually wasteful |

Override enum: auto, avoid-inside, keep-with-next, page-before, allow-split. Block policies are saved separately from source Markdown; invalid or orphaned anchors must be diagnosed, not silently applied to another node.

## Precedence when constraints collide

1. Preserve all content, accessible text and source order; no clipping.
2. Honor physical page and layout geometry.
3. Honor explicit forced breaks as possible.
4. Keep heading + first content, then prevent widows/orphans where feasible.
5. Prefer natural block boundaries and avoid needless whitespace.
6. Degrade constraints on elements taller than a page, and explain why.

## Proposed editor UX

- 'Mostrar limites de página' toggle in source editor, disabled until reliable PagePlan.
- Noneditable gutter marks at source ranges: start/end of page N; markers react to theme, paper, font and pagination overrides.
- Select block in editor or preview to reveal inspector control: Auto / Manter inteiro / Manter com próximo / Começar nova página / Permitir divisão.
- Temporary stale indicator while layout is recomputing; discard old revision computations, never display a guessed marker as current.
- Undo and redo apply to pagination policies, with no Markdown bytes changed.
- Editor wraps text differently than the PDF, so gutter anchors to sourceMap semantic boundaries, not editor visual lines.

## Multi-tenant, multi-document scalability

- Typed stateless layout engine independent of tenant and document type.
- Cache key: content revision, semantic version, theme revision, fonts and font metrics, page format, margin, layout engine version and export profile.
- Use worker, cancellation tokens and incremental reflow from first affected block/page.
- Virtualize long previews, keep full PagePlan and source mappings for export.
- Bound input complexity and provide non-destructive recovery for huge tables/images/code and unsupported fonts.
- Avoid customer-specific heuristics and avoid independent pagination algorithms in preview and PDF.

## Acceptance tests

- PAG-001 Heading and initial paragraph remain together near end-of-page when physically possible.
- PAG-002 Keep short section together and move it to next page if necessary.
- PAG-003 Oversized keep-together degrades without clipping or loop.
- PAG-004 Forced page-before and page change follow physical format.
- PAG-005 Paragraph >=4 lines has 2/2 widow/orphan minimization where feasible.
- PAG-006 Long code/list/table fragments without losing source order.
- PAG-007 Theme, font, margin, A4/Letter changes invalidate prior PagePlan.
- PAG-008 Editor gutter, preview and PDF share exact page boundaries.
- PAG-009 Overrides persist and undo/redo without mutating Markdown.
- PAG-010 Export profiles retain semantic document content.
- PAG-011 200-page documents support cancellation, virtualization and incremental reflow.
- PAG-012 Verify actual PDF extraction and page text grouping in CI.

## Delivery order

P0: CSS fragmentation safeguards and Chromium PDF smoke.
P1: Stable AST block IDs/source maps and policy registry.
P2: Font measurement and deterministic PagePlan generation.
P3: Break gutter + contextual inspector + manual override.
P4: PagePlan-driven final export with PDF/page text parity tests.

Related: F-004, F-006, F-007, F-009, UX-001.
