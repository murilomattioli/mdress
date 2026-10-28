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
