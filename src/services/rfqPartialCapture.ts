import { RFQ_API_URL } from './rfqAttachmentService';
import { getVisitorId } from './analyticsStorageService';

/** The Step-1 fields worth capturing so an abandoned RFQ is still visible in admin. */
export interface PartialRfqFields {
  name?: string;
  email?: string;
  institution?: string;
  equipmentCategory?: string;
  applicationDescription?: string;
}

/**
 * Fire-and-forget capture of the customer's Step-1 input, sent when they advance
 * to Step 2. Purely for admin visibility of abandoned leads — it must NEVER block,
 * throw, or disrupt the form. Keyed server-side by visitorId, so a visitor with no
 * stable id (analytics blocked) is simply skipped, and a later full submit supersedes
 * the captured row. `keepalive` lets the request outlive a quick navigation away.
 */
export function capturePartialRfq(fields: PartialRfqFields): void {
  try {
    const visitorId = getVisitorId();
    if (!visitorId) return;

    void fetch(RFQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'capturePartial', visitorId, ...fields }),
      keepalive: true,
    }).catch(() => {
      /* best-effort; a rejected request must never surface to the customer */
    });
  } catch {
    /* even a synchronous failure (e.g. no fetch) must never disrupt the form */
  }
}
