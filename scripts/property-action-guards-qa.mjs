import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('test-results/ux-audit',{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.MDRESS_AUDIT_URL||'http://127.0.0.1:4173');
 await page.locator('#designToggle').click();
 const result=await page.evaluate(async()=>{
  const {enhancePropertyControls}=await import('/design-system/property-controls.js');
  const panel=document.querySelector('#inspector-document');
  if(!panel)throw Error('Missing inspector document panel');
  const fixtures=[];
  const make=(kind,legend=false)=>{
   const fieldset=document.createElement('fieldset');
   fieldset.dataset.ux23PropertyGuard=kind;
   const heading=document.createElement('legend');heading.textContent='Permissões numéricas';
   const label=document.createElement('label');label.className='property-row';
   label.append(document.createTextNode('Controle '+kind+' '));
   const source=document.createElement('input');source.type=kind;
   if(kind==='color')source.value='#336699';
   else{source.min='0';source.max='10';source.step='1';source.setAttribute('value','4');source.value='4';}
   label.append(source);
   if(legend){heading.append(label);fieldset.append(heading);}
   else fieldset.append(heading,label);
   panel.append(fieldset);fixtures.push(fieldset);
   enhancePropertyControls(document);
   let changes=0;source.addEventListener('change',()=>changes++);
   const step=label.querySelector('.ds-scrub-step:last-child');
   const hex=label.querySelector('.ds-color-hex');
   const act=()=>{
    if(kind==='color'){
     hex.value='#112233';hex.dispatchEvent(new Event('change',{bubbles:true}));
    }else step.dispatchEvent(new MouseEvent('click',{bubbles:true}));
   };
   return {fieldset,label,source,act,changes:()=>changes};
  };
  const checks={};
  const assertBlocked=(name,fixture,action=fixture.act)=>{
   const before=fixture.source.value,changes=fixture.changes();
   action();
   checks[name]=fixture.source.value===before&&fixture.changes()===changes;
  };
  for(const kind of ['range','number','color']){
   const f=make(kind);
   f.fieldset.disabled=true;
   assertBlocked(kind+'Fieldset',f);
   f.fieldset.disabled=false;
   f.fieldset.setAttribute('aria-disabled','true');
   assertBlocked(kind+'Aria',f);
   f.fieldset.removeAttribute('aria-disabled');
   f.fieldset.inert=true;assertBlocked(kind+'Inert',f);f.fieldset.inert=false;
   f.fieldset.hidden=true;assertBlocked(kind+'Hidden',f);f.fieldset.hidden=false;
   f.fieldset.style.display='none';assertBlocked(kind+'Display',f);f.fieldset.style.display='';
   f.fieldset.style.contentVisibility='hidden';
   assertBlocked(kind+'ContentVisibility',f);f.fieldset.style.contentVisibility='';
   // CSS visibility can be overridden on descendants. Revoke the actual
   // interactive target, rather than assuming every hidden ancestor wins.
   const target=kind==='color'?f.label.querySelector('.ds-color-hex'):
    f.label.querySelector('.ds-scrub-step:last-child');
   target.style.visibility='hidden';
   assertBlocked(kind+'Visibility',f);target.style.visibility='';
   if(kind==='range'){
    const numeric=f.label.querySelector('.ds-prop-number');
    const progress=f.label.querySelector('.ds-prop-track');
    f.fieldset.setAttribute('aria-disabled','true');
    assertBlocked('rangePrecision',f,()=>{
     numeric.value='9';numeric.dispatchEvent(new Event('change',{bubbles:true}));
    });
    assertBlocked('rangeReset',f,()=>progress.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
    f.fieldset.removeAttribute('aria-disabled');
   }
   if(kind==='number'){
    const slider=f.label.querySelector('.ds-scrub-range');
    f.fieldset.setAttribute('aria-disabled','true');
    assertBlocked('numberSlider',f,()=>{
     slider.value='9';slider.dispatchEvent(new Event('input',{bubbles:true}));
    });
    f.fieldset.removeAttribute('aria-disabled');
   }
   const before=f.source.value;
   f.act();
   checks[kind+'Restored']=f.source.value!==before&&f.changes()===1;
   const detachedValue=f.source.value,detachedChanges=f.changes();
   f.fieldset.remove();f.act();
   checks[kind+'Detached']=f.source.value===detachedValue&&f.changes()===detachedChanges;
   const legend=make(kind,true);
   legend.fieldset.disabled=true;legend.act();
   checks[kind+'FirstLegend']=legend.source.value!==(kind==='color'?'#336699':'4')&&legend.changes()===1;
  }
  return {checks,fixtureCount:fixtures.length};
 });
 assert.deepEqual(Object.entries(result.checks).filter(([,ok])=>!ok),[],
  'Stale numeric/color actions must not commit after synchronous permission revocation');
 assert.equal(Object.keys(result.checks).length,33,'Expected all permission and recovery checks');
 await page.screenshot({path:'test-results/ux-audit/property-action-permissions.png',animations:'disabled'});
 await page.evaluate(()=>document.querySelectorAll('[data-ux23-property-guard]').forEach(el=>el.remove()));
 assert.deepEqual(errors,[],'No page errors during permission checks');
 console.log('Property action permission guards passed: '+Object.keys(result.checks).length+' checks, '+result.fixtureCount+' fixtures');
}finally{await browser.close();}
