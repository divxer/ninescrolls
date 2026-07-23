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

  // Allowlist sanitization choke point: projectMessage's catch is the ONLY place a projection
  // error object becomes a diagnostic string — the diagnostic is built exclusively from
  // structured error metadata (class/enum/type names), NEVER from exception prose.
  it('projection failure → retryable_failure with the allowlisted diagnostic (constructor name, no message)', async () => {
    invokeCrmApi.mockRejectedValueOnce(new Error('boom'));
    const out = await projectMessage(sampleEmit);
    expect(out).toMatchObject({ outcome: 'retryable_failure', error: 'unknown: Error' });
  });

  it('a PII-laden plain Error at the projection choke point yields ONLY the allowlisted form', async () => {
    invokeCrmApi.mockRejectedValueOnce(new Error('failed for bob@acme.com re: Quote #123 +1-555-0100 https://x.com/y'));
    const out = await projectMessage(sampleEmit);
    expect(out.outcome).toBe('retryable_failure');
    const error = (out as { error: string }).error;
    expect(error).toBe('unknown: Error');
    for (const fragment of ['bob@acme.com', 'Quote', '123', '555', 'x.com', 'failed']) {
      expect(error).not.toContain(fragment);
    }
  });

  it('a crm-api FunctionError with prose+PII message → bare crm_api_error (no message content)', async () => {
    invokeCrmApi.mockRejectedValueOnce(new Error(`crm-api error: emit failed for bob@acme.com subject Hello ${'Z'.repeat(9000)}`));
    const out = await projectMessage(sampleEmit);
    expect((out as { error: string }).error).toBe('crm_api_error');
  });

  it('a crm-api FunctionError carrying a safe errorType name → crm_api_error: <type>', async () => {
    const e = new Error('crm-api error: bad input for bob@acme.com');
    e.name = 'ValidationError';                                   // invoke-crm-api sets this from the payload errorType
    invokeCrmApi.mockRejectedValueOnce(e);
    const out = await projectMessage(sampleEmit);
    expect((out as { error: string }).error).toBe('crm_api_error: ValidationError');
  });
});

describe('sanitizeDiagnostic (allowlist — structured metadata only, never exception prose)', () => {
  it('GmailApiError → gmail_api_error + "<endpoint> <status> <classification>" (all our own values)', () => {
    expect(sanitizeDiagnostic(new GmailApiError('messagesGet', 500, 'transient', {})))
      .toEqual({ errorClass: 'gmail_api_error', diagnostic: 'messagesGet 500 transient' });
  });

  it("crm-api FunctionError without a payload errorType → crm_api_error with EMPTY diagnostic", () => {
    expect(sanitizeDiagnostic(new Error('crm-api error: prose with eve@corp.io')))
      .toEqual({ errorClass: 'crm_api_error', diagnostic: '' });
  });

  it('crm-api FunctionError with a safe errorType name → that name only', () => {
    const e = new Error('crm-api error: whatever'); e.name = 'Runtime.HandlerError';
    expect(sanitizeDiagnostic(e)).toEqual({ errorClass: 'crm_api_error', diagnostic: 'Runtime.HandlerError' });
  });

  it('AWS SDK invoke error → invoke_error + the SDK error name (safe token)', () => {
    const sdkErr = Object.assign(new Error('rate exceeded for bob@acme.com'), { name: 'ThrottlingException', $metadata: {} });
    expect(sanitizeDiagnostic(sdkErr)).toEqual({ errorClass: 'invoke_error', diagnostic: 'ThrottlingException' });
  });

  it('a weird error name (spaces/symbols) fails the safe-token filter → bare class', () => {
    const sdkErr = Object.assign(new Error('x'), { name: 'Weird Name! <script>', $metadata: {} });
    expect(sanitizeDiagnostic(sdkErr)).toEqual({ errorClass: 'invoke_error', diagnostic: '' });
  });

  it('PII-laden plain Error → unknown + constructor name only; NO message fragment survives', () => {
    const { errorClass, diagnostic } = sanitizeDiagnostic(new Error('failed for bob@acme.com re: Quote #123 +1-555-0100 https://x.com/y'));
    expect(errorClass).toBe('unknown');
    expect(diagnostic).toBe('Error');
  });

  it('oversized (10KB) message never reaches the diagnostic at all', () => {
    const { diagnostic } = sanitizeDiagnostic(new Error('secret '.repeat(1500)));
    expect(diagnostic).toBe('Error');
  });

  it('a custom Error subclass → its constructor name (structured, not prose)', () => {
    class QuoteProjectionFailure extends Error {}
    expect(sanitizeDiagnostic(new QuoteProjectionFailure('for bob@acme.com')).diagnostic).toBe('QuoteProjectionFailure');
  });

  it('non-Error input → unknown + boxed constructor name, no content', () => {
    expect(sanitizeDiagnostic('raw failure for eve@corp.io')).toEqual({ errorClass: 'unknown', diagnostic: 'String' });
  });
});
