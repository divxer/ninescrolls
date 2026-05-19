import { describe, it, expect } from 'vitest';
import { matchLinkedLeadsByVisitor } from './linkedLeadsMatch';
import type { LeadSubmission } from '../../types/admin';

// Minimal AnalyticsEvent shape — the helper only reads visitorId, eventType, timestamp.
type EventLike = { visitorId?: string | null; eventType: string; timestamp: string };

function lead(overrides: Partial<LeadSubmission>): LeadSubmission {
  return {
    leadId: 'lead-x',
    type: 'contact',
    email: 'x@example.com',
    submittedAt: '2026-05-16T10:00:00Z',
    ...overrides,
  };
}

describe('matchLinkedLeadsByVisitor', () => {
  it('matches leads by visitorId (primary signal)', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'page_view', timestamp: '2026-05-16T09:00:00Z' },
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'L1', visitorId: 'v1', submittedAt: '2026-05-16T10:00:05Z' }),
      lead({ leadId: 'L2', visitorId: 'v2', submittedAt: '2026-05-16T10:00:00Z' }),
    ];
    const result = matchLinkedLeadsByVisitor(events, leads);
    expect(result.map(l => l.leadId)).toEqual(['L1']);
  });

  it('falls back to ±60s timestamp match when visitorId is missing', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'L1', visitorId: null, submittedAt: '2026-05-16T10:00:30Z' }),    // within 60s
      lead({ leadId: 'L2', visitorId: null, submittedAt: '2026-05-16T10:02:00Z' }),    // outside 60s
    ];
    const result = matchLinkedLeadsByVisitor(events, leads);
    expect(result.map(l => l.leadId)).toEqual(['L1']);
  });

  it('does not double-count when both visitorId and timestamp match', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'L1', visitorId: 'v1', submittedAt: '2026-05-16T10:00:10Z' }),
    ];
    const result = matchLinkedLeadsByVisitor(events, leads);
    expect(result).toHaveLength(1);
  });

  it('sorts results by submittedAt descending (most recent first)', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-15T10:00:00Z' },
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'OLD', visitorId: 'v1', submittedAt: '2026-05-15T10:00:00Z' }),
      lead({ leadId: 'NEW', visitorId: 'v1', submittedAt: '2026-05-16T10:00:00Z' }),
    ];
    const result = matchLinkedLeadsByVisitor(events, leads);
    expect(result.map(l => l.leadId)).toEqual(['NEW', 'OLD']);
  });

  it('returns [] when no contact_form events present', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'page_view', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [lead({ leadId: 'L1', visitorId: 'v1' })];
    expect(matchLinkedLeadsByVisitor(events, leads)).toEqual([]);
  });

  it('returns [] when leads array is empty', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    expect(matchLinkedLeadsByVisitor(events, [])).toEqual([]);
  });

  // Regression guard: a lead with a non-matching visitorId belongs to a
  // different org and must NOT fall back to timestamp proximity — otherwise
  // unrelated submissions within 60s of each other would cross-pollinate.
  it('does NOT timestamp-match a lead whose visitorId belongs to a different org', () => {
    const events: EventLike[] = [
      { visitorId: 'v1', eventType: 'contact_form', timestamp: '2026-05-16T10:00:00Z' },
    ];
    const leads = [
      lead({ leadId: 'OTHER_ORG', visitorId: 'v2', submittedAt: '2026-05-16T10:00:10Z' }),
    ];
    expect(matchLinkedLeadsByVisitor(events, leads)).toEqual([]);
  });
});
