import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {markdownElements,elementPresets,parseElementStyles,setElementStyle,setElementInstanceStyle,setElementProperty,clearElementInstance,decorateMarkdownElements} from '../app/element-styles.js';

test('all natively rendered Markdown kinds have independent visual recipes',()=>{
 const kinds=['h1','h2','h3','h4','h5','h6','p','ul','ol','li','blockquote','pre','hr','img','table','thead','tbody','tr','th','td','a','strong','em','del','code'];
 assert.deepEqual(markdownElements.map(x=>x.id),kinds);
 assert.ok(elementPresets.block.some(x=>x.id==='glass'));
 assert.ok(elementPresets.inline.some(x=>x.id==='glass'));
});
test('element styling is schema-safe, serializable and per kind',()=>{
 const untouched=parseElementStyles(),p=setElementStyle(untouched,'p','glass'),links=setElementStyle(p,'a','pill');
 assert.deepEqual(untouched,{version:1,rules:{},instances:{},properties:{}});
 assert.equal(links.rules.p,'glass');
 assert.equal(links.rules.a,'pill');
 assert.deepEqual(parseElementStyles(JSON.parse(JSON.stringify(links))),links);
 assert.deepEqual(setElementStyle(links,'p','plain').rules,{a:'pill'});
 assert.throws(()=>setElementStyle(p,'code','surface'));
 assert.throws(()=>parseElementStyles({version:1,rules:{script:'glass'}}));
});
test('styling only annotates the DOM and leaves inline code in pre blocks alone',()=>{
 const style={setProperty(){},removeProperty(){}};
 const nodes=[{tagName:'P',dataset:{},style},{tagName:'CODE',dataset:{},style,closest:()=>true},{tagName:'CODE',dataset:{},style,closest:()=>null}];
 const root={querySelectorAll:selector=>selector==='p'?[nodes[0]]:selector==='code'?nodes.slice(1):[]};
 const value=setElementStyle(setElementStyle(null,'p','surface'),'code','pill');
 assert.equal(decorateMarkdownElements(root,value),2);
 assert.equal(nodes[0].dataset.mdElementStyle,'surface');
 assert.equal(nodes[1].dataset.mdElementStyle,undefined);
 assert.equal(nodes[2].dataset.mdElementStyle,'pill');
});

test('local instance overrides preserve sibling styling',()=>{
 const style={setProperty(){},removeProperty(){}};
 const one={dataset:{},style},two={dataset:{},style};
 const root={querySelectorAll:kind=>kind==='p'?[one,two]:[]};
 const styled=setElementInstanceStyle(setElementStyle(null,'p','surface'),'p:2','glass');
 decorateMarkdownElements(root,styled);
 assert.equal(one.dataset.mdElementStyle,'surface');
 assert.equal(two.dataset.mdElementStyle,'glass');
 assert.deepEqual(parseElementStyles(JSON.parse(JSON.stringify(styled))),styled);
});

test('per-instance typography, layout and clear actions preserve sibling/global design',()=>{
 const global=setElementStyle(null,'p','surface');
 const local=setElementInstanceStyle(global,'p:2','glass');
 const sized=setElementProperty(local,'p:2','fontSize',22);
 const aligned=setElementProperty(sized,'p:2','align','center');
 assert.equal(aligned.properties['p:2'].fontSize,22);
 assert.equal(aligned.properties['p:2'].align,'center');
 assert.deepEqual(parseElementStyles(JSON.parse(JSON.stringify(aligned))),aligned);
 assert.deepEqual(clearElementInstance(aligned,'p:2').properties,{});
 assert.deepEqual(clearElementInstance(aligned,'p:2').instances,{});
 assert.equal(clearElementInstance(aligned,'p:2').rules.p,'surface');
 assert.throws(()=>setElementProperty(null,'p:2','fontSize',500));
 assert.throws(()=>setElementProperty(null,'p:2','align','invalid'));
});
