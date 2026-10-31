import test from 'node:test';
import assert from 'node:assert/strict';
import {setElementProperty,parseElementStyles,decorateMarkdownElements} from '../app/element-styles.js';
test('type colors persist, instance overrides win and inherit restores type',()=>{
 let value=setElementProperty(null,'li','markerColor','#ff000080');
 value=setElementProperty(value,'li:1','markerColor','#00ff00');
 value=parseElementStyles(JSON.parse(JSON.stringify(value)));
 const values=new Map(),node={dataset:{},style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
 const root={querySelectorAll:k=>k==='li'?[node]:[]};
 decorateMarkdownElements(root,value);assert.equal(values.get('--md-marker-color'),'#00ff00');assert.equal(values.has('color'),false);
 value=setElementProperty(value,'li:1','markerColor',null);decorateMarkdownElements(root,value);assert.equal(values.get('--md-marker-color'),'#ff000080');
 value=setElementProperty(value,'li','markerColor',null);decorateMarkdownElements(root,value);assert.equal(values.has('--md-marker-color'),false);
 assert.throws(()=>setElementProperty(null,'li','color','url(evil)'));
});
