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
});
