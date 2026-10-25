import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentHistory} from '../app/document-history.js';

const state=(markdown,accent='#000')=>({markdown,appearance:{accent},pagination:{breakBefore:[]}});
test('undo and redo span Markdown and appearance changes',()=>{
 const history=new DocumentHistory();
 history.reset(state('Original'));
 history.record(state('Editado'),'Editar Markdown',true,1000);
 history.record(state('Editado','#f80'),'Alterar aparência',false,1200);
 assert.deepEqual(history.undo(),state('Editado'));
 assert.deepEqual(history.undo(),state('Original'));
 assert.deepEqual(history.redo(),state('Editado'));
 assert.deepEqual(history.redo(),state('Editado','#f80'));
});
test('new action invalidates redo and snapshots are immutable',()=>{
 const history=new DocumentHistory();
 const first=state('A');history.reset(first);first.markdown='mutação externa';
 history.record(state('B'),'Editar Markdown');
 history.undo();
 history.record(state('C'),'Editar Markdown');
 assert.equal(history.canRedo,false);
 assert.equal(history.undo().markdown,'A');
});
test('typing merges but never absorbs a different action',()=>{
 const h=new DocumentHistory();h.reset(state(''));
 h.record(state('a'),'Editar Markdown',true,1000);
 h.record(state('ab'),'Editar Markdown',true,1200);
 assert.equal(h.undo().markdown,'');
 h.redo();
 h.record(state('ab','#f80'),'Alterar aparência',false,1300);
 h.record(state('abc','#f80'),'Editar Markdown',true,1400);
 assert.equal(h.undo().markdown,'ab');
 assert.equal(h.undo().appearance.accent,'#000');
});
