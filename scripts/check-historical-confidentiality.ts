import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanConfidentialBlob } from './lib/historicalQuotationImport';

const termsPath = process.env.HISTORICAL_CONFIDENTIAL_TERMS_FILE;
if (!termsPath) throw new Error('HISTORICAL_CONFIDENTIAL_TERMS_FILE is required');
const terms = readFileSync(termsPath, 'utf8').split(/\r?\n/).filter(term => term.length > 0);
if (terms.length === 0) throw new Error('Confidential terms file contains no non-empty terms');

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
let matches = 0;
const report = (scope: string, findings: string[]) => {
  if (!findings.length) return;
  const labels = findings.map(finding => finding.startsWith('term:') ? 'confidential-term' : finding);
  console.error(`${scope} (${labels.join(', ')})`);
  matches += findings.length;
};

const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root })
  .toString('utf8').split('\0').filter(Boolean);
for (const path of paths) {
  report(`working-tree:${path}`, scanConfidentialBlob(readFileSync(resolve(root, path)), terms));
}

const historicalObjects = execFileSync('git', ['rev-list', '--objects', '--all'], {
  cwd: root, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024,
})
  .split(/\r?\n/).filter(Boolean);
const pathsByOid = new Map(historicalObjects.map(entry => {
  const [oid, ...pathParts] = entry.split(' ');
  return [oid, pathParts.join(' ') || '<unknown-path>'] as const;
}));
const objectIds = [...pathsByOid.keys()];
const checked = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype)'], {
  cwd: root, encoding: 'utf8', input: `${objectIds.join('\n')}\n`, maxBuffer: 100 * 1024 * 1024,
});
const blobIds = checked.split(/\r?\n/).filter(line => line.endsWith(' blob')).map(line => line.split(' ')[0]);

const batch = spawn('git', ['cat-file', '--batch'], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
const batchExit = new Promise<number | null>((resolveExit, reject) => {
  batch.once('error', reject);
  batch.once('close', resolveExit);
});
batch.stdin.end(`${blobIds.join('\n')}\n`);
let pending = Buffer.alloc(0);
let expected: { oid: string; size: number } | null = null;
for await (const chunk of batch.stdout) {
  pending = Buffer.concat([pending, chunk as Buffer]);
  while (pending.length > 0) {
    if (!expected) {
      const newline = pending.indexOf(0x0a);
      if (newline < 0) break;
      const [oid, type, sizeText] = pending.subarray(0, newline).toString('utf8').split(' ');
      if (type !== 'blob' || !/^\d+$/.test(sizeText)) throw new Error(`Unexpected git cat-file header for ${oid}`);
      expected = { oid, size: Number(sizeText) };
      pending = pending.subarray(newline + 1);
    }
    if (pending.length < expected.size + 1) break;
    const bytes = pending.subarray(0, expected.size);
    report(`history:${expected.oid}:${pathsByOid.get(expected.oid) ?? '<unknown-path>'}`, scanConfidentialBlob(bytes, terms));
    pending = pending.subarray(expected.size + 1);
    expected = null;
  }
}
const exitCode = await batchExit;
if (exitCode !== 0 || expected || pending.length) throw new Error('git cat-file history scan ended unexpectedly');

if (matches > 0) {
  console.error(`Confidentiality scan found ${matches} location(s)`);
  process.exitCode = 1;
}
