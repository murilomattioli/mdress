# PDF Weight Budget & Harmonic Randomizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the editor a live, offline, calibrated estimate of PDF weight (total + per page + top contributors), and make "Surpreenda-me" vary section/background presets harmonically (by heading level, not per-heading-independent) while staying inside a weight budget.

**Architecture:** A new pure cost-model module (`app/pdf-weight.js`) is the single source of truth for preset costs, consumed by (a) the existing randomizer modules (`section-surprise.js`, `theme-explorer.js`) to bias/cap their picks, and (b) the editor's live DOM to render a badge + a "Peso" inspector tab. A separate on-demand Playwright script calibrates the cost table against real `page.pdf()` output; it is not part of the standard CI gate.

**Tech Stack:** Vanilla JS ES modules (no new dependencies), `node --test` for pure-logic tests, Playwright (already a devDependency, already used by `scripts/pdf-quality.mjs`/`scripts/e2e.mjs`) for calibration and DOM-coupled smoke checks.

**Spec:** `specs/F-013/spec.md` — the plan argues from the spec; executors should read both.

## Global Constraints

- Fully offline: no network calls anywhere in `app/pdf-weight.js` or its callers (spec §2/§3).
- Document-total weight bands reuse the exact thresholds already in `app/pdf-export.js`'s `inspectPDFFile`: **leve** <500 KiB (512000 bytes), **atenção** 500 KiB – 2.5 MiB, **pesado** ≥2.5 MiB (2621440 bytes) (spec §4.3). Express all internal math in KiB (1024 bytes) to match the existing codebase convention (`inspectPDFFile` uses `/(1024*1024)`).
- Heavy-preset cap for the randomizer: at most 1 heading level (out of however many are present) may receive a `pesado`-class section preset per document; background follows the same pesado-avoidance rule (spec §5.3).
- **REQ-013-06 is best-effort, not a hard guarantee:** `surpriseSections`/`shuffleTheme` pick presets from parsed Markdown alone — they have no access to the real page count (that's only known after layout, later in `app.js`). The level/background caps bound the common case well (see Task 1's cost magnitudes: even 9 occurrences of the heaviest preset stays far under the 2560 KiB "pesado" threshold). Task 5 closes the loop honestly instead of pretending a sort-time guarantee exists: if a "Surpreenda-me" result still estimates `pesado` once real pagination completes, the toast says so plainly rather than silently retrying forever.
- Trading off app appearance (F-002A / `data-theme`) must never affect the estimator or the cost table (REQ-013-08).
- This feature never changes PDF export CSS/print behavior — it only measures/estimates and biases random selection (spec §2 Fora).
- When "Seções" is locked, `surpriseSections` returns the input design unchanged — existing behavior, do not alter (REQ-013-05, already covered by an existing passing test in `tests/section-surprise.test.mjs`).
- When "Seções" is NOT locked, `surpriseSections` replaces the whole section design including any prior manual per-section overrides — confirmed intentional with the user, existing behavior, do not add merge logic (REQ-013-05).

## Review Focus

- A document with zero headings (body text only): `surpriseSections`/`estimateWeight` must not throw and must return a sane empty-ish result, not crash the editor. → test in Task 3.
- A document where every heading is the same level: the harmony rewrite must still assign that single level a preset without forcing it to `leve` only (the cap logic must not degenerate when there's only one level to choose from). → test in Task 3.
- A background `kind` or section preset `id` missing from the cost table (e.g. a preset added later without updating `pdf-weight.js`) must fall back to a safe default cost, never throw or produce `NaN` in the total. → test in Task 1.
- A document whose weight comes from **manual** (non-randomized) heavy section overrides must still report `band:'pesado'` correctly in the estimator — the cap only constrains what the randomizer itself picks, never what the badge reports. → test in Task 1.
- The heavy-cap re-roll inside `surpriseSections` must terminate even in a degenerate case (e.g. a level whose only non-`plain` candidates are all `pesado`) — `plain` is always `leve` and always in the candidate list, so a fallback exists; the implementation must use it rather than loop. → test in Task 3.

---

### Task 1: Weight cost model

**Files:**
- Create: `app/pdf-weight.js`
- Test: `tests/pdf-weight.test.mjs`

**Interfaces:**
- Consumes: nothing (no imports from other app modules; pure constants/math only).
- Produces (used by Tasks 2–5):
  - `export const SECTION_PRESET_COST` — `{[presetId]: kibPerOccurrence}` for all 9 ids in `sectionPresets` (`app/section-design.js`): `plain:0, outline:2, editorial:3, accent:4, 'minimal-grid':5, spotlight:8, band:12, surface:15, glass:25`. These are initial reasoned placeholders (see Task 1 Step 3 note) — Task 2 overwrites the numbers, not the shape.
  - `export const BACKGROUND_KIND_COST` — `{[kind]: kibFlat}` keyed by `backgroundPresets[].kind` (`app/background-presets.js`): `solid:0, gradient:3, radial:4, mesh:6, dots:10, grid:10, lines:10, crosshatch:12, checker:8`.
  - `export const PAGE_BASE_KIB = 20` (plain-text page baseline, from the measured baseline in spec §4.1).
  - `export function costClass(kib)` → `'leve'` if `kib<5`, `'medio'` if `kib<15`, else `'pesado'`.
  - `export function weightBand(totalKiB)` → `'leve'` if `<500`, `'atencao'` if `<2560`, else `'pesado'`.
  - `export function estimateWeight({pages=1, backgroundKind='solid', sectionPresetCounts={}, font='system'}={})` → `{totalKiB, perItem:[{id,kib}], band}`. `perItem` sorted by `kib` descending (feeds "top contributors"). Unknown `backgroundKind` or unknown keys in `sectionPresetCounts` must not throw — fall back to `BACKGROUND_KIND_COST.gradient` (3 KiB, a safe mid default) for unknown background kinds and skip unknown section preset ids (treat as 0 contribution) rather than crashing.

- [ ] **Step 1: Write failing tests in `tests/pdf-weight.test.mjs`**

```js
import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {estimateWeight,costClass,weightBand,PAGE_BASE_KIB,SECTION_PRESET_COST,BACKGROUND_KIND_COST} from '../app/pdf-weight.js';

test('page-only estimate uses the base page cost and is leve',()=>{
 const r=estimateWeight({pages:3});
 assert.equal(r.totalKiB,3*PAGE_BASE_KIB);
 assert.equal(r.band,'leve');
});
test('costClass boundaries match the spec table',()=>{
 assert.equal(costClass(4),'leve');assert.equal(costClass(5),'medio');
 assert.equal(costClass(14),'medio');assert.equal(costClass(15),'pesado');
});
test('weightBand boundaries match the reused inspectPDFFile thresholds',()=>{
 assert.equal(weightBand(499),'leve');assert.equal(weightBand(500),'atencao');
 assert.equal(weightBand(2559),'atencao');assert.equal(weightBand(2560),'pesado');
});
test('unknown background kind or section preset id never throws or yields NaN',()=>{
 const r=estimateWeight({pages:1,backgroundKind:'future-kind',sectionPresetCounts:{'future-preset':3}});
 assert.ok(Number.isFinite(r.totalKiB));
});
test('many manually-heavy sections across many pages report pesado regardless of how they were set',()=>{
 const r=estimateWeight({pages:9,backgroundKind:'solid',sectionPresetCounts:{glass:18}});
 assert.equal(r.band,'pesado');
});
test('top contributors are sorted by kib descending',()=>{
 const r=estimateWeight({pages:1,sectionPresetCounts:{outline:1,glass:1,surface:1}});
 assert.deepEqual(r.perItem.map(x=>x.id),['glass','surface','outline']);
});
```

- [ ] **Step 2: Run `node --test tests/pdf-weight.test.mjs` and confirm every test fails** (module doesn't exist yet).

- [ ] **Step 3: Implement `app/pdf-weight.js`**

One file, no imports. The constants are literal objects with the exact values listed in Interfaces above. `estimateWeight` sums `pages*PAGE_BASE_KIB + (BACKGROUND_KIND_COST[backgroundKind] ?? BACKGROUND_KIND_COST.gradient) + Σ (SECTION_PRESET_COST[id] ?? 0) * count` over `Object.entries(sectionPresetCounts)`, builds `perItem` only from ids present in `SECTION_PRESET_COST` with `count>0`, each contributing `kib = SECTION_PRESET_COST[id]*count`, sorted descending.

- [ ] **Step 4: Run `node --test tests/pdf-weight.test.mjs` and confirm all pass.**

- [ ] **Step 5: Add to the `check` script in `package.json`** — append `&& node --check app/pdf-weight.js` to the existing chain (follow the exact pattern already used for every other `app/*.js` file in that line).

- [ ] **Step 6: Commit**

```bash
git add app/pdf-weight.js tests/pdf-weight.test.mjs package.json
git commit -m "feat(weight): add offline PDF weight cost model and estimator"
```

---

### Task 2: Calibration script

**Files:**
- Create: `scripts/pdf-weight-calibrate.mjs`
- Modify: `app/pdf-weight.js:SECTION_PRESET_COST,BACKGROUND_KIND_COST` (values only, not shape)

**Interfaces:**
- Consumes: Playwright (`chromium.launch`), the dev server at `http://127.0.0.1:4173` (same as `scripts/pdf-quality.mjs`), the UI selectors `#designToggle`, `[data-inspector-tab="sections"]`, `.section-style-preset[data-section-preset="<id>"]`, `[data-inspector-tab="background"]`, `.bg-preset[aria-label="Usar fundo <Nome>"]` (existing markup, see `app/app.js:274-286` for the sections gallery and `scripts/pdf-quality.mjs:21-26` for the background pattern it already exercises successfully).
- Produces: a console report (one JSON line per scenario, same shape as `pdf-quality.mjs`'s `console.log('PDF QUALITY '+...)`) that a human reads to update the two cost tables in Task 1's file. Not consumed programmatically by any other task.

- [ ] **Step 1: Write `scripts/pdf-weight-calibrate.mjs`**

Model it directly on `scripts/pdf-quality.mjs`'s `printScenario` (same `openDocument`/`page.pdf({path,preferCSSPageSize:true,printBackground:true,scale:1})`/`stat(path).size` pattern). Use a fixed reference markdown with 9 short `##`-level entries (same shape as the spec §4.1 reference doc) so results are comparable across presets. For each of the 9 `sectionPresets` ids, open the document, click `#designToggle` → `[data-inspector-tab="sections"]` → `.section-style-preset[data-section-preset="<id>"]`, generate the PDF, record `{preset, bytes, kib, pages, kibPerPage}`. Repeat the same pattern over each `backgroundPresets` entry's `aria-label` to isolate background cost by `kind`.

**Known flake to handle:** clicking the sections-tab preset buttons immediately after opening the design panel can hit the button while its container still has a `0×0` bounding box (observed during design-phase spiking). Before each preset click, wait for layout to settle: `await page.waitForFunction(sel => { const el = document.querySelector(sel); return el && el.getBoundingClientRect().width > 0; }, selector)` ahead of `.click()`.

- [ ] **Step 2: Run it against a local dev server**

```bash
node scripts/dev-server.mjs &
node scripts/pdf-weight-calibrate.mjs
```
Expected: one JSON line per section preset and per background kind, process exits 0, no Playwright timeout.

- [ ] **Step 3: Transcribe the measured KiB-per-occurrence (section) and KiB-flat (background, grouped by `kind`) into `SECTION_PRESET_COST`/`BACKGROUND_KIND_COST` in `app/pdf-weight.js`, replacing the Task 1 placeholder numbers.**

- [ ] **Step 4: Run `node --test tests/pdf-weight.test.mjs` again and confirm it still passes** (the tests assert boundaries and relative ordering, not the exact placeholder numbers, so real calibration data should not break them — if a real number crosses a `costClass`/`weightBand` boundary in a way that breaks a test's premise, adjust the test's input magnitude, not the thresholds, since the thresholds are spec-pinned).

- [ ] **Step 5: Commit**

```bash
git add scripts/pdf-weight-calibrate.mjs app/pdf-weight.js
git commit -m "feat(weight): calibrate cost table against real Chromium PDF output"
```

---

### Task 3: Harmonic section randomizer

**Files:**
- Modify: `app/section-surprise.js` (full rewrite of `surpriseSections`'s body; same exported signature)
- Modify: `tests/section-surprise.test.mjs`

**Interfaces:**
- Consumes: `costClass`, `SECTION_PRESET_COST` from `app/pdf-weight.js` (Task 1); `sectionPresets`, `parseSectionDesign` from `app/section-design.js` (existing, unchanged); `sectionAnchors` from `app/section-pagination.js` (existing, unchanged); `normalizeThemeLocks` from `app/theme-explorer.js` (existing, unchanged).
- Produces: `surpriseSections(markdown, current, locks={}, random=Math.random)` — **same signature as today**. Result shape changes: variation now lives in `result.levelPresets` (`{[level]: presetId}`, one entry per distinct heading level 1–6 present in `markdown`), `result.overrides` is always `{}` (randomizer never sets per-id overrides — matches the "reset completo" decision).

- [ ] **Step 1: Update `tests/section-surprise.test.mjs`'s failing/changed assertions**

Replace the line that currently asserts `Object.keys(a.overrides).every(id=>id.startsWith('1:')||...)` (this tested the old per-id behavior being removed) with assertions on the new shape, and add the new harmony/cap/edge cases:

```js
test('surprise varies by heading level, not per heading independently',()=>{
 const a=surpriseSections(markdown,parseSectionDesign(),{},0.11);
 assert.deepEqual(a.overrides,{});
 assert.ok(Object.keys(a.levelPresets).every(level=>/^[1-6]$/.test(level)));
 // markdown fixture has two level-2 headings ("Visão geral","Implementação","Considerações" are H2) —
 // same level must resolve to the same preset for both.
});
test('heavy-cost presets never exceed one level per document, across many seeds',()=>{
 const sixLevels='# A\n## B\n### C\n#### D\n##### E\n###### F\nTexto.';
 for(let s=0;s<1;s+=0.03){
  const r=surpriseSections(sixLevels,parseSectionDesign(),{},s);
  const heavy=Object.values(r.levelPresets).filter(id=>costClass(SECTION_PRESET_COST[id])==='pesado');
  assert.ok(heavy.length<=1,'seed '+s+' produced '+heavy.length+' heavy levels');
 }
});
test('document with no headings does not throw and yields no level presets',()=>{
 const r=surpriseSections('Só um parágrafo solto, sem heading.',parseSectionDesign(),{},0.5);
 assert.deepEqual(r.levelPresets,{});
});
test('document where every heading shares one level still gets a preset for that level',()=>{
 const oneLevel='## Um\nTexto\n\n## Dois\nTexto\n\n## Três\nTexto';
 const r=surpriseSections(oneLevel,parseSectionDesign(),{},0.6);
 assert.ok(r.levelPresets['2']);
});
```

Keep the existing lock test (`surpriseSections(markdown,design,{sections:true},0.45)` returns `design` unchanged) and the existing determinism test (same seed → same result) as-is — both still apply to the new implementation.

- [ ] **Step 2: Run `node --test tests/section-surprise.test.mjs` and confirm the new/changed tests fail.**

- [ ] **Step 3: Rewrite `surpriseSections` in `app/section-surprise.js`**

Keep the existing seeded xorshift `next()` generator and the `choose(values,old)` helper as-is. Pick `defaultPreset`/`density` exactly as today. Then, instead of looping `anchors` and setting per-id `overrides`, collect the **distinct levels** present (`new Set(anchors.map(a=>a.level))`, still excluding levels >3 per the existing `anchor.level>3` guard — or lift that guard now that the mechanism is per-level, not per-anchor-count; either is defensible, but if anchors beyond level 3 exist they should still get *some* level preset since `resolveSectionPreset` already supports levels 1–6 — prefer including all distinct levels found, not just ≤3). For each distinct level, call `choose(presets, defaultPreset)` to pick a candidate preset. Track how many picked levels classify as `costClass(SECTION_PRESET_COST[id])==='pesado'`; for every level beyond the first pesado one (in ascending level order), re-pick using `choose(presets.filter(id=>costClass(SECTION_PRESET_COST[id])!=='pesado'), defaultPreset)` — `plain` (cost 0, always `leve`) is always in that filtered list, so this always has a candidate and terminates in one re-pick, never a loop. Build `levelPresets` from the final per-level picks (omit a level's entry if its pick equals `defaultPreset`, mirroring how `setSectionPreset`'s existing level-preset semantics avoid redundant entries — see `app/section-design.js:48-49`). Return `parseSectionDesign({version:1, defaultPreset, density, levelPresets, overrides:{}})`.

- [ ] **Step 4: Run `node --test tests/section-surprise.test.mjs` and confirm all pass.**

- [ ] **Step 5: Run the full suite** (`npm test`) to confirm nothing else referencing `surpriseSections` broke.

- [ ] **Step 6: Commit**

```bash
git add app/section-surprise.js tests/section-surprise.test.mjs
git commit -m "feat(sections): surprise-me varies by heading level, capped at one heavy level"
```

---

### Task 4: Background weight-awareness in the theme randomizer

**Files:**
- Modify: `app/theme-explorer.js:62-92` (inside `shuffleTheme`, between computing `changed` and picking from it)
- Modify: `tests/theme-explorer.test.mjs`

**Interfaces:**
- Consumes: `BACKGROUND_KIND_COST`, `costClass` from `app/pdf-weight.js` (Task 1).
- Produces: `shuffleTheme`'s existing exported signature and return shape are unchanged — only which candidate gets picked changes.

- [ ] **Step 1: Write a failing test in `tests/theme-explorer.test.mjs`**

```js
test('shuffle avoids a pesado-cost background when a lighter option is available',()=>{
 const base=recipeTheme('modernist');
 for(let s=0;s<1;s+=0.05){
  const r=shuffleTheme(base,{},s);
  assert.notEqual(costClass(BACKGROUND_KIND_COST[r.backgroundStyle.kind]??0),'pesado');
 }
});
```
(Import `costClass,BACKGROUND_KIND_COST` from `../app/pdf-weight.js` at the top of the file alongside the existing imports.)

- [ ] **Step 2: Run `node --test tests/theme-explorer.test.mjs` and confirm it fails** (today's `shuffleTheme` has no weight awareness; depending on the real calibrated costs from Task 2 some seeds will land on a heavy `kind`).

- [ ] **Step 3: Implement the filter in `app/theme-explorer.js`**

Right after `const changed=options.filter(next=>JSON.stringify(next)!==JSON.stringify(old));` and its existing `if(!changed.length)return old;` guard, add: compute `lightChoices=changed.filter(o=>costClass(BACKGROUND_KIND_COST[o.backgroundStyle.kind]??0)!=='pesado')`; use `lightChoices.length?lightChoices:changed` as the pool the existing `const pick=changed[Math.min(changed.length-1,Math.floor(r*changed.length))];` line indexes into (rename the local to `pool` and index into it instead of `changed`, keeping the same clamping shape).

- [ ] **Step 4: Run `node --test tests/theme-explorer.test.mjs` and confirm it passes.**

- [ ] **Step 5: Run `npm test` to confirm no regressions in the other `shuffleTheme`/`recipeTheme` tests.**

- [ ] **Step 6: Commit**

```bash
git add app/theme-explorer.js tests/theme-explorer.test.mjs
git commit -m "feat(theme): surprise-me avoids heavy-cost backgrounds when lighter options exist"
```

---

### Task 5: Live weight badge + "Peso" inspector tab

**Files:**
- Modify: `app/index.html` (badge near `#printPDF`; new tab button + panel in the Design inspector, mirroring the existing `data-inspector-tab`/`data-inspector-panel` pattern at lines 107–111 and 114–217)
- Modify: `app/pdf-weight.js` (add one DOM-reading export, alongside the pure functions from Task 1)
- Modify: `app/app.js` (import + wire into the existing pagination-complete callback)
- Modify: `app/studio.css` (badge color-by-band styling)
- Modify: `scripts/e2e.mjs` (one smoke assertion)
- Modify: `tests/editor-toolbar.test.mjs` is NOT touched directly, but `tests/ui-contract.test.mjs`'s existing generic checks (every `$('id')` in `app.js` has a matching `id="..."` in `index.html`, no duplicate ids) must keep passing — this is the plan's regression guard for the new markup, no new assertions needed there.

**Interfaces:**
- Consumes: `estimateWeight` from Task 1 (its return already includes `.band`, no separate `weightBand` call needed here); the new `pageSectionCounts` from this task's own Step 2.
- Produces: `export function pageSectionCounts(pageStackEl)` → `Array<{page:number, counts:Record<string,number>}>`, one entry per `.paper` child of `pageStackEl`, tallying `[data-section-variant]` descendants by their `dataset.sectionVariant` value. Not pure (reads live DOM) — deliberately kept in `pdf-weight.js` next to the cost tables it depends on conceptually, per spec §4.2's split (REQ-013-01 only covers `estimateWeight` itself being pure, not this file as a whole).

- [ ] **Step 1: Add markup to `app/index.html`**

Badge: inside `.appbar-actions`, between the `.save-state` span and the `#printPDF` button (this is where `#siteSettings` used to sit before it was removed):
```html
<span id="weightBadge" class="weight-badge" data-band="leve" title="Peso estimado do PDF">~0 KB</span>
```
Tab button (append after the existing `ai` tab button, same line style as lines 107–111):
```html
<button role="tab" id="inspector-tab-weight" aria-controls="inspector-weight" aria-selected="false" tabindex="-1" data-inspector-tab="weight"><ds-icon name="gauge" size="13"></ds-icon><span>Peso</span></button>
```
Panel (append after the existing `ai` panel, same wrapper style as lines 114–217):
```html
<section class="inspector-panel hidden" id="inspector-weight" role="tabpanel" aria-labelledby="inspector-tab-weight" data-inspector-panel="weight">
 <p class="property-hint">Estimativa offline calibrada — não é o byte exato. Confira o real depois de exportar.</p>
 <div id="weightPerPage"></div>
 <div id="weightContributors"></div>
</section>
```
No change needed to `property-inspector.js` — `initializeInspector`/`setInspectorTab` already operate generically over every `[data-inspector-tab]`/`[data-inspector-panel]` pair in the DOM.

- [ ] **Step 2: Add `pageSectionCounts` to `app/pdf-weight.js`**

```js
export function pageSectionCounts(pageStackEl){
 if(!pageStackEl)return [];
 return [...pageStackEl.querySelectorAll(':scope > .paper')].map((paper,i)=>{
  const counts={};
  for(const el of paper.querySelectorAll('[data-section-variant]'))counts[el.dataset.sectionVariant]=(counts[el.dataset.sectionVariant]||0)+1;
  return {page:i+1,counts};
 });
}
```

- [ ] **Step 3: Wire it into `app/app.js`**

Add `pageSectionCounts,estimateWeight,weightBand` to the existing `pdf-weight.js`... — this is a **new** import line (file wasn't imported in `app.js` before): `import {estimateWeight,pageSectionCounts} from './pdf-weight.js';`. Add a `renderWeightEstimate(t)` function that: calls `pageSectionCounts($('pageStack'))`; sums all pages' `counts` into one `sectionPresetCounts` object for the total; calls `estimateWeight({pages:livePagePlan.pages.length, backgroundKind:t.backgroundStyle.kind, sectionPresetCounts, font:t.font})`; sets `$('weightBadge').textContent` to a human label (`<1024?Math.round(kib)+' KB':(kib/1024).toFixed(1)+' MB'`, matching the existing label style in `inspectPDFFile`) and `$('weightBadge').dataset.band=result.band`; renders `perItem` into `#weightContributors` and the per-page breakdown (one `estimateWeight` call per page using that page's own `counts`, `pages:1`) into `#weightPerPage`; returns the computed `band`. Call `renderWeightEstimate(t)` from inside `runPaginationNow(t)` right after the existing `inspectorPageSummary(livePagePlan.pages.length,livePagePlan.diagnostics);` line (`app/app.js:52`) — this reuses the pagination routine's existing debounce, no new timer needed.

Track whether the pagination that just completed was triggered by "Surpreenda-me" (a module-level flag, e.g. `let lastChangeWasSurprise=false;`, set `true` at the end of the existing `randomizeFullDesign()` and cleared back to `false` at the start of `runPaginationNow`, after it's been read). If `lastChangeWasSurprise` is true and `renderWeightEstimate(t)` returns `band==='pesado'`, override the existing "Novo visual: tipografia, composição..." toast (`app/app.js:684`) with an honest one instead, e.g. `toast('Visual pesado (~'+label+'). Rode Surpreenda-me de novo ou trave uma seção.')` — a disclosed best-effort signal, not a blocking retry (see Global Constraints note on REQ-013-06).

- [ ] **Step 4: Add badge styling to `app/studio.css`**, near the other `.topbar #printPDF` rule: a small pill with `[data-band="leve"]`/`[data-band="atencao"]`/`[data-band="pesado"]` background/text colors using the existing `--ds-success`/`--ds-warning`/`--ds-danger` tokens (already defined for the `mdress` theme in `app/design-system/mdress-palette.css`).

- [ ] **Step 5: Add a smoke check to `scripts/e2e.mjs`**

After an existing content-edit step, add: open the design panel, click `[data-inspector-tab="weight"]`, assert `$('weightBadge')`'s text matches `/\d/` (non-empty, numeric) and `data-band` is one of `leve|atencao|pesado`; switch the default section preset to `glass` via the existing `.section-style-preset[data-section-preset="glass"]` click pattern, and assert the badge's numeric value strictly increased. Then click `#surpriseButton`-equivalent (check the actual id bound to `randomizeFullDesign` in `app.js`'s `bind()`) 10 times in a row with no lock active, and assert `$('weightBadge').dataset.band` is never `'pesado'` on more than, say, 2 of the 10 draws (documents the best-effort nature from Global Constraints rather than asserting a hard 0, which the architecture can't promise).

- [ ] **Step 6: Manual visual verification**

Start the dev server, open the app in a browser (or via the `run` skill's Playwright/chromium-cli pattern used earlier in this project), confirm the badge renders with readable contrast in the `mdress` theme and the "Peso" tab shows a non-empty breakdown. Screenshot before calling this done — this is a visual/CSS change and must be rendered and checked, not just reasoned about.

- [ ] **Step 7: Run `npm test` and `node scripts/e2e.mjs` (against a running dev server) to confirm no regressions.**

- [ ] **Step 8: Commit**

```bash
git add app/index.html app/pdf-weight.js app/app.js app/studio.css scripts/e2e.mjs
git commit -m "feat(weight): show live PDF weight badge and per-page breakdown in the editor"
```
