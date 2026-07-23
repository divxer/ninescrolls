/**
 * First-party visitorId sanitation, shared by every hop of the checkout →
 * Stripe metadata → webhook → order chain. The id originates in the browser
 * (localStorage UUID from analyticsStorageService.getVisitorId) but transits
 * client-controlled request bodies and Stripe metadata, so each server-side
 * consumer re-validates instead of trusting the previous hop.
 *
 * Returns the id when it looks like a legitimate visitor id (UUID-shaped
 * charset, bounded length), undefined otherwise — callers simply omit the
 * field on undefined.
 */
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function sanitizeVisitorId(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return VISITOR_ID_RE.test(trimmed) ? trimmed : undefined;
}
