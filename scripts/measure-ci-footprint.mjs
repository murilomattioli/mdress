#!/usr/bin/env node
/**
 * Read-only GitHub Actions footprint sampler (RFC-001 / Phase 0).
 * Node >=20. Uses GitHub REST API; does not access billing or mutate resources.
 *
 * GITHUB_TOKEN=... node scripts/measure-ci-footprint.mjs --limit=100
 * Optionally --repo=owner/name --out=path.json --max-artifact-runs=20
 */
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

const options=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=/^--([a-z-]+)=(.*)$/.exec(arg);
  if(!m) throw Error('Invalid option: '+arg);
  return [m[1],m[2]];
}));
const repo=options.repo||process.env.GITHUB_REPOSITORY||'murilomattioli/mdress';
if(!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('Invalid repo owner/name');
const limit=Math.min(500,Math.max(1,Number(options.limit||100)));
const maxArtifactRuns=Math.min(limit,Math.max(0,Number(options['max-artifact-runs']||20)));
if(!Number.isInteger(limit)||!Number.isInteger(maxArtifactRuns)) throw Error('Invalid numeric option');
const out=options.out||'test-results/ci-footprint.json';
const token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
if(!token) throw Error('GITHUB_TOKEN or GH_TOKEN required; use a read-only Actions token');
const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
const get=async path=>{
  const res=await fetch('https://api.github.com/repos/'+repo+path,{headers});
  if(!res.ok) throw Error('GitHub API '+res.status+' for '+path+'; '+(await res.text()).slice(0,250));
  return res.json();
};
const all=[];
for(let page=1;all.length<limit;page++){
 const chunk=await get('/actions/runs?per_page=100&page='+page);
 if(!chunk.workflow_runs?.length) break;
 all.push(...chunk.workflow_runs.slice(0,limit-all.length));
}
const runs=all.map(r=>({
 id:r.id,name:r.name,event:r.event,branch:r.head_branch,commit:r.head_sha,
 createdAt:r.created_at,startedAt:r.run_started_at,updatedAt:r.updated_at,
 conclusion:r.conclusion,
 // Endpoints for workflow_run expose run timing; wall clock != billable runner time.
 wallClockSeconds:r.run_started_at&&r.updated_at?Math.max(0,Math.round((Date.parse(r.updated_at)-Date.parse(r.run_started_at))/1000)):null
}));
const artifactSample=[];
for(const r of runs.slice(0,maxArtifactRuns)){
  const x=await get('/actions/runs/'+r.id+'/artifacts?per_page=100');
  artifactSample.push({runId:r.id,count:x.total_count||0,bytes:(x.artifacts||[]).reduce((a,v)=>a+v.size_in_bytes,0),
    artifacts:(x.artifacts||[]).map(a=>({name:a.name,bytes:a.size_in_bytes,expired:a.expired,createdAt:a.created_at,expiresAt:a.expires_at}))});
}
const groups=new Map();
for(const run of runs){const key=run.name||'unknown';groups.set(key,[...(groups.get(key)||[]),run]);}
const byWorkflow=[...groups.values()].map(rows=>{
 const secs=rows.map(r=>r.wallClockSeconds).filter(n=>n!==null).sort((a,b)=>a-b);
 return {name:rows[0].name,count:rows.length,failures:rows.filter(r=>r.conclusion==='failure').length,
  medianWallClockSeconds:secs.length?secs[Math.floor(secs.length/2)]:null,
  sumWallClockSeconds:secs.reduce((a,b)=>a+b,0),
  events:Object.fromEntries([...new Set(rows.map(r=>r.event))].map(e=>[e,rows.filter(r=>r.event===e).length]))};
});
const report={schemaVersion:1,source:'GitHub REST read-only',repo,generatedAt:new Date().toISOString(),
 caveats:[
  'Sample of recent workflow runs, not the complete account billing period.',
  'wallClockSeconds is NOT billed runner-minutes (includes non-runner time and excludes parallel job multiplier).',
  'Artifact listing can be empty because files were not generated, were expired, or were never uploaded.',
  'Billing plan, account-wide quota, runner SKU and actual invoice are not available from this report.',
  'No GitHub token is written to the report.'
 ],sample:{requestedRuns:limit,actualRuns:runs.length,artifactRunsChecked:artifactSample.length,
 firstRunDate:runs.at(-1)?.createdAt||null,lastRunDate:runs[0]?.createdAt||null},
 byWorkflow,runs,artifactSample};
await mkdir(dirname(out),{recursive:true});
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({path:out,sample:report.sample,byWorkflow,artifactRunsWithFiles:artifactSample.filter(x=>x.count>0).length},null,2));
