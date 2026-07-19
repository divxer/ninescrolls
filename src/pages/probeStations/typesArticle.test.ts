import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import matrix from '../../data/probeStations/typeMatrixContent.json';

// ---------------------------------------------------------------------------
// Single-source guard families. Consumed by: (a) matrix-cell assertions,
// (b) article-content assertions, (c) the mutation meta-test. Mirrors the
// GUARD_FAMILIES pattern in cryoBuyersGuideArticle.test.ts.
// ---------------------------------------------------------------------------
const UNIT = String.raw`(?:nm|µm|um|mm|cm|K|°C|GHz|MHz|kHz|Hz|dB|dBm|torr|Torr|mbar|Pa|pA|nA|µA|uA|mA|A|mV|kV|V|mW|kW|W|Ω|ohm)`;
const GUARD_FAMILIES = {
  // Any digit attached to a physical unit — the article teaches WHAT to
  // review, never HOW MUCH. (\d then optional space/decimal then unit, word-bounded.)
  noUnitNumbers: [new RegExp(String.raw`\d+(?:\.\d+)?\s?${UNIT}\b`)],
  // Currency symbols, codes, price words with digits, and relative-cost runs.
  noCurrency: [
    /[$€£¥]/,
    /\bUSD|CNY|EUR|RMB\b/,
    /\$+\s*[\u2013-]\s*\$+/,
    /\bprice[sd]?\s+(?:from|at|around)\s+\d/i,
  ],
  // No vendor/brand names in matrix cells or type profiles (brand mentions
  // belong only in "Where NineScrolls Fits" + registry-safe contexts).
  noBrandInMatrix: [/semishare/i, /ninescrolls/i, /formfactor|lake\s*shore|micromanipulator|mpi\b|accretech/i],
} as const;

const allCells: string[] = (matrix.cells as string[][]).flat();

describe('type matrix single source', () => {
  it('has 6 types × 4 dimensions with a full cell grid', () => {
    expect(matrix.types).toHaveLength(6);
    expect(matrix.dimensions).toHaveLength(4);
    expect(matrix.cells).toHaveLength(4);
    for (const row of matrix.cells) expect(row).toHaveLength(6);
  });

  it('cells contain no unit-numbers, currency, or brand names', () => {
    for (const cell of allCells) {
      for (const family of Object.values(GUARD_FAMILIES)) {
        for (const pattern of family) {
          expect(cell, `cell "${cell}" vs ${pattern}`).not.toMatch(pattern);
        }
      }
    }
  });

  it('uses typographic punctuation in locked copy', () => {
    expect(matrix.dimensions[3]).toBe('Buyer\u2019s key question');
    expect(allCells.join(' ')).not.toContain("Buyer's"); // no straight-quote drift
  });
});

const ARTICLE_PATH = 'scripts/articles/types-of-wafer-probe-stations.html';
const html = () => readFileSync(ARTICLE_PATH, 'utf8');

// References-exemption scoping: guard families apply OUTSIDE the references
// block only. The article MUST wrap references in these exact markers.
const REF_OPEN = '<!-- guard-exempt:references -->';
const REF_CLOSE = '<!-- /guard-exempt:references -->';
const outsideReferences = (doc: string) => {
  const start = doc.indexOf(REF_OPEN);
  const end = doc.indexOf(REF_CLOSE);
  expect(start, 'references exemption markers present').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return doc.slice(0, start) + doc.slice(end + REF_CLOSE.length);
};

describe('types article - structure and metadata', () => {
  it('declares the locked slug, title, and TechArticle schema', () => {
    const doc = html();
    expect(doc).toMatch(/<meta name="article:slug" content="types-of-wafer-probe-stations">/);
    const title = doc.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
    expect(title).toContain('Types of Wafer Probe Stations');
    expect(title.length).toBeLessThanOrEqual(70); // page <title>; SEO title ≤60 asserted on article:title meta
    expect(doc).toMatch(/article:type" content="TechArticle"/);
  });

  it('contains the six type-profile sections in locked order', () => {
    const doc = html();
    const positions = matrix.types.map((t) => doc.indexOf(`<h3>${t}</h3>`));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `profile heading "${matrix.types[i]}"`).toBeGreaterThan(-1);
      if (i > 0) expect(pos).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('renders every matrix cell verbatim in the HTML table (single source)', () => {
    const doc = html();
    for (const cell of allCells) expect(doc).toContain(cell);
    for (const dim of matrix.dimensions) expect(doc).toContain(dim);
    expect(doc).toMatch(/<div class="table-scroll"|overflow-x:\s*auto/); // responsive defense
  });

  it('keeps unit-numbers, currency, and price symbols out of the body', () => {
    const body = outsideReferences(html());
    for (const family of [GUARD_FAMILIES.noUnitNumbers, GUARD_FAMILIES.noCurrency]) {
      for (const pattern of family) expect(body).not.toMatch(pattern);
    }
  });

  it('sentinel: no brand within 3 sentences of any exempted number', () => {
    const doc = html();
    const start = doc.indexOf(REF_OPEN);
    const end = doc.indexOf(REF_CLOSE);
    const refs = doc.slice(start, end);
    // Split the references block into sentence-ish units; any window of 7
    // consecutive units (≈3 sentences each side) containing a digit must not
    // also contain a brand.
    const units = refs.split(/(?<=[.!?])\s+|<\/li>/);
    for (let i = 0; i < units.length; i++) {
      if (!/\d/.test(units[i])) continue;
      const window = units.slice(Math.max(0, i - 3), i + 4).join(' ');
      expect(window, `brand near exempted number: "${units[i].slice(0, 60)}"`).not.toMatch(/ninescrolls|semishare/i);
    }
  });

  it('carries the required interlinks (spec \u00a7Interlink map)', () => {
    const doc = html();
    for (const href of [
      '/insights/how-to-choose-wafer-probe-station-university-lab',
      '/insights/cryogenic-probe-station-buyers-guide',
      '/insights/probe-station-procurement-nsf-doe-funded-projects',
      '/applications/cryogenic-probing',
      '/applications/silicon-photonics-probing',
      '/wafer-probe-stations/semishare',
    ]) {
      expect(doc, `interlink ${href}`).toContain(`href="${href}"`);
    }
  });

  it('keeps the figure figcaption disclaimer adjacent to the matrix figure', () => {
    const doc = html();
    expect(doc).toMatch(/<figcaption[^>]*>[^<]*illustrative comparison/i);
  });

  it('inherits kelvin discipline: no kelvin numbers anywhere in this survey article', () => {
    // #4 stays survey-level; temperature quantification lives in #3.
    const body = outsideReferences(html());
    expect(body).not.toMatch(/\d+(?:\.\d+)?\s?(?:k\b|kelvin\b)/i);
    expect(body).not.toMatch(/\bguaranteed\b/i);
    expect(body).not.toMatch(/installation\s+included/i);
  });
});
