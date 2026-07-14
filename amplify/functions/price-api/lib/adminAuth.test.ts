import { describe, it, expect } from 'vitest';
import { requireAdmin } from './adminAuth.js';

const base = { info: { fieldName: 'x', parentTypeName: 'Query' }, arguments: {} };

describe('requireAdmin', () => {
  it('passes when identity.groups contains admin', () => {
    expect(() => requireAdmin({ ...base, identity: { sub: 's', groups: ['admin'] } })).not.toThrow();
  });

  it('passes when cognito:groups claim contains admin (string form)', () => {
    expect(() => requireAdmin({
      ...base, identity: { sub: 's', claims: { 'cognito:groups': 'admin' } },
    })).not.toThrow();
  });

  it('passes when cognito:groups claim contains admin (array form)', () => {
    expect(() => requireAdmin({
      ...base, identity: { sub: 's', claims: { 'cognito:groups': ['viewer', 'admin'] } },
    })).not.toThrow();
  });

  it('rejects an authenticated caller without the group', () => {
    expect(() => requireAdmin({ ...base, identity: { sub: 's', claims: { email: 'a@b.c' } } }))
      .toThrow(/^UNAUTHORIZED:/);
  });

  it('rejects when identity is missing entirely', () => {
    expect(() => requireAdmin(base)).toThrow(/^UNAUTHORIZED:/);
  });
});
