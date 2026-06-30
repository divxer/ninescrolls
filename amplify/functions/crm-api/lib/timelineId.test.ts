import { describe, it, expect } from 'vitest';
import { timelineId } from './timelineId';

describe('timelineId', () => {
  it('order_created keys off orderId', () => {
    expect(timelineId({ kind: 'order_created', orderId: 'ord-1' })).toBe('tev-order-ord-1-created');
  });
  it('order_stage_changed keys off the stable orderLogId', () => {
    expect(timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', orderLogId: 'olog-abc' })).toBe('tev-order-ord-1-stage-olog-abc');
  });
  it('order_stage_changed falls back to a deterministic hash without a log id', () => {
    const a = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    const b = timelineId({ kind: 'order_stage_changed', orderId: 'ord-1', toStatus: 'SHIPPED', occurredAt: '2026-01-01T00:00:00Z' });
    expect(a).toMatch(/^tev-order-ord-1-stage-h[0-9a-f]{12}$/);
    expect(a).toBe(b);
  });
  it('other kinds', () => {
    expect(timelineId({ kind: 'rfq_submitted', rfqId: 'rfq-1' })).toBe('tev-rfq-rfq-1-submitted');
    expect(timelineId({ kind: 'rfq_status_changed', rfqId: 'rfq-1', toStatus: 'converted' })).toBe('tev-rfq-rfq-1-status-converted');
    expect(timelineId({ kind: 'lead_captured', leadId: 'lead-1' })).toBe('tev-lead-lead-1');
    expect(timelineId({ kind: 'logistics_milestone', caseId: 'lc-1', milestoneId: 'mlog-x' })).toBe('tev-logistics-lc-1-log-mlog-x');
    expect(timelineId({ kind: 'quote_sent', quoteDocId: 'doc-1' })).toBe('tev-quote-doc-1');
    expect(timelineId({ kind: 'site_visit_session', sessionId: 'sess-1' })).toBe('tev-analytics-session-sess-1');
    expect(timelineId({ kind: 'manual', manualId: 'm1' })).toBe('tev-manual-m1');
  });
});
