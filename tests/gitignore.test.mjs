import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function ignored(path){
 const result=spawnSync('git',['-C',root,'check-ignore','--no-index','--quiet','--',path],{encoding:'utf8'});
 if(result.error)throw result.error;
 if(result.status!==0&&result.status!==1)throw Error(`git check-ignore failed: ${result.stderr}`);
 return result.status===0;
}

test('local credentials and generated QA evidence are not accidentally staged',()=>{
 for(const path of [
  '.env','.env.local','.env.production',
  'test-results/ux-audit/graphite-768.png',
  'test-results/component-ux-audit.json',
  'playwright-report/index.html','blob-report/report.zip',
  'test-results/run.trace.zip',
  'scripts/e2e.supervised.mjs','scripts/e2e.backup.mjs',
  'scripts/e2e.corrupted-backup','scripts/e2e.encoding-backup',
  'scripts/e2e.before-fix',
 ])assert.equal(ignored(path),true,`${path} should be ignored`);
});

test('example configs and actual source remain trackable',()=>{
 for(const path of ['.env.example','.env.sample','scripts/e2e.mjs','tests/gitignore.test.mjs'])
  assert.equal(ignored(path),false,`${path} must remain trackable`);
});
