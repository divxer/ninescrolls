import { JWT } from 'google-auth-library';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Pure Google adapter (spec §3): DWD service-account JWT impersonating the mailbox; REST via fetch;
// headers + snippet ONLY (format=metadata) — never bodies. Endpoint-aware error classification (§4).
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
export const METADATA_HEADERS = ['From', 'To', 'Cc', 'Bcc', 'Subject', 'Date', 'Message-ID', 'References', 'List-Unsubscribe'];
const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailEndpoint = 'historyList' | 'messagesList' | 'messagesGet' | 'getProfile';
export type GmailErrorClass = 'history_expired' | 'not_found' | 'rate_limited' | 'bad_request' | 'transient';

export function classifyGmailError(endpoint: GmailEndpoint, status: number, body: unknown): GmailErrorClass {
  // plan-review fix: expiry requires the PARSED Google reason, not the status code alone —
  // (endpoint === historyList) AND (404) AND a notFound reason from ANY of the three shapes Google
  // uses: legacy error.status, legacy error.errors[].reason, or google.rpc error.details[].reason.
  const err = (body as { error?: { status?: string; errors?: { reason?: string }[]; details?: { reason?: string; ['@type']?: string }[] } } | undefined)?.error;
  const looksNotFound = err?.status === 'NOT_FOUND'
    || err?.errors?.some((e) => e.reason === 'notFound') === true
    || err?.details?.some((d) => d.reason === 'notFound' || d.reason === 'NOT_FOUND') === true;
  if (endpoint === 'historyList' && status === 404 && looksNotFound) return 'history_expired';  // the ONLY re-anchor signal
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 400) return 'bad_request';
  return 'transient';
}

export class GmailApiError extends Error {
  constructor(public endpoint: GmailEndpoint, public status: number, public classification: GmailErrorClass, public body: unknown) {
    super(`gmail ${endpoint} ${status} (${classification})`);
  }
}

export async function createGmailClient(mailbox: string) {
  const sm = new SecretsManagerClient({});
  const sec = await sm.send(new GetSecretValueCommand({ SecretId: process.env.GMAIL_SA_SECRET_ARN! }));
  const key = JSON.parse(sec.SecretString!) as { client_email: string; private_key: string };
  const jwt = new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES, subject: mailbox });

  async function call(endpoint: GmailEndpoint, path: string): Promise<Record<string, unknown>> {
    const { token } = await jwt.getAccessToken();
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) return (await res.json()) as Record<string, unknown>;
      const body = await res.json().catch(() => ({}));
      const cls = classifyGmailError(endpoint, res.status, body);
      if (cls === 'rate_limited' && attempt < 3) { await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); continue; }
      throw new GmailApiError(endpoint, res.status, cls, body);
    }
  }
  const mh = METADATA_HEADERS.map((h) => `metadataHeaders=${h}`).join('&');
  return {
    getProfile: () => call('getProfile', '/profile'),
    historyList: (startHistoryId: string, pageToken?: string) =>
      call('historyList', `/history?historyTypes=messageAdded&startHistoryId=${startHistoryId}${pageToken ? `&pageToken=${pageToken}` : ''}`),
    messagesList: (q: string, pageToken?: string) =>
      call('messagesList', `/messages?q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ''}`),
    messagesGetMetadata: (id: string) => call('messagesGet', `/messages/${id}?format=metadata&${mh}`),
  };
}
export type GmailClient = Awaited<ReturnType<typeof createGmailClient>>;
