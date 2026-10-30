import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {testFiles} from '../scripts/run-tests.mjs';

const packageJson=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const smoke=readFileSync(new URL('../.github/workflows/browser-smoke.yml',import.meta.url),'utf8');
const runner=readFileSync(new URL('../scripts/supervised-ux-qa.mjs',import.meta.url),'utf8');

test('supervised QA is installable from declared development dependencies',()=>{
 assert.match(packageJson.devDependencies?.playwright||'',/^\d+\.\d+\.\d+$/,'Pin Playwright for reproducible QA');
 assert.equal(packageJson.scripts.test,'node scripts/run-tests.mjs','The test command must be independent of shell glob expansion and Node directory support');
 assert.ok(testFiles.length>0&&testFiles.every(file=>file.endsWith('.test.mjs')),'The cross-platform test runner must discover every Node test file explicitly');
 assert.equal(packageJson.scripts['qa:supervised'],'node scripts/supervised-ux-qa.mjs');
 assert.equal(packageJson.scripts['qa:automatic'],'node scripts/supervised-ux-qa.mjs --auto --headless');
 assert.match(runner,/from 'playwright'/);
 assert.match(smoke,/npm install --include=dev/,'CI must install declared dependencies, not an ad-hoc Playwright version');
 assert.match(smoke,/npx playwright install --only-shell chromium/);
});

test('UX QA records traces for failed scenarios without archiving successful runs',()=>{
 assert.match(runner,/context\.tracing\.start\(\{screenshots:true,snapshots:true,sources:true\}\)/);
 assert.match(runner,/if\(!scenarioPassed\)\{/);
 assert.match(runner,/context\.tracing\.stop\(\{path\}\)/);
 assert.match(runner,/else await context\.tracing\.stop\(\)/);
 assert.match(runner,/screenshots,traces,findings/,'Reports must link captured failure traces');
 assert.match(runner,/#toast\.show'\)\.waitFor\(\{state:'hidden'/,'Visual captures must wait for the startup toast to clear');
 assert.match(smoke,/supervised\/\*-trace\.zip/,'CI should preserve failure traces');
});

test('UX sign-off rechecks immutable screenshots instead of trusting a green report',()=>{
 assert.match(runner,/sha256:createHash\('sha256'\)\.update\(png\)\.digest\('hex'\)/,
  'Every screenshot must carry a capture-time SHA-256 fingerprint');
 assert.match(runner,/verifySourceBoundEvidence\(screenshots,sourceFingerprint\)/,
  'Interactive approval must verify screenshots against the live source revision');
 assert.match(runner,/const report=\{schema:6,/,
  'New fingerprint requirements must use a versioned report contract');
 const resume=readFileSync(new URL('../scripts/resume-ux-review.mjs',import.meta.url),'utf8');
 assert.match(resume,/verifySourceBoundEvidence\(report\.screenshots,currentSourceFingerprint\)/,
  'Resumed approval must use the same source-bound evidence verification');
 assert.match(resume,/verifyScreenshotEvidence\(screenshots,evidenceDirectory\)/,
  'Shared verification must still hash and decode every screenshot');
 assert.match(resume,/Captura modificada desde a sessão/,
  'Replacing a valid PNG must invalidate the human review');
});

test('stopping after capture preserves the completed viewport for safe resume',()=>{
 const checkpoint=runner.indexOf("await checkpoint(theme+'/'+width");
 const finalize=runner.indexOf('scenarioPassed=toolbarPassed&&inspectorPassed&&errors.length===0;',checkpoint);
 const cleanup=runner.indexOf('finally{',checkpoint);
 const coverage=runner.indexOf('coverage.push({theme,width,scenario:scenarioPassed',checkpoint);
 assert.ok(checkpoint>=0&&cleanup>checkpoint&&finalize>cleanup&&coverage>finalize,
  'Viewport status must be computed in finally, including when q stops at the checkpoint');
 assert.match(runner,/writeUxQaResumeCheckpoint\(reportPath,/,
  'Completed viewports must be saved for recovery after unexpected termination');
});
