import { describe, it, expect } from 'vitest';
import { findBannedTokens } from './bannedOem';

describe('findBannedTokens', () => {
  it('flags OEM names and internal model strings, case-insensitively', () => {
    expect(findBannedTokens('Etched on a Tailong ICP-100A system'))
      .toEqual(expect.arrayContaining(['Tailong', 'ICP-100A']));
  });
  it('flags an OEM-identifying slug via the brand token', () => {
    expect(findBannedTokens('pub-tailong-icp100a-nanomaterials-2020')).toContain('Tailong');
  });
  it('passes clean, attribution-safe text', () => {
    expect(findBannedTokens('Silicon-nanopillar metasurfaces dry-etched for flow imaging')).toEqual([]);
  });

  it('flags the PLUTOVAC OEM brand but NOT the public PLUTO-T/F/M product names', () => {
    // PLUTO-T/F/M are NineScrolls's own public SKU names (used as public Evidence
    // product slugs). Only the OEM brand must stay banned. Guards against an
    // accidental re-ban that would false-positive every per-model payload.
    const hits = findBannedTokens('cleaned in a plasma cleaner (PLUTOVAC, PLUTO-T)');
    expect(hits).toContain('PLUTOVAC');
    expect(hits).not.toContain('PLUTO-T');
  });

  it('does not flag public plasma-cleaner SKU slugs', () => {
    expect(findBannedTokens('pluto-t')).toEqual([]);
    expect(findBannedTokens('pluto-f')).toEqual([]);
    expect(findBannedTokens('pluto-m')).toEqual([]);
  });

  it('keeps the PLUTOVAC OEM brand + legal-name tokens banned', () => {
    expect(findBannedTokens('Shanghai Peiyuan / 沛沅 (PLUTOVAC)'))
      .toEqual(expect.arrayContaining(['PLUTOVAC', 'Peiyuan', '沛沅', 'Shanghai Peiyuan']));
  });
});
