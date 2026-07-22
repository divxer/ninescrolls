import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const sourceEmailMock = vi.fn();
vi.mock('../link/sourceEmail', () => ({ readSourceEmailForUnit: (...a: unknown[]) => sourceEmailMock(...a), sourceDomain: (e: string) => e.split('@')[1] ?? null }));
import { needsLinkingQueue } from './needsLinkingQueue';

const rfqEv = { id: 'tev-r', orgId: 'unresolved-rfq-r1', source: 'rfq', kind: 'rfq_submitted', sourceEntityId: 'r1', occurredAt: '2026-03-01T00:00:00Z', voided: false, isInternalOnly: false, payload: { equipmentCategory: 'ICP' } };
const analyticsEv = { id: 'tev-a', orgId: 'unresolved-analytics-s1', source: 'analytics', kind: 'site_visit_session', sourceEntityId: 's1', occurredAt: '2026-03-02T00:00:00Z', voided: false, isInternalOnly: false, payload: { visitorId: 'v1', orgNameDisplay: 'Verizon Business', country: 'US', topPaths: ['/x'], pageCount: 1 } };
const gmailEv = { id: 'tev-g', orgId: 'unresolved-gmail-g1', source: 'gmail', kind: 'gmail_message', sourceEntityId: 'g1', occurredAt: '2026-03-03T00:00:00Z', voided: false, isInternalOnly: false, payload: { customerEmail: 'c@example.com' } };
beforeEach(() => { mockSend.mockReset(); sourceEmailMock.mockReset(); });

describe('needsLinkingQueue', () => {
  it('reads GSI1 unresolved, excludes voided+internal, collapses to units', async () => {
    mockSend.mockResolvedValueOnce({ Items: [rfqEv, analyticsEv] });
    sourceEmailMock.mockResolvedValueOnce('j@nanofab.com');
    const r = await needsLinkingQueue({});
    const q = mockSend.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI1');
    expect(q.KeyConditionExpression).toContain('GSI1PK = :pk');
    expect(q.ExpressionAttributeValues[':pk']).toBe('TLEVENT_STATUS#unresolved');
    expect(q.FilterExpression).toContain('voided = :false');
    expect(q.FilterExpression).toContain('isInternalOnly = :false');
    const struct = r.items.find((u) => u.linkUnitType === 'structured')!;
    expect(struct).toMatchObject({ unitKey: 'unresolved-rfq-r1', source: 'rfq', signal: { email: 'j@nanofab.com', domain: 'nanofab.com', enrichmentStatus: 'ok' } });
    const analytics = r.items.find((u) => u.linkUnitType === 'analytics')!;
    expect(analytics).toMatchObject({ unitKey: 'v1', visitorId: 'v1', signal: { orgNameDisplay: 'Verizon Business', country: 'US' } });
  });

  it('structured enrichment failure is isolated per unit', async () => {
    mockSend.mockResolvedValueOnce({ Items: [rfqEv] });
    sourceEmailMock.mockRejectedValueOnce(new Error('boom'));
    const r = await needsLinkingQueue({});
    expect(r.items[0].signal.enrichmentStatus).toBe('error');
  });

  it('includes representativeEventId and surfaces a gmail unit\'s payload.customerEmail as signal.email', async () => {
    mockSend.mockResolvedValueOnce({ Items: [gmailEv, rfqEv] });
    sourceEmailMock.mockImplementation(async (sourceType: string) => (sourceType === 'gmail' ? 'c@example.com' : 'j@nanofab.com'));
    const r = await needsLinkingQueue({});
    const gmailItem = r.items.find((u) => u.source === 'gmail')!;
    expect(gmailItem.representativeEventId).toBe(gmailEv.id);
    expect(gmailItem.signal.email).toBe('c@example.com');
    const rfqItem = r.items.find((u) => u.source === 'rfq')!;
    expect(rfqItem.representativeEventId).toBe(rfqEv.id);
  });
});
