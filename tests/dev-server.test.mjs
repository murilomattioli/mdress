import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';

const entry=resolve('scripts/dev-server.mjs');

function startAndWaitForExit(port){
 return new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,[entry],{
   env:{...process.env,PORT:port},
   stdio:['ignore','pipe','pipe']
  });
  let stderr='';
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const timeout=setTimeout(()=>{child.kill();reject(new Error('dev server did not exit'));},5000);
  child.once('error',error=>{clearTimeout(timeout);reject(error);});
  child.once('close',code=>{clearTimeout(timeout);resolveResult({code,stderr});});
 });
}

test('local dev server rejects invalid PORT with an actionable error',async()=>{
 const result=await startAndWaitForExit('invalid');
 assert.equal(result.code,1);
 assert.match(result.stderr,/PORT inválida/);
 assert.doesNotMatch(result.stderr,/Unhandled 'error' event/);
});

test('local dev server reports an occupied port without an unhandled exception',async()=>{
 const blocker=createServer();
 await new Promise((resolveListen,reject)=>{
  blocker.once('error',reject);
  blocker.listen(0,'127.0.0.1',resolveListen);
 });
 try{
  const result=await startAndWaitForExit(String(blocker.address().port));
  assert.equal(result.code,1);
  assert.match(result.stderr,/já está em uso/);
  assert.match(result.stderr,/\$env:PORT = 4174; pnpm dev/);
  assert.doesNotMatch(result.stderr,/Unhandled 'error' event/);
 }finally{
  await new Promise(resolveClose=>blocker.close(resolveClose));
 }
});
