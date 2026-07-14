import { describe, it, expect } from 'vitest';
import {
  generateSupplierId, generateCatalogItemId, formatQuotationNumber, versionSk, lineSk,
} from './ids.js';

describe('ids', () => {
  it('prefixes entity ids', () => {
    expect(generateSupplierId()).toMatch(/^sup-/);
    expect(generateCatalogItemId()).toMatch(/^cat-/);
    expect(generateSupplierId()).not.toBe(generateSupplierId());
  });

  it('formats quotation numbers as Q-YYYY-NNNN', () => {
    expect(formatQuotationNumber(2026, 1)).toBe('Q-2026-0001');
    expect(formatQuotationNumber(2026, 123)).toBe('Q-2026-0123');
    expect(formatQuotationNumber(2027, 10000)).toBe('Q-2027-10000'); // >4 digits never truncates
  });

  it('zero-pads sort keys so DDB lexical order equals numeric order', () => {
    expect(versionSk(1)).toBe('V#001');
    expect(versionSk(12)).toBe('V#012');
    expect(lineSk(3, 7)).toBe('V#003#LINE#07');
    expect(lineSk(3, 45)).toBe('V#003#LINE#45');
  });
});
