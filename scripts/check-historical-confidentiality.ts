import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const termsPath = process.env.HISTORICAL_CONFIDENTIAL_TERMS_FILE;
if (!termsPath) throw new Error('HISTORICAL_CONFIDENTIAL_TERMS_FILE is required');
const terms = readFileSync(termsPath, 'utf8').split(/\r?\n/).filter(term => term.length > 0);
if (terms.length === 0) throw new Error('Confidential terms file contains no non-empty terms');

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root })
  .toString('utf8').split('\0').filter(Boolean);
let matches = 0;
for (const path of paths) {
  const bytes = readFileSync(resolve(root, path));
  if (bytes.includes(0)) continue;
  const lines = bytes.toString('utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const term of terms) {
      if (line.includes(term)) {
        console.error(`${path}:${index + 1}`);
        matches += 1;
      }
    }
  }
}
if (matches > 0) {
  console.error(`Confidentiality scan found ${matches} location(s)`);
  process.exitCode = 1;
}
