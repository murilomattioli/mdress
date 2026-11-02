# UX-023 — oversized toolbar controls in RTL

An action wider than the available toolbar scrollport cannot fit completely. Focus must reveal its **logical leading edge** rather than alternate between two clipped edges after each resize. LTR aligns the left edge; RTL aligns the right edge. Ordinary smaller actions still reveal either clipped physical edge.

## Browser evidence

Run `node scripts/toolbar-rtl-oversized-qa.mjs` against the development server. The mandatory Browser Smoke job writes three screenshots under `test-results/ux-audit/`: `toolbar-oversized-leading-rtl-390.png`, `toolbar-oversized-leading-ltr-390.png`, `toolbar-oversized-restored-rtl-390.png`.

The regression asserts focus retention, edge alignment, direction switching, no resize oscillation and no browser errors. **Human visual review is still required**: verify that the beginning of the oversized command is recognizable, the focused state remains visible, the scroll arrows are discoverable and the inspector does not waste vertical space. Automated geometry checks do not approve visual UX.
