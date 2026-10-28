import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {renderUxQaGallery} from '../scripts/ux-qa-gallery.mjs';
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS,summarizeScreenshotCoverage} from '../scripts/ux-qa-coverage.mjs';

const all=UX_QA_MATRIX.flatMap(({theme,width})=>UX_QA_REQUIRED_SCREENSHOTS.map(state=>({
 theme,width,state,path:'test-results/ux-audit/supervised/'+theme+'-'+width+'-'+state+'.png'
})));

test('offline gallery renders all 300 comparisons and supports filtering',()=>{
 const html=renderUxQaGallery(all,summarizeScreenshotCoverage(all));
 assert.match(html,/<html lang="pt-BR">/);
 assert.match(html,/id="filter"/);
 assert.match(html,/id="review-progress"/);
 assert.match(html,/id="export-review"/);
 assert.match(html,/id="only-pending"/);
 assert.equal((html.match(/class="review-status"/g)||[]).length,50);
 assert.equal((html.match(/class="review-note"/g)||[]).length,50);
 assert.equal((html.match(/class="image-warning"/g)||[]).length,50);
 assert.equal((html.match(/class="review-status" disabled/g)||[]).length,50);
 assert.match(html,/async function verifyImages/);
 assert.match(html,/await img\.decode\(\)/);
 assert.match(html,/await Promise\.all\(states\.map\(verifyImages\)\)/);
 assert.match(html,/color-draft-sync/);
 assert.match(html,/binary-disabled-focus-handoff/);
 assert.match(html,/segment-live-focus-handoff/);
 assert.match(html,/graphite-1440-workspace.png/);
 assert.equal((html.match(/<figure>/g)||[]).length,300);
 assert.equal((html.match(/<details class="state"/g)||[]).length,50);
});

test('invalid evidence path is not inserted as HTML or a clickable link',()=>{
 const invalid=all.map((entry,index)=>index===0?{...entry,path:'"><script>alert(1)</script>'}:entry);
 const html=renderUxQaGallery(invalid,summarizeScreenshotCoverage(invalid));
 assert.doesNotMatch(html,/<script>alert/);
 assert.match(html,/Captura ausente ou inválida/);
 assert.equal((html.match(/<figure>/g)||[]).length,281);
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
