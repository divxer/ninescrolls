import { describe, it, expect } from 'vitest';
import {
  buildRfqEmitArgs, buildLeadEmitArgs, buildOrderCreatedEmitArgs,
  buildOrderStageChangedEmitArgs, buildQuoteSentEmitArgs, buildLogisticsMilestoneEmitArgs,
} from './emit-builders';

describe('emit-builders (pure)', () => {
  it('buildRfqEmitArgs: stable occurredAt, deterministic id, matchedOrgId+email in resolveInput', () => {
    const a = buildRfqEmitArgs({ rfqId: 'rfq-1', submittedAt: '2026-06-19T10:00:00Z', email: 'T@DiamondFoundry.com', specificModel: 'ICP-1000W' }, 'diamondfoundry.com');
    expect(a).toMatchObject({ source: 'rfq', kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', occurredAt: '2026-06-19T10:00:00Z' });
    expect(a.idInput).toEqual({ kind: 'rfq_submitted', rfqId: 'rfq-1' });
    expect(a.resolveInput).toMatchObject({ channel: 'rfq', matchedOrgId: 'diamondfoundry.com', email: 'T@DiamondFoundry.com' });
    expect(a.summary).toContain('ICP-1000W');
  });
  it('buildLeadEmitArgs: summary varies by lead type', () => {
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'download_gate', productName: 'ICP brochure' }, null).summary).toMatch(/Downloaded/i);
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'contact', inquiryType: 'pricing' }, null).summary).toMatch(/Contact/i);
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'newsletter' }, null).summary).toMatch(/Newsletter/i);
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'contact' }, 'acme.com').resolveInput.matchedOrgId).toBe('acme.com');
  });
  it('buildOrderCreatedEmitArgs: order_created, optional rfqId in payload', () => {
    const a = buildOrderCreatedEmitArgs({ orderId: 'ord-1', createdAt: '2026-03-01T00:00:00Z', productModel: 'XPS-9' }, { matchedOrgId: 'acme.com', email: 'p@acme.com', rfqId: 'rfq-9' });
    expect(a).toMatchObject({ source: 'order', kind: 'order_created', sourceEntityId: 'ord-1', occurredAt: '2026-03-01T00:00:00Z' });
    expect(a.idInput).toEqual({ kind: 'order_created', orderId: 'ord-1' });
    expect(a.resolveInput.matchedOrgId).toBe('acme.com');
    expect(a.payload).toMatchObject({ rfqId: 'rfq-9' });
  });
  it('buildOrderStageChangedEmitArgs: keyed by stable orderLogId, summary shows status', () => {
    const a = buildOrderStageChangedEmitArgs({ orderId: 'ord-1', matchedOrgId: 'acme.com' }, { id: 'olog-abc', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' });
    expect(a.kind).toBe('order_stage_changed');
    expect(a.idInput).toEqual({ kind: 'order_stage_changed', orderId: 'ord-1', orderLogId: 'olog-abc', toStatus: 'SHIPPED', occurredAt: '2026-04-01T00:00:00Z' });
    expect(a.occurredAt).toBe('2026-04-01T00:00:00Z');
    expect(a.summary).toContain('SHIPPED');
    expect(a.resolveInput.matchedOrgId).toBe('acme.com');
  });
  it('buildQuoteSentEmitArgs: quote_sent keyed by doc id', () => {
    const a = buildQuoteSentEmitArgs({ orderId: 'ord-1', matchedOrgId: 'acme.com' }, { id: 'doc-1', fileName: 'Quote-014.pdf', uploadedAt: '2026-03-05T00:00:00Z' });
    expect(a).toMatchObject({ source: 'quote', kind: 'quote_sent', sourceEntityType: 'quote', sourceEntityId: 'doc-1', occurredAt: '2026-03-05T00:00:00Z' });
    expect(a.idInput).toEqual({ kind: 'quote_sent', quoteDocId: 'doc-1' });
    expect(a.summary).toContain('Quote-014.pdf');
  });
  it('buildLogisticsMilestoneEmitArgs: isInternalOnly passthrough + matchedOrgId from related order', () => {
    const internal = buildLogisticsMilestoneEmitArgs({ caseId: 'lc-1', caseType: 'SAMPLE' }, { id: 'mlog-x', toStage: 'US_CUSTOMS_CLEARED', timestamp: '2026-06-28T00:00:00Z', internalOnly: true, action: 'STAGE_ADVANCED' }, 'acme.com');
    expect(internal).toMatchObject({ source: 'logistics', kind: 'logistics_milestone', sourceEntityId: 'lc-1', isInternalOnly: true });
    expect(internal.idInput).toEqual({ kind: 'logistics_milestone', caseId: 'lc-1', milestoneId: 'mlog-x', stage: 'US_CUSTOMS_CLEARED', occurredAt: '2026-06-28T00:00:00Z' });
    expect(internal.resolveInput.matchedOrgId).toBe('acme.com');
    expect(internal.summary).toContain('US_CUSTOMS_CLEARED');
    const created = buildLogisticsMilestoneEmitArgs({ caseId: 'lc-2', caseType: 'EQUIPMENT' }, { id: 'mlog-y', toStage: 'DRAFT', timestamp: '2026-06-01T00:00:00Z', internalOnly: false, action: 'CASE_CREATED' }, null);
    expect(created.summary).toMatch(/created/i);
    expect(created.isInternalOnly).toBe(false);
  });
});
