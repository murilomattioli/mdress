import {test} from 'node:test';import {strict as assert} from 'node:assert';import {presets,defaults,validateTheme,selectPreset} from '../app/resume-themes.js';
test('seven presets',()=>assert.equal(Object.keys(presets).length,7));
test('default is minimal',()=>assert.equal(defaults.theme,'minimal'));
test('OLED background is black',()=>assert.equal(selectPreset('oled').background,'#000000'));
test('paper size preserved',()=>assert.equal(selectPreset('neon',{...defaults,paper:'letter'}).paper,'letter'));
test('reject invalid color',()=>assert.throws(()=>validateTheme({...defaults,accent:'red'})));
test('reject unknown theme property',()=>assert.throws(()=>validateTheme({...defaults,onload:'alert(1)'})));