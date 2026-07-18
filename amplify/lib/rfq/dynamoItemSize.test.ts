// amplify/lib/rfq/dynamoItemSize.test.ts
import { describe, it, expect } from 'vitest';
import {
  estimateDynamoItemBytes, assertWithinItemLimits, MAX_ITEM_BYTES,
} from './dynamoItemSize';

describe('estimateDynamoItemBytes', () => {
  it('counts UTF-8 name + value bytes plus overhead (over-counts payload)', () => {
    expect(estimateDynamoItemBytes({ a: 'bc' })).toBeGreaterThan(3);
  });

  it('counts multibyte UTF-8 by byte length', () => {
    expect(estimateDynamoItemBytes({ k: '€' })).toBeGreaterThan(estimateDynamoItemBytes({ k: 'x' }));
  });

  it('over-counts vs JSON.stringify for a text-heavy item', () => {
    const item = { PK: 'RFQ#x', SK: 'META', body: 'y'.repeat(1000) };
    expect(estimateDynamoItemBytes(item)).toBeGreaterThan(JSON.stringify(item).length);
  });

  it('handles nested lists/maps/numbers/booleans/null', () => {
    expect(() => estimateDynamoItemBytes({
      n: 12345, b: true, nul: null, arr: [1, 'two', { three: 3 }], obj: { a: { b: 'c' } },
    })).not.toThrow();
  });

  it('throws (fail-closed) on unsupported value types', () => {
    expect(() => estimateDynamoItemBytes({ buf: Buffer.from('x') })).toThrow(/unsupported/i);
    expect(() => estimateDynamoItemBytes({ big: BigInt(1) })).toThrow(/unsupported/i);
    expect(() => estimateDynamoItemBytes({ set: new Set([1]) })).toThrow(/unsupported/i);
  });

  it('rejects undefined (not storable) but accepts null', () => {
    expect(() => estimateDynamoItemBytes({ u: undefined })).toThrow(/undefined/i);
    expect(() => estimateDynamoItemBytes({ nested: { u: undefined } })).toThrow(/undefined/i);
    expect(() => estimateDynamoItemBytes({ n: null })).not.toThrow();
  });

  it('rejects non-finite numbers', () => {
    expect(() => estimateDynamoItemBytes({ n: NaN })).toThrow(/non-finite/i);
    expect(() => estimateDynamoItemBytes({ n: Infinity })).toThrow(/non-finite/i);
  });
});

describe('assertWithinItemLimits', () => {
  it('accepts a small item', () => {
    expect(() => assertWithinItemLimits({ PK: 'RFQ#x', SK: 'META' })).not.toThrow();
  });

  it('throws when the estimate exceeds MAX_ITEM_BYTES', () => {
    expect(() => assertWithinItemLimits({ PK: 'x', SK: 'META', blob: 'z'.repeat(MAX_ITEM_BYTES + 1) }))
      .toThrow(/item size/i);
  });
});
