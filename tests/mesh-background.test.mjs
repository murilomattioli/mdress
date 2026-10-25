import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {meshSeed,validateMeshPoints,meshCSS} from '../app/mesh-background.js';
import {validateTheme,defaults,backgroundCSS,themeCode,decodeTheme} from '../app/resume-themes.js';
import {backgroundPresets,applyBackgroundPreset} from '../app/background-presets.js';
test('mesh gradient consists of static radial layers',()=>{
 const theme=validateTheme({...defaults,backgroundStyle:{kind:'mesh',points:meshSeed.map(x=>({...x})),softness:82}});
 assert.equal((backgroundCSS(theme).match(/radial-gradient/g)||[]).length,3);
 assert.doesNotMatch(backgroundCSS(theme),/url\(|script|data:/i);
});
test('all curated mesh recipes validate',()=>{
 const meshes=backgroundPresets.filter(p=>p.kind==='mesh');
 assert.equal(meshes.length,4);
 for(const preset of meshes){
  const theme=validateTheme(applyBackgroundPreset(defaults,preset));
  assert.equal(theme.background,preset.background);
  assert.equal(theme.backgroundStyle.points.length,3);
  assert.match(backgroundCSS(theme),/radial-gradient/);
 }
});
test('reject invalid color points, excessive points and injection',()=>{
 assert.throws(()=>validateMeshPoints([meshSeed[0]],true));
 assert.throws(()=>validateMeshPoints([...meshSeed,...meshSeed,...meshSeed],true));
 assert.throws(()=>validateMeshPoints([{...meshSeed[0],color:'url(http://bad)'},meshSeed[1]],true));
 assert.throws(()=>validateMeshPoints([{...meshSeed[0],onload:'alert(1)'},meshSeed[1]],true));
 assert.throws(()=>validateMeshPoints([{...meshSeed[0],x:-20},meshSeed[1]],true));
 assert.throws(()=>validateTheme({...defaults,backgroundStyle:{kind:'mesh',points:[]}}));
});
test('shared mesh preserves color point positions and softness',()=>{
 const original=validateTheme({...defaults,backgroundStyle:{kind:'mesh',softness:76,points:meshSeed.map(p=>({...p}))}});
 assert.deepEqual(decodeTheme(themeCode(original)),original);
});
test('legacy theme migrates missing point/softness properties',()=>{
 const theme=validateTheme({theme:'swiss',backgroundStyle:{kind:'dots',patternSize:19}});
 assert.deepEqual(theme.backgroundStyle.points,[]);
 assert.equal(theme.backgroundStyle.softness,80);
});
