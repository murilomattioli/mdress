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
