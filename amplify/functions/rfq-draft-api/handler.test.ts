import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { FakeDdb } from '../price-api/lib/testing/fakeDdb';
import { encodeCredential } from '../../lib/rfq/draftCredentials';
import { header, jsonResponse, DRAFT_UNAVAILABLE_RESPONSE, makeHandler } from './handler';

describe('header', () => {
  it('reads a header case-insensitively', () => {
    const h = { 'X-RFQ-Draft-Token': 'abc' };
    expect(header(h, 'x-rfq-draft-token')).toBe('abc');
    expect(header(h, 'X-RFQ-Draft-Token')).toBe('abc');
    expect(header({}, 'x-missing')).toBeUndefined();
  });
});

describe('responses', () => {
  it('credential-bearing responses set no-store + no-referrer', () => {
    const r = jsonResponse(201, { rfqId: 'x' }, 'https://ninescrolls.com');
    expect(r.statusCode).toBe(201);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.headers['Referrer-Policy']).toBe('no-referrer');
    expect(r.headers['Access-Control-Allow-Origin']).toBe('https://ninescrolls.com');
  });

  it('DRAFT_UNAVAILABLE is a flat non-disclosing 404', () => {
    const r = DRAFT_UNAVAILABLE_RESPONSE('https://ninescrolls.com');
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body)).toEqual({ error: 'Draft unavailable' });
  });
});

const pepper = crypto.randomBytes(32);
const CREATE = {
  name: 'Jane Researcher', email: 'jane@stanford.edu', institution: 'Stanford University',
  equipmentCategory: 'Probe-Station', applicationDescription: 'Wafer probing for photonics devices.',
  quantity: 2,
};
function ctx() {
  const ddb = new FakeDdb();
  const handler = makeHandler({
    send: (c: unknown) => ddb.send(c as never), tableName: 't',
    pepper, keyVersion: 1, resolvePepper: (v: number) => (v === 1 ? pepper : undefined),
    now: () => '2026-07-15T00:00:00.000Z',
  });
  return { ddb, handler };
}
const evt = (method: string, path: string, headers: Record<string, string>, body?: unknown) => {
  const last = path.split('/').filter(Boolean).pop();
  return {
    requestContext: { http: { method, path, sourceIp: '1.2.3.4' } },
    rawPath: path,
    pathParameters: last && /^[A-Za-z0-9_-]{20,}$/.test(last) ? { rfqId: last } : undefined,
    headers: { origin: 'https://ninescrolls.com', 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
};

describe('rfq-draft-api routing', () => {
  it('POST create → 201 with rfqId, then GET with the token returns the fields', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await handler(evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE));
    expect(created.statusCode).toBe(201);
    const { rfqId, draftToken } = JSON.parse(created.body);
    const got = await handler(evt('GET', `/api/rfq/draft/${rfqId}`, { 'x-rfq-draft-token': draftToken }));
    expect(got.statusCode).toBe(200);
    expect(JSON.parse(got.body).fields.email).toBe('jane@stanford.edu');
  });

  it('GET with a wrong token → 404 Draft unavailable', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await handler(evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE));
    const { rfqId } = JSON.parse(created.body);
    const wrong = encodeCredential(crypto.randomBytes(32));
    const got = await handler(evt('GET', `/api/rfq/draft/${rfqId}`, { 'x-rfq-draft-token': wrong }));
    expect(got.statusCode).toBe(404);
    expect(JSON.parse(got.body)).toEqual({ error: 'Draft unavailable' });
  });

  it('maps malformed credentials to the same unavailable response', async () => {
    const { handler } = ctx();
    const response = await handler(evt('GET', '/api/rfq/draft/AAAAAAAAAAAAAAAAAAAA', {
      'x-rfq-draft-token': 'not+base64url',
    }));
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Draft unavailable' });
  });

  it('PATCH bumps version; a stale draftVersion → 409 with the current draft', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await handler(evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE));
    const { rfqId, draftToken } = JSON.parse(created.body);
    const h = { 'x-rfq-draft-token': draftToken };
    const ok = await handler(evt('PATCH', `/api/rfq/draft/${rfqId}`, h, { draftVersion: 1, patch: { quantity: 7 } }));
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body).draftVersion).toBe(2);
    const stale = await handler(evt('PATCH', `/api/rfq/draft/${rfqId}`, h, { draftVersion: 1, patch: { quantity: 8 } }));
    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body).draftVersion).toBe(2);
    expect(JSON.parse(stale.body).draft.quantity).toBe(7);
  });

  it('POST create missing its nonce → 404 (no disclosure of the reason)', async () => {
    const { handler } = ctx();
    const r = await handler(evt('POST', '/api/rfq/draft', {}, CREATE));
    expect(r.statusCode).toBe(404);
  });

  it('does not charge unauthenticated access to the authenticated rate bucket', async () => {
    let calls = 0;
    const ddb = new FakeDdb();
    const handler = makeHandler({
      send: (c: unknown) => ddb.send(c as never), tableName: 't', pepper, keyVersion: 1,
      resolvePepper: () => pepper, now: () => '2026-07-15T00:00:00.000Z',
      rateLimit: async () => { calls++; return false; },
    });
    const response = await handler(evt('GET', '/api/rfq/draft/AAAAAAAAAAAAAAAAAAAA', {
      'x-rfq-draft-token': encodeCredential(crypto.randomBytes(32)),
    }));
    expect(response.statusCode).toBe(404);
    expect(calls).toBe(0);
  });

  it('authenticates PATCH before reporting malformed JSON or fields', async () => {
    const { handler } = ctx();
    const bad = evt('PATCH', '/api/rfq/draft/AAAAAAAAAAAAAAAAAAAA', {
      'x-rfq-draft-token': encodeCredential(crypto.randomBytes(32)),
    }, { draftVersion: 1, patch: { unknown: true } });
    expect((await handler(bad)).statusCode).toBe(404);
  });

  it('requires JSON, enforces decoded byte limits, and handles API Gateway base64 bodies', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    expect((await handler(evt('POST', '/api/rfq/draft', {
      'x-rfq-draft-create-nonce': nonce, 'content-type': 'text/plain',
    }, CREATE))).statusCode).toBe(400);
    const encoded = evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE);
    encoded.body = Buffer.from(encoded.body!).toString('base64');
    (encoded as typeof encoded & { isBase64Encoded: boolean }).isBase64Encoded = true;
    expect((await handler(encoded)).statusCode).toBe(201);
    encoded.body = `${encoded.body}!`;
    expect((await handler(encoded)).statusCode).toBe(400);
    const huge = evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE);
    huge.body = JSON.stringify({ ...CREATE, applicationDescription: 'x'.repeat(17 * 1024) });
    expect((await handler(huge)).statusCode).toBe(400);
  });

  it('supports REST API v1 source IP and returns safe 429 responses', async () => {
    const { handler: ignored } = ctx();
    let seen = '';
    const ddb = new FakeDdb();
    const handler = makeHandler({
      send: (c: unknown) => ddb.send(c as never), tableName: 't', pepper, keyVersion: 1,
      resolvePepper: () => pepper, now: () => '2026-07-15T00:00:00.000Z',
      rateLimit: async (ip) => { seen = ip; return false; },
    });
    const event = evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': encodeCredential(crypto.randomBytes(32)) }, CREATE);
    delete (event.requestContext as { http?: unknown }).http;
    Object.assign(event, { httpMethod: 'POST', path: '/api/rfq/draft' });
    (event.requestContext as { identity?: { sourceIp: string } }).identity = { sourceIp: '192.0.2.5' };
    const response = await handler(event);
    expect(seen).toBe('192.0.2.5');
    expect(response.statusCode).toBe(429);
    expect(response.headers['Cache-Control']).toBe('no-store');
    void ignored;
  });

  it('rejects untrusted origins without reflecting or defaulting CORS', async () => {
    const { handler } = ctx();
    const event = evt('OPTIONS', '/api/rfq/draft', {});
    event.headers.origin = 'https://evil.example';
    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(response.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('sanitizes storage failures as retryable 503 responses with safe headers', async () => {
    const handler = makeHandler({
      send: async () => { throw new Error('secret internal detail'); }, tableName: 't',
      pepper, keyVersion: 1, resolvePepper: () => pepper, now: () => '2026-07-15T00:00:00.000Z',
    });
    const response = await handler(evt('GET', '/api/rfq/draft/AAAAAAAAAAAAAAAAAAAA', {
      'x-rfq-draft-token': encodeCredential(crypto.randomBytes(32)),
    }));
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('internal');
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(response.headers['Referrer-Policy']).toBe('no-referrer');
  });
});
