import type { LeadSubmission } from '../../types/admin';

interface EventLike {
  visitorId?: string | null;
  eventType: string;
  timestamp: string;
}

const TIMESTAMP_WINDOW_MS = 60_000;

/**
 * Match leads (of any type) to an organization's events using a two-signal
 * hybrid strategy:
 *   1. Primary — lead.visitorId is in the org's visitorId set.
 *   2. Fallback — lead.submittedAt is within ±60s of any anchor event
 *      (an event of one of the `anchorEventTypes`).
 *
 * The anchor event types are the events that mark "this org had an
 * interaction of the type these leads represent" (e.g. `['contact_form']`
 * for inquiries, `['lead_capture', 'pdf_download']` for downloads).
 *
 * The result is deduplicated by leadId and sorted by submittedAt descending.
 * Returns [] early when the org has no events of any anchor type.
 */
export function matchLinkedLeadsByVisitor(
  events: EventLike[],
  leads: LeadSubmission[],
  anchorEventTypes: string[] = ['contact_form'],
): LeadSubmission[] {
  const anchorSet = new Set(anchorEventTypes);
  const anchorTimestamps = events
    .filter(e => anchorSet.has(e.eventType))
    .map(e => new Date(e.timestamp).getTime());

  if (anchorTimestamps.length === 0) return [];
  if (leads.length === 0) return [];

  const visitorIds = new Set<string>();
  for (const e of events) {
    if (e.visitorId) visitorIds.add(e.visitorId);
  }

  const matched = new Map<string, LeadSubmission>();
  for (const lead of leads) {
    if (lead.visitorId) {
      // Lead has a visitorId — match by visitorId only. If it doesn't match
      // this org, the lead belongs to a different org; do NOT fall back to
      // timestamp (that would cause cross-org false positives whenever two
      // submissions happen within 60s of each other).
      if (visitorIds.has(lead.visitorId)) matched.set(lead.leadId, lead);
      continue;
    }
    // Legacy lead with no visitorId — match by timestamp proximity.
    const leadTime = new Date(lead.submittedAt).getTime();
    const hasNearbyEvent = anchorTimestamps.some(
      t => Math.abs(leadTime - t) < TIMESTAMP_WINDOW_MS,
    );
    if (hasNearbyEvent) matched.set(lead.leadId, lead);
  }

  return Array.from(matched.values()).sort(
    (a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt),
  );
}
