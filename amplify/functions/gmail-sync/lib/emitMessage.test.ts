import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeCrmApi = vi.fn();
vi.mock('../../../lib/crm/invoke-crm-api', () => ({ invokeCrmApi: (...a: unknown[]) => invokeCrmApi(...a) }));

import { projectMessage, sanitizeDiagnostic } from './emitMessage';
import { GmailApiError } from './gmailClient';
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

  it('projection failure → retryable_failure with the sanitized, class-prefixed diagnostic', async () => {
    invokeCrmApi.mockRejectedValueOnce(new Error('boom'));
    const out = await projectMessage(sampleEmit);
    expect(out).toMatchObject({ outcome: 'retryable_failure', error: 'unknown: boom' });
  });

  // Sanitization choke point: projectMessage's catch is the ONLY place a projection error object
  // becomes a diagnostic string — everything downstream (engine summary → handler outcome →
  // lastSummary/state/logs) may carry ONLY the sanitized form.
  it('a PII-bearing oversized projection rejection stores only the sanitized diagnostic', async () => {
    invokeCrmApi.mockRejectedValueOnce(new Error(`crm-api error: emit failed for bob@acme.com subject Hello ${'Z'.repeat(9000)}`));
    const out = await projectMessage(sampleEmit);
    expect(out.outcome).toBe('retryable_failure');
    const error = (out as { error: string }).error;
    expect(error).not.toContain('bob@acme.com');
    expect(error).toContain('[email]');
    expect(error.startsWith('crm_api_error: ')).toBe(true);
    expect(error.length).toBeLessThanOrEqual('crm_api_error: '.length + 200);
  });
});

describe('sanitizeDiagnostic', () => {
  it('redacts email addresses from the diagnostic', () => {
    const { errorClass, diagnostic } = sanitizeDiagnostic(new Error('failed for bob@acme.com: subject Hello'));
    expect(diagnostic).not.toContain('bob@acme.com');
    expect(diagnostic).toBe('failed for [email]: subject Hello');
    expect(errorClass).toBe('unknown');
  });

  it('hard-caps an oversized (10KB) message at exactly 200 chars', () => {
    const { diagnostic } = sanitizeDiagnostic(new Error('boom '.repeat(2048)));   // 10240 chars
    expect(diagnostic).toHaveLength(200);
  });

  it('collapses long token sequences (base64 blobs, opaque ids)', () => {
    const { diagnostic } = sanitizeDiagnostic(new Error(`payload ${'A'.repeat(300)} end`));
    expect(diagnostic).not.toContain('A'.repeat(48));
    expect(diagnostic).toBe('payload [token] end');
  });

  it('classifies by error shape: GmailApiError → gmail_api_error', () => {
    expect(sanitizeDiagnostic(new GmailApiError('messagesGet', 500, 'transient', {})).errorClass).toBe('gmail_api_error');
  });

  it("classifies by error shape: 'crm-api error:'-prefixed Error → crm_api_error", () => {
    expect(sanitizeDiagnostic(new Error('crm-api error: Unhandled')).errorClass).toBe('crm_api_error');
  });

  it('classifies by error shape: AWS SDK invoke error (named error / $metadata) → invoke_error', () => {
    const sdkErr = Object.assign(new Error('rate exceeded'), { name: 'ThrottlingException', $metadata: {} });
    expect(sanitizeDiagnostic(sdkErr).errorClass).toBe('invoke_error');
  });

  it('non-Error input is stringified, sanitized and classified unknown', () => {
    const { errorClass, diagnostic } = sanitizeDiagnostic('raw failure for eve@corp.io');
    expect(errorClass).toBe('unknown');
    expect(diagnostic).toBe('raw failure for [email]');
  });
});
