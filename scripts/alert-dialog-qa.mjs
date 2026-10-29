import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results/alerts',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
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
 // A confirmation may outlive a deleted inspector control. Focus must
 // return to another live action, not disappear onto the document body.
 await page.evaluate(async()=>{
  const opener=document.createElement('button');
  opener.id='qa-removed-alert-origin';
  opener.textContent='Remover';
  document.body.append(opener);opener.focus();
  const {confirmAlert}=await import('/design-system/alert-dialog.js');
  window.removedOriginResult=null;
  confirmAlert({title:'Controle removido',description:'Verificar retorno de foco.'})
   .then(value=>window.removedOriginResult=value);
  opener.remove();
 });
 const removedDialog=page.getByRole('alertdialog',{name:'Controle removido'});
 await removedDialog.waitFor({state:'visible'});
 await removedDialog.locator('[data-alert-cancel]').click();
 await page.waitForFunction(()=>window.removedOriginResult===false);
 const focus=await page.evaluate(()=>{
  const active=document.activeElement;
  return {body:active===document.body,visible:!!active?.getClientRects().length,
   disabled:!!active?.disabled,tag:active?.tagName,id:active?.id};
 });
 assert.equal(focus.body,false,'Deleted modal opener must not strand focus on body: '+JSON.stringify(focus));
 assert.equal(focus.visible,true,'Focus must move to a visible control: '+JSON.stringify(focus));
 assert.equal(focus.disabled,false,'Focus must not move to a disabled control: '+JSON.stringify(focus));
 console.log('Six variants, desktop/mobile, focus containment/restoration including deleted opener, Escape, queue and promise results passed.');
}finally{await browser.close();}

