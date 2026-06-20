import { describe, it, expect } from 'vitest';
import { generateCaseId, generateLegId, formatCaseNumber } from './idGenerators.js';

describe('idGenerators', () => {
  it('generateCaseId is prefixed and unique', () => {
    const a = generateCaseId();
    const b = generateCaseId();
    expect(a).toMatch(/^lc-\d{8}-[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
  });

  it('generateLegId is prefixed', () => {
    expect(generateLegId()).toMatch(/^leg-[0-9a-f]{6}$/);
  });

  it('formatCaseNumber zero-pads to 4 digits', () => {
    expect(formatCaseNumber(2026, 1)).toBe('NS-LOG-2026-0001');
    expect(formatCaseNumber(2026, 42)).toBe('NS-LOG-2026-0042');
    expect(formatCaseNumber(2026, 12345)).toBe('NS-LOG-2026-12345');
  });
});
