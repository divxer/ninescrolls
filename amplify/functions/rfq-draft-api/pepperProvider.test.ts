import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { parsePepperSecret } from './pepperProvider';

const k1 = crypto.randomBytes(32).toString('hex');
const k2 = crypto.randomBytes(32).toString('hex');
const secret = JSON.stringify({ current: 2, keys: { 1: k1, 2: k2 } });

describe('parsePepperSecret', () => {
  it('exposes the current signing pepper + version and resolves all versions', () => {
    const p = parsePepperSecret(secret);
    expect(p.keyVersion).toBe(2);
    expect(p.pepper.equals(Buffer.from(k2, 'hex'))).toBe(true);
    expect(p.resolvePepper(1)!.equals(Buffer.from(k1, 'hex'))).toBe(true);
    expect(p.resolvePepper(2)!.equals(Buffer.from(k2, 'hex'))).toBe(true);
    expect(p.resolvePepper(9)).toBeUndefined();
  });

  it('throws on a missing current key, empty keys, or non-32-byte key', () => {
    expect(() => parsePepperSecret(JSON.stringify({ current: 3, keys: { 1: k1 } }))).toThrow();
    expect(() => parsePepperSecret(JSON.stringify({ current: 1, keys: {} }))).toThrow();
    expect(() => parsePepperSecret(JSON.stringify({ current: 1, keys: { 1: 'abcd' } }))).toThrow();
    expect(() => parsePepperSecret('not json')).toThrow();
  });

  it('rejects non-canonical and unsafe key versions', () => {
    for (const key of ['01', '-1', '1.5', '9007199254740992']) {
      expect(() => parsePepperSecret(JSON.stringify({ current: Number(key), keys: { [key]: k1 } }))).toThrow();
    }
    expect(() => parsePepperSecret(JSON.stringify({ current: -1, keys: { 1: k1 } }))).toThrow();
  });
});
