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

  it('canonicalizes nested objects recursively and excludes credentials at every depth', () => {
    const a = { ...PAYLOAD, metadata: { z: 1, nested: { b: 2, a: 1, draftToken: 'nested-secret' } } };
    const b = { ...PAYLOAD, metadata: { nested: { draftToken: 'other', a: 1, b: 2 }, z: 1 } };
    expect(canonicalizeRfqPayload(a)).toBe(canonicalizeRfqPayload(b));
    expect(canonicalizeRfqPayload(a)).not.toContain('nested-secret');
  });

  it('rejects non-JSON payload values instead of silently changing the binding', () => {
    expect(() => canonicalizeRfqPayload({ ...PAYLOAD, bad: Number.NaN })).toThrow();
    expect(() => canonicalizeRfqPayload({ ...PAYLOAD, bad: () => undefined })).toThrow();
  });
});

describe('computeRequestBinding', () => {
  it('binds payload + operation kind (+ rfqId for upgrade); differs across modes/payloads', () => {
    const direct = computeRequestBinding(PAYLOAD, { kind: 'direct' });
    const upgrade = computeRequestBinding(PAYLOAD, { kind: 'draft-upgrade', rfqId: 'rfq-1' });
    expect(direct).toMatch(/^[0-9a-f]{64}$/);
    expect(direct).not.toBe(upgrade);
    expect(computeRequestBinding(PAYLOAD, { kind: 'draft-upgrade', rfqId: 'rfq-2' })).not.toBe(upgrade);
    expect(computeRequestBinding({ ...PAYLOAD, quantity: 2 }, { kind: 'direct' })).not.toBe(direct);
    expect(computeRequestBinding(PAYLOAD, { kind: 'direct' })).toBe(direct);
  });

  it('rejects empty upgrade ids and direct operations carrying an rfqId at runtime', () => {
    expect(() => computeRequestBinding(PAYLOAD, { kind: 'draft-upgrade', rfqId: '' })).toThrow();
    expect(() => computeRequestBinding(PAYLOAD, { kind: 'direct', rfqId: 'rfq-1' } as never)).toThrow();
  });
});
