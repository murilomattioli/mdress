import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {deflateSync} from 'node:zlib';
import {summarizeUxCoverage,summarizeScreenshotCoverage,UX_QA_MATRIX,UX_QA_REQUIRED_SCREENSHOTS,parseHumanReviewChoice,validateHumanReviewEvidence,validateScreenshotViewport,UX_QA_VIEWPORT_HEIGHT} from '../scripts/ux-qa-coverage.mjs';

const full=()=>UX_QA_MATRIX.map(({theme,width})=>({theme,width,scenario:true,inspector:true,toolbar:true,errors:0}));

test('full matrix passes only when every scenario and sub-audit passes',()=>{
 const result=summarizeUxCoverage(full(),[],false);
 assert.deepEqual([result.status,result.expected,result.passing,result.complete],['passed',6,6,true]);
});
test('a missing or duplicated viewport never counts as full coverage',()=>{
 const missing=full().slice(0,-1);
 assert.equal(summarizeUxCoverage(missing,[],false).status,'failed');
 const duplicate=full();duplicate[5]={...duplicate[0]};
 assert.equal(summarizeUxCoverage(duplicate,[],false).complete,false);
});
test('toolbar, inspector, runtime and finding failures fail the report',()=>{
 for(const key of ['toolbar','inspector','scenario']){
  const rows=full();rows[0][key]=false;
  assert.equal(summarizeUxCoverage(rows,[],false).status,'failed');
 }
 const rows=full();rows[0].errors=1;
 assert.equal(summarizeUxCoverage(rows,[],false).status,'failed');
 assert.equal(summarizeUxCoverage(full(),[{severity:'error'}],false).status,'failed');
 assert.equal(summarizeUxCoverage(full(),[{severity:'warning'}],false).status,'passed');
});
test('reviewer stop is never reported as successful completion',()=>{
 assert.equal(summarizeUxCoverage(full(),[],true).status,'stopped');
 assert.equal(summarizeUxCoverage(full().slice(0,1),[],true).status,'stopped');
});

test('human visual sign-off is explicit and separate from passing automated checks',()=>{
 assert.equal(parseHumanReviewChoice(''), 'not-reviewed');
 assert.equal(parseHumanReviewChoice('m'), 'not-reviewed');
 assert.equal(parseHumanReviewChoice(' A '), 'approved');
 assert.equal(parseHumanReviewChoice('r'), 'rejected');
 assert.equal(parseHumanReviewChoice(null), 'not-reviewed');
 assert.equal(summarizeUxCoverage(full(),[],false).status,'passed',
  'Automated status remains a separate functional result');
});

test('visual evidence requires every control state in every viewport exactly once',()=>{
 const all=UX_QA_MATRIX.flatMap(({theme,width})=>
  UX_QA_REQUIRED_SCREENSHOTS.map(state=>({theme,width,state,path:theme+'-'+width+'-'+state+'.png'})));
 const complete=summarizeScreenshotCoverage(all);
 const expected=UX_QA_MATRIX.length*UX_QA_REQUIRED_SCREENSHOTS.length;
 assert.equal(complete.expected,expected);
 assert.equal(complete.captured,expected);
 assert.deepEqual(complete.missing,[]);
 assert.deepEqual(complete.duplicates,[]);
 assert.deepEqual(complete.unexpected,[]);
 assert.deepEqual(complete.invalidPaths,[]);
 const missing=summarizeScreenshotCoverage(all.slice(1));
 assert.deepEqual(missing.missing,['graphite:1440:workspace']);
 const repeated=summarizeScreenshotCoverage([...all,all[0]]);
 assert.deepEqual(repeated.duplicates,['graphite:1440:workspace']);
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('range-live-any'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-tab-backward'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-accordion-collapse-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-tab-switch-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-inspector-close-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('toolbar-last-focus'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('toolbar-disabled-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('toolbar-hidden-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('toolbar-detached-focus-handoff'));
 assert.equal(UX_QA_REQUIRED_SCREENSHOTS.length,67,'67 distinct states are mandatory');
 assert.equal(new Set(UX_QA_REQUIRED_SCREENSHOTS).size,67,'State names must be unique');
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('number-disabled-invalid-draft'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('number-rollback-valid-draft'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('color-draft-sync'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('range-native-override'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('binary-disabled-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('select-disabled-trigger-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('segment-live-options'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('segment-live-focus-handoff'));
 assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes('segment-disabled-focus-handoff'));
 for(const state of ['range-disabled-focus-handoff','color-disabled-focus-handoff','color-swatch-focus','color-swatch-disabled-focus-handoff',
  'number-disabled-focus-handoff','number-stepper-disabled-focus-handoff'])
  assert.ok(UX_QA_REQUIRED_SCREENSHOTS.includes(state),state+' must be captured');
 const unexpected=summarizeScreenshotCoverage([...all,{theme:'graphite',width:1440,state:'not-in-contract',path:'graphite-1440-not-in-contract.png'}]);
 assert.deepEqual(unexpected.unexpected,['graphite:1440:not-in-contract']);
 const wrongPath=summarizeScreenshotCoverage(all.map((row,index)=>index===0?{...row,path:'stale-capture.png'}:row));
 assert.deepEqual(wrongPath.invalidPaths,['graphite:1440:workspace']);
 const missingPath=summarizeScreenshotCoverage(all.map((row,index)=>index===0?{...row,path:undefined}:row));
 assert.deepEqual(missingPath.invalidPaths,['graphite:1440:workspace']);
});

test('human review requires a matching session and explicit approval of every required state',()=>{
 const session='review-session-1';
 const states=Object.fromEntries(UX_QA_REQUIRED_SCREENSHOTS.map(state=>[state,{status:'approved',note:''}]));
 const complete={schema:1,sessionId:session,states};
 assert.equal(validateHumanReviewEvidence(complete,session).valid,true);
 assert.equal(validateHumanReviewEvidence(complete,'another-session').valid,false);
 assert.equal(validateHumanReviewEvidence({...complete,schema:0},session).valid,false);
 const pending=structuredClone(complete);
 pending.states.workspace.status='pending';
 assert.equal(validateHumanReviewEvidence(pending,session).valid,false);
 assert.ok(validateHumanReviewEvidence(pending,session).missing.includes('workspace'));
 const rejected=structuredClone(complete);
 rejected.states.toolbar.status='rejected';
 assert.deepEqual(validateHumanReviewEvidence(rejected,session).rejected,['toolbar']);
 assert.equal(validateHumanReviewEvidence(rejected,session).valid,false);
 const extra=structuredClone(complete);
 extra.states['unverified-extra']={status:'approved'};
 assert.deepEqual(validateHumanReviewEvidence(extra,session).unexpected,['unverified-extra']);
 assert.equal(validateHumanReviewEvidence(extra,session).valid,false);
 assert.equal(validateHumanReviewEvidence(null,session).valid,false);
});

test('PNG evidence requires a complete, CRC-valid, full-viewport image',()=>{
 const chunk=(type,data)=>{
  const result=Buffer.alloc(data.length+12);
  result.writeUInt32BE(data.length,0);
  result.write(type,4,'ascii');
  data.copy(result,8);
  let crc=0xffffffff;
  for(let index=4;index<8+data.length;index++){
   crc^=result[index];
   for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  result.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);
  return result;
 };
 const header=Buffer.alloc(13);
 header.writeUInt32BE(1440,0);
 header.writeUInt32BE(UX_QA_VIEWPORT_HEIGHT,4);
 header[8]=8;header[9]=2;
 const png=Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',header),
  chunk('IDAT',deflateSync(Buffer.alloc((1440*3+1)*UX_QA_VIEWPORT_HEIGHT))),
  chunk('IEND',Buffer.alloc(0))
 ]);
 assert.equal(validateScreenshotViewport(png,1440),true);
 assert.equal(validateScreenshotViewport(png,1024),false);
 assert.equal(validateScreenshotViewport(png.subarray(0,33),1440),false,
  'An IHDR-only stub is not a valid screenshot');
 assert.equal(validateScreenshotViewport(png.subarray(0,png.length-12),1440),false,
  'A missing IEND chunk must fail');
 const corrupted=Buffer.from(png);
 corrupted[60]^=1;
 assert.equal(validateScreenshotViewport(corrupted,1440),false,
  'A corrupt IDAT checksum must fail');
 const badHeader=Buffer.from(png);
 badHeader.writeUInt32BE(1,16);
 assert.equal(validateScreenshotViewport(badHeader,1440),false);
 assert.equal(validateScreenshotViewport(Buffer.from('not a PNG'),1440),false);
 // A valid CRC alone does not mean the PNG contains decodable pixels.
 const badZlib=Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',header),
  chunk('IDAT',Buffer.from('not compressed image data')),
  chunk('IEND',Buffer.alloc(0))
 ]);
 assert.equal(validateScreenshotViewport(badZlib,1440),false,
  'CRC-correct but undecodable IDAT must fail');
 const shortRaster=Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',header),
  chunk('IDAT',deflateSync(Buffer.from('short raster'))),
  chunk('IEND',Buffer.alloc(0))
 ]);
 assert.equal(validateScreenshotViewport(shortRaster,1440),false,
  'Inflated raster must contain every full-viewport scanline');
 const badFilter=Buffer.alloc((1440*3+1)*UX_QA_VIEWPORT_HEIGHT);
 badFilter[0]=5;
 const invalidScanline=Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',header),
  chunk('IDAT',deflateSync(badFilter)),
  chunk('IEND',Buffer.alloc(0))
 ]);
 assert.equal(validateScreenshotViewport(invalidScanline,1440),false,
  'Invalid PNG row filters must fail even with correct CRC and zlib');
 const interlacedHeader=Buffer.from(header);
 interlacedHeader[12]=1;
 const unsupportedInterlace=Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',interlacedHeader),
  chunk('IDAT',deflateSync(Buffer.alloc((1440*3+1)*UX_QA_VIEWPORT_HEIGHT))),
  chunk('IEND',Buffer.alloc(0))
 ]);
 assert.equal(validateScreenshotViewport(unsupportedInterlace,1440),false,
  'Unsupported interlaced formats must not be falsely accepted');
 const compressed=deflateSync(Buffer.alloc((1440*3+1)*UX_QA_VIEWPORT_HEIGHT));
 const split=Math.floor(compressed.length/2);
 const interruptedIdat=Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',header),
  chunk('IDAT',compressed.subarray(0,split)),
  chunk('tEXt',Buffer.from('comment')),
  chunk('IDAT',compressed.subarray(split)),
  chunk('IEND',Buffer.alloc(0))
 ]);
 assert.equal(validateScreenshotViewport(interruptedIdat,1440),false,
  'IDAT chunks separated by ancillary data violate PNG ordering');
});
