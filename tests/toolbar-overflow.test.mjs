import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {toolbarOverflowState,focusedToolbarDelta} from '../app/toolbar-overflow.js';

test('toolbar arrows appear only for genuine overflow',()=>{
 assert.deepEqual(toolbarOverflowState({scrollLeft:0,scrollWidth:400,clientWidth:400}),{
  overflow:false,canScrollPrevious:false,canScrollNext:false
 });
 assert.deepEqual(toolbarOverflowState({scrollLeft:0,scrollWidth:700,clientWidth:400}),{
  overflow:true,canScrollPrevious:false,canScrollNext:true
 });
 assert.deepEqual(toolbarOverflowState({scrollLeft:150,scrollWidth:700,clientWidth:400}),{
  overflow:true,canScrollPrevious:true,canScrollNext:true
 });
 assert.deepEqual(toolbarOverflowState({scrollLeft:300,scrollWidth:700,clientWidth:400}),{
  overflow:true,canScrollPrevious:true,canScrollNext:false
 });
});
test('keyboard focus reveals clipped actions without shifting visible controls',()=>{
 const viewport={left:100,right:400};
 assert.equal(focusedToolbarDelta({left:90,right:120},viewport),-16);
 assert.equal(focusedToolbarDelta({left:390,right:430},viewport),36);
 assert.equal(focusedToolbarDelta({left:150,right:200},viewport),0);
});

test('toolbar overflow tolerates fractional layout measurements',()=>{
 assert.deepEqual(toolbarOverflowState({scrollLeft:0,scrollWidth:402,clientWidth:400}),{
  overflow:false,canScrollPrevious:false,canScrollNext:false
 });
 assert.deepEqual(toolbarOverflowState({scrollLeft:0,scrollWidth:401,clientWidth:400}),{
  overflow:false,canScrollPrevious:false,canScrollNext:false
 });
});

test('focused action respects padding on both viewport edges',()=>{
 const viewport={left:100,right:300};
 assert.equal(focusedToolbarDelta({left:106,right:294},viewport),0);
 assert.equal(focusedToolbarDelta({left:105,right:295},viewport),-1);
 assert.equal(focusedToolbarDelta({left:120,right:295},viewport),1);
 assert.equal(focusedToolbarDelta({left:105,right:295},viewport,8),-3);
});

test('oversized toolbar controls reveal the leading edge without oscillating',()=>{
 const viewport={left:100,right:260};
 assert.equal(focusedToolbarDelta({left:310,right:610},viewport),204);
 assert.equal(focusedToolbarDelta({left:106,right:406},viewport),0);
 assert.equal(focusedToolbarDelta({left:50,right:350},viewport),-56);
 assert.equal(focusedToolbarDelta({left:106,right:406},viewport),0);
});

test('overflow controls stay disabled when the scrollbar is below the visual tolerance',()=>{
 assert.deepEqual(toolbarOverflowState({scrollLeft:1.8,scrollWidth:402,clientWidth:400}),{
  overflow:false,canScrollPrevious:false,canScrollNext:false
 });
 assert.deepEqual(toolbarOverflowState({scrollLeft:1.8,scrollWidth:403,clientWidth:400}),{
  overflow:true,canScrollPrevious:true,canScrollNext:false
 });
});
