import { describe, it, expect } from 'vitest';
import { generateOrgId, generateAuditId } from './idGenerators';

describe('crm-api id generators', () => {
  it('generateOrgId is org- prefixed and date-stamped', () => {
    expect(generateOrgId()).toMatch(/^org-\d{8}-[0-9a-f]{4}$/);
  });
  it('generateAuditId is audit- prefixed', () => {
    expect(generateAuditId()).toMatch(/^audit-[0-9a-f]{12}$/);
  });
});
