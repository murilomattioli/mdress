import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {googleFamily,googleStack,fontCSSURL} from '../app/google-fonts.js';
import {validateTheme,resolveFont,themeCode,decodeTheme} from '../app/resume-themes.js';
const families=JSON.parse(readFileSync(new URL('../app/google-fonts-catalog.json',import.meta.url))).families;
test('catalog families are valid and request only available variants',()=>{
 assert.ok(families.length>1900);
 for(const entry of families){
  assert.equal(googleFamily('google:'+entry.family),entry.family);
  const url=fontCSSURL(entry);assert.ok(url.endsWith('&display=swap'));
  const tuples=url.split('@')[1].split('&')[0].split(';');
  assert.ok(tuples.length>0&&tuples.length<=4);
  for(const tuple of tuples){const [italic,weight]=tuple.split(',');assert.ok(entry.variants.includes(weight+(italic==='1'?'i':'')),entry.family);}
 }
});
test('Google font survives theme sharing and rejects CSS injection',()=>{
 const theme=validateTheme({font:'google:Lora'});assert.equal(decodeTheme(themeCode(theme)).font,'google:Lora');
 assert.equal(resolveFont(theme.font),'"Lora", Arial, sans-serif');
 for(const value of ['google:bad";color:red','google:url(evil)','google:'])assert.throws(()=>validateTheme({font:value}));
 assert.equal(googleStack('system'),null);
});
