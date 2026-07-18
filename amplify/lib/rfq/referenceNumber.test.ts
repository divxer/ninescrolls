// amplify/lib/rfq/referenceNumber.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { deriveReferenceNumber } from './referenceNumber';

describe('deriveReferenceNumber', () => {
  it('preserves the exact legacy format for a direct rfq id', () => {
    expect(deriveReferenceNumber('rfq-20260310-a1b2c3', '2026-03-10T12:00:00.000Z'))
      .toBe('RFQ-20260310-A1B2');
  });

  it('derives a dated reference from submittedAt for a base64url draft id', () => {
    const rfqId = 'aB-cd_EF0123456789ghijklmnopqrstuvwxyzABCDEF';
    expect(deriveReferenceNumber(rfqId, '2026-07-18T09:30:00.000Z')).toMatch(/^RFQ-20260718-[0-9A-F]{4}$/);
  });

  it('is deterministic across times on the same date for a draft id', () => {
    const rfqId = 'aB-cd_EF0123456789ghijklmnopqrstuvwxyzABCDEF';
    expect(deriveReferenceNumber(rfqId, '2026-07-18T09:30:00.000Z'))
      .toBe(deriveReferenceNumber(rfqId, '2026-07-18T23:59:59.000Z'));
  });

  it('does not misclassify a hyphenated base64url id as legacy', () => {
    const rfqId = '12345678-abcdefg_hijk';
    const suffix = crypto.createHash('sha256').update(rfqId).digest('hex').slice(0, 4).toUpperCase();
    expect(deriveReferenceNumber(rfqId, '2026-07-18T00:00:00.000Z')).toBe(`RFQ-20260718-${suffix}`);
  });
});
