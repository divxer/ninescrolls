import { invokeCrmApi } from '../../../lib/crm/invoke-crm-api';
import type { GmailEmit } from './mapMessage';

// Spec §4: gmail has NO sweep heal, so emits are SYNCHRONOUS and confirmed per message.
// (Deliberate, documented deviation from invoke-crm-api's "sync = tests/debug only" note.)
export type ProjectOutcome =
  | { outcome: 'persisted' }
  | { outcome: 'terminal_skip'; reason: string }
  | { outcome: 'retryable_failure'; error: string };

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
    return { outcome: 'retryable_failure', error: err instanceof Error ? err.message : String(err) };
  }
}
