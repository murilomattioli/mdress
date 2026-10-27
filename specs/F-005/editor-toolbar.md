# F-005A — Markdown Editor Usability and Toolbar

**Status:** Implemented initial, unit-tested; visual E2E pending.

## Core UX
1. User opens a document in split mode with editor and preview.
2. Markdown toolbar always lives above the editor and provides heading level, bold, italic, strikethrough, inline code, links, bullet/number/task lists, block quotes, fenced code and separator.
3. Controls operate on current selection, never serialize rich HTML into source.
4. Link insertion uses an accessible dialog with protocol guard (HTTP, HTTPS, mailto).
5. Undo/redo supports toolbar and keyboard actions. History is per-document and resets on document switch.
6. Modes: split / edit-focused / preview-focused, persistent for the active session.
7. Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+K, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+S.
8. Source view remains genuine Markdown. Formatting changes are textual and reversible.
9. Preview supports headings, paragraph, ordered/unordered/task lists, inline code, fenced code, blockquotes, horizontal rules, links and strikethrough.
10. App appearance remains independent from document appearance.

## Quality scenarios
- E-01 Bold wraps selection and toggles back.
- E-02 Heading applies to selected line and restores paragraph.
- E-03 Multiline list toggle does not remove content.
- E-04 Bad javascript: links are rejected.
- E-05 Formatted Markdown preview remains sanitized.
- E-06 History undo/redo returns correct content.
- E-07 Different documents do not share edit history.
- E-08 Keyboard shortcuts and editor buttons are equivalent.
- E-09 Undo/redo must never report persisted success before IndexedDB confirms.
- E-10 UI identifiers are unique and all imperative refs map to markup.

## Limitations
No drag-and-drop visual editing, selection-to-preview source mapping, CodeMirror editor, or browser-verified pixel-perfect QA yet. This is a purposeful improvement of the initial textarea-based MVP, not a completed professional editor.
