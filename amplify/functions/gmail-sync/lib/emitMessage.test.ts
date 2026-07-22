import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeCrmApi = vi.fn();
vi.mock('../../../lib/crm/invoke-crm-api', () => ({ invokeCrmApi: (...a: unknown[]) => invokeCrmApi(...a) }));

import { projectMessage } from './emitMessage';
import type { GmailEmit } from './mapMessage';

const sampleEmit: GmailEmit = {
  idInput: { source: 'gmail', rfc822MessageId: '<abc123@mail.gmail.com>' },
  direction: 'inbound',
  occurredAt: '2026-07-21T12:00:00.000Z',
  externalId: 'abc123@mail.gmail.com',
  threadId: 'thread-1',
  from: 'customer@example.com',
  to: 'info@ninescrolls.com',
  subject: 'Question about probe stations',
  bodySnippet: 'Hi, I had a question...',
  resolveInput: { sourceEntityType: 'gmail', sourceEntityId: 'abc123@mail.gmail.com', channel: 'gmail', email: 'customer@example.com' },
  payload: { customerEmail: 'customer@example.com', gmailLink: 'https://mail.google.com/mail/u/0/#search/rfc822msgid:abc123%40mail.gmail.com', mailbox: 'info@ninescrolls.com' },
};

beforeEach(() => { invokeCrmApi.mockReset(); });

describe('projectMessage', () => {
  it('persisted: sync-invokes crm-api emit and confirms', async () => {
    invokeCrmApi.mockResolvedValueOnce({ ok: true });
    const out = await projectMessage(sampleEmit);
    expect(out).toEqual({ outcome: 'persisted' });
    expect(invokeCrmApi).toHaveBeenCalledWith(expect.objectContaining({ action: 'emitTimelineEvent' }), expect.objectContaining({ sync: true }));
  });

  it('projection failure → retryable_failure with the error message', async () => {
    invokeCrmApi.mockRejectedValueOnce(new Error('boom'));
    const out = await projectMessage(sampleEmit);
    expect(out).toMatchObject({ outcome: 'retryable_failure', error: 'boom' });
  });
});
