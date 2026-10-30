/** Explicit coverage contract: incomplete, duplicate or interrupted matrices never pass. */
// Full-viewport evidence is required; tiny or cropped PNGs cannot be approved.
export const UX_QA_VIEWPORT_HEIGHT=900;
// A PNG header alone is not evidence: reject truncated, malformed or
// checksum-corrupted screenshots before they can be reported as captured.
import {inflateSync} from 'node:zlib';
const PNG_SIGNATURE=Buffer.from('89504e470d0a1a0a','hex');
const CRC_TABLE=Uint32Array.from({length:256},(_,index)=>{
 let crc=index;
 for(let bit=0;bit<8;bit++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;
 return crc>>>0;
});
function pngCrc32(bytes,start,end){
 let crc=0xffffffff;
 for(let index=start;index<end;index++)
  crc=CRC_TABLE[(crc^bytes[index])&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
export function validateScreenshotViewport(png,width,height=UX_QA_VIEWPORT_HEIGHT){
 if(!Buffer.isBuffer(png)||png.length<57||
  !png.subarray(0,8).equals(PNG_SIGNATURE))return false;
 let offset=8,hasHeader=false,idatEnded=false,bytesPerPixel=0;
 const compressed=[];
 while(offset+12<=png.length){
  const length=png.readUInt32BE(offset);
  if(length>png.length-offset-12)return false;
  const type=png.toString('ascii',offset+4,offset+8);
  const end=offset+12+length;
  if(png.readUInt32BE(end-4)!==pngCrc32(png,offset+4,end-4))return false;
  if(!hasHeader){
   if(type!=='IHDR'||length!==13||
    png.readUInt32BE(offset+8)!==width||
    png.readUInt32BE(offset+12)!==height)return false;
   // Playwright screenshots are 8-bit, non-interlaced RGB or RGBA.
   // Reject unsupported formats instead of claiming to have decoded them.
   const colorType=png[offset+17];
   if(png[offset+16]!==8||![2,6].includes(colorType)||
    png[offset+18]!==0||png[offset+19]!==0||png[offset+20]!==0)return false;
   bytesPerPixel=colorType===6?4:3;
   hasHeader=true;
  }else if(type==='IHDR')return false;
  if(type==='IDAT'){
   if(idatEnded)return false; // IDAT chunks must be consecutive.
   compressed.push(png.subarray(offset+8,end-4));
  }else if(compressed.length)idatEnded=true;
  if(type==='IEND'){
   if(length!==0||!compressed.length||end!==png.length)return false;
   const rowLength=width*bytesPerPixel+1;
   const expectedLength=rowLength*height;
   try{
    // CRC validates the container; zlib and scanline checks validate actual
    // pixel data. A CRC-correct PNG with an empty/bogus IDAT is not evidence.
    const pixels=inflateSync(Buffer.concat(compressed),{maxOutputLength:expectedLength+1});
    if(pixels.length!==expectedLength)return false;
    for(let row=0;row<height;row++)if(pixels[row*rowLength]>4)return false;
    return true;
   }catch{return false;}
  }
  offset=end;
 }
 return false;
}
export const UX_QA_MATRIX=[
 ...['graphite','studio'].flatMap(theme=>[1440,1024,768,390].map(width=>({theme,width})))
];
// Each named state must be captured once for every theme and viewport.
// Passing functional assertions without the corresponding visual evidence
// must never produce a green automated report.
export const UX_QA_REQUIRED_SCREENSHOTS=[
 'workspace','toolbar','toolbar-focus','toolbar-last-focus','toolbar-disabled-focus-handoff','toolbar-hidden-focus-handoff','toolbar-detached-focus-handoff',
 'range-normal','range-hover','range-focus','range-invalid','range-escape-focused','range-native-override','range-valid','range-disabled',
 'range-live-valid','range-live-invalid','range-live-any','range-live-any-stepper','range-live-grid-edge','range-live-disabled','range-disabled-focus-handoff',
 'color-focus','color-swatch-focus','color-invalid','color-draft-sync','color-escape-focused','color-valid','color-disabled','color-disabled-focus-handoff','color-swatch-disabled-focus-handoff','color-eyedropper-pending-focus','color-eyedropper-disabled-focus-handoff','color-eyedropper-stale-ignored','color-picker-error-handoff','color-picker-error-owner','color-picker-switch-text','color-picker-switch-back',
 'select-hover','select-open','select-group-disabled','select-typeahead-prefix','select-long-option',
 'select-live-value','select-live-options','select-live-options-removed',
 'select-hidden-optgroup','select-all-disabled','select-resize-focus',
 'select-scroll-focus-handoff','select-tab-forward','select-tab-backward',
 'select-accordion-collapse-focus-handoff','select-tab-switch-focus-handoff','select-inspector-close-focus-handoff',
 'select-disabled-focus-handoff','select-disabled-trigger-focus-handoff','select-disabled',
 'quick-select-disabled-focus-handoff','quick-gallery-disabled-focus-handoff',
 'number-focus','number-invalid','number-valid','number-rollback-valid-draft','number-disabled','number-disabled-invalid-draft','number-disabled-focus-handoff','number-stepper-disabled-focus-handoff','number-slider-disabled-focus-handoff','number-slider-invalid-bounds',
 'binary-disabled','binary-disabled-focus-handoff','binary-toggled','binary-keyboard-on','binary-keyboard-off','binary-external-selection-focus',
 'segment-disabled-focus','segment-keyboard-focus','segment-external-selection-focus','segment-live-options','segment-live-focus-handoff','segment-removed-disabled-neighbor','segment-disabled-focus-handoff'
];
export function summarizeScreenshotCoverage(screenshots){
 const expected=UX_QA_MATRIX.flatMap(({theme,width})=>
  UX_QA_REQUIRED_SCREENSHOTS.map(state=>theme+':'+width+':'+state));
 const expectedKeys=new Set(expected);
 const counts=new Map(),invalidPaths=[];
 for(const {theme,width,state,path} of screenshots){
  const key=theme+':'+width+':'+state;
  counts.set(key,(counts.get(key)||0)+1);
  // Reject mismatched or missing file references, even if the state names
  // happen to form a complete matrix. No absolute path is required.
  const basename=typeof path==='string'?path.split(/[\\/]/).pop():'';
  if(basename!==theme+'-'+width+'-'+state+'.png')invalidPaths.push(key);
 }
 return {expected:expected.length,captured:screenshots.length,
  missing:expected.filter(key=>!counts.has(key)),
  duplicates:expected.filter(key=>(counts.get(key)||0)>1),
  unexpected:[...counts.keys()].filter(key=>!expectedKeys.has(key)),
  invalidPaths};
}
export function summarizeUxCoverage(coverage,findings,stopped=false){
 const expected=new Set(UX_QA_MATRIX.map(({theme,width})=>theme+':'+width));
 const actual=coverage.map(({theme,width})=>theme+':'+width);
 const unique=new Set(actual);
 const complete=actual.length===expected.size&&unique.size===expected.size&&[...expected].every(key=>unique.has(key));
 const passing=coverage.filter(row=>row.scenario&&row.inspector&&row.toolbar&&row.errors===0).length;
 const errors=findings.filter(item=>item.severity==='error').length;
 const status=stopped?'stopped':complete&&passing===expected.size&&errors===0?'passed':'failed';
 return {status,expected:expected.size,completed:coverage.length,passing,failed:coverage.length-passing,errors,complete,stopped};
}

/** A green automated matrix is not a human UX sign-off. */
export function parseHumanReviewChoice(choice){
 const value=String(choice??'').trim().toLowerCase();
 if(value==='a')return 'approved';
 if(value==='r')return 'rejected';
 return 'not-reviewed';
}

/** Human sign-off is tied to one capture session and every required state. */
export function validateHumanReviewEvidence(review,sessionId){
 const states=review?.states;
 const expected=new Set(UX_QA_REQUIRED_SCREENSHOTS);
 const validShape=review?.schema===1&&review?.sessionId===sessionId&&
  states&&typeof states==='object'&&!Array.isArray(states);
 const missing=UX_QA_REQUIRED_SCREENSHOTS.filter(state=>states?.[state]?.status!=='approved');
 const rejected=UX_QA_REQUIRED_SCREENSHOTS.filter(state=>states?.[state]?.status==='rejected');
 const unexpected=Object.keys(states&&typeof states==='object'&&!Array.isArray(states)?states:{}).filter(key=>!expected.has(key));
 return {valid:Boolean(validShape)&&missing.length===0&&unexpected.length===0,
  sessionMatches:review?.sessionId===sessionId,missing,rejected,unexpected};
}
