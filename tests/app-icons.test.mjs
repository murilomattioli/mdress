import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const app=new URL('../app/',import.meta.url);
const html=readFileSync(new URL('index.html',app),'utf8');
const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',app),'utf8'));
test('install icons have matching PNG dimensions and offline coverage',()=>{
 const handlers={};let assets;
 vm.runInNewContext(readFileSync(new URL('sw.js',app),'utf8'),{self:{addEventListener:(event,handler)=>handlers[event]=handler},caches:{open:async()=>({addAll:async urls=>{assets=urls;}})}});
 let installed;handlers.install({waitUntil:promise=>installed=promise});
 return installed.then(()=>{
  assert.deepEqual(new Set(manifest.icons.map(icon=>icon.purpose)),new Set(['any','maskable']));
  for(const icon of manifest.icons){
   const png=readFileSync(new URL(icon.src,app));
   assert.equal(png.subarray(1,4).toString(),'PNG');
   assert.equal(icon.sizes,`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
   assert.ok(assets.includes('./'+icon.src),'Icon missing from offline shell: '+icon.src);
  }
  for(const asset of assets)assert.ok(existsSync(new URL(asset,app)),'Missing precache file: '+asset);
 });
});
test('browser and header branding resolve local files',()=>{
 const refs=[...html.matchAll(/<(?:link|img)\b[^>]*(?:href|src)="(assets\/[^"]+)"/g)].map(match=>match[1]);
 assert.ok(refs.some(path=>path.endsWith('favicon-32.png')));
 assert.ok(refs.some(path=>path.endsWith('apple-touch-icon-180.png')));
 assert.ok(refs.some(path=>path.endsWith('brand/mdress.svg')));
 for(const ref of refs)assert.ok(existsSync(new URL(ref,app)),ref);
});
