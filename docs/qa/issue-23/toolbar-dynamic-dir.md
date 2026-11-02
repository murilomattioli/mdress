# UX-023 — Live toolbar direction and keyboard focus

A toolbar can inherit `dir` from an editor or receive `dir` directly.
Switching language/direction must refresh the physical scroll-arrow states
**without** relying on a resize, scroll event, or unrelated class/style change.

## Implemented

- `app/toolbar-overflow.js` observes `dir` on the toolbar subtree **and**
  the wrapping shell's ancestor chain. An inherited direction change now
  schedules the same overflow/focus reconciliation as a resize.
- `scripts/toolbar-dynamic-dir-qa.mjs` verifies a real Chromium scrollport
  at 390px, direction changes RTL → LTR → RTL via the host `dir`,
  direct `dir` overrides on the toolbar, and keyboard focus handoff
  when the focused arrow becomes disabled.
- The script also clicks the physical left arrow after RTL restoration and
  asserts negative `scrollLeft`. It captures four PNGs in
  `test-results/ux-audit/`.
- Browser Smoke runs this regression as a required step; `npm run check`
  checks the script's syntax.

## Human acceptance criteria

Inspect the four `toolbar-dir-*.png` screenshots. The correct arrow must
be enabled at each edge; the disabled arrow must not retain keyboard focus
after a direction switch. Verify real keyboard navigation in both directions,
including high zoom and narrow inspector panes. The 24 existing
`scrollable-toolbar` audit warnings still require human review; a green
CI run does not approve the visual UX.

## PowerShell (no merge)

```powershell
cd F:\Projects\lumu\tools\mdress
git status --short
git fetch origin
git switch feat/23-property-controls-ux-qa
git pull --ff-only origin feat/23-property-controls-ux-qa
npm install --include=dev
npx playwright install chromium
npm run dev
# In a second PowerShell window:
node scripts/toolbar-dynamic-dir-qa.mjs
node scripts/toolbar-discoverability-qa.mjs
npm run qa:supervised
# For interrupted supervised capture:
npm run qa:resume-capture
```

PR #27 remains draft, issue #23 open until explicit human homologation.
No merge, release, Cloudflare deployment, or legacy-repository changes.
