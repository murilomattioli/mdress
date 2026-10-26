# F-007C — Soft Mesh Gradient backgrounds for documents

Status: initial implementation / functional browser QA and PDF verification pending.

## Reference

Inspired by UX Pilot Labs Gradient & Background Studio: https://uxpilot.ai/labs/gradient-generator/soft-mesh

UX Pilot exposes multiple color spots, opacity, softness, distortion, grain and blending. We are implementing original recipes and a portable subset specialized for printed Markdown documents; the UX Pilot source, art and theme codes are not copied.

## Design contract

backgroundStyle.kind: mesh. Each document may use 2 to 6 declarative points with:
- color: RGB hex
- x/y: 0–100 percent of page
- radius: 15–120 percent
- strength: 0.05–1
- softness: global 0–100

Rendering uses layered CSS radial-gradient backgrounds; main text remains separate selectable HTML, never baked into an image. No remote images, scripts, freeform CSS, animation or HTML in the theme.

## UX

Four curated starters: Soft Mesh, Aurora Glow, Peach Mist and Mint Cloud. Users can add/remove points (minimum 2, maximum 6), move them by dragging or keyboard arrows, change each color/position/radius/intensity and adjust softness. Dragging previews without writing to IndexedDB until pointer release.

Themes remain editable per document, can be shared as RST1 codes and generated through the validated LLM Theme Agent contract.

## PDF risks and acceptance

CSS radial gradients may be rasterized internally by the browser when printing. Static CSS alone does NOT guarantee a vector-only PDF or any fixed PDF size.

Acceptance requires:
- MSH-01 Browser QA of pointer drag, keyboard drag, live preview and persistence.
- MSH-02 Existing themes load with default empty point list/softness.
- MSH-03 Only strict point objects and safe colors are accepted.
- MSH-04 RST1 preserves points and layout metadata.
- MSH-05 Printing without background omits both background colors and all gradient layers.
- MSH-06 The finished PDF must preserve real selectable text, reading order, links and Unicode and be measured for size.
- MSH-07 Visual and ATS print profiles must be verified independently.
- MSH-08 Optional grain/glass/warp features require an export cost benchmark before shipping.
