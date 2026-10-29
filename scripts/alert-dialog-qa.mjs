import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/alerts',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4174');
 for(const width of [1440,390])for(const type of ['warning','danger','error','neutral','info','success']){
  await page.setViewportSize({width,height:900});await page.locator('#printPDF').focus();
  await page.evaluate(async type=>{const {confirmAlert}=await import('/design-system/alert-dialog.js');window.alertResult=null;confirmAlert({type,title:'Redefinir estilo?',description:'As cores e a tipografia serão restauradas. O conteúdo Markdown será mantido.',confirmLabel:'Redefinir estilo'}).then(value=>window.alertResult=value);},type);
  const dialog=page.getByRole('alertdialog');await dialog.waitFor();
  assert.equal(await dialog.locator('[data-alert-cancel]').evaluate(el=>el===document.activeElement),true);
  for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
  await page.screenshot({path:`test-results/alerts/${type}-${width}.png`,animations:'disabled'});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.alertResult===false);
  assert.equal(await page.locator('#printPDF').evaluate(el=>el===document.activeElement),true);
 }
 await page.evaluate(async()=>{const {showAlert}=await import('/design-system/alert-dialog.js');window.alertResults=[];showAlert({title:'Primeiro'}).then(x=>window.alertResults.push(x));showAlert({title:'Segundo'}).then(x=>window.alertResults.push(x));});
 await page.getByRole('alertdialog',{name:'Primeiro'}).waitFor();await page.locator('[data-alert-confirm]').click();
 await page.getByRole('alertdialog',{name:'Segundo'}).waitFor();await page.locator('[data-alert-confirm]').click();
 await page.waitForFunction(()=>window.alertResults.length===2);assert.deepEqual(await page.evaluate(()=>window.alertResults),[true,true]);
 console.log('Six variants, desktop/mobile, focus containment/restoration, Escape, queue and promise results passed.');
}finally{await browser.close();}

