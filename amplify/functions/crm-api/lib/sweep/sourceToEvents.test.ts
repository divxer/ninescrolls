import { describe, it, expect, vi } from 'vitest';
import { rfqEvents, leadEvents, orderCreatedEvents, orderStageEvents, quoteEvents, logisticsEvents } from './sourceToEvents';

describe('sourceToEvents (pure, mirrors live-emit)', () => {
  it('rfqEvents → 1 rfq_submitted with the deterministic id', () => {
    const out = rfqEvents({ rfqId: 'rfq-1', submittedAt: '2026-06-19T10:00:00Z', email: 'a@x.com', equipmentCategory: 'ICP', matchedOrgId: 'x.com' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-rfq-rfq-1-submitted');
    expect(out[0].args).toMatchObject({ kind: 'rfq_submitted', resolveInput: { matchedOrgId: 'x.com' } });
  });
  it('leadEvents → 1 lead_captured', () => {
    const out = leadEvents({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'contact', matchedOrgId: null });
    expect(out[0].id).toBe('tev-lead-l1');
  });
  it('orderCreatedEvents → 1 order_created', () => {
    const out = orderCreatedEvents({ orderId: 'ord-1', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: 'x.com', rfqId: null });
    expect(out[0].id).toBe('tev-order-ord-1-created');
  });
  it('orderCreatedEvents → carries email in resolveInput (mirrors live emit; drives resolution when org absent)', () => {
    const out = orderCreatedEvents({ orderId: 'ord-2', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: null, rfqId: null, email: 'buyer@lab.edu' });
    expect(out[0].args.resolveInput).toMatchObject({ email: 'buyer@lab.edu' });
  });
  it('orderStageEvents → ONLY STATUS_CHANGE logs, keyed by the olog id', () => {
    const order = { orderId: 'ord-1', matchedOrgId: 'x.com' };
    const logs = [
      { id: 'olog-a', action: 'STATUS_CHANGE', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' },
      { id: 'olog-b', action: 'CONTACT_ADDED', timestamp: '2026-04-02T00:00:00Z' },
      { id: 'olog-c', action: 'DOCUMENT_UPLOADED', timestamp: '2026-04-03T00:00:00Z' },
    ];
    const out = orderStageEvents(order, logs);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-order-ord-1-stage-olog-a');
    expect(out[0].args).toMatchObject({ kind: 'order_stage_changed' });
  });
  it('quoteEvents → ONLY QUOTATION docs, keyed by the stored docId', () => {
    const order = { orderId: 'ord-1', matchedOrgId: 'x.com' };
    // Stored DOC items use `docId` (SK: DOC#<stage>#<docId>), NOT `id`.
    const docs = [
      { docId: 'doc-1', docType: 'QUOTATION', fileName: 'q.pdf', uploadedAt: '2026-03-05T00:00:00Z' },
      { docId: 'doc-2', docType: 'PURCHASE_ORDER', fileName: 'po.pdf', uploadedAt: '2026-03-06T00:00:00Z' },
    ];
    const out = quoteEvents(order, docs);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-quote-doc-1');
  });
  it('logisticsEvents → one per usable entry; skips legacy entries missing id/toStage/timestamp', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = logisticsEvents(
      { caseId: 'lc-1', caseType: 'SAMPLE', milestoneLog: [
        { id: 'mlog-x', action: 'CASE_CREATED', toStage: 'DRAFT', timestamp: '2026-06-01T00:00:00Z', internalOnly: false },
        { id: 'mlog-y', action: 'STAGE_ADVANCED', toStage: 'SHIPPED', fromStage: 'DRAFT', timestamp: '2026-06-02T00:00:00Z', internalOnly: true },
        { id: 'mlog-z', action: 'NOTE', timestamp: '2026-06-03T00:00:00Z', internalOnly: false }, // legacy: no toStage → skipped
      ] },
      'x.com',
    );
    expect(out.map((e) => e.id)).toEqual(['tev-logistics-lc-1-log-mlog-x', 'tev-logistics-lc-1-log-mlog-y']);
    expect(out[1].args.isInternalOnly).toBe(true);
    expect(warnSpy).toHaveBeenCalled(); // malformed-skip is logged, not silent
    warnSpy.mockRestore();
  });
});
