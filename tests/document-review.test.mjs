import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMarkdown} from '../app/document-templates.js';
test('review locates actionable issues and ignores fenced examples',()=>{
 const r=inspectMarkdown('# Título\n### Salto\n![](https://example.com/a.png)\n[Link]()\n```\n[exemplo]()\n```');
 assert.deepEqual(r.diagnostics.map(x=>x.line),[2,3,4]);assert.equal(r.images,1);assert.equal(r.links,1);assert.equal(r.codeBlocks,1);
});
test('review detects unclosed fences at opening and counts reading words',()=>{
 const r=inspectMarkdown('# Olá mundo\nTexto simples\n```js\nconst foo=1;');assert.equal(r.words,4);assert.equal(r.diagnostics[0].line,3);
});
test('supported images are not incorrectly reported as unsupported',()=>{
 const r=inspectMarkdown('# Título\n![Descrição](https://example.com/a.png)');assert.equal(r.diagnostics.length,0);
});
