/** Explicit coverage contract: incomplete, duplicate or interrupted matrices never pass. */
export const UX_QA_MATRIX=[
 ...['graphite','studio'].flatMap(theme=>[1440,1024,768].map(width=>({theme,width})))
];
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
