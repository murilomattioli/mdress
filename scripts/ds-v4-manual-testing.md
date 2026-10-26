# Inspector DS v4 QA scenarios

- [ ] Studio Light default for new users; legacy app themes unchanged
- [ ] Range dragging, exact number entry, keyboard arrows, clamp and step
- [ ] Hex color from swatch or field; invalid hex rejected
- [ ] Segmented font and separator controls with focus/pressed state
- [ ] Custom select popover search/arrow/Escape/outside click, selected option retained
- [ ] Accordion collapse/expand preserves document state
- [ ] Mesh gallery and point editor remain functional
- [ ] Change document theme and export A4/Letter to PDF with same text
- [ ] 1366 and 1600 width: fields fit inspector with no horizontal overflow
- [ ] System themes graphite / OLED / sand / neon and studio maintain readable contrast
- [ ] No duplicate HTML IDs; all original onchange handlers work

See `scripts/e2e.mjs` and `tests/property-controls.test.mjs` for automated checks.
