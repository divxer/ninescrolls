// src/data/probeStations/attestationScan.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_ATTESTATION_PATTERNS } from './semishare';

const REGISTRY_FILE = join('src', 'data', 'probeStations', 'semishare.ts');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('attestation wording static scan (spec Constraint 6)', () => {
  it('no forbidden attestation phrase or badge asset pattern appears in src/** outside the registry', () => {
    const files = walk('src').filter(
      (f) =>
        /\.(ts|tsx)$/.test(f) &&
        !/\.test\.(ts|tsx)$/.test(f) &&
        f !== REGISTRY_FILE &&
        !f.split(sep).includes('test-setup.ts')
    );
    expect(files.length).toBeGreaterThan(100); // sanity: the walk actually ran

    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
        if (pattern.test(text)) violations.push(`${file} matches ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
