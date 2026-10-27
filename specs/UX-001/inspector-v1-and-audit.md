# UX-001 — Audit findings, Inspector v1 and design directions

**Status:** first structural improvement implemented. Visual comparison against Figma/Framer and moderated usability testing remain open. Findings below come from code-and-flow review, not an independent screenshot-based visual audit.

## Critical problems in prior version

| Problem | Severity | Root cause | Initial fix |
|---|---|---|---|
| 1 endless inspector scroll, no information architecture | P1 | Theme, typography, background, mesh, sharing and AI all in a single stacked form | Four contextual tabs: Estilo, Página, Fundo, IA |
| Sliders show no precise editable value | P1 | Incomplete property control contract | Numeric spinbox paired with slider, value sync |
| Document pages did not communicate section geometry | P1 | Continuous preview + browser-only printing | F-006 PagePlan v1 produces page count; Página tab shows count and diagnostics |
| Mesh gallery buried in page settings | P2 | Incorrect grouping | Fundo tab has gallery + advanced mesh points |
| Save/share theme mixed with app appearance | P2 | Product mental model confusion | Tema library in Estilo, site appearance stays in separate Settings |
| Labels/controls inconsistent density | P2 | Ad hoc CSS, no component design | Consistent Property Rows, section headers, focus/hover |
| Workflow not keyboard-friendly | P1 | Inspector elements not focus managed | WAI-ARIA tabs with arrow/home/end keyboard navigation |
| Too little canvas space at 1366 width | P1 | fixed split/editor/preview + 320px overlay | Still unresolved: resizable/dockable panels and canvas focus mode |
| Missing Markdown-to-preview selection mapping | P1 | Parser source maps not yet integrated | Still unresolved: F-004/F-006P source maps |

## Inspector v1 implementation

A contextual 4-tab inspector:
- Estilo: saved document theme, color palette, typography and reusable theme library.
- Página: margins, separators, spacing, page count and diagnostic summary.
- Fundo: presets gallery, CSS pattern parameters and interactive mesh editor.
- IA: structured theme creation guidance and validated JSON preview (LLM provider not connected).

Common property row: short label, aligned control, optional exact numeric value, min/max/step and keyboard behavior. When a slider updates preview, its numeric field stays in sync. Entering a precise numeric value fires the same update path as the slider.

All pre-existing control IDs remain stable to preserve older event wiring and tests. Tab selection only changes UI, never document/pagination state. Application appearance remains in global Settings.

## Alternative directions to explore BEFORE final redesign

**A — Neutral Tooling:** dense, precise, restrained. Thin border segmentation, 32px controls, centralized page canvas. Inspired by design-tool inspectors, not cloned.

**B — Editorial Studio:** large spacious canvas with floating compact property rail; friendlier for writers, simplified advanced actions behind drawers.

**C — Advanced Composer:** dual editor and visual navigator with detachable inspector, layers/sections outline, deep structured properties. Better for power users and long documents.

No final direction is locked yet. UX task must produce three distinct visual alternatives with real states and at least 1366×768 / 1600×900 / narrow-window examples before choosing.

## Next milestones

1. Real screenshot-backed audit, capture relevant states and action frequency.
2. Shared component primitives: PropertyRow, NumericField with unit and scrubbing, ColorField, SectionAccordion, ControlsGroup, ResetControl, Tabs.
3. Keyboard and screen reader review at zoom 200%.
4. Resizable panels and canvas-centered layout with paper navigation.
5. Hierarchical Markdown outline and source-preview selection sync after compiler source maps.
6. Usability test script and measurement (task completion/clicks, errors, time).
7. E2E/visual regression for the selected design direction.

## Acceptance

- UX1-01 Switching inspector tabs retains theme values, Markdown and page count.
- UX1-02 All tabs can be navigated with arrow, home, end and are labeled.
- UX1-03 Numeric edits mirror slider values, respect min/max, and update document preview.
- UX1-04 Background gallery and mesh point controls remain usable.
- UX1-05 Offline modes, theme sharing, ATS info, export remain available.
- UX1-06 Page count/diagnostics reflect the live PagePlan.
- UX1-07 No duplicate HTML IDs or broken imperative references.
- UX1-08 No CSS/JS theme injection; LLM flow remains validated.
