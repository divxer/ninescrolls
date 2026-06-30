import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { upsertContact } from './contactStore';
beforeEach(() => mockSend.mockReset());

describe('upsertContact', () => {
  it('creates with deterministic id; firstSeenAt=occurredAt, createdAt is a separate now', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] }); // getContactByEmail
    mockSend.mockResolvedValueOnce({});            // put
    const id = await upsertContact({ email: 'Terry@DiamondFoundry.com', orgId: 'org-1', source: 'rfq', occurredAt: '2026-06-19T10:00:00Z', name: 'Terry' });
    expect(id).toMatch(/^ct-[0-9a-f]{12}$/);
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(item.email).toBe('terry@diamondfoundry.com');
    expect(item.firstSeenAt).toBe('2026-06-19T10:00:00Z');
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('advances lastSeenAt monotonically, preserves firstSeenAt, respects linkLocked', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', email: 'a@b.com', orgId: 'org-OLD', linkLocked: true, firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', source: 'rfq' }] });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'a@b.com', orgId: 'org-NEW', source: 'lead', occurredAt: '2026-06-01T00:00:00Z' });
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(item.orgId).toBe('org-OLD');
    expect(item.lastSeenAt).toBe('2026-06-01T00:00:00Z');
    expect(item.firstSeenAt).toBe('2026-01-01T00:00:00Z');
    expect(item.createdAt).toBe('2026-01-01T00:00:00Z');
  });
});
