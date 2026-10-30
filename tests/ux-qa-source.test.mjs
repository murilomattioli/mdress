import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,rename,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprintUxQaSource} from '../scripts/ux-qa-source.mjs';

test('QA fingerprint is deterministic and bound to app, scripts and package bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mdress-qa-source-'));
 try{
  await mkdir(join(root,'app'));
  await mkdir(join(root,'scripts'));
  await writeFile(join(root,'app','z.js'),'app-v1');
  await writeFile(join(root,'scripts','a.mjs'),'qa-v1');
  await writeFile(join(root,'package.json'),'{"name":"fixture"}');
  const original=await fingerprintUxQaSource(root);
  assert.match(original,/^[a-f0-9]{64}$/);
  assert.equal(await fingerprintUxQaSource(root),original);
  await writeFile(join(root,'app','z.js'),'app-v2');
  assert.notEqual(await fingerprintUxQaSource(root),original,'App changes invalidate prior visual evidence');
  await writeFile(join(root,'app','z.js'),'app-v1');
  assert.equal(await fingerprintUxQaSource(root),original);
  await writeFile(join(root,'scripts','a.mjs'),'qa-v2');
  assert.notEqual(await fingerprintUxQaSource(root),original,'QA runner changes invalidate prior visual evidence');
  await writeFile(join(root,'scripts','a.mjs'),'qa-v1');
  await writeFile(join(root,'package.json'),'{"name":"fixture","version":"2"}');
  assert.notEqual(await fingerprintUxQaSource(root),original,'Package metadata changes invalidate prior visual evidence');
  await writeFile(join(root,'package.json'),'{"name":"fixture"}');
  await writeFile(join(root,'app','new.css'),'body{}');
  assert.notEqual(await fingerprintUxQaSource(root),original,'Added assets invalidate prior visual evidence');
  await rm(join(root,'app','new.css'));
  await rename(join(root,'app','z.js'),join(root,'app','a.js'));
  assert.notEqual(await fingerprintUxQaSource(root),original,'Renamed source paths invalidate prior visual evidence');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('QA fingerprint refuses symlinks instead of silently ignoring source changes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'mdress-qa-symlink-'));
 try{
  await mkdir(join(root,'app'));
  await mkdir(join(root,'scripts'));
  await writeFile(join(root,'package.json'),'{}');
  await writeFile(join(root,'app','real.js'),'real');
  try{await symlink('real.js',join(root,'app','alias.js'));}
  catch(error){
   if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('Symlink creation unavailable on this platform');return;}
   throw error;
  }
  await assert.rejects(fingerprintUxQaSource(root),/Entrada não suportada/);
 }finally{await rm(root,{recursive:true,force:true});}
});
