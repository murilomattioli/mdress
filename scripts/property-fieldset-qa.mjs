import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output='test-results/ux-audit';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.evaluate(async()=>{
  const {enhancePropertyControls}=await import('/design-system/property-controls.js');
  window.EyeDropper=class {open(){return new Promise(resolve=>{window.__ux23ResolveDropper=resolve;});}};
  const host=document.createElement('section');
  host.id='ux23-inherited';host.className='design-inspector';
  host.style.cssText='position:fixed;top:60px;left:12px;width:350px;max-width:calc(100vw - 24px);height:760px;overflow:auto;padding:12px;z-index:2147483640;background:var(--ds-panel,white);color:var(--ds-text,#222)';
  host.innerHTML=[
   '<button type="button">Antes</button><fieldset id="ux23-permissions"><legend>Propriedades</legend>',
   '<label class="property-row">Faixa <input id="ux23-range" type="range" min="0" max="10" step="1" value="5"></label>',
   '<label class="property-row">Número <input id="ux23-number" type="number" min="0" max="10" step="1" value="5"></label>',
   '<label class="property-row">Cor <input id="ux23-color" type="color" value="#336699"></label>',
   '<label class="property-row">Alternância <input id="ux23-binary" type="checkbox"></label>',
   '<label class="property-row">Segmento <select id="sectionRule"><option value="line">Linha</option><option value="none">Nenhum</option><option value="block">Bloco</option></select></label>',
   '<label class="property-row">Escolha <select id="ux23-choice"><option value="a">Alpha</option><option value="b">Beta</option></select></label>',
   '</fieldset><button type="button">Depois</button>',
   '<fieldset disabled><legend><label class="property-row">Primeira legenda <select id="ux23-legend"><option>Ativo</option></select></label></legend>',
   '<label class="property-row">Fora da legenda <select id="ux23-blocked"><option>Inativo</option></select></label></fieldset>'
  ].join('');
  document.body.append(host);enhancePropertyControls(host);
 });
 const host=page.locator('#ux23-inherited');
 const state=()=>page.evaluate(()=>{
  const root=document.querySelector('#ux23-inherited');
  const q=s=>root.querySelector(s),row=s=>q(s).closest('label');
  const buttons=(s,selector)=>[...row(s).querySelectorAll(selector)].map(el=>el.disabled);
  return {
   range:row('#ux23-range').querySelector('.ds-prop-number').disabled,
   rangeStep:buttons('#ux23-range','.ds-number-step'),
   number:q('#ux23-number').matches(':disabled'),
   numberStep:buttons('#ux23-number','.ds-number-step'),
   slider:row('#ux23-number').querySelector('.ds-scrub-range').disabled,
   hex:row('#ux23-color').querySelector('.ds-color-hex').disabled,
   pipette:row('#ux23-color').querySelector('.ds-color-pipette').disabled,
   binary:buttons('#ux23-binary','.ds-binary-option'),
   segment:buttons('#sectionRule','.ds-segment-option'),
   select:row('#ux23-choice').querySelector('.ds-select-trigger').disabled,
   legend:row('#ux23-legend').querySelector('.ds-select-trigger').disabled,
   blocked:row('#ux23-blocked').querySelector('.ds-select-trigger').disabled,
   values:[q('#ux23-range').value,q('#ux23-number').value,q('#ux23-color').value,q('#ux23-binary').checked,q('#sectionRule').value,q('#ux23-choice').value]
  };
 });
 const before=await state();
 assert.equal(before.range,false);assert.deepEqual(before.rangeStep,[false,false]);
 assert.equal(before.number,false);assert.deepEqual(before.numberStep,[false,false]);
 assert.equal(before.slider,false);assert.equal(before.hex,false);assert.equal(before.pipette,false);
 assert.deepEqual(before.binary,[false,false]);assert.deepEqual(before.segment,[false,false,false]);
 assert.equal(before.select,false);assert.equal(before.legend,false);assert.equal(before.blocked,true);
 await host.screenshot({path:output+'/fieldset-enabled-390.png',animations:'disabled'});
 // Revocation in the same task must invalidate a pending native EyeDropper.
 await host.locator('#ux23-color').evaluate(el=>el.closest('label').querySelector('.ds-color-pipette').click());
 await page.waitForFunction(()=>typeof window.__ux23ResolveDropper==='function');
 await host.locator('#ux23-permissions').evaluate(el=>{el.disabled=true;el.disabled=false;el.disabled=true;});
 await page.waitForFunction(()=>document.querySelector('#ux23-choice').closest('label').querySelector('.ds-select-trigger').disabled);
 const blocked=await state();
 assert.equal(blocked.range,true);assert.deepEqual(blocked.rangeStep,[true,true]);
 assert.equal(blocked.number,true);assert.deepEqual(blocked.numberStep,[true,true]);
 assert.equal(blocked.slider,true);assert.equal(blocked.hex,true);assert.equal(blocked.pipette,true);
 assert.deepEqual(blocked.binary,[true,true]);assert.deepEqual(blocked.segment,[true,true,true]);
 assert.equal(blocked.select,true);assert.equal(blocked.legend,false);assert.equal(blocked.blocked,true);
 await host.locator('#ux23-permissions').evaluate(el=>{
  for(const selector of ['.ds-number-step','.ds-binary-option','.ds-segment-option','.ds-select-trigger','.ds-color-pipette'])
   el.querySelector(selector)?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 });
 assert.deepEqual((await state()).values,before.values,'Disabled actions must not edit the document');
 assert.equal(await page.locator('.ds-select-popover:popover-open').count(),0);
 await host.screenshot({path:output+'/fieldset-disabled-390.png',animations:'disabled'});
 await host.locator('#ux23-permissions').evaluate(el=>{el.disabled=false;});
 await page.waitForFunction(()=>!document.querySelector('#ux23-choice').closest('label').querySelector('.ds-select-trigger').disabled);
 await page.evaluate(()=>window.__ux23ResolveDropper({sRGBHex:'#ff00ff'}));
 await page.waitForTimeout(80);
 const restored=await state();
 assert.equal(restored.values[2],'#336699','Stale EyeDropper must not commit');
 assert.equal(restored.range,false);assert.equal(restored.number,false);
 assert.equal(restored.hex,false);assert.equal(restored.pipette,false);
 assert.deepEqual(restored.binary,[false,false]);assert.deepEqual(restored.segment,[false,false,false]);
 assert.equal(restored.select,false);
 await host.locator('#ux23-binary').evaluate(el=>el.closest('label').querySelectorAll('.ds-binary-option')[1].click());
 assert.equal((await state()).values[3],true,'Re-enabled controls must work');
 await host.screenshot({path:output+'/fieldset-restored-390.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('Inherited fieldset QA passed: six control types, first legend, stale EyeDropper; three screenshots.');
}finally{await browser.close();}
