import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateAuditId: () => 'audit-x' }));
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
    expect(mockSend.mock.calls[0][0].input.ConditionExpression).toMatch(/attribute_not_exists/); // immutable
  });
});

describe('writeLinkAuditLog details payload', () => {
  it('persists an arbitrary details object on the audit item', async () => {
    mockSend.mockResolvedValueOnce({});
    await writeLinkAuditLog({ operator: 'a@x.com', reason: 'manual_link_unit', timestamp: '2026-07-08T00:00:00Z',
      newOrgId: 'acme.com', details: { unitType: 'structured', unitKey: 'unresolved-rfq-r1', affectedCount: 2, affectedEventIds: ['tev-a', 'tev-b'] } });
    const item = mockSend.mock.calls[0][0].input.Item;
    expect(item.details).toEqual({ unitType: 'structured', unitKey: 'unresolved-rfq-r1', affectedCount: 2, affectedEventIds: ['tev-a', 'tev-b'] });
    expect(item.entityType).toBe('LINK_AUDIT');
    expect(mockSend.mock.calls[0][0].input.ConditionExpression).toContain('attribute_not_exists');
  });
});

describe('writeLinkAuditLog idempotent id', () => {
  it('uses a caller-supplied deterministic id when provided (else random)', async () => {
    mockSend.mockResolvedValueOnce({});
    const returned = await writeLinkAuditLog({
      id: 'audit-deadbeef00000000', operator: 'op@x', reason: 'manual_link_unit',
      timestamp: '2026-07-08T00:00:00.000Z', newOrgId: 'acme.com', details: { unitType: 'structured' },
    });
    expect(returned).toBe('audit-deadbeef00000000');
    const putArg = mockSend.mock.calls.at(-1)![0].input;
    expect(putArg.Item.id).toBe('audit-deadbeef00000000');
    expect(putArg.Item.PK).toBe('AUDIT#audit-deadbeef00000000');
    expect(putArg.ConditionExpression).toContain('attribute_not_exists(PK)');
  });

  it('supplied id + duplicate (CCFE) is an idempotent no-op: returns the id, does not throw', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const returned = await writeLinkAuditLog({
      id: 'audit-deadbeef00000000', operator: 'op@x', reason: 'manual_link_unit',
      timestamp: '2026-07-08T00:00:00.000Z', newOrgId: 'acme.com',
    });
    expect(returned).toBe('audit-deadbeef00000000');
  });

  it('random id (no supplied id) still throws on CCFE (unchanged behavior)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    await expect(writeLinkAuditLog({ operator: 'op', reason: 'manual_link_unit', timestamp: '2026-07-08T00:00:00.000Z', newOrgId: 'acme.com' })).rejects.toThrow();
  });
});

// Task 8: R5 write-time fence — the generational replay's audit put rides a TransactWriteItems
// whose element 0 is the org-active ConditionCheck; cancellations map POSITIONALLY.
describe('writeLinkAuditLog activeOrgFence', () => {
  const fencedArgs = {
    id: 'audit-deadbeef00000000deadbeef000000', operator: 'op@x', reason: 'manual_link_unit',
    timestamp: '2026-07-08T00:00:00.000Z', newOrgId: 'acme.com', activeOrgFence: true,
  };

  it('rides ONE TransactWriteItems: [org-active ConditionCheck, immutable Put]', async () => {
    mockSend.mockResolvedValueOnce({});
    const returned = await writeLinkAuditLog(fencedArgs);
    expect(returned).toBe('audit-deadbeef00000000deadbeef000000');
    const tx = mockSend.mock.calls.at(-1)![0].input.TransactItems;
    expect(tx).toHaveLength(2);
    expect(tx[0].ConditionCheck.Key).toEqual({ PK: 'ORG#acme.com', SK: 'META' });
    expect(tx[0].ConditionCheck.ConditionExpression).toBe('#s = :active');
    expect(tx[1].Put.Item.PK).toBe('AUDIT#audit-deadbeef00000000deadbeef000000');
    expect(tx[1].Put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('fence cancellation (index 0) throws OrgInactiveError — caller re-resolves the successor', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('cancelled'), {
      name: 'TransactionCanceledException', CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
    }));
    await expect(writeLinkAuditLog(fencedArgs)).rejects.toMatchObject({ name: 'OrgInactiveError' });
  });

  it('duplicate-row cancellation (index 1) on a deterministic id is an idempotent success', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('cancelled'), {
      name: 'TransactionCanceledException', CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
    }));
    await expect(writeLinkAuditLog(fencedArgs)).resolves.toBe('audit-deadbeef00000000deadbeef000000');
  });

  it('missing CancellationReasons propagates the raw error (never guessed)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }));
    await expect(writeLinkAuditLog(fencedArgs)).rejects.toThrow('cancelled');
  });
});
