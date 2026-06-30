import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateAuditId: () => 'audit-x', generateOrgId: () => 'org-x' }));
import { writeLinkAuditLog } from './auditStore';
beforeEach(() => mockSend.mockReset());

describe('writeLinkAuditLog', () => {
  it('writes an immutable audit row with old/new org+contact, operator, reason, timestamp', async () => {
    mockSend.mockResolvedValueOnce({});
    const id = await writeLinkAuditLog({
      timelineEventId: 'tev-1', newOrgId: 'org-NEW', oldOrgId: 'org-OLD',
      oldContactId: null, newContactId: 'ct-2', operator: 'harvey', reason: 'manual re-link', timestamp: '2026-06-19T10:00:00Z',
    });
    expect(id).toBe('audit-x');
    const item = mockSend.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('AUDIT#audit-x');
    expect(item.entityType).toBe('LINK_AUDIT');
    expect(item.oldOrgId).toBe('org-OLD');
    expect(item.newOrgId).toBe('org-NEW');
    expect(item.operator).toBe('harvey');
    expect(item.GSI2PK).toBe('ORG#org-NEW');
  });
});
