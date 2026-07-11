import { describe, it, expect } from 'vitest';
import { parsePdfFonts, assertEmbeddedFontsOutput } from './pdfFontsCheck';

const HEADER =
  'name                                 type              encoding         emb sub uni object ID\n' +
  '------------------------------------ ----------------- ---------------- --- --- --- ---------';
const GOOD = `${HEADER}
BCDEEF+SpaceGrotesk-Bold             CID TrueType      Identity-H       yes yes yes     12  0
ABCDEF+Inter-Regular                 CID TrueType      Identity-H       yes yes yes     14  0`;

describe('parsePdfFonts', () => {
  it('parses rows into {name, emb, sub} with header skipped', () => {
    expect(parsePdfFonts(GOOD)).toEqual([
      { name: 'BCDEEF+SpaceGrotesk-Bold', emb: 'yes', sub: 'yes' },
      { name: 'ABCDEF+Inter-Regular', emb: 'yes', sub: 'yes' },
    ]);
  });
  it('throws on unrecognizable output (fail-closed, never silently passes)', () => {
    expect(() => parsePdfFonts('')).toThrow();
    expect(() => parsePdfFonts('garbage with no header')).toThrow();
  });
  it('parses emb/sub correctly even when a long name overflows the fixed-width column', () => {
    // real variable-font instance names overrun the 36-char name column, shifting absolute offsets
    const long = `${HEADER}\nEAAAAA+SpaceGrotesk-Light_wght2580000 Type 3           Custom           yes yes yes     12  0`;
    expect(parsePdfFonts(long)).toEqual([{ name: 'EAAAAA+SpaceGrotesk-Light_wght2580000', emb: 'yes', sub: 'yes' }]);
  });
});

describe('assertEmbeddedFontsOutput', () => {
  it('accepts subset-embedded Space Grotesk + Inter', () => {
    expect(() => assertEmbeddedFontsOutput(parsePdfFonts(GOOD))).not.toThrow();
  });
  it('rejects when a required family is missing', () => {
    const one = parsePdfFonts(`${HEADER}\nBCDEEF+SpaceGrotesk-Bold             CID TrueType      Identity-H       yes yes yes     12  0`);
    expect(() => assertEmbeddedFontsOutput(one)).toThrow(/Inter/);
  });
  it('rejects emb=no or sub=no for a required family', () => {
    const bad = parsePdfFonts(GOOD.replace('yes yes yes     14', 'no  no  yes     14'));
    expect(() => assertEmbeddedFontsOutput(bad)).toThrow(/Inter/);
  });
  it('rejects any fallback family regardless of the rest (subset prefix stripped, case-folded)', () => {
    const fb = parsePdfFonts(`${GOOD}\nGHIJKL+Helvetica                     TrueType          WinAnsi          yes yes yes     16  0`);
    expect(() => assertEmbeddedFontsOutput(fb)).toThrow(/Helvetica/i);
  });
});
