import { describe, it, expect } from 'vitest';
import { isAdmin } from './authz';

describe('isAdmin', () => {
  it('claims cognito:groups as ARRAY containing admin → true', () =>
    expect(isAdmin({ identity: { claims: { 'cognito:groups': ['admin', 'x'] } } } as never)).toBe(true));
  it('claims cognito:groups as comma STRING containing admin → true', () =>
    expect(isAdmin({ identity: { claims: { 'cognito:groups': 'staff,admin' } } } as never)).toBe(true));
  it('identity.groups shape → true', () =>
    expect(isAdmin({ identity: { groups: ['admin'] } } as never)).toBe(true));
  it('wrong group → false; no identity → false; empty → false', () => {
    expect(isAdmin({ identity: { claims: { 'cognito:groups': ['staff'] } } } as never)).toBe(false);
    expect(isAdmin({} as never)).toBe(false);
    expect(isAdmin({ identity: { claims: {} } } as never)).toBe(false);
  });
});
