
import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {applyMarkdownCommand as cmd} from '../app/markdown-commands.js';
import {markdownToHTML} from '../app/markdown-render.js';
import {MarkdownHistory} from '../app/markdown-history.js';
import {backgroundPresets,applyBackgroundPreset} from '../app/background-presets.js';
import {defaults,validateTheme,backgroundCSS,backgroundSize} from '../app/resume-themes.js';
test('inline bold preserves selection and toggles outside markers',()=>{
 const a=cmd('Olá mundo',4,9,'bold');
 assert.equal(a.text,'Olá **mundo**');assert.deepEqual([a.start,a.end],[6,11]);
 const b=cmd(a.text,a.start,a.end,'bold');assert.equal(b.text,'Olá mundo');
});
test('headings edit current line, not previous one',()=>{
 assert.equal(cmd('Primeira\nSegunda',9,9,'h2').text,'Primeira\n## Segunda');
 assert.equal(cmd('## Teste',4,4,'paragraph').text,'Teste');
});
test('numbered and task lists operate on multiline selection',()=>{
 assert.equal(cmd('um\ndois',0,7,'number').text,'1. um\n2. dois');
 const x=cmd('um\ndois',0,7,'task');
 assert.equal(x.text,'- [ ] um\n- [ ] dois');
 assert.equal(cmd(x.text,0,x.text.length,'task').text,'um\ndois');
});
test('links never accept JS URL',()=>{
 assert.throws(()=>cmd('alvo',0,4,'link','javascript:alert(1)'));
 assert.equal(cmd('alvo',0,4,'link','https://example.com').text,'[alvo](https://example.com)');
});
test('code fences and quotes are previewed',()=>{
 const md=cmd('console.log(1)',0,14,'fence').text;
 assert.match(markdownToHTML(md),/<pre><code>/);
 assert.match(markdownToHTML('> citação'),/<blockquote>/);
});
test('extended Markdown escapes user HTML',()=>{
 const output=markdownToHTML('## Título\n\n~~Cortado~~ e \`inline\`\n\n<script>alert(1)</script>');
 assert.match(output,/<del>Cortado<\/del>/);assert.match(output,/<code>inline<\/code>/);
 assert.ok(!output.includes('<script>'));
});
test('history groups typing and supports undo redo',()=>{
 const h=new MarkdownHistory();h.reset('a');h.record('ab',2,2,false,1000);h.record('abc',3,3,false,1100);
 assert.equal(h.undo().text,'a');assert.equal(h.redo().text,'abc');
 h.undo();h.record('ax',2,2,true,1500);assert.equal(h.canRedo,false);
});
test('background recipes resolve to strict, editable theme config',()=>{
 assert.ok(backgroundPresets.length>=10);
 for(const p of backgroundPresets){
  const value=validateTheme(applyBackgroundPreset(defaults,p));
  assert.ok(value.backgroundStyle.kind);assert.ok(['solid','none'].includes(value.backgroundStyle.kind)||backgroundCSS(value).length>15);
  assert.ok(backgroundSize(value).length>0);
 }
});
test('background config rejects executable values',()=>{
 assert.throws(()=>validateTheme({...defaults,backgroundStyle:{kind:'url(javascript:alert(1))'}}));
 assert.throws(()=>validateTheme({...defaults,backgroundStyle:{opacity:2}}));
});
