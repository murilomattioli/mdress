import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {menuScrollDelta} from '../app/design-system/inspector-header.js';

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
