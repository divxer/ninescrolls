import { describe, it, expect } from 'vitest';
import { getOperatorInfo } from './types.js';

describe('getOperatorInfo', () => {
  it('falls back to admin when no identity', () => {
    expect(getOperatorInfo({ info: { fieldName: 'x', parentTypeName: 'Query' }, arguments: {} }))
      .toEqual({ sub: 'admin', email: 'admin' });
  });

  it('prefers claims.email', () => {
    const r = getOperatorInfo({
      info: { fieldName: 'x', parentTypeName: 'Query' },
      arguments: {},
      identity: { sub: 'u-1', claims: { email: 'harvey@ninescrolls.com' } },
    });
    expect(r).toEqual({ sub: 'u-1', email: 'harvey@ninescrolls.com' });
  });
});
