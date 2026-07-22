import { invokeCrmApi } from '../../../lib/crm/invoke-crm-api';
import { GmailApiError } from './gmailClient';
import type { GmailEmit } from './mapMessage';

// Spec §4: gmail has NO sweep heal, so emits are SYNCHRONOUS and confirmed per message.
// (Deliberate, documented deviation from invoke-crm-api's "sync = tests/debug only" note.)
export type ProjectOutcome =
  | { outcome: 'persisted' }
  | { outcome: 'terminal_skip'; reason: string }
  | { outcome: 'retryable_failure'; error: string };

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_TOKEN_RE = /\S{48,}/g;          // base64 blobs, opaque ids, stack-frame paths
const DIAGNOSTIC_MAX = 200;

// Diagnostic sanitizer for error text that leaves the sync run — raw Error.message can carry
// customer data (crm-api errors embed emails/subjects) or be oversized. errorClass is derived
// from the error SHAPE, the message text is redacted (emails → '[email]', long token runs →
// '[token]') and hard-capped. CHOKE POINTS (the only places error objects become persisted/
// logged strings): projectMessage's catch below (projection errors → engine summaries →
// lastSummary/blocked logs) and syncMailbox's catch in handler.ts (thrown-run errors →
// lastSummary/mailbox_failed log). Engines only forward the already-sanitized strings.
export function sanitizeDiagnostic(err: unknown): { errorClass: 'crm_api_error' | 'invoke_error' | 'gmail_api_error' | 'unknown'; diagnostic: string } {
  let errorClass: 'crm_api_error' | 'invoke_error' | 'gmail_api_error' | 'unknown' = 'unknown';
  if (err instanceof GmailApiError) errorClass = 'gmail_api_error';
  else if (err instanceof Error && err.message.startsWith('crm-api error:')) errorClass = 'crm_api_error';
  else if (err instanceof Error && ('$metadata' in err || (err.name !== 'Error' && err.name !== ''))) errorClass = 'invoke_error';   // AWS SDK error shape
  const message = err instanceof Error ? err.message : String(err);
  const diagnostic = message.replace(EMAIL_RE, '[email]').replace(LONG_TOKEN_RE, '[token]').slice(0, DIAGNOSTIC_MAX);
  return { errorClass, diagnostic };
}

export async function projectMessage(e: GmailEmit): Promise<ProjectOutcome> {
  try {
    await invokeCrmApi({ action: 'emitTimelineEvent', args: {
      source: 'gmail', kind: 'email',
      sourceEntityType: 'gmail', sourceEntityId: e.resolveInput.sourceEntityId,
      occurredAt: e.occurredAt, summary: e.subject ? `Email: ${e.subject}` : 'Email',
      idInput: e.idInput, resolveInput: e.resolveInput,
      direction: e.direction, externalId: e.externalId, threadId: e.threadId ?? undefined,
      from: e.from, to: e.to, subject: e.subject, bodySnippet: e.bodySnippet,
      payload: e.payload, isInternalOnly: false,
    } }, { sync: true });
    return { outcome: 'persisted' };
  } catch (err) {
    // Sanitization choke point (see sanitizeDiagnostic): the ONLY place a projection error
    // object becomes a diagnostic string — downstream summaries/state/logs carry only this form.
    const { errorClass, diagnostic } = sanitizeDiagnostic(err);
    return { outcome: 'retryable_failure', error: `${errorClass}: ${diagnostic}` };
  }
}
