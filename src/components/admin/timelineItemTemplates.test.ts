import { describe, it, expect } from 'vitest';
import { composeTimelineText, CHIP_LABELS, toneBadge } from './timelineItemTemplates';

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
