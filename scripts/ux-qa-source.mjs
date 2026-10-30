/** Source identity shared by Playwright capture, safe resume and human sign-off.
 * Includes the app, QA tooling and package metadata. Never mix visual
 * evidence from different source trees, even if filenames are unchanged.
 */
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

export async function fingerprintUxQaSource(){
 const hash=createHash('sha256');
 async function walk(dir){
  const entries=(await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){
   const path=join(dir,entry.name);
   if(entry.isDirectory())await walk(path);
   else if(entry.isFile()){
    hash.update(path.replaceAll('\\','/'));
    hash.update(Buffer.from([0]));
    hash.update(await readFile(path));
    hash.update(Buffer.from([0]));
   }
  }
 }
 await walk('app');
 await walk('scripts');
 hash.update(await readFile('package.json'));
 return hash.digest('hex');
}
