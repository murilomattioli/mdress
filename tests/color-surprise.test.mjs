import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {defaults,validateTheme} from '../app/resume-themes.js';
import {getBackgroundPreset,applyBackgroundPreset} from '../app/background-presets.js';
import {contrastRatio} from '../app/theme-explorer.js';
import {colorPalettes,shuffleColors,recolorTheme,colorPreview} from '../app/color-surprise.js';

test('curated color palettes are accessible, unique and independent of typography',()=>{
 const ids=new Set(colorPalettes.map(p=>p.id));
 assert.equal(ids.size,colorPalettes.length);
 assert.ok(ids.size>=12);
 for(const palette of colorPalettes){
  const out=recolorTheme(defaults,palette);
  assert.ok(out,'Invalid colors for '+palette.id);
  assert.ok(contrastRatio(out.text,out.background)>=4.5,palette.id+': text contrast');
  assert.ok(contrastRatio(out.accent,out.background)>=3,palette.id+': accent contrast');
  assert.equal(out.font,defaults.font);
  assert.equal(out.size,defaults.size);
  assert.equal(out.paper,defaults.paper);
  assert.deepEqual(out.layout,defaults.layout);
  assert.equal(out.backgroundStyle.kind,defaults.backgroundStyle.kind);
 }
});

test('recolor preserves background kind, size, angle, softness and mesh point geometry',()=>{
 const mesh=validateTheme(applyBackgroundPreset(defaults,getBackgroundPreset('mesh-soft')));
 const original=structuredClone(mesh);
 const chosen=colorPalettes.find(p=>p.id==='iris');
 const out=recolorTheme(mesh,chosen);
 assert.equal(out.backgroundStyle.kind,'mesh');
 for(const property of ['angle','patternSize','opacity','softness']){
  assert.equal(out.backgroundStyle[property],mesh.backgroundStyle[property],property);
 }
 assert.equal(out.backgroundStyle.points.length,mesh.backgroundStyle.points.length);
 for(const [i,point] of out.backgroundStyle.points.entries()){
  const {color:oldColor,...before}=mesh.backgroundStyle.points[i];
  const {color,...after}=point;
  assert.deepEqual(after,before);
  assert.equal(color,chosen.mesh[i%chosen.mesh.length]);
  assert.notEqual(color,oldColor);
 }
 assert.deepEqual(mesh,original,'Source theme was mutated');
});
test('shuffling color-only leaves font, layout and full background geometry untouched',()=>{
 const base=validateTheme(applyBackgroundPreset(defaults,getBackgroundPreset('mesh-aurora')));
 const next=shuffleColors(base,{},0.51);
 assert.equal(next.font,base.font);
 assert.equal(next.size,base.size);
 assert.equal(next.theme,base.theme);
 assert.equal(next.paper,base.paper);
 assert.deepEqual(next.layout,base.layout);
 assert.equal(next.backgroundStyle.kind,base.backgroundStyle.kind);
 for(const key of ['angle','patternSize','opacity','softness'])assert.equal(next.backgroundStyle[key],base.backgroundStyle[key]);
 const currentGeometry=base.backgroundStyle.points.map(({color,...rest})=>rest);
 const newGeometry=next.backgroundStyle.points.map(({color,...rest})=>rest);
 assert.deepEqual(currentGeometry,newGeometry);
 assert.ok(contrastRatio(next.text,next.background)>=4.5);
 assert.notDeepEqual(colorPreview(next),colorPreview(base));
});
test('locks are honored: background locks base/secondary/mesh colors, color lock keeps text/accent',()=>{
 const base=validateTheme(applyBackgroundPreset(defaults,getBackgroundPreset('mesh-soft')));
 const onBackgroundLock=shuffleColors(base,{background:true},0.5);
 assert.equal(onBackgroundLock.background,base.background);
 assert.deepEqual(onBackgroundLock.backgroundStyle,base.backgroundStyle);
 const onColorLock=shuffleColors(base,{colors:true},0.5);
 assert.equal(onColorLock.text,base.text);
 assert.equal(onColorLock.accent,base.accent);
 assert.deepEqual(shuffleColors(base,{background:true,colors:true},0.5),base);
});
test('invalid values, incompatible locked combinations and seed boundaries are safe',()=>{
 const base=validateTheme(defaults);
 assert.throws(()=>shuffleColors(base,{},NaN));
 assert.throws(()=>shuffleColors(base,{},-0.1));
 assert.throws(()=>shuffleColors(base,{},()=>1.01));
 assert.throws(()=>recolorTheme(base,{id:'invalid'}));
 const earliest=shuffleColors(base,{},0);
 const latest=shuffleColors(base,{},1);
 assert.ok(contrastRatio(earliest.text,earliest.background)>=4.5);
 assert.ok(contrastRatio(latest.text,latest.background)>=4.5);
});
