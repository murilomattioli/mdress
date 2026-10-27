import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/semantic-flow.js',import.meta.url),'utf8');
test('semantic grouping is non-lossy and does not inject Markdown',()=>{
 assert.match(source,/groupSemanticLeads/);
 assert.match(source,/group\.append\(heading\)/);
 assert.doesNotMatch(source,/innerHTML\s*=/);
});
