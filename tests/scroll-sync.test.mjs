import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {interpolateScroll} from '../app/scroll-sync.js';

test('landmark mapping aligns sections without assuming equal panel height',()=>{
 const landmarks=[[0,0],[200,600],[500,760],[800,1600]];
 assert.equal(interpolateScroll(0,landmarks),0);
 assert.equal(interpolateScroll(100,landmarks),300);
 assert.equal(interpolateScroll(350,landmarks),680);
 assert.equal(interpolateScroll(650,landmarks),1180);
 assert.equal(interpolateScroll(900,landmarks),1600);
});
test('landmark mapping can be inverted for scrolling from canvas to editor',()=>{
 const landmarks=[[0,0],[100,340],[500,760],[1000,2100]];
 const inverse=landmarks.map(([a,b])=>[b,a]);
 assert.equal(interpolateScroll(550,inverse),300);
 assert.equal(interpolateScroll(0,[]),0);
});
