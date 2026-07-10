import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('build dependency hygiene', () => {
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
