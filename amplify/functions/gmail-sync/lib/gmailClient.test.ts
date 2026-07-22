import { describe, it, expect, vi, beforeEach } from 'vitest';
const getToken = vi.fn();
vi.mock('google-auth-library', () => ({ JWT: vi.fn().mockImplementation(() => ({ authorize: getToken, getAccessToken: getToken })) }));
const secretsSend = vi.fn();
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({ send: secretsSend })),
  GetSecretValueCommand: vi.fn().mockImplementation((i) => i),
}));
import { createGmailClient, classifyGmailError } from './gmailClient';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  secretsSend.mockResolvedValue({ SecretString: JSON.stringify({ client_email: 'sa@p.iam', private_key: 'k' }) });
  getToken.mockResolvedValue({ token: 'at' });
});

describe('gmailClient', () => {
  it('impersonates the mailbox (JWT subject) with gmail.readonly scope', async () => {
    const { JWT } = await import('google-auth-library');
    await createGmailClient('info@ninescrolls.com');
    expect(JWT).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'info@ninescrolls.com',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    }));
  });
  it('messagesGetMetadata requests format=metadata + the pinned header list, never full', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'g1' }) });
    const c = await createGmailClient('info@ninescrolls.com');
    await c.messagesGetMetadata('g1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('format=metadata');
    for (const h of ['From','To','Cc','Bcc','Subject','Date','Message-ID']) expect(url).toContain(`metadataHeaders=${h}`);
    expect(url).not.toContain('format=full');
  });
  it('classifyGmailError: expiry ONLY for (historyList, 404, parsed NOT_FOUND/notFound reason); everything else classified strictly', () => {
    expect(classifyGmailError('historyList', 404, { error: { status: 'NOT_FOUND' } })).toBe('history_expired');
    expect(classifyGmailError('historyList', 404, { error: { errors: [{ reason: 'notFound' }] } })).toBe('history_expired');
    expect(classifyGmailError('historyList', 404, { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'notFound' }] } })).toBe('history_expired');   // plan-review R2: details[] shape
    expect(classifyGmailError('historyList', 404, {})).toBe('not_found');            // 404 WITHOUT the parsed reason ≠ expiry
    expect(classifyGmailError('historyList', 404, { error: { details: [{ reason: 'quotaExceeded' }] } })).toBe('not_found');   // wrong details reason ≠ expiry
    expect(classifyGmailError('messagesGet', 404, { error: { status: 'NOT_FOUND' } })).toBe('not_found'); // wrong endpoint ≠ expiry
    expect(classifyGmailError('historyList', 429, {})).toBe('rate_limited');
    expect(classifyGmailError('messagesGet', 500, {})).toBe('transient');
    expect(classifyGmailError('messagesGet', 400, {})).toBe('bad_request');
  });
});
