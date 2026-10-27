import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {PDF_PROFILES,PDF_PRESETS,resolvePDFExport,pdfExportNotes,configurePDFPrint,clearPDFPrint,inspectPDFFile} from '../app/pdf-export.js';
test('presentation presets not ATS claims',()=>{
 assert.equal(Object.keys(PDF_PRESETS).length,3);
 assert.equal(resolvePDFExport({profile:'visual'}).backgroundMode,'full');
 assert.equal(resolvePDFExport({profile:'readable'}).backgroundMode,'none');
 assert.equal(resolvePDFExport({profile:'readable'}).textMode,'dark');
});
test('independent options and validation',()=>{
 assert.equal(resolvePDFExport({profile:'custom',backgroundMode:'solid',textMode:'document',paper:'letter'}).paper,'letter');
 assert.throws(()=>resolvePDFExport({backgroundMode:'url(https://x)'}));
 assert.throws(()=>resolvePDFExport({textMode:'script'}));
 assert.throws(()=>resolvePDFExport({paper:'legal'}));
 assert.throws(()=>resolvePDFExport({includeBackground:'yes'}));
});
test('print flags apply and clear on same node',()=>{
 const attrs=new Map();const dom={setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 configurePDFPrint(dom,{profile:'custom',backgroundMode:'solid',textMode:'dark',paper:'letter'});
 assert.equal(attrs.get('data-print-background'),'solid');
 assert.equal(attrs.get('data-print-text'),'dark');
 assert.equal(attrs.get('data-print-paper'),'letter');
 clearPDFPrint(dom);assert.equal(attrs.size,0);
});
test('notes clarify content and warn of contrast conflicts',()=>{
 assert.match(pdfExportNotes({profile:'visual',backgroundMode:'full'},'mesh').join(' '),/rasterizados/);
 assert.match(pdfExportNotes({profile:'custom',backgroundMode:'none',textMode:'document'}).join(' '),/ilegíveis/);
 assert.match(pdfExportNotes({profile:'readable'}).join(' '),/nenhuma opção garante leitura perfeita/);
});
test('actual size measurement done locally only',()=>{
 const small=inspectPDFFile({type:'application/pdf',name:'cv.pdf',size:43296});
 assert.equal(small.kib,42);assert.equal(small.above500KiB,false);
 const large=inspectPDFFile({type:'application/pdf',name:'cv.pdf',size:3000000});
 assert.equal(large.aboveGreenhouseParserLimit,true);
 assert.throws(()=>inspectPDFFile({name:'image.jpg',size:123,type:'image/jpeg'}));
});
