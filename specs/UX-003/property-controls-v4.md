# UX-003 — Professional Property Controls / DS v4

Status: UX-023 implementation under supervised QA; automated browser checks do not replace human visual approval.

Reference: user-supplied screenshots of Designminis Background Remover property panel (2026-10-23). Interaction principles and density are the references; no source, assets, or branding copied.

## Real component contracts

| Primitive | Anatomy | Interaction and accessibility |
|---|---|---|
| DSRangeField | unified row: label, tick ruler, fill, vertical thumb, editable number + unit | Native range retained. Keyboard, pointer drag, exact typed value, step snap and clamp |
| DSNumberField | compact label, minus, numeric, unit, plus | Limit-disabled steppers, same input/change event source |
| DSColorField | label, color swatch and editable hex | OS color picker or six-digit hex; invalid input rejected |
| DSSegmentedField | label + fixed set of pressed buttons | Arrow/Home/End and click, selected state synced with underlying select |
| DSSelectField | value button + viewport-positioned listbox | Enter, Escape, arrows, selected state, outside click, dynamic saved options |
| DSBinaryField | label + Não / Sim | Pressed and keyboard states, synced checkbox; reselecting the active value does not emit document events |
| DSAccordionSection | header + metadata + optional body | Expanded/collapsed by keyboard; persists app UI preference |

## Implementation and invariants

- app/design-system/property-controls.js builds the visual controls, retaining IDs and native change handlers.
- app/design-system/property-controls.css provides the unified surfaces and tokens.
- app/property-inspector.js initializes each control and synchronizes them after document-theme updates.
- New first-run app appearance Studio Light, preserving old Graphite/OLED/Sand/Neon preferences.
- Component decoration does not alter Markdown, page geometry or PDF export.
- Native controls remain the single source of truth. Values are numeric constrained and CSS is static.
- No-op interactions (reselecting the active segment, combobox option, binary state, hex color or slider value) do not dispatch synthetic `input`/`change` events. Only actual value changes may update document history.
- Invalid drafts never commit; Escape restores the confirmed value and focus remains available for further editing.
- The page-guide binary control affects only preview labels and is saved as a UI preference.

## Test matrix

1. Range keyboard, exact numeric entry, out-of-range clamp, native input binding.
2. Color hex entry and theme token update.
3. Segmented font and section separator, original select synchronized.
4. Dropdown with accessible option selection and accurate current value.
5. Accordion toggle and restoration, no data loss.
6. Não/Sim page guide toggles preview labels, not PDF; repeated selection is a no-op.
7. Mesh gallery, editor and theme persistence unchanged.
8. Canvas responsive views at 1366, 1600 and mobile; PDF remains text-extractable.
9. Playwright regression verifies unchanged values produce zero native `input`/`change` events for range, color, select, segment and binary; screenshot of localized binary control is retained as visual evidence.
10. Supervised UX-023 matrix: 67 states × two themes × three widths = 402 screenshots; all must be reviewed by a human before merge.

## Limitations

This ships the core family, not a complete Figma-grade DS. Future items: pointer numeric scrubbing, stepper press-and-hold, unit conversion, richer color popover (HSL/HSV/alpha), dynamic Mesh-point controls migrated to the same primitives, screenshot visual regression and removal of old style overrides.