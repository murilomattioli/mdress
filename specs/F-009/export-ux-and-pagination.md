# F-009A — Export UX: design, background and text legibility are different choices

**Status:** implemented first iteration, with browser/unit smoke. Not a certified ATS checker, not a programmatic PDF engine.

## Product correction

The previous switch "Visual vs Leitura automatizada" implied (incorrectly) that the visual PDF was not parseable. The new export interface is about **presentation choices**, not an ATS pass/fail toggle.

- Quick starts: Design completo (all background layers); Design simplificado (solid page color only); Alto contraste (white page + dark text).
- Independent properties: Fundo = Completo / Sólido / Sem fundo. Texto = cores originais / escuro de alto contraste. Papel = A4 / Letter.
- User can change these individually; when no quick start matches, the UI shows "Personalizado".
- All combinations keep Markdown-rendered **HTML text** as text; PDF output may still fail particular ATS parsers because of semantic layout, extraction order, font or file limits.
- Warnings are specific: choosing original white text and no background can produce white-on-white; choosing dark text with dark background may lack contrast; never silently alter the document source.
- All controls affect export only, not appearance settings stored in the document.
- The browser handles Save as PDF; the selected settings are reflected in print CSS. The user can cancel and try different combinations.

## File size and decision support

Measured against a known CI fixture (Chromium Linux) on 2026-10-23, not a forecast for all documents:
- Simple white: approximately 37 KiB
- Full Soft Mesh: approximately 42 KiB
- Soft Mesh removed: approximately 37 KiB
- Multi-page Letter: approximately 94 KiB

The studio shows the fixture baseline explicitly as reference. It cannot reliably predict exact PDF bytes BEFORE native browser print; font subsets, internal rasterization and print engine vary. After saving, users can select 1-8 PDFs to read File.size **locally**, see real sizes and largest-to-smallest differences, with 500 KiB budget hint and a caution at 2.5 MiB (specific to the Greenhouse parser documented in March 2026, not universal). The file is not uploaded and the selected file size is **not** a text-extraction check.

## Pagination changes included now

- Group sequential heading levels and first content node non-destructively.
- On each H2 section, measure rendered physical height; short sections (at most 72% of printable page) prefer staying together, larger sections remain splittable. This avoids forcing enormous whitespace or clipping long documents.
- Preserve per-paragraph widows/orphans 2/2; avoid splitting each small list item; do not require entire long lists to fit on one page.
- The original Markdown is not modified. PDF test with a heading near a physical page boundary confirms first paragraph stays on the same page.

**Remaining:** preview is still a continuous flow; editor does not yet show trustworthy page boundaries because the typed PagePlan/sourceMap engine from F-006 is not implemented. Do not display guessed "page 2" markers. Full preview/export parity is a separate acceptance gate.

## Acceptance

- UXE-01 Visual complete and high contrast both preserve extractable text; no ATS success claims.
- UXE-02 Individually changing background, text or paper updates a transparent export config, not document source.
- UXE-03 Native print output applies the chosen paper, foreground and background.
- UXE-04 User can compare actual local file sizes and never sends selected PDFs to a server.
- UXE-05 File >2.5 MiB shows a vendor-specific caution, not a universal file rejection.
- UXE-06 Heading and first paragraph stay on the same physical PDF page in a boundary test.
- UXE-07 Short H2 sections prefer to remain intact; oversized sections never clip.
- UXE-08 Browser E2E compares independent controls; PDF extraction and byte size are measured in CI.
- UXE-09 Keep Source Maps/PagePlan work (#5) and professional inspector UX (#4) as explicit unresolved issues.
