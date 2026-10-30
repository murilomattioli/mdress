/** Source identity shared by Playwright capture, safe resume and human sign-off.
 * Hash the actual app, QA tooling and package metadata with stable relative
 * paths. Fail closed on unsupported entries instead of silently ignoring them.
 */
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

export async function fingerprintUxQaSource(root=process.cwd()){
 const hash=createHash('sha256');
 async function walk(relativeDir){
  const entries=(await readdir(join(root,relativeDir),{withFileTypes:true}))
   .sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  for(const entry of entries){
   const relativePath=join(relativeDir,entry.name);
   if(entry.isDirectory())await walk(relativePath);
   else if(entry.isFile()){
    hash.update(relativePath.replaceAll('\\','/'));
    hash.update(Buffer.from([0]));
    hash.update(await readFile(join(root,relativePath)));
    hash.update(Buffer.from([0]));
   }else throw Error('Entrada não suportada no fingerprint de QA: '+relativePath);
  }
 }
 await walk('app');
 await walk('scripts');
 hash.update('package.json');
 hash.update(Buffer.from([0]));
 hash.update(await readFile(join(root,'package.json')));
 return hash.digest('hex');
}
