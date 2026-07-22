import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { generateAuditId, deterministicAuditId } from './idGenerators';

describe('crm-api id generators', () => {
  it('generateAuditId is audit- prefixed', () => {
    expect(generateAuditId()).toMatch(/^audit-[0-9a-f]{12}$/);
  });
});

describe('deterministicAuditId', () => {
  it('is stable for the same (reason, unitKey, targetOrgId)', () => {
    const a = deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'acme.com');
    const b = deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'acme.com');
    expect(a).toBe(b);
    expect(a).toMatch(/^audit-[0-9a-f]{16}$/);
  });
  it('differs when the committed target org differs (corrective re-link gets its own row)', () => {
    expect(deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'acme.com'))
      .not.toBe(deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'other.com'));
  });
  it('differs by reason (structured vs analytics)', () => {
    expect(deterministicAuditId('manual_link_unit', 'v1', 'acme.com'))
      .not.toBe(deterministicAuditId('manual_link_visitor', 'v1', 'acme.com'));
  });
  it('WITHOUT generation: byte-identical to the legacy 16-hex id (existing audit rows depend on it)', () => {
    const legacy = `audit-${crypto.createHash('sha256').update('manual_link_unit|u1|acme.com').digest('hex').slice(0, 16)}`;
    expect(deterministicAuditId('manual_link_unit', 'u1', 'acme.com')).toBe(legacy);
  });
  it('WITH generation: 32-hex id that varies by generation (every manual action = own row)', () => {
    const a = deterministicAuditId('manual_link_unit', 'u1', 'acme.com', '01J0AAAAAAAAAAAAAAAAAAAAAA');
    const b = deterministicAuditId('manual_link_unit', 'u1', 'acme.com', '01J0BBBBBBBBBBBBBBBBBBBBBB');
    expect(a).toMatch(/^audit-[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
    expect(a).toBe(deterministicAuditId('manual_link_unit', 'u1', 'acme.com', '01J0AAAAAAAAAAAAAAAAAAAAAA')); // replay-stable
  });
});
