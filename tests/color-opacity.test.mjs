import test from 'node:test';import assert from 'node:assert/strict';
import {validateTheme,themeColor,backgroundCSS,themeCode,decodeTheme} from '../app/resume-themes.js';
import {meshCSS,meshSeed} from '../app/mesh-background.js';
test('color opacity validates and survives shared theme serialization',()=>{const t=validateTheme({colorOpacity:{accent:0,text:.4,background:.5,secondary:.2}});assert.match(themeColor(t,'accent'),/,0\)/);assert.equal(decodeTheme(themeCode(t)).colorOpacity.text,.4);assert.throws(()=>validateTheme({colorOpacity:{text:2}}));assert.throws(()=>validateTheme({colorOpacity:{text:NaN}}));assert.equal(themeColor(validateTheme({}),'accent'),'#245f81');});
test('background and mesh include independent alpha',()=>{const t=validateTheme({backgroundStyle:{kind:'radial'},colorOpacity:{secondary:.2}});assert.match(backgroundCSS(t),/rgba\([^)]*,0.2\)/);assert.match(meshCSS(meshSeed.map(p=>({...p,opacity:0}))),/,0\)/);});
