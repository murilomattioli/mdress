import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:900}});
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4174');await page.locator('#designToggle').click();
 for(const width of [1024,390]){
  await page.setViewportSize({width,height:900});
  for(const name of ['Cores e fundo','Estilos prontos']){
   await page.locator('[data-inspector-tab='+(name==='Estilos prontos'?'themes':'document')+']').click();
   const toggle=page.getByRole('button',{name,exact:true}),header=toggle.locator('..'),chevron=header.locator('.ds-accordion-chevron');
   await header.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
   const initial=await chevron.boundingBox();
   for(const target of [header.locator('.ds-accordion-title'),chevron]){
    await target.hover();
    const samples=await chevron.evaluate(async el=>{const list=[];for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect();list.push({x:r.x,y:r.y});}return list;});
    assert.ok(samples.every(r=>Math.abs(r.x-initial.x)<1&&Math.abs(r.y-initial.y)<1),'Chevron must not move or oscillate on hover');
   }
   const before=await toggle.getAttribute('aria-expanded');await chevron.click();assert.notEqual(await toggle.getAttribute('aria-expanded'),before);await toggle.click();
  }
  await page.locator('#toast.show').waitFor({state:'hidden'});
  await page.locator('.design-inspector').screenshot({path:`test-results/accordion-hover-${width}.png`});
 }
 console.log('Chevron stable over 24 animation frames on title/chevron hover; click works at 1024/390.');
}finally{await browser.close();}
