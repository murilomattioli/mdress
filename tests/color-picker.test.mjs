import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHex,hexToRgb,rgbToHex,rgbToHsv,hsvToRgb} from '../app/design-system/color-picker.js';
test('picker rejects partial/alpha colors without turning invalid drafts into black',()=>{
 for(const value of ['#12','foo','#11223344','rgb(0,0,0)'])assert.equal(parseHex(value),null);
 assert.equal(parseHex('aabbcc'),'#AABBCC');
});
test('RGB/HSV round trips preserve document colors including grayscale and hue wrap',()=>{
 for(const hex of ['#000000','#FFFFFF','#245F81','#FF0000','#00FF00','#0000FF','#7E34AD'])assert.equal(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex)))),hex);
 assert.equal(rgbToHex(hsvToRgb([360,100,100])),'#FF0000');
 assert.equal(rgbToHex(hsvToRgb([180,100,0])),'#000000');
});
