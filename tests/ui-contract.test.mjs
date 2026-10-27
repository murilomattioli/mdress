import {test} from 'node:test';import {strict as assert} from 'node:assert';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
test('UI element identifiers are unique',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size,'Duplicate ID');
});
test('imperative UI references have matching markup IDs',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
 const staticRefs=[...app.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
 const missing=[...new Set(staticRefs)].filter(x=>!ids.has(x));
 assert.deepEqual(missing,[],'Missing UI nodes: '+missing.join(', '));
});
test('editor and preview mode and toolbar controls are present',()=>{
 for(const id of ['headingCommand','undoEdit','redoEdit','bgOpacity','bgKind','backgroundGallery','designToggle','linkDialog','shortcutsDialog'])assert.ok(html.includes('id="'+id+'"'));
 for(const mode of ['split','edit','preview'])assert.ok(html.includes('data-workspace-mode="'+mode+'"'));
 for(const command of ['bold','italic','link','bullet','number','fence','quote'])assert.ok(html.includes('data-md-command="'+command+'"'));
});
test('UI still links stylesheet and required local modules',()=>{
 for(const name of ['styles-v2.css','app.js'])assert.ok(html.includes(name));
 for(const name of ['markdown-commands.js','document-history.js','background-presets.js'])assert.ok(app.includes(name));
});
