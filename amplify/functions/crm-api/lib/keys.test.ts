import { describe, it, expect } from 'vitest';
import { timelineEventKeys, contactKeys, auditKeys, contactIdForEmail } from './keys';

describe('timelineEventKeys', () => {
  const common = { id: 'tev-x', occurredAt: '2026-06-19T10:00:00Z', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1' };
  it('resolved event: PK/SK + GSI2(org)+GSI3(src), NO GSI1, GSI4 only with contactId', () => {
    const k = timelineEventKeys({ ...common, orgId: 'org-1', contactId: 'ct-a', resolutionStatus: 'resolved' });
    expect(k.PK).toBe('TLEVENT#tev-x');
    expect(k.GSI2PK).toBe('ORG#org-1');
    expect(k.GSI2SK).toBe('TLEVENT#2026-06-19T10:00:00Z#tev-x');
    expect(k.GSI3PK).toBe('SRC#rfq#rfq-1');
    expect(k.GSI4PK).toBe('CONTACT#ct-a');
    expect(k.GSI1PK).toBeUndefined();
  });
  it('unresolved event: GSI1 IS written; GSI4 omitted without contactId', () => {
    const k = timelineEventKeys({ ...common, orgId: 'unresolved-rfq-rfq-1', resolutionStatus: 'unresolved' });
    expect(k.GSI1PK).toBe('TLEVENT_STATUS#unresolved');
    expect(k.GSI1SK).toBe('2026-06-19T10:00:00Z#tev-x');
    expect(k.GSI4PK).toBeUndefined();
  });
});

describe('contactKeys / auditKeys / contactIdForEmail', () => {
  it('contactKeys maps PK + GSI4(email) + GSI2(org)', () => {
    const k = contactKeys({ contactId: 'ct-a', email: 'terry@diamondfoundry.com', orgId: 'org-1' });
    expect(k.PK).toBe('CONTACT#ct-a');
    expect(k.GSI4PK).toBe('EMAIL#terry@diamondfoundry.com');
    expect(k.GSI2PK).toBe('ORG#org-1');
  });
  it('auditKeys maps PK + GSI2(org) by timestamp', () => {
    const k = auditKeys({ id: 'audit-1', orgId: 'org-1', timestamp: '2026-06-19T10:00:00Z' });
    expect(k.PK).toBe('AUDIT#audit-1');
    expect(k.GSI2PK).toBe('ORG#org-1');
    expect(k.GSI2SK).toBe('AUDIT#2026-06-19T10:00:00Z#audit-1');
  });
  it('contactIdForEmail is deterministic ct- id', () => {
    expect(contactIdForEmail('a@b.com')).toMatch(/^ct-[0-9a-f]{12}$/);
    expect(contactIdForEmail('a@b.com')).toBe(contactIdForEmail('a@b.com'));
  });
});
