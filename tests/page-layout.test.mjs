import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePageLayout,setBottomAlignment} from '../app/page-layout.js';

const id='1:ui/ux engineering manager | front-end engineer:1';
test('empty layout defaults to normal flow',()=>{
 assert.deepEqual(parsePageLayout(),{version:1,alignBottom:[]});
});
test('bottom alignment is reversible and does not mutate input',()=>{
 const original=parsePageLayout();
 const enabled=setBottomAlignment(original,id,true);
 assert.deepEqual(original.alignBottom,[]);
 assert.deepEqual(enabled.alignBottom,[id]);
 assert.deepEqual(setBottomAlignment(enabled,id,true).alignBottom,[id]);
 assert.deepEqual(setBottomAlignment(enabled,id,false).alignBottom,[]);
});
test('invalid persisted anchors fail closed',()=>{
 assert.throws(()=>parsePageLayout({version:1,alignBottom:['<script>']}),/inválida/);
 assert.throws(()=>parsePageLayout({version:2,alignBottom:[]}),/inválida/);
});
