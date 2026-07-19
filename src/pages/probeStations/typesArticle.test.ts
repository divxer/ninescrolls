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
    /\$+\s*[–-]\s*\$+/,
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
