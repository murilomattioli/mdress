# F-007B — Procedural Background Gallery

**Status:** Initial gallery implemented; true PDF geometry/ATS verification pending.

The document preview's Design panel includes a gallery of eleven original background recipes: two solid, four gradients (linear and radial), five repeating patterns. All backgrounds are represented as structured theme JSON and CSS backgrounds; no network images, hidden script, HTML or font files.

Editable theme background properties:
- kind: solid, gradient, radial, dots, lines, grid, crosshatch, checker
- background: page base color #RRGGBB
- secondary: secondary/pattern color #RRGGBB
- angle: 0..360
- patternSize: 8..64 (CSS pixels)
- opacity: 0.02..0.60 (pattern ink alpha)

The gallery applies a complete visual recipe including accessible foreground and accent choices. The user can then tune controls independently. Changes persist per document and are included in shared theme codes (RST1).

**Portability:** themes stored in IndexedDB v2 documents and JSON backup. Old backgrounds without opacity load using 0.12. Strict validation rejects arbitrary properties, external asset URLs and unsafe CSS. Presets are original, not copied verbatim from external galleries.

**PDF behavior:** CSS gradients and patterns can be rasterized by browser PDF printers, depending on engine and options. Never claim guaranteed vector PDF or ATS certification. Export option can remove decor, and text remains separate HTML elements. A verified PDF engine must inspect final text extraction, reading order, color contrast, size, and rendering across browsers.

## Acceptance
- BG-01 Each recipe preview renders with CSS generated from validated tokens.
- BG-02 Gallery preset switches page foreground and background consistently.
- BG-03 Adjusted size/angle/opacity persists on document and survives theme sharing.
- BG-04 Invalid CSS and remote assets are refused.
- BG-05 Legacy theme configuration works without new props.
- BG-06 Printing without background removes background image.
- BG-07 Future independent PDF verification reports presence of selectable text, reading order and size.
