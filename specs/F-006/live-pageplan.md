# F-006 — Live PagePlan v1 and physical page preview

**Implemented (first iteration)**: browser-measured multi-page preview, physical A4/Letter page stack, page navigation, selectable Markdown text, PDF output from the same DOM pages, testable diagnostics.

**Not complete**: stable AST source maps, per-block keep/new-page inspector, cross-browser measurement, visual regression, orphan-policy registry, PDF tag structure audit.

## Design decisions

1. Source Markdown remains unchanged. Each edit renders semantic HTML blocks, then the paginator measures layout within the selected physical page geometry.
2. No fake editor break markers. This v1 paginates the **document preview**, not the Markdown gutter; block line/source metadata is not yet available. A later compiler must supply stable source maps.
3. The same DOM page nodes are used for preview and print. Print does not trigger an independent browser-only flow from one infinitely tall sheet.
4. Heading + first paragraph and short semantic sections are grouped, when the measured height permits.
5. A too-large section degrades to child-level layout; large lists break between items; very long paragraphs/code may break at whitespace while preserving their inline DOM structure.
6. Every page has an overflow diagnostic flag; if a fragment cannot fit safely it must be visibly identified rather than invisibly clipped.
7. Paginator requests are debounced, invalidated on new edits, and recalculated immediately before printing.
8. Page navigation and zoom affect only presentation, not Markdown text or PDF geometric size.
9. The App UI theme has no influence on page rendering. Per-document background/color/typography remain identical across pages.
10. Export paper A4/Letter is resolved independently from the saved document setting and pages must reflow for that choice.

## Measured test evidence

Chromium/Linux CI (2026-10-23): Unit test geometry; E2E creates at least three real preview sheets and asserts that every page-content has scrollHeight <= clientHeight+2, retains final content, navigates and survives paper format change. Independent PDF verifier uses Poppler text extraction and pdfinfo; PDF page counts equal the preview sheet count for all test fixtures; heading and first paragraph stay on one physical PDF page. Long Letter fixture generated 6 pages, approx. 97 KiB with source markers present.

## Caveats

- This is a **browser-specific DOM-measurement engine**, not a deterministic cross-renderer layout engine. Preview vs PDF parity is tested only in Chromium here.
- Inline text splitting by whitespace is best-effort and may leave widow/orphan cases in unusual paragraphs, especially with nested formatting.
- Max 120 pages and fragment guard; pathological cases expose diagnostics. Not yet virtualized or worker-backed.
- Page labels are editor-only; hidden from printed PDF.
- Selection-to-source and manual page break override require the F-004 AST/compiler and stable SourceMap layer.
- Accessibility audit and tests with non-Latin/CJK/RTL/complex fonts remain open.

## Next implementation

- F-004 sourceMap and stable block IDs
- F-006 pagination policy overrides per block + noneditable source gutter markers
- Font-face observation and async recalculation, long docs virtualization and cancellation
- UX-001 (#4): inspector, pages navigator and property fields redesigned together
- Browser matrix and actual print/PDF visual regression
