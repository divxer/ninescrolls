import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  deriveSubmitReceiptId, canonicalizeRfqPayload, computeRequestBinding,
} from './submitReceipt';
import { encodeCredential } from './draftCredentials';

const key = encodeCredential(crypto.randomBytes(32));
const PAYLOAD = {
  name: 'Jane', email: 'jane@stanford.edu', institution: 'Stanford',
  equipmentCategory: 'ICP', applicationDescription: 'silicon etching for MEMS work',
  quantity: 1, turnstileToken: 'one-time', submitIdempotencyKey: key, draftToken: 'secret',
};

describe('deriveSubmitReceiptId', () => {
  it('is a deterministic, non-enumerable SUBMIT_RECEIPT id independent of key encoding', () => {
    const a = deriveSubmitReceiptId(key);
    expect(a).toBe(deriveSubmitReceiptId(key));
    expect(a).toMatch(/^SUBMIT_RECEIPT#[A-Za-z0-9_-]+$/);
    expect(a).not.toContain(key);
  });
  it('rejects a non-32-byte key', () => {
    expect(() => deriveSubmitReceiptId('short')).toThrow();
  });
});

describe('canonicalizeRfqPayload', () => {
  it('excludes one-time/credential values and is key-order independent', () => {
    const c1 = canonicalizeRfqPayload(PAYLOAD);
    const reordered = {
      quantity: 1, email: 'jane@stanford.edu', name: 'Jane',
      institution: 'Stanford', equipmentCategory: 'ICP',
      applicationDescription: 'silicon etching for MEMS work',
      draftToken: 'other', turnstileToken: 'other', submitIdempotencyKey: 'other',
    };
    expect(canonicalizeRfqPayload(reordered)).toBe(c1);
    expect(c1).not.toContain('one-time');
    expect(c1).not.toContain('secret');
    expect(c1).not.toContain(key);
  });
});

describe('computeRequestBinding', () => {
  it('binds payload + operation kind (+ rfqId for upgrade); differs across modes/payloads', () => {
    const direct = computeRequestBinding(PAYLOAD, 'direct');
    const upgrade = computeRequestBinding(PAYLOAD, 'draft-upgrade', 'rfq-1');
    expect(direct).toMatch(/^[0-9a-f]{64}$/);
    expect(direct).not.toBe(upgrade);
    expect(computeRequestBinding(PAYLOAD, 'draft-upgrade', 'rfq-2')).not.toBe(upgrade);
    expect(computeRequestBinding({ ...PAYLOAD, quantity: 2 }, 'direct')).not.toBe(direct);
    expect(computeRequestBinding(PAYLOAD, 'direct')).toBe(direct);
  });
});
