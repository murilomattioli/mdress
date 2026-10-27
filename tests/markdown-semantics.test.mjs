import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {markdownToHTML} from '../app/markdown-render.js';
test('renders semantic tables and image links safely',()=>{
 const html=markdownToHTML('## Dados\n\n| Campo | Valor |\n| --- | --- |\n| Idade | **42** |\n\n![Fotografia](https://example.org/photo.jpg)');
 assert.match(html,/<table><thead><tr><th>Campo<\/th>/);
 assert.match(html,/<tbody><tr><td>Idade<\/td><td><strong>42<\/strong><\/td>/);
 assert.match(html,/<img src="https:\/\/example.org\/photo.jpg" alt="Fotografia"/);
 assert.doesNotMatch(markdownToHTML('![x](javascript:alert(1))'),/<img/);
});
