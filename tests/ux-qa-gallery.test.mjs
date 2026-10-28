import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {renderUxQaGallery} from '../scripts/ux-qa-gallery.mjs';
import {UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS,summarizeScreenshotCoverage} from '../scripts/ux-qa-coverage.mjs';

const all=UX_QA_MATRIX.flatMap(({theme,width})=>UX_QA_REQUIRED_SCREENSHOTS.map(state=>({
 theme,width,state,path:'test-results/ux-audit/supervised/'+theme+'-'+width+'-'+state+'.png'
})));

test('offline gallery renders all 276 comparisons and supports filtering',()=>{
 const html=renderUxQaGallery(all,summarizeScreenshotCoverage(all));
 assert.match(html,/<html lang="pt-BR">/);
 assert.match(html,/id="filter"/);
 assert.match(html,/color-draft-sync/);
 assert.match(html,/binary-disabled-focus-handoff/);
 assert.match(html,/graphite-1440-workspace.png/);
 assert.equal((html.match(/<figure>/g)||[]).length,276);
 assert.equal((html.match(/<details class="state"/g)||[]).length,46);
});

test('invalid evidence path is not inserted as HTML or a clickable link',()=>{
 const invalid=all.map((entry,index)=>index===0?{...entry,path:'"><script>alert(1)</script>'}:entry);
 const html=renderUxQaGallery(invalid,summarizeScreenshotCoverage(invalid));
 assert.doesNotMatch(html,/<script>alert/);
 assert.match(html,/Captura ausente ou inválida/);
 assert.equal((html.match(/<figure>/g)||[]).length,275);
});
