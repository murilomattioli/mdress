import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateAuditFindings} from '../scripts/component-ux-findings.mjs';

const finding = (theme, width, severity = 'warning') => ({
  rule: 'scrollable-toolbar',
  severity,
  component: 'button',
  detail: 'Controle fora da área visível',
  context: {theme, width, html: '<button title="Citação">Citação</button>'},
});

test('preserves the same control finding across viewports and themes', () => {
  const observations = [
    finding('studio', 1024),
    finding('studio', 768),
    finding('graphite', 1024),
  ];
  assert.deepEqual(deduplicateAuditFindings(observations), observations);
});

test('deduplicates repeated observations only within the same scenario', () => {
  const original = finding('studio', 1024);
  assert.deepEqual(
    deduplicateAuditFindings([original, {...original}, finding('studio', 768)]),
    [original, finding('studio', 768)],
  );
});

test('never collapses a critical error into a warning', () => {
  const warning = finding('studio', 1024);
  const error = finding('studio', 1024, 'error');
  assert.deepEqual(deduplicateAuditFindings([warning, error]), [warning, error]);
});
