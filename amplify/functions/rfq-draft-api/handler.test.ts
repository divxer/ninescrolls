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
    const r = jsonResponse(201, { rfqId: 'x' }, 'https://ninescrolls.com', { credential: true });
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
    headers: { origin: 'https://ninescrolls.com', ...headers },
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
    expect(JSON.parse(stale.body).fields.quantity).toBe(7);
  });

  it('POST create missing its nonce → 404 (no disclosure of the reason)', async () => {
    const { handler } = ctx();
    const r = await handler(evt('POST', '/api/rfq/draft', {}, CREATE));
    expect(r.statusCode).toBe(404);
  });
});
