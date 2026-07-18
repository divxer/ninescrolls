import { describe, expect, it } from 'vitest';
import { FakeDdb } from '../price-api/lib/testing/fakeDdb';
import { createRateLimiter } from './rateLimiter';

describe('createRateLimiter', () => {
  it('allows 10 creates per IP per five-minute window, then rejects without storing the IP', async () => {
    const ddb = new FakeDdb();
    const limit = createRateLimiter({ send: (c) => ddb.send(c as never), tableName: 't', nowMs: () => 1_000 });
    for (let i = 0; i < 10; i++) expect(await limit('203.0.113.8', 'create')).toBe(true);
    expect(await limit('203.0.113.8', 'create')).toBe(false);
    expect(await limit('203.0.113.9', 'create')).toBe(true);
    expect(JSON.stringify([...ddb.store.values()])).not.toContain('203.0.113.8');
  });

  it('allows 120 reads/updates combined and starts a fresh bucket after five minutes', async () => {
    const ddb = new FakeDdb();
    let now = 299_999;
    const limit = createRateLimiter({ send: (c) => ddb.send(c as never), tableName: 't', nowMs: () => now });
    for (let i = 0; i < 120; i++) expect(await limit('198.51.100.4', 'access')).toBe(true);
    expect(await limit('198.51.100.4', 'access')).toBe(false);
    now = 300_000;
    expect(await limit('198.51.100.4', 'access')).toBe(true);
  });
});
