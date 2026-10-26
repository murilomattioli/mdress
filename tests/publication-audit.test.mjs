import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../scripts/publication-audit.mjs';

test('credential guard reports known token formats without exposing values', () => {
  const token = 'ghp_' + 'a'.repeat(30);
  const findings = scanText('safe line\n' + token + '\n');
  assert.deepEqual(findings, [{ rule: 'github-token', line: 2 }]);
  assert.ok(!JSON.stringify(findings).includes(token));
});

test('credential guard detects private key headers and AWS access key IDs', () => {
  const keyHeader = '-----BEGIN ' + 'PRIVATE KEY-----';
  const awsKey = 'AKIA' + 'A'.repeat(16);
  const findings = scanText(keyHeader + '\n' + awsKey);
  assert.deepEqual(findings, [
    { rule: 'private-key', line: 1 },
    { rule: 'aws-access-key', line: 2 },
  ]);
});

test('credential guard ignores placeholder strings and non-secret configuration', () => {
  assert.deepEqual(scanText(
    'GITHUB_TOKEN=process.env.GITHUB_TOKEN\n' +
    'token=YOUR_TOKEN_HERE\n' +
    'https://api.github.com/repos/murilomattioli/mdress'
  ), []);
});
