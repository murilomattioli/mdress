/** Explicit coverage contract: incomplete, duplicate or interrupted matrices never pass. */
export const UX_QA_MATRIX=[
 ...['graphite','studio'].flatMap(theme=>[1440,1024,768].map(width=>({theme,width})))
];
// Each named state must be captured once for every theme and viewport.
// Passing functional assertions without the corresponding visual evidence
// must never produce a green automated report.
export const UX_QA_REQUIRED_SCREENSHOTS=[
 'workspace','toolbar','toolbar-focus','toolbar-last-focus',
 'range-normal','range-hover','range-focus','range-invalid','range-native-override','range-valid','range-disabled',
 'range-live-valid','range-live-invalid','range-live-any','range-live-disabled',
 'color-focus','color-invalid','color-draft-sync','color-valid','color-disabled',
 'select-hover','select-open','select-group-disabled','select-typeahead-prefix',
 'select-live-value','select-live-options','select-live-options-removed',
 'select-hidden-optgroup','select-all-disabled','select-resize-focus',
 'select-scroll-focus-handoff','select-tab-forward','select-tab-backward',
 'select-disabled-focus-handoff','select-disabled-trigger-focus-handoff','select-disabled',
 'number-focus','number-invalid','number-valid','number-disabled',
 'binary-disabled','binary-disabled-focus-handoff','binary-toggled','binary-keyboard-on','binary-keyboard-off',
 'segment-disabled-focus','segment-keyboard-focus'
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
