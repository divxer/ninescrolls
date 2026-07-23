import { invokeCrmApi } from '../../../lib/crm/invoke-crm-api';
import { GmailApiError } from './gmailClient';
import type { GmailEmit } from './mapMessage';

// Spec §4: gmail has NO sweep heal, so emits are SYNCHRONOUS and confirmed per message.
// (Deliberate, documented deviation from invoke-crm-api's "sync = tests/debug only" note.)
export type ProjectOutcome =
  | { outcome: 'persisted' }
  | { outcome: 'terminal_skip'; reason: string }
  | { outcome: 'retryable_failure'; error: string };

const SAFE_TOKEN_RE = /^[A-Za-z0-9_.]{1,64}$/;   // error TYPE names only — never free prose
const DIAGNOSTIC_MAX = 200;                       // belt-and-braces cap on the assembled diagnostic

// ALLOWLIST diagnostic sanitizer for error text that leaves the sync run. Exception prose
// (Error.message) can carry customer data — emails, subjects, names, phones, URLs — so NO
// `.message` content EVER flows to the boundary. The diagnostic is assembled exclusively from
// structured error metadata:
//   GmailApiError            → 'gmail_api_error' + "<endpoint> <status> <classification>"
//                              (all three are our own enum/number values)
//   crm-api FunctionError    → 'crm_api_error' + the payload errorType (invoke-crm-api carries it
//                              as err.name) IF it passes SAFE_TOKEN_RE, else bare class
//   AWS SDK invoke error     → 'invoke_error' + the SDK error name (safe-token filtered)
//   anything else            → 'unknown' + the error CONSTRUCTOR name only (safe-token filtered)
// CHOKE POINTS (the only places error objects become persisted/logged strings): projectMessage's
// catch below (projection errors → engine summaries → lastSummary/blocked logs) and syncMailbox
// in handler.ts (thrown-run catch + release-failure catch). Engines only forward these strings.
export function sanitizeDiagnostic(err: unknown): { errorClass: 'crm_api_error' | 'invoke_error' | 'gmail_api_error' | 'unknown'; diagnostic: string } {
  let errorClass: 'crm_api_error' | 'invoke_error' | 'gmail_api_error' | 'unknown' = 'unknown';
  let diagnostic = '';
  if (err instanceof GmailApiError) {
    errorClass = 'gmail_api_error';
    diagnostic = `${err.endpoint} ${err.status} ${err.classification}`;
  } else if (err instanceof Error && err.message.startsWith('crm-api error:')) {
    errorClass = 'crm_api_error';
    if (err.name !== 'Error' && SAFE_TOKEN_RE.test(err.name)) diagnostic = err.name;
  } else if (err instanceof Error && ('$metadata' in err || (err.name !== 'Error' && err.name !== ''))) {
    errorClass = 'invoke_error';                  // AWS SDK error shape
    if (SAFE_TOKEN_RE.test(err.name)) diagnostic = err.name;
  } else {
    const ctor = err === null || err === undefined ? '' : Object(err).constructor?.name ?? '';
    if (SAFE_TOKEN_RE.test(ctor)) diagnostic = ctor;
  }
  return { errorClass, diagnostic: diagnostic.slice(0, DIAGNOSTIC_MAX) };
}

// The single string form used at both choke points: "<errorClass>: <diagnostic>" or the bare
// class when no safe structured detail exists.
export function diagnosticString(err: unknown): string {
  const { errorClass, diagnostic } = sanitizeDiagnostic(err);
  return diagnostic ? `${errorClass}: ${diagnostic}` : errorClass;
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
    return { outcome: 'retryable_failure', error: diagnosticString(err) };
  }
}
