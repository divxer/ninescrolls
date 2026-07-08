import { describe, it, expect } from 'vitest';
import { composeTimelineText, CHIP_LABELS, toneBadge, buildSourceLink } from './timelineItemTemplates';

const item = (o: Record<string, unknown>) => ({
  kind: 'order_created', primaryLabel: 'fallback', productModel: null, specificModel: null,
  equipmentCategory: null, leadType: null, productName: null, stageFrom: null, stageTo: null,
  fileName: null, pageCount: null, activeSeconds: null, topPaths: null, ...o,
}) as never;

describe('timelineItemTemplates', () => {
  it('composes known kinds from structured fields (not from summary)', () => {
    expect(composeTimelineText(item({ kind: 'order_stage_changed', stageFrom: 'IN_PRODUCTION', stageTo: 'SHIPPED' })).title).toBe('Order stage: IN_PRODUCTION → SHIPPED');
    expect(composeTimelineText(item({ kind: 'quote_sent', fileName: 'Q-014.pdf' })).title).toBe('Quote sent');
    expect(composeTimelineText(item({ kind: 'quote_sent', fileName: 'Q-014.pdf' })).snippet).toBe('Q-014.pdf');
    expect(composeTimelineText(item({ kind: 'site_visit_session', pageCount: 3, activeSeconds: 245 })).title).toBe('Site visit');
    expect(composeTimelineText(item({ kind: 'site_visit_session', pageCount: 3, activeSeconds: 245 })).snippet).toBe('3 pages · 4m 5s');
  });

  it('falls back to primaryLabel for an unknown kind', () => {
    const r = composeTimelineText(item({ kind: 'future_kind_xyz', primaryLabel: 'Something happened' }));
    expect(r.title).toBe('Something happened');
    expect(r.snippet).toBeNull();
  });

  it('exposes chip labels and tone→badge class', () => {
    expect(CHIP_LABELS.site_visits).toBe('Site visits');
    expect(toneBadge('inferred')).toContain('amber');
    expect(toneBadge('confirmed')).toBeTruthy();
  });
});

describe('buildSourceLink', () => {
  const it2 = (o: Record<string, unknown>) => ({ source: 'order', sourceEntityId: 'x', payload: null, ...o }) as never;
  it('links rfq/lead/order/logistics by sourceEntityId', () => {
    expect(buildSourceLink(it2({ source: 'rfq', sourceEntityId: 'rfq-1' }))).toBe('/admin/rfqs/rfq-1');
    expect(buildSourceLink(it2({ source: 'lead', sourceEntityId: 'lead-1' }))).toBe('/admin/leads/lead-1');
    expect(buildSourceLink(it2({ source: 'order', sourceEntityId: 'ord-1' }))).toBe('/admin/orders/ord-1');
    expect(buildSourceLink(it2({ source: 'logistics', sourceEntityId: 'lc-1' }))).toBe('/admin/logistics/lc-1');
  });
  it('links a quote to its order via payload.orderId; null if absent', () => {
    expect(buildSourceLink(it2({ source: 'quote', sourceEntityId: 'doc-1', payload: { orderId: 'ord-9' } }))).toBe('/admin/orders/ord-9');
    expect(buildSourceLink(it2({ source: 'quote', sourceEntityId: 'doc-1', payload: null }))).toBeNull();
  });
  it('no link for analytics / unknown source', () => {
    expect(buildSourceLink(it2({ source: 'analytics', sourceEntityId: 'sess-1' }))).toBeNull();
    expect(buildSourceLink(it2({ source: 'weird', sourceEntityId: 'z' }))).toBeNull();
  });
});
