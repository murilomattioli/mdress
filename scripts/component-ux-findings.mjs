/**
 * Deduplicate repeated observations within a single audit scenario.
 * A finding in a different theme or viewport is separate evidence and
 * must not disappear from the report.
 */
export function deduplicateAuditFindings(findings) {
  const byScenario = new Map();
  for (const finding of findings) {
    const key = JSON.stringify([
      finding.rule,
      finding.severity,
      finding.component,
      finding.detail,
      finding.context?.theme,
      finding.context?.width,
      finding.context?.html,
    ]);
    if (!byScenario.has(key)) byScenario.set(key, finding);
  }
  return [...byScenario.values()];
}

/**
 * Summarize deduplicated audit findings without hiding affected scenarios.
 * Warning counts are diagnostic; only critical findings fail the audit.
 */
export function summarizeAuditFindings(findings, coverage) {
  const count = (items, severity) => items.filter(item => item.severity === severity).length;
  return {
    critical: count(findings, 'error'),
    warnings: count(findings, 'warning'),
    scenarios: coverage.map(({theme, width}) => {
      const scoped = findings.filter(item => item.context?.theme === theme && item.context?.width === width);
      return {
        theme,
        width,
        critical: count(scoped, 'error'),
        warnings: count(scoped, 'warning'),
        rules: [...new Set(scoped.map(item => item.rule))].sort(),
      };
    }),
  };
}

/** A scenario with no visible controls cannot be reported as a clean UX audit. */
export function auditCoverageFinding(count,context){
 if(Number.isInteger(count)&&count>0)return null;
 return {rule:'coverage',severity:'error',component:'app',
  detail:'Nenhum controle visível foi inventariado',context};
}

/**
 * Detect actionable overlap between distinct inspector controls in the same
 * property row. Intentional toolbar scrolling and adjacent shared borders
 * are not collisions. Coordinates come from rendered browser rectangles.
 */
export function findInspectorControlOverlaps(rows,minimumIntersection=4){
 const collisions=[];
 for(const row of rows){
  const controls=row.controls||[];
  for(let i=0;i<controls.length;i++){
   for(let j=i+1;j<controls.length;j++){
    const a=controls[i],b=controls[j];
    const horizontal=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
    const vertical=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
    if(horizontal<=minimumIntersection||vertical<=minimumIntersection)continue;
    collisions.push({
     row:row.name,first:a.name,second:b.name,
     horizontal:Math.round(horizontal),vertical:Math.round(vertical),
     html:a.html+' | '+b.html
    });
   }
  }
 }
 return collisions;
}

/**
 * Controls from distinct property rows must never occupy the same hit area.
 * Unlike within-row checks, this also catches a row escaping its layout
 * container and covering the neighboring row after responsive reflow.
 */
export function findInspectorCrossRowOverlaps(rows,minimumIntersection=4){
 const collisions=[];
 for(let i=0;i<rows.length;i++){
  for(let j=i+1;j<rows.length;j++){
   for(const a of rows[i].controls||[]){
    for(const b of rows[j].controls||[]){
     const horizontal=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
     const vertical=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
     if(horizontal<=minimumIntersection||vertical<=minimumIntersection)continue;
     collisions.push({
      row:rows[i].name,otherRow:rows[j].name,
      first:a.name,second:b.name,
      horizontal:Math.round(horizontal),vertical:Math.round(vertical),
      html:a.html+' | '+b.html
     });
    }
   }
  }
 }
 return collisions;
}

/** Report broken IDREFs rather than mistaking aria-labelledby for a name. */
export function missingAriaReferenceIds(value,exists){
 return [...new Set(String(value||'').trim().split(/\s+/).filter(Boolean))]
  .filter(id=>!exists(id));
}
