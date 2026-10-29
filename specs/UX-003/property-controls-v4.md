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
- Portalled comboboxes close on outside pointer interaction **and** keyboard/programmatic focus departure, preserving the destination focus. Dismissal clears `aria-controls` with the unmounted listbox. Mobile Chromium regression verifies viewport bounds, visible option focus and Tab navigation at 390px. If an anchor is hidden or detached while its option owns focus, the handoff targets an available inspector control or visible inspector toggle; it never attempts to focus the detached trigger. A Playwright fixture removes the active anchor to prevent regressions.
- Range steppers with `step="any"` advance by 1% of the live span; grid steppers disable at the last valid step even when HTML `max` is off-grid. No-op boundaries do not emit edits, and focus is handed to a visible neighbor if the active stepper becomes disabled.
- Invalid drafts never commit; Escape restores the confirmed value and focus remains available for further editing.
- Native number, slider precision and hexadecimal text fields expose a 2px `:focus-visible` outline on the editable input itself (not only a faint row-level focus border). Chromium E2E asserts the computed focus indicator and stores contextual screenshots for human review.
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
10. Supervised UX-023 matrix: 68 states × two themes × four widths (1440/1024/768/390px) = 544 screenshots; all must be reviewed by a human before merge.

11. At 390px, numeric steppers, color swatches, dropdowns, segmented/binary buttons and precision inputs expose 44px mobile targets; Playwright asserts the geometry and captures the inspector overlay.

## Automated accessibility and geometry gates

The Chromium component audit runs in Graphite and Studio at 390, 768, 1024 and 1440px. It rejects interactive hit-target collisions both **inside one property row** and **across different rows** when the rendered intersection exceeds 4px on each axis. Adjacent borders and intentionally scrollable toolbar actions are not treated as collisions. It also rejects missing or duplicated `aria-labelledby` / `aria-describedby` ID references, `aria-labelledby` chains whose existing targets provide no accessible text, visible controls with no accessible name, and keyboard-focusable controls inside `aria-hidden="true"` subtrees. For name computation, `aria-labelledby` takes precedence over a fallback `aria-label` or `title`; a broken/empty reference must not be silently treated as valid. Unit regressions cover row boundaries, collision thresholds, missing, duplicate and empty multi-ID references. At the 390px mobile breakpoint, the audit also fails when an enhanced inspector hit target measures less than 44px in either axis (with 0.5px rounding tolerance); the check explicitly excludes decorative elements and hidden native select sources. The native range slider retains a minimum 44×44px target even in narrow grids. Node regressions cover width, height and noninteractive exclusions.

These checks are necessary but not a visual sign-off: the 544 supervised screenshots and interactive focus, contrast and ergonomics still require explicit human approval.

## Limitations

This ships the core family, not a complete Figma-grade DS. Future items: pointer numeric scrubbing, stepper press-and-hold, unit conversion, richer color popover (HSL/HSV/alpha), dynamic Mesh-point controls migrated to the same primitives, screenshot visual regression and removal of old style overrides.