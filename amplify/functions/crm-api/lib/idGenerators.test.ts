import { describe, it, expect } from 'vitest';
import { generateAuditId } from './idGenerators';

describe('crm-api id generators', () => {
  it('generateAuditId is audit- prefixed', () => {
    expect(generateAuditId()).toMatch(/^audit-[0-9a-f]{12}$/);
  });
});
