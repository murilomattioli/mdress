import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {menuScrollDelta,nextAvailableMenuItem,inspectorMenuLabel} from '../app/design-system/inspector-header.js';

const viewport={top:20,bottom:220};

test('menu focus scrolls only when the action is clipped',()=>{
 assert.equal(menuScrollDelta({top:60,bottom:96},viewport),0);
 assert.equal(menuScrollDelta({top:10,bottom:46},viewport),-14);
 assert.equal(menuScrollDelta({top:200,bottom:236},viewport),20);
});

test('menu focus respects its inner padding at both boundaries',()=>{
 assert.equal(menuScrollDelta({top:24,bottom:60},viewport),0);
 assert.equal(menuScrollDelta({top:180,bottom:216},viewport),0);
 assert.equal(menuScrollDelta({top:23,bottom:60},viewport),-1);
 assert.equal(menuScrollDelta({top:180,bottom:217},viewport),1);
});

test('dynamic menu permissions restore the closest following item before wrapping',()=>{
 const all=['A','B','C','D','E'];
 assert.equal(nextAvailableMenuItem(all,['A','C','E'],'B'),'C');
 assert.equal(nextAvailableMenuItem(all,['A','B','D','E'],'C'),'D');
 assert.equal(nextAvailableMenuItem(all,['A','B','C','D'],'E'),'D');
 assert.equal(nextAvailableMenuItem(all,['A'],'E'),'A');
});

test('menu focus fallback is safe for removed or entirely unavailable items',()=>{
 const all=['A','B','C'];
 assert.equal(nextAvailableMenuItem(all,['B'],'removed'),'B');
 assert.equal(nextAvailableMenuItem(all,[],'B'),null);
 assert.equal(nextAvailableMenuItem(all,[],'removed'),null);
});

test('oversized menu actions align once and never bounce between edges',()=>{
 const viewport={top:20,bottom:100};
 assert.equal(menuScrollDelta({top:130,bottom:260},viewport),106);
 assert.equal(menuScrollDelta({top:24,bottom:154},viewport),0);
 assert.equal(menuScrollDelta({top:-20,bottom:110},viewport),-44);
 assert.equal(menuScrollDelta({top:24,bottom:154},viewport),0);
});

test('inspector action menu names follow aria-label, visible text and empty fallback',()=>{
 const toggle={label:null,textContent:'  Título inicial  ',getAttribute(name){return name==='aria-label'?this.label:null;}};
 assert.equal(inspectorMenuLabel(toggle),'Opções de Título inicial');
 toggle.label='  Seção renomeada  ';
 assert.equal(inspectorMenuLabel(toggle),'Opções de Seção renomeada');
 toggle.label='';toggle.textContent='  Outro nome  ';
 assert.equal(inspectorMenuLabel(toggle),'Opções de Outro nome');
 toggle.textContent='  ';
 assert.equal(inspectorMenuLabel(toggle),'Opções de seção');
});
