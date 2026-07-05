import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('generate-sitemaps static product coverage', () => {
  it('keeps the dynamic Lambda sitemap in sync with the static SEO generator for E-Beam', () => {
    const lambdaHandler = readRepoFile('amplify/functions/generate-sitemaps/handler.ts');
    const staticGenerator = readRepoFile('scripts/generate-seo.ts');

    expect(staticGenerator).toContain("loc: '/products/e-beam-evaporator'");
    expect(lambdaHandler).toContain("loc: '/products/e-beam-evaporator'");
  });
});
