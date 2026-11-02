import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {defaults} from '../app/resume-themes.js';
import {themeRecipes,recipeTheme,shuffleTheme,contrastRatio} from '../app/theme-explorer.js';
test('curated Markdown themes cover different document styles and stay readable',()=>{
 assert.ok(themeRecipes.length>=9);
 for(const recipe of themeRecipes){
  const theme=recipeTheme(recipe.id,defaults);
  assert.ok(contrastRatio(theme.text,theme.background)>=4.5,recipe.id+' has insufficient contrast');
 }
});
test('each lock preserves its entire property group when themes are shuffled',()=>{
 const base=recipeTheme('technical-blue');
 const locks={colors:true,typography:true,spacing:true,background:true};
 assert.deepEqual(shuffleTheme(base,locks,()=>0.6),base);
 const modified=recipeTheme('editorial-ivory',base,{colors:true,background:true});
 assert.equal(modified.text,base.text);assert.equal(modified.accent,base.accent);
 assert.equal(modified.background,base.background);assert.deepEqual(modified.backgroundStyle,base.backgroundStyle);
 const typographyLocked=recipeTheme('aurora-night',base,{typography:true});
 assert.equal(typographyLocked.font,base.font);assert.equal(typographyLocked.size,base.size);
});
test('shuffling supports deterministic choices with unlocked groups',()=>{
 const sample=recipeTheme('modernist');
 const a=shuffleTheme(sample,{typography:true},()=>0);
 const b=shuffleTheme(sample,{typography:true},()=>0);
 assert.deepEqual(a,b);assert.equal(a.font,sample.font);
 assert.throws(()=>shuffleTheme(sample,{},()=>Infinity));
});

test('shuffle never picks the single heaviest-cost background kind when lighter alternatives exist',()=>{
 // 'grid' (blueprint recipe, 46 KiB) is the single most expensive kind among the curated
 // recipes — every other draw has a cheaper alternative available, so it should never win.
 const base=recipeTheme('modernist');
 for(let s=0;s<1;s+=0.02){
  const r=shuffleTheme(base,{},s);
  assert.notEqual(r.backgroundStyle.kind,'grid','seed '+s+' picked the heaviest available kind');
 }
});
