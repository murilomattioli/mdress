# UX-003 — Professional Property Controls / DS v4

Status: implemented first pass; browser interaction and PDF regression covered by CI.

Reference: user-supplied screenshots of Designminis Background Remover property panel (2026-10-23). Interaction principles and density are the references; no source, assets, or branding copied.

## Real component contracts

| Primitive | Anatomy | Interaction and accessibility |
|---|---|---|
| DSRangeField | unified row: label, tick ruler, fill, vertical thumb, editable number + unit | Native range retained. Keyboard, pointer drag, exact typed value, step snap and clamp |
| DSNumberField | compact label, minus, numeric, unit, plus | Limit-disabled steppers, same input/change event source |
| DSColorField | label, color swatch and editable hex | OS color picker or six-digit hex; invalid input rejected |
| DSSegmentedField | label + fixed set of pressed buttons | Arrow/Home/End and click, selected state synced with underlying select |
| DSSelectField | value button + viewport-positioned listbox | Enter, Escape, arrows, selected state, outside click, dynamic saved options |
| DSBinaryField | label + Off / On | Pressed and keyboard states, synced checkbox |
| DSAccordionSection | header + metadata + optional body | Expanded/collapsed by keyboard; persists app UI preference |

## Implementation and invariants

- app/design-system/property-controls.js builds the visual controls, retaining IDs and native change handlers.
- app/design-system/property-controls.css provides the unified surfaces and tokens.
- app/property-inspector.js initializes each control and synchronizes them after document-theme updates.
- New first-run app appearance Studio Light, preserving old Graphite/OLED/Sand/Neon preferences.
- Component decoration does not alter Markdown, page geometry or PDF export.
- Native controls remain the single source of truth. Values are numeric constrained and CSS is static.
- The page-guide binary control affects only preview labels and is saved as a UI preference.

## Test matrix

1. Range keyboard, exact numeric entry, out-of-range clamp, native input binding.
2. Color hex entry and theme token update.
3. Segmented font and section separator, original select synchronized.
4. Dropdown with accessible option selection and accurate current value.
5. Accordion toggle and restoration, no data loss.
6. Off/On page guide toggles preview labels, not PDF.
7. Mesh gallery, editor and theme persistence unchanged.
8. Canvas responsive views at 1366, 1600 and mobile; PDF remains text-extractable.

## Limitations

This ships the core family, not a complete Figma-grade DS. Future items: pointer numeric scrubbing, stepper press-and-hold, unit conversion, richer color popover (HSL/HSV/alpha), dynamic Mesh-point controls migrated to the same primitives, screenshot visual regression and removal of old style overrides.