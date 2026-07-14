import { describe, it, expect } from 'vitest';
import { allocateTotalOverride, type AllocLine } from './allocation.js';

const L = (sku: string, suggestedLineTotalUsdCents: number | null, lineType: 'NORMAL' | 'SURCHARGE' = 'NORMAL'): AllocLine =>
  ({ sku, lineType, suggestedLineTotalUsdCents });

describe('allocateTotalOverride', () => {
  it('allocates proportionally and sums exactly to the override total', () => {
    // suggested 100/200/300 (total 600), override 500
    const res = allocateTotalOverride([L('a', 100), L('b', 200), L('c', 300)], 500);
    expect(res.map((r) => r.actualLineTotalUsdCents)).toEqual([83, 167, 250]);
    expect(res.reduce((s, r) => s + r.actualLineTotalUsdCents, 0)).toBe(500);
  });

  it('hands out remainder units by descending fractional remainder, ties by position', () => {
    // 3 equal lines of 100 (total 300), override 100 → each 33.33; floors 33,33,33, remainder 1
    // equal remainders → position tie-break: first line gets the extra unit
    const res = allocateTotalOverride([L('a', 100), L('b', 100), L('c', 100)], 100);
    expect(res.map((r) => r.actualLineTotalUsdCents)).toEqual([34, 33, 33]);
  });

  it('excludes SURCHARGE lines from allocation and keeps their amounts', () => {
    const res = allocateTotalOverride([L('a', 100), L('f', 50, 'SURCHARGE')], 130);
    // allocatable portion = 130 - 50 = 80 goes entirely to line a
    expect(res.find((r) => r.sku === 'a')!.actualLineTotalUsdCents).toBe(80);
    expect(res.find((r) => r.sku === 'f')!.actualLineTotalUsdCents).toBe(50);
  });

  it('rejects when no allocatable lines exist', () => {
    expect(() => allocateTotalOverride([L('f', 50, 'SURCHARGE')], 40)).toThrow(/^VALIDATION:/);
  });

  it('rejects when allocatable suggested sum is zero', () => {
    expect(() => allocateTotalOverride([L('a', 0)], 100)).toThrow(/^VALIDATION:/);
  });

  it('rejects when the allocatable portion would be <= 0 after fixed surcharges', () => {
    expect(() => allocateTotalOverride([L('a', 100), L('f', 50, 'SURCHARGE')], 50)).toThrow(/^VALIDATION:/);
  });

  it('rejects unknown suggested prices (incomplete quote cannot take a total override)', () => {
    expect(() => allocateTotalOverride([L('a', null)], 100)).toThrow(/^VALIDATION:/);
  });

  it('rejects a non-integer override total (minor units only)', () => {
    expect(() => allocateTotalOverride([L('a', 100)], 100.5)).toThrow(/^VALIDATION:/);
  });

  it('distributes multiple leftover units one per line, ties by position', () => {
    // weights [100,100,100], override 200 → floors [66,66,66], leftover 2 → [67,67,66]
    const res = allocateTotalOverride([L('a', 100), L('b', 100), L('c', 100)], 200);
    expect(res.map((r) => r.actualLineTotalUsdCents)).toEqual([67, 67, 66]);
  });

  it('allocates duplicate-sku lines independently by index', () => {
    const res = allocateTotalOverride([L('a', 100), L('a', 300)], 200);
    expect(res.map((r) => r.actualLineTotalUsdCents)).toEqual([50, 150]);
  });
});
