import { describe, it, expect } from 'vitest';
import { toOrganizationTimelineItem } from './organizationTimelineItem';

const base = {
  id: 'tev-1', orgId: 'acme.com', occurredAt: '2026-03-01T00:00:00Z',
  resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1,
  isInternalOnly: false, voided: false, sourceEntityType: 'order', sourceEntityId: 'ord-1',
  summary: 'Order created — XPS-9', payload: { rfqId: 'rfq-9', productModel: 'XPS-9' },
} as never;

describe('toOrganizationTimelineItem', () => {
  it('maps identity/label/group/icon and gates confidence off for confirmed', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'order', kind: 'order_created' });
    expect(r).toMatchObject({
      id: 'tev-1', occurredAt: '2026-03-01T00:00:00Z', kind: 'order_created',
      sourceFilterGroup: 'order', icon: 'order', tone: 'confirmed',
      primaryLabel: 'Order created — XPS-9', productModel: 'XPS-9', confidence: null,
      sourceEntityType: 'order', sourceEntityId: 'ord-1',
    });
  });

  it('domain-match tone for email_domain_exact', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'rfq', kind: 'rfq_submitted', resolutionReason: 'email_domain_exact', payload: { equipmentCategory: 'ICP', specificModel: 'X' } } as never);
    expect(r.tone).toBe('domain-match');
    expect(r.sourceFilterGroup).toBe('rfq');
    expect(r.equipmentCategory).toBe('ICP');
  });

  it('inferred tone SHOWS confidence for visitor_prior_event (analytics)', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'analytics', kind: 'site_visit_session', resolutionReason: 'visitor_prior_event', confidence: 0.72, payload: { pageCount: 3, activeSeconds: 240, topPaths: ['/a', '/b'] } } as never);
    expect(r).toMatchObject({ tone: 'inferred', sourceFilterGroup: 'site_visits', icon: 'site_visit', confidence: 0.72, pageCount: 3, activeSeconds: 240, topPaths: ['/a', '/b'] });
  });

  it('manually_linked status forces confirmed tone regardless of reason', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'order', kind: 'order_created', resolutionStatus: 'manually_linked', resolutionReason: 'visitor_prior_event' } as never);
    expect(r.tone).toBe('confirmed');
  });

  it('unknown reason → unknown tone (keeps confidence) and unknown source → other/event', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'gmail', kind: 'email_received', resolutionReason: 'weird', confidence: 0.4, payload: {} } as never);
    expect(r).toMatchObject({ tone: 'unknown', sourceFilterGroup: 'other', icon: 'event', confidence: 0.4 });
  });

  it('maps stage/logistics keys (fromStatus/toStatus OR fromStage/toStage)', () => {
    const a = toOrganizationTimelineItem({ ...base, source: 'order', kind: 'order_stage_changed', payload: { fromStatus: 'IN_PRODUCTION', toStatus: 'SHIPPED' } } as never);
    expect(a).toMatchObject({ stageFrom: 'IN_PRODUCTION', stageTo: 'SHIPPED' });
    const b = toOrganizationTimelineItem({ ...base, source: 'logistics', kind: 'logistics_milestone', payload: { fromStage: 'BOOKED', toStage: 'IN_TRANSIT' } } as never);
    expect(b).toMatchObject({ stageFrom: 'BOOKED', stageTo: 'IN_TRANSIT', sourceFilterGroup: 'logistics', icon: 'logistics' });
  });

  it('primaryLabel falls back to summary and payload passes through as escape hatch', () => {
    const r = toOrganizationTimelineItem({ ...base, source: 'quote', kind: 'quote_sent', summary: 'Quote sent — Q-014.pdf', payload: { orderId: 'ord-1', fileName: 'Q-014.pdf' } } as never);
    expect(r).toMatchObject({ primaryLabel: 'Quote sent — Q-014.pdf', fileName: 'Q-014.pdf', sourceFilterGroup: 'quote', payload: { orderId: 'ord-1', fileName: 'Q-014.pdf' } });
  });
});
