import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('build dependency hygiene', () => {
  it('does not track spreadsheet archives', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\0').filter(Boolean);
    expect(tracked.filter(path => /\.(?:xlsx|xls|xlsm|xlsb)$/i.test(path))).toEqual([]);
  });

  it('ignores the default confidential normalized output', () => {
    expect(execFileSync(
      'git', ['check-ignore', '-q', 'scripts/data/historical-quotations.normalized.json'],
      { cwd: repoRoot, encoding: 'utf8' },
    )).toBe('');
  });

  it('isolates the workbook parser from authentication and credentials', () => {
    const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'scripts'], {
      cwd: repoRoot, encoding: 'utf8',
    }).trim().split('\n').filter(path => path.endsWith('.ts'));
    const parserPackage = ['read', 'excel', 'file'].join('-');
    const parserImports = tracked.filter(path =>
      readFileSync(resolve(repoRoot, path), 'utf8').includes(`from '${parserPackage}`));
    expect(parserImports).toEqual(['scripts/extract-historical-workbook.ts']);
    const extractor = readFileSync(resolve(repoRoot, parserImports[0]), 'utf8');
    expect(extractor).not.toMatch(/aws-amplify|amplify_outputs|\.\/lib\/auth|ADMIN_|AWS_|TOKEN/i);

    const normalizer = readFileSync(resolve(repoRoot, 'scripts/normalize-historical-quotations.ts'), 'utf8');
    expect(normalizer).toContain("['PATH', 'TMPDIR', 'LANG', 'LC_ALL']");
    expect(normalizer.indexOf('execFileSync(tsx')).toBeLessThan(normalizer.indexOf("import('aws-amplify')"));
  });
  it('keeps the build script free of dependency installation', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.build).not.toMatch(/\bnpm\s+(?:i|install|ci)\b/);
    expect(packageJson.scripts.build).toContain('npm run lint');
    expect(packageJson.scripts.build).toContain('npm run typecheck:amplify');
    expect(packageJson.scripts.build).toContain('vite build');
    expect(packageJson.scripts.build).toContain('npm run generate-seo');
  });

  it('uses npm ci without deleting the lockfile in GitHub CI', () => {
    const workflow = readFileSync(
      resolve(repoRoot, '.github/workflows/ci.yml'),
      'utf8',
    );

    expect(workflow).toContain('run: npm ci');
    expect(workflow).not.toContain('rm -rf node_modules package-lock.json');
    expect(workflow).not.toContain('npm install --no-ignore-optional');
  });

  it('uses npm ci before Amplify builds', () => {
    const amplifyConfig = readFileSync(resolve(repoRoot, 'amplify.yml'), 'utf8');

    expect(amplifyConfig).toContain('- npm ci');
    expect(amplifyConfig).not.toContain('rm -rf node_modules package-lock.json');
  });
});
