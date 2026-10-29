import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {renderUxQaGallery} from '../scripts/ux-qa-gallery.mjs';
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS,summarizeScreenshotCoverage} from '../scripts/ux-qa-coverage.mjs';

const all=UX_QA_MATRIX.flatMap(({theme,width})=>UX_QA_REQUIRED_SCREENSHOTS.map(state=>({
 theme,width,state,path:'test-results/ux-audit/supervised/'+theme+'-'+width+'-'+state+'.png'
})));

test('offline gallery renders the full comparison matrix and supports filtering',()=>{
 const html=renderUxQaGallery(all,summarizeScreenshotCoverage(all));
 const stateCount=UX_QA_REQUIRED_SCREENSHOTS.length;
 assert.match(html,/<html lang="pt-BR">/);
 assert.match(html,/id="filter"/);
 assert.match(html,/id="review-progress"/);
 assert.match(html,/id="export-review"/);
 assert.match(html,/id="only-pending"/);
 assert.equal((html.match(/class="review-status"/g)||[]).length,stateCount);
 assert.equal((html.match(/class="review-note"/g)||[]).length,stateCount);
 assert.equal((html.match(/class="image-warning"/g)||[]).length,stateCount);
 assert.equal((html.match(/class="review-status" disabled/g)||[]).length,stateCount);
 assert.match(html,/async function verifyImages/);
 assert.match(html,/await candidate\.decode\(\)/);
 assert.match(html,/candidate\.removeAttribute\("src"\)/);
 assert.match(html,/fetch\(source\.href,\{cache:"no-store"\}\)/);
 assert.match(html,/createImageBitmap\(await response\.blob\(\)\)/);
 assert.match(html,/bitmap\.close\(\)/);
 assert.match(html,/actualWidth!==expectedWidth/);
 assert.match(html,/actualHeight!==expectedHeight/);
 assert.match(html,/data-theme="graphite" data-viewport-width="1440" data-viewport-height="900"/);
 assert.match(html,/previousTheme=previous\?\.dataset\.theme/);
 assert.match(html,/if\(event\.shiftKey\)moveViewerState/);
 assert.match(html,/await verifyImages\(states\[offset\],\{fresh:true\}\)/);
 assert.match(html,/source\.searchParams\.set\("mdress-verify"/);
 assert.match(html,/id="image-viewer"/);
 assert.match(html,/viewer\.showModal\(\)/);
 assert.match(html,/origin\.focus\(\)/);
 assert.match(html,/requestAnimationFrame/);
 assert.match(html,/id="viewer-status"/);
 assert.match(html,/id="viewer-note"/);
 assert.match(html,/id="viewer-next-state"/);
 assert.match(html,/function setViewerSection/);
 assert.match(html,/viewerOrigin=viewerImages\[viewerIndex\]\?\.closest\("a"\)\|\|viewerOrigin/);
 assert.match(html,/event\.target\.closest\("input,textarea,select,\[contenteditable\]"\)/);
 assert.match(html,/Verificando capturas:/);
 assert.match(html,/color-draft-sync/);
 assert.match(html,/binary-disabled-focus-handoff/);
 assert.match(html,/segment-live-focus-handoff/);
 assert.match(html,/graphite-1440-workspace.png/);
 assert.equal((html.match(/<figure data-theme=/g)||[]).length,all.length);
 assert.equal(UX_QA_MATRIX.length,8,'Mobile 390px is a required QA viewport for both themes');
 assert.equal((html.match(/<details class="state"/g)||[]).length,stateCount);
});

test('invalid evidence path is not inserted as HTML or a clickable link',()=>{
 const invalid=all.map((entry,index)=>index===0?{...entry,path:'"><script>alert(1)</script>'}:entry);
 const html=renderUxQaGallery(invalid,summarizeScreenshotCoverage(invalid));
 assert.doesNotMatch(html,/<script>alert/);
 assert.match(html,/Captura ausente ou inválida/);
 assert.equal((html.match(/<figure data-theme=/g)||[]).length,all.length-1);
});

test('gallery review session is isolated and JSON-safe',()=>{
 const html=renderUxQaGallery(all,summarizeScreenshotCoverage(all),'session-2026-10-28');
 assert.match(html,/session-2026-10-28/);
 assert.match(html,/localStorage/);
 assert.match(html,/mdress-ux023-review:/);
 assert.match(html,/application\/json/);
 assert.match(html,/URL.createObjectURL/);
 assert.match(html,/rejected/);
});
