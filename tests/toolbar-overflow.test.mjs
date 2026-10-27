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
