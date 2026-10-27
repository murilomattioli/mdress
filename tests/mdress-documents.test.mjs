import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {documentTemplates,getDocumentTemplate,inspectMarkdown} from '../app/document-templates.js';
test('mdress is generic Markdown product with optional resume template',()=>{assert.ok(documentTemplates.length>=6);assert.equal(documentTemplates[0].id,'blank');assert.ok(getDocumentTemplate('documentation').markdown.includes('Instalação'));assert.equal(getDocumentTemplate('resume').name,'Currículo');});
test('document analysis checks Markdown not ATS résumé fields',()=>{const r=inspectMarkdown('# Meu artigo\\n\\n## Introdução\\nTexto.');assert.equal(r.diagnostics.length,0);assert.throws(()=>getDocumentTemplate('invalid'));});
