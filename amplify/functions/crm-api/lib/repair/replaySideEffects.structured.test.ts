import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const writeLinkAuditLog = vi.fn();
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (...a: unknown[]) => writeLinkAuditLog(...a) }));
import { replayStructuredSideEffects } from './replaySideEffects';

const base = { sourceType: 'rfq', sourceEntityId: '1', backfillPk: 'RFQ#1', targetOrgId: 'acme.com',
  unitKey: 'unresolved-rfq-1', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z',
  affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked' };

beforeEach(() => { send.mockReset(); writeLinkAuditLog.mockReset(); writeLinkAuditLog.mockResolvedValue('audit-x'); });

describe('replayStructuredSideEffects', () => {
  it('ok: backfill written + audit written with deterministic id', async () => {
    send.mockResolvedValueOnce({}); // conditional Update succeeds
    const r = await replayStructuredSideEffects(base);
    expect(r).toEqual({ ok: true, backfillStatus: 'written' });
    expect(writeLinkAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^audit-[0-9a-f]{16}$/), reason: 'manual_link_unit', timestamp: base.createdAt,
      details: expect.objectContaining({ sourceBackfillStatus: 'written', affectedEventIds: ['e1'] }),
    }));
  });
  it('already_set: conditional fails but source already points at target → ok', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { matchedOrgId: 'acme.com' } }); // Get
    const r = await replayStructuredSideEffects(base);
    expect(r.ok).toBe(true); expect(r.backfillStatus).toBe('already_set');
  });
  it('source_conflict: source points at a DIFFERENT real org → audit still written, not ok', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { matchedOrgId: 'other.com' } });
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' });
    expect(writeLinkAuditLog).toHaveBeenCalled(); // audit written despite conflict
  });
  it('audit CCFE (already written) is idempotent success, not transient', async () => {
    send.mockResolvedValueOnce({}); // backfill ok
    writeLinkAuditLog.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const r = await replayStructuredSideEffects(base);
    expect(r.ok).toBe(true);
  });
  it('transient: backfill Update throws a non-CCFE error → transient', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('logistics with NO cached backfillPk re-resolves via LOGISTICS META Get', async () => {
    send.mockResolvedValueOnce({ Item: { relatedOrderId: 'o9' } }); // resolveBackfillPk Get
    send.mockResolvedValueOnce({}); // backfill Update on ORDER#o9
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'logistics', sourceEntityId: 'lc1', backfillPk: null });
    expect(r.ok).toBe(true);
    const updateInput = send.mock.calls[1][0].input;
    expect(updateInput.Key.PK).toBe('ORDER#o9');
  });
  it('logistics re-resolve Get throws → transient (never a lost backfill)', async () => {
    send.mockRejectedValueOnce(new Error('get boom'));
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'logistics', sourceEntityId: 'lc1', backfillPk: null });
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('no source (pk resolves null) → no_source counts as ok', async () => {
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'quote', sourceEntityId: 'q1', backfillPk: null });
    expect(r).toMatchObject({ ok: true, backfillStatus: 'no_source' });
  });
  it('transient: backfill SUCCEEDS but audit throws a non-CCFE error → transient', async () => {
    send.mockResolvedValueOnce({}); // backfill Update ok
    writeLinkAuditLog.mockRejectedValueOnce(new Error('audit throttled')); // non-CCFE
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
});
