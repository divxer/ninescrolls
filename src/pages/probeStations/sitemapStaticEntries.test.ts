import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The full expected entries, lastmod included. When a launch-page lastmod is
// intentionally bumped later, update it HERE too — the test forces both
// generators and this expectation to move together.
const ENTRIES = [
  { loc: '/wafer-probe-stations', lastmod: '2026-07-12', changefreq: 'weekly', priority: '0.9' },
  { loc: '/wafer-probe-stations/semishare', lastmod: '2026-07-12', changefreq: 'weekly', priority: '0.9' },
  { loc: '/applications/cryogenic-probing', lastmod: '2026-07-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/applications/silicon-photonics-probing', lastmod: '2026-07-12', changefreq: 'monthly', priority: '0.8' },
];
const GENERATORS = [
  'scripts/generate-seo.ts',
  'amplify/functions/generate-sitemaps/handler.ts',
];

describe.each(GENERATORS)('%s', (file) => {
  const text = readFileSync(file, 'utf8');
  it.each(ENTRIES)('contains $loc with the exact expected metadata', ({ loc, lastmod, changefreq, priority }) => {
    const entry = new RegExp(
      `\\{\\s*loc:\\s*'${loc.replace(/[/]/g, '\\/')}',\\s*lastmod:\\s*'${lastmod}',\\s*changefreq:\\s*'${changefreq}',\\s*priority:\\s*'${priority}'\\s*\\}`
    );
    expect(text).toMatch(entry);
  });
});
