#!/usr/bin/env node
/**
 * Lightweight credential-leak guard for the public mdress snapshot.
 * Checks tracked text files only. This is NOT a comprehensive security,
 * privacy, dependency or license audit.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.svg',
  '.txt', '.webmanifest', '.yaml', '.yml',
]);
const RULES = [
  ['private-key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g],
  ['github-token', /\b(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{16,}/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['stripe-secret-key', /\b(?:sk_live_|rk_live_)[A-Za-z0-9]{12,}/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{16,}/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['openai-api-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
];

/** Return only rule IDs and line numbers, never credential values. */
export function scanText(content) {
  const findings = [];
  for (const [rule, pattern] of RULES) {
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ rule, line });
    }
  }
  return findings;
}

/** Block sensitive tracked filenames even when their contents contain no recognizable token. */
export function isSensitiveTrackedPath(path) {
  const name = path.split('/').at(-1);
  if (name === '.env.example' || name === '.env.sample') return false;
  return /^(?:\.env(?:\..+)?|id_rsa|id_ed25519|.+\.(?:pem|p12|pfx|key))$/i.test(name);
}

function trackedFiles(root) {
  // Inspect Git index modes rather than filesystem symlinks: on Windows,
  // core.symlinks=false can check out a tracked link as an ordinary text file.
  const output = execFileSync('git', ['-C', root, 'ls-files', '--stage', '-z']);
  return output.toString('utf8').split('\0').filter(Boolean).map(entry => {
    const separator = entry.indexOf('\t');
    if (separator < 0) throw new Error('Unexpected git ls-files --stage output');
    return {
      mode: entry.slice(0, separator).split(' ')[0],
      path: entry.slice(separator + 1),
    };
  });
}

export function auditTrackedFiles(root = ROOT) {
  const findings = [];
  const files = trackedFiles(root);
  let filesChecked = 0;
  for (const { path, mode } of files) {
    // Never follow tracked symlinks during a public-snapshot audit.
    // Their targets can escape the repository or contain private content.
    if (mode === '120000') {
      findings.push({ path, line: 1, rule: 'tracked-symlink' });
      filesChecked++;
      continue;
    }
    if (isSensitiveTrackedPath(path)) {
      findings.push({ path, line: 1, rule: 'tracked-sensitive-file' });
      filesChecked++;
      continue;
    }
    if (!TEXT_EXTENSIONS.has(extname(path)) && path !== '.gitignore' && path !== '.gitattributes') continue;
    filesChecked++;
    const text = readFileSync(join(root, path), 'utf8');
    for (const finding of scanText(text)) findings.push({ path, ...finding });
  }
  return { filesChecked, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { filesChecked, findings } = auditTrackedFiles();
  for (const { path, line, rule } of findings) {
    console.error(`::error file=${path},line=${line}::Potential credential pattern (${rule}); inspect privately`);
  }
  console.log(`Public snapshot credential guard: ${filesChecked} tracked files inspected; ${findings.length} finding(s).`);
  if (findings.length) process.exitCode = 1;
}
