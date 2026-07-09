import { describe, it, expect } from 'vitest';
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
});
