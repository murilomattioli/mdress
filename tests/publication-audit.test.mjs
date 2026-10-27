import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, isSensitiveTrackedPath, auditTrackedFiles } from '../scripts/publication-audit.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

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

test('tracked env and private key paths are blocked without needing recognizable tokens', () => {
  for (const path of ['.env', '.env.local', 'config/.env.production', 'certs/server.pem', 'certs/client.p12', 'id_ed25519']) {
    assert.equal(isSensitiveTrackedPath(path), true, path);
  }
  for (const path of ['.env.example', '.env.sample', 'docs/notes.md', 'app/index.html']) {
    assert.equal(isSensitiveTrackedPath(path), false, path);
  }
});

test('publication audit detects a tracked env file without printing its contents', () => {
  const root = mkdtempSync(join(tmpdir(), 'mdress-publication-audit-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'config', '.env.production'), 'PASSWORD=not-a-known-token-format\n');
    writeFileSync(join(root, 'README.md'), 'Public project\n');
    execFileSync('git', ['-C', root, 'add', '--', '.']);
    const result = auditTrackedFiles(root);
    assert.deepEqual(result.findings, [{path:'config/.env.production', line:1, rule:'tracked-sensitive-file'}]);
    assert.equal(result.filesChecked, 2);
    assert.ok(!JSON.stringify(result).includes('not-a-known-token-format'));
  } finally {
    rmSync(root, {recursive:true, force:true});
  }
});
