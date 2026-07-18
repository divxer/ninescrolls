import { describe, it, expect } from 'vitest';
import { header, jsonResponse, DRAFT_UNAVAILABLE_RESPONSE } from './handler';

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
