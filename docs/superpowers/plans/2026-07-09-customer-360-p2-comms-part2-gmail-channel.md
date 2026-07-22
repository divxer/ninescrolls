# P2 Comms — Part 2: Gmail Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Prerequisite: Part 1 (CRM foundations) fully merged/green** — this plan consumes its contracts (comms EmitArgs, gmail TimelineIdInput, `resolveLinks` gmail rule, marker v2, authz).

**Goal:** Sync `info@ninescrolls.com` (the single mailbox — spec §0) into the Customer 360 timeline: a `gmail-sync` Lambda polls the Gmail history API via a DWD service account, maps customer-facing messages to `TimelineEvent(source:'gmail')` through the existing emit path, rendered with subject/snippet/direction + a Gmail deep link.

**Architecture:** New `gmail-sync` Lambda = pure Google adapter + one fenced DynamoDB state item per mailbox (`GMAIL_SYNC#<mailbox>/STATE`, own `gmailSyncState` module patterned after sweepState). Sync emits **synchronously** into crm-api and advances a history-**record**-boundary checkpoint only past durably-projected messages. Metadata + snippet only — never bodies.

**Tech Stack:** `google-auth-library` (JWT/DWD) + `fetch` to Gmail REST (NOT `googleapis`); `@aws-sdk/client-secrets-manager`; `@aws-sdk/lib-dynamodb`; EventBridge cron; vitest module-mocks. Worktree `scratchpad/wt-comms`, branch `feature/customer-360-p2-comms-sync`. Spec @ `da47e1bf` §§2–4, 5 (mapping), 6, 7, 7b, 10.

**Invariants for every review gate:** (1) checkpoint advances only past **fully-done history records** (every message `persisted`/`terminal_skip`), committing the response-level `historyId` on a clean run; (2) every state write is fenced on `lease = :tok AND leaseExpiresAt > :now`; ANY CCFE ⇒ ownership lost ⇒ abort; release requires an unexpired lease; (3) `historyId` compared as decimal **BigInt** inside the fenced write; (4) backfill: anchor captured + persisted **before** page 1; `pageToken` advances only after **complete page success**; watermark set to the stored anchor; (5) expiry re-anchor ONLY on the *(endpoint=history.list, 404/notFound)* tuple; (6) headers+snippet only (`format=metadata`), never bodies; (7) dedup identity = normalized RFC822 `Message-ID` (fallback `${mailbox}:${gmailMessageId}`), identical across `id`/`externalId`/`sourceEntityId`; (8) alias allowlist `{info,sales,support}`; skip all-internal + `DRAFT`/`CHAT` labelIds; (9) `payload.customerEmail` normalized non-empty on every emitted event; (10) gmail-sync writes ONLY `GMAIL_SYNC#*` items (LeadingKeys-scoped IAM).

---

### Task 1: `gmailSyncState` — fenced state item (literal spec contract)

**Files:**
- Create: `amplify/functions/gmail-sync/lib/gmailSyncState.ts`
- Test: `amplify/functions/gmail-sync/lib/gmailSyncState.test.ts`

- [ ] **Step 1: Failing test** — create the test file:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
import { acquireLease, writeStateFenced, releaseLease, readState, isNewerHistoryId, stateKey } from './gmailSyncState';

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

describe('gmailSyncState', () => {
  it('stateKey: GMAIL_SYNC#<mailbox>/STATE', () =>
    expect(stateKey('info@ninescrolls.com')).toEqual({ PK: 'GMAIL_SYNC#info@ninescrolls.com', SK: 'STATE' }));
  it('acquire: conditional on no-live-lease; returns token; null on CCFE', async () => {
    const tok = await acquireLease('m@x', 120, 1000);
    expect(tok).toMatch(/[0-9a-f-]{36}/);
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toBe('attribute_not_exists(lease) OR leaseExpiresAt < :now');
    send.mockRejectedValueOnce(Object.assign(new Error('held'), { name: 'ConditionalCheckFailedException' }));
    expect(await acquireLease('m@x', 120, 1000)).toBeNull();
  });
  it('writeStateFenced: conditions on token AND unexpired lease; lost=true on CCFE', async () => {
    await writeStateFenced('m@x', 'tok', 2000, { historyId: '123' });
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toBe('lease = :tok AND leaseExpiresAt > :now');
    send.mockRejectedValueOnce(Object.assign(new Error('lost'), { name: 'ConditionalCheckFailedException' }));
    expect((await writeStateFenced('m@x', 'tok', 2000, { historyId: '124' })).lost).toBe(true);
  });
  it('release: ALSO requires unexpired lease (R6/blocker-3) and removes lease attrs', async () => {
    await releaseLease('m@x', 'tok', 2000, { lastSummary: { examined: 0 } });
    const u = send.mock.calls[0][0].input;
    expect(u.ConditionExpression).toBe('lease = :tok AND leaseExpiresAt > :now');
    expect(u.UpdateExpression).toContain('REMOVE lease, leaseExpiresAt');
  });
  it('isNewerHistoryId compares as decimal BigInt (\"9\" < \"10\")', () => {
    expect(isNewerHistoryId('10', '9')).toBe(true);
    expect(isNewerHistoryId('9', '10')).toBe(false);
    expect(isNewerHistoryId('18446744073709551617', '18446744073709551616')).toBe(true); // > Number.MAX_SAFE_INTEGER
    expect(isNewerHistoryId('5', null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** — `amplify/functions/gmail-sync/lib/dynamodb.ts` (same 5-line pattern as crm-api's: docClient + `TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!`) and `gmailSyncState.ts`:
```ts
import crypto from 'node:crypto';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';

// Fenced per-mailbox sync state (spec §2/§4) — PATTERNED after crm-api's sweepState (which is
// crm-api-local + CRM_SWEEP-hardcoded, so not importable). One atomic JSON item; every write fenced.
export interface GmailSyncState {
  phase?: 'backfill' | 'incremental';
  historyId?: string | null;
  anchorHistoryId?: string | null; pageToken?: string | null; window?: string | null; configId?: string | null;
  lease?: string; leaseExpiresAt?: number;   // epoch ms
  lastRunAt?: number; lastSummary?: Record<string, unknown> | null;
}

export const stateKey = (mailbox: string) => ({ PK: `GMAIL_SYNC#${mailbox}`, SK: 'STATE' });

export function isNewerHistoryId(candidate: string, stored: string | null | undefined): boolean {
  if (!stored) return true;
  return BigInt(candidate) > BigInt(stored);     // uint64-safe; string compare would be lexicographic
}

export async function readState(mailbox: string): Promise<GmailSyncState> {
  // plan-review fix: always strongly-consistent — the read happens right after acquireLease and
  // must see the previous holder's final fenced write, not an eventually-consistent ghost.
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: stateKey(mailbox), ConsistentRead: true }));
  return (res.Item as GmailSyncState | undefined) ?? {};
}

export async function acquireLease(mailbox: string, lambdaTimeoutSec: number, nowMs: number): Promise<string | null> {
  const token = crypto.randomUUID();
  const exp = nowMs + Math.max(2 * lambdaTimeoutSec, 300) * 1000;
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mailbox),
      UpdateExpression: 'SET lease = :tok, leaseExpiresAt = :exp, lastRunAt = :now',
      ConditionExpression: 'attribute_not_exists(lease) OR leaseExpiresAt < :now',
      ExpressionAttributeValues: { ':tok': token, ':exp': exp, ':now': nowMs },
    }));
    return token;
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

// Every progress write: token AND unexpired. CCFE ⇒ {lost:true} ⇒ caller must abort the run.
// NO lease renewal/heartbeat exists — deliberately (plan-review): the lease is max(2×timeout,300s)=300s,
// strictly greater than the 120s max invocation, so a live run can never outlast its own lease.
// If the Lambda timeout is ever raised, this arithmetic MUST be revisited.
export async function writeStateFenced(mailbox: string, token: string, nowMs: number, fields: Partial<GmailSyncState>): Promise<{ lost: boolean }> {
  const names: Record<string, string> = {}; const values: Record<string, unknown> = { ':tok': token, ':now': nowMs };
  const sets = Object.entries(fields).map(([k, v], i) => { names[`#f${i}`] = k; values[`:f${i}`] = v ?? null; return `#f${i} = :f${i}`; });
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mailbox),
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: 'lease = :tok AND leaseExpiresAt > :now',
      ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}

// Release ALSO requires an unexpired lease (R6/blocker-3); expired cleanup belongs to the next acquire.
export async function releaseLease(mailbox: string, token: string, nowMs: number, fields: Partial<GmailSyncState>): Promise<{ lost: boolean }> {
  const names: Record<string, string> = {}; const values: Record<string, unknown> = { ':tok': token, ':now': nowMs };
  const sets = Object.entries({ ...fields, lastRunAt: nowMs }).map(([k, v], i) => { names[`#f${i}`] = k; values[`:f${i}`] = v ?? null; return `#f${i} = :f${i}`; });
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mailbox),
      UpdateExpression: `SET ${sets.join(', ')} REMOVE lease, leaseExpiresAt`,
      ConditionExpression: 'lease = :tok AND leaseExpiresAt > :now',
      ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    }));
    return { lost: false };
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return { lost: true };
    throw err;
  }
}
```

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/lib/dynamodb.ts amplify/functions/gmail-sync/lib/gmailSyncState.ts amplify/functions/gmail-sync/lib/gmailSyncState.test.ts
git commit -m "feat(comms-p2): fenced gmailSyncState (lease ops, BigInt historyId, unexpired release)"
```

---

### Task 2: Google auth + Gmail REST client (endpoint-aware errors, backoff)

**Files:**
- Create: `amplify/functions/gmail-sync/lib/gmailClient.ts`
- Test: `amplify/functions/gmail-sync/lib/gmailClient.test.ts`

- [ ] **Step 1: Failing test** (mock `google-auth-library`'s JWT + global `fetch` + the secrets client):
```ts
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
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `gmailClient.ts`:
```ts
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
```
Add `google-auth-library` to `package.json` dependencies (`npm install google-auth-library` — regenerate the lockfile with `npm install --package-lock-only` afterwards; NO other dep changes).

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/lib/gmailClient.ts amplify/functions/gmail-sync/lib/gmailClient.test.ts package.json package-lock.json
git commit -m "feat(comms-p2): DWD Gmail REST client (metadata-only, endpoint-aware errors, backoff)"
```

---

### Task 3: Message mapping (direction, allowlist, skips, identity, payload)

**Files:**
- Create: `amplify/functions/gmail-sync/lib/mapMessage.ts`
- Test: `amplify/functions/gmail-sync/lib/mapMessage.test.ts`

- [ ] **Step 1: Failing tests:**
```ts
import { describe, it, expect } from 'vitest';
import { mapMessage } from './mapMessage';

const msg = (over: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({
  id: 'g1', threadId: 'th1', internalDate: '1783600000000', snippet: 'snip', labelIds: ['INBOX'],
  payload: { headers: Object.entries({ From: 'Bob <Bob@Ext.com>', To: 'sales@ninescrolls.com', Subject: 'Hi', 'Message-ID': '<M1@ext.com>', ...headers }).map(([name, value]) => ({ name, value })) },
  ...over,
});

describe('mapMessage', () => {
  it('inbound: customer = From (normalized); alias allowlist keeps sales@; emits full payload', () => {
    const r = mapMessage(msg(), 'info@ninescrolls.com');
    expect(r.kind).toBe('emit');
    if (r.kind !== 'emit') return;
    expect(r.emit.direction).toBe('inbound');
    expect(r.emit.payload.customerEmail).toBe('bob@ext.com');
    expect(r.emit.occurredAt).toBe(new Date(1783600000000).toISOString());   // internalDate, NOT the Date header
    expect(r.emit.idInput).toEqual({ source: 'gmail', rfc822MessageId: '<M1@ext.com>' });
    expect(r.emit.externalId).toBe('m1@ext.com');
    expect(r.emit.resolveInput).toMatchObject({ channel: 'gmail', email: 'bob@ext.com', sourceEntityType: 'gmail', sourceEntityId: 'm1@ext.com' });
    expect(r.emit.payload.gmailLink).toBe(`https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent('m1@ext.com')}`);
  });
  it('outbound: From is ours → customer = first external in To/Cc (Bcc for bcc-only)', () => {
    const r = mapMessage(msg({}, { From: 'info@ninescrolls.com', To: 'cust@acme.com' }), 'info@ninescrolls.com');
    if (r.kind !== 'emit') throw new Error('expected emit');
    expect(r.emit.direction).toBe('outbound');
    expect(r.emit.payload.customerEmail).toBe('cust@acme.com');
    const bccOnly = mapMessage(msg({}, { From: 'info@ninescrolls.com', To: 'info@ninescrolls.com', Bcc: 'hidden@ext.com' }), 'info@ninescrolls.com');
    if (bccOnly.kind !== 'emit') throw new Error('expected emit');
    expect(bccOnly.emit.payload.customerEmail).toBe('hidden@ext.com');
  });
  it('skips: all-internal; DRAFT/CHAT labels; non-customer alias (ap@); ZERO visible our-aliases (bcc-delivery); each with a reason', () => {
    expect(mapMessage(msg({}, { From: 'a@ninescrolls.com', To: 'b@ninescrolls.com' }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'all_internal' });
    expect(mapMessage(msg({ labelIds: ['DRAFT'] }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'draft_or_chat' });
    expect(mapMessage(msg({}, { To: 'ap@ninescrolls.com' }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'non_customer_alias' });
    expect(mapMessage(msg({}, { From: 'a@ext.com', To: 'b@ext.com' }), 'info@ninescrolls.com')).toEqual({ kind: 'skip', reason: 'non_customer_alias' }); // reached us invisibly → unverifiable → skip
  });
  it('keep-if-ANY-recipient-is-customer-alias', () => {
    const r = mapMessage(msg({}, { To: 'ap@ninescrolls.com', Cc: 'sales@ninescrolls.com' }), 'info@ninescrolls.com');
    expect(r.kind).toBe('emit');
  });
  it('missing Message-ID → mailbox-namespaced fallback identity + THREAD link; both absent → externalUrl null', () => {
    const r = mapMessage(msg({}, { 'Message-ID': '' }), 'info@ninescrolls.com');
    if (r.kind !== 'emit') throw new Error('expected emit');
    expect(r.emit.idInput).toEqual({ source: 'gmail', mailbox: 'info@ninescrolls.com', gmailMessageId: 'g1' });
    expect(r.emit.externalId).toBe('info@ninescrolls.com:g1');
    expect(r.emit.payload.gmailLink).toBe('https://mail.google.com/mail/u/0/#all/th1');
    const noThread = mapMessage(msg({ threadId: undefined }, { 'Message-ID': '' }), 'info@ninescrolls.com');
    if (noThread.kind !== 'emit') throw new Error('expected emit');
    expect(noThread.emit.payload.gmailLink).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `mapMessage.ts` (pure — no I/O):
```ts
// Pure message→emit mapper (spec §5). All decisions here so the engine stays orchestration-only.
const OUR_DOMAIN = '@ninescrolls.com';
export const CUSTOMER_ALIASES = new Set(['info', 'sales', 'support']);   // spec §5 allowlist (config)

export type MapResult =
  | { kind: 'emit'; emit: GmailEmit }
  | { kind: 'skip'; reason: 'all_internal' | 'draft_or_chat' | 'non_customer_alias' | 'no_customer' };

export interface GmailEmit {
  idInput: { source: 'gmail'; rfc822MessageId: string } | { source: 'gmail'; mailbox: string; gmailMessageId: string };
  direction: 'inbound' | 'outbound';
  occurredAt: string; externalId: string; threadId: string | null;
  from: string; to: string; subject: string; bodySnippet: string;
  resolveInput: { sourceEntityType: 'gmail'; sourceEntityId: string; channel: 'gmail'; email: string };
  payload: { customerEmail: string; gmailLink: string | null; mailbox: string; cc?: string };
}

const header = (m: GmailMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
const addresses = (raw: string) => (raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) ?? []).map((a) => a.toLowerCase());
const isOurs = (a: string) => a.endsWith(OUR_DOMAIN);
const normalizeMsgId = (raw: string) => { const t = raw.trim(); return (t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t).toLowerCase(); };

export interface GmailMessage {
  id: string; threadId?: string; internalDate?: string; snippet?: string; labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

export function mapMessage(m: GmailMessage, mailbox: string): MapResult {
  if (m.labelIds?.some((l) => l === 'DRAFT' || l === 'CHAT')) return { kind: 'skip', reason: 'draft_or_chat' };

  const from = addresses(header(m, 'From'));
  const toCc = [...addresses(header(m, 'To')), ...addresses(header(m, 'Cc'))];
  const bcc = addresses(header(m, 'Bcc'));
  const all = [...from, ...toCc, ...bcc];
  if (all.length > 0 && all.every(isOurs)) return { kind: 'skip', reason: 'all_internal' };

  // Alias allowlist (plan-review fix): the mail MUST visibly touch an approved customer alias.
  // Zero of-our-addresses in the headers (e.g. reached us only via Bcc/Delivered-To) is unverifiable
  // → skip, same reason. Never ingest on absence of evidence.
  const ourAddresses = all.filter(isOurs);
  const touchesCustomerAlias = ourAddresses.some((a) => CUSTOMER_ALIASES.has(a.split('@')[0]));
  if (!touchesCustomerAlias) return { kind: 'skip', reason: 'non_customer_alias' };

  const inbound = from.length > 0 && !isOurs(from[0]);
  const customer = inbound ? from[0]
    : (toCc.find((a) => !isOurs(a)) ?? bcc.find((a) => !isOurs(a)));
  if (!customer) return { kind: 'skip', reason: 'no_customer' };

  const rawMsgId = header(m, 'Message-ID').trim();
  const hasMsgId = rawMsgId.length > 0;
  const normId = hasMsgId ? normalizeMsgId(rawMsgId) : `${mailbox}:${m.id}`;
  const gmailLink = hasMsgId
    ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(normId)}`
    : (m.threadId ? `https://mail.google.com/mail/u/0/#all/${m.threadId}` : null);

  return { kind: 'emit', emit: {
    idInput: hasMsgId ? { source: 'gmail', rfc822MessageId: rawMsgId } : { source: 'gmail', mailbox, gmailMessageId: m.id },
    direction: inbound ? 'inbound' : 'outbound',
    occurredAt: new Date(Number(m.internalDate ?? Date.now())).toISOString(),   // internalDate canonical (R2)
    externalId: normId, threadId: m.threadId ?? null,
    from: header(m, 'From'), to: header(m, 'To'), subject: header(m, 'Subject'), bodySnippet: m.snippet ?? '',
    resolveInput: { sourceEntityType: 'gmail', sourceEntityId: normId, channel: 'gmail', email: customer },
    payload: { customerEmail: customer, gmailLink, mailbox, ...(header(m, 'Cc') ? { cc: header(m, 'Cc') } : {}) },
  }};
}
```
*(Note: `new Date(Number(internalDate ?? Date.now()))` — the fallback exists only for malformed test fixtures; production messages always carry `internalDate`.)*

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/lib/mapMessage.ts amplify/functions/gmail-sync/lib/mapMessage.test.ts
git commit -m "feat(comms-p2): pure gmail message mapper (direction/allowlist/identity/link fallbacks)"
```

---

### Task 4: Sync emitter — synchronous projection + outcome enum

**Files:**
- Create: `amplify/functions/gmail-sync/lib/emitMessage.ts`
- Test: `amplify/functions/gmail-sync/lib/emitMessage.test.ts`

- [ ] **Step 1: Failing tests:**
```ts
const invokeCrmApi = vi.fn();
vi.mock('../../../lib/crm/invoke-crm-api', () => ({ invokeCrmApi: (...a: unknown[]) => invokeCrmApi(...a) }));
import { projectMessage } from './emitMessage';

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
```
(Read `amplify/lib/crm/invoke-crm-api.ts` first for the exact export + sync-option shape and mirror it; the test above adjusts to the real signature.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `emitMessage.ts`:
```ts
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
    }}, { sync: true });
    return { outcome: 'persisted' };
  } catch (err) {
    return { outcome: 'retryable_failure', error: err instanceof Error ? err.message : String(err) };
  }
}
```
(Adjust the `invokeCrmApi` call shape to the real export read in Step 1 — the plan's shape follows the P2A contract.)

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/lib/emitMessage.ts amplify/functions/gmail-sync/lib/emitMessage.test.ts
git commit -m "feat(comms-p2): synchronous confirmed projection with outcome enum"
```

---

### Task 5: Incremental engine — record-boundary checkpoints

**Files:**
- Create: `amplify/functions/gmail-sync/lib/incrementalSync.ts`
- Test: `amplify/functions/gmail-sync/lib/incrementalSync.test.ts`

- [ ] **Step 1: Failing tests** (mock gmailClient/mapMessage-free — feed synthetic history pages; mock `projectMessage` + `writeStateFenced`):
```ts
it('advances across the contiguous prefix of fully-done records; stops at the first record with a retryable_failure', async () => {
  historyPages([{ id: '100', messages: ['a'] }, { id: '110', messages: ['b', 'c'] }, { id: '120', messages: ['d'] }]);
  outcomes({ a: 'persisted', b: 'persisted', c: 'retryable_failure', d: 'persisted' });
  const s = await runIncremental(ctx);
  expect(s.checkpoint).toBe('100');        // record 110 not fully done → stop BEFORE it (sibling c not skipped)
  expect(s.counters.persisted).toBe(3);    // d still processed (work continues; checkpoint just doesn't pass 110)
});
it('clean run commits the response-level top-level historyId', async () => {
  historyPages([{ id: '100', messages: ['a'] }], { responseHistoryId: '999' });
  outcomes({ a: 'persisted' });
  const s = await runIncremental(ctx);
  expect(s.checkpoint).toBe('999');
});
it('terminal_skip counts as done for its record (messages.get 404 → not blocked)', async () => {
  historyPages([{ id: '100', messages: ['a', 'b'] }]);
  outcomes({ a: 'terminal_skip', b: 'persisted' });
  const s = await runIncremental(ctx);
  expect(s.checkpoint).toBe('100');
});
it('history_expired classification returns needsReanchor (no checkpoint write)', async () => {
  historyThrows(new GmailApiError('historyList', 404, 'history_expired', {}));
  const s = await runIncremental(ctx);
  expect(s.needsReanchor).toBe(true);
});
it('a lost fenced write aborts the run immediately', async () => {
  historyPages([{ id: '100', messages: ['a'] }]);
  outcomes({ a: 'persisted' });
  stateWriteLost();
  const s = await runIncremental(ctx);
  expect(s.aborted).toBe(true);
});
```
(Build the small `historyPages`/`outcomes`/`ctx` harness in the test file — the engine takes injected `{ client, project, state }` dependencies so tests need no module mocks.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `incrementalSync.ts` (dependency-injected, orchestration-only):
```ts
import type { GmailClient } from './gmailClient';
import { GmailApiError } from './gmailClient';
import { mapMessage, type GmailMessage } from './mapMessage';
import type { ProjectOutcome } from './emitMessage';
import { isNewerHistoryId } from './gmailSyncState';

export interface IncrementalCtx {
  mailbox: string; startHistoryId: string;
  client: Pick<GmailClient, 'historyList' | 'messagesGetMetadata'>;
  project: (emit: ReturnType<typeof mapMessage>) => Promise<ProjectOutcome>;   // wraps projectMessage for 'emit' results
  persistCheckpoint: (historyId: string) => Promise<{ lost: boolean }>;        // fenced write via gmailSyncState
}

export interface IncrementalResult {
  checkpoint: string | null; needsReanchor?: boolean; aborted?: boolean;
  counters: Record<string, number>; hasMore: boolean;
}

// Spec §4: outcome per message; checkpoint at HISTORY-RECORD boundaries; clean run commits the
// response-level historyId; expiry only from the historyList endpoint classification.
export async function runIncremental(ctx: IncrementalCtx): Promise<IncrementalResult> {
  const counters = { records: 0, persisted: 0, terminal_skip: 0, retryable_failure: 0, skipped_filter: 0 };
  let checkpoint: string | null = null;       // highest fully-done contiguous record id
  let blocked = false;                        // a record with a retryable_failure was seen
  let pageToken: string | undefined; let responseHistoryId: string | null = null;
  try {
    do {
      const page = await ctx.client.historyList(ctx.startHistoryId, pageToken) as {
        history?: { id: string; messagesAdded?: { message: GmailMessage }[] }[];
        historyId?: string; nextPageToken?: string;
      };
      responseHistoryId = page.historyId ?? responseHistoryId;
      for (const record of page.history ?? []) {
        counters.records += 1;
        let recordDone = true;
        for (const added of record.messagesAdded ?? []) {
          const full = await ctx.client.messagesGetMetadata(added.message.id).catch((err) => {
            if (err instanceof GmailApiError && err.classification === 'not_found') return null;   // deleted → terminal_skip
            throw err;
          });
          if (full === null) { counters.terminal_skip += 1; continue; }
          const mapped = mapMessage(full as GmailMessage, ctx.mailbox);
          if (mapped.kind === 'skip') { counters.skipped_filter += 1; continue; }                  // filtered = done
          const out = await ctx.project(mapped);
          counters[out.outcome] += 1;
          if (out.outcome === 'retryable_failure') recordDone = false;
        }
        if (recordDone && !blocked && isNewerHistoryId(record.id, checkpoint)) {
          checkpoint = record.id;
          const w = await ctx.persistCheckpoint(checkpoint);
          if (w.lost) return { checkpoint, counters, hasMore: !!page.nextPageToken, aborted: true };
        } else if (!recordDone) blocked = true;   // later records still process, but checkpoint never passes this one
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    if (!blocked && responseHistoryId && isNewerHistoryId(responseHistoryId, checkpoint)) {
      checkpoint = responseHistoryId;             // clean run: commit the response-level final historyId
      const w = await ctx.persistCheckpoint(checkpoint);
      if (w.lost) return { checkpoint, counters, hasMore: false, aborted: true };
    }
    return { checkpoint, counters, hasMore: false };
  } catch (err) {
    if (err instanceof GmailApiError && err.classification === 'history_expired') {
      return { checkpoint, counters, hasMore: false, needsReanchor: true };
    }
    if (err instanceof GmailApiError && (err.classification === 'rate_limited' || err.classification === 'transient')) {
      return { checkpoint, counters, hasMore: true };  // resume next cron from the last checkpoint
    }
    throw err;                                          // bad_request etc: surface loudly (spec §4)
  }
}
```

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/lib/incrementalSync.ts amplify/functions/gmail-sync/lib/incrementalSync.test.ts
git commit -m "feat(comms-p2): incremental engine — record-boundary checkpoints, outcome enum, expiry signal"
```

---

### Task 6: Backfill state machine — anchor-first, page-complete cursor

**Files:**
- Create: `amplify/functions/gmail-sync/lib/backfill.ts`
- Test: `amplify/functions/gmail-sync/lib/backfill.test.ts`

- [ ] **Step 1: Failing tests:**
```ts
it('persists {phase:backfill, anchorHistoryId, pageToken:null, window} BEFORE the first page', async () => {
  profileHistoryId('500'); pages([['a'], ['b']]); outcomes({ a: 'persisted', b: 'persisted' });
  await runBackfill(ctx);
  expect(stateWrites()[0]).toMatchObject({ phase: 'backfill', anchorHistoryId: '500', pageToken: null });
});
it('pageToken advances ONLY after complete page success; a retryable_failure retains the input cursor', async () => {
  profileHistoryId('500'); pages([['a', 'b'], ['c']]); outcomes({ a: 'persisted', b: 'retryable_failure', c: 'persisted' });
  const s = await runBackfill(ctx);
  expect(s.completed).toBe(false);
  expect(stateWrites().some((w) => 'pageToken' in w && w.pageToken === 'pt-1')).toBe(false);  // never advanced past page 0
});
it('resume uses the STORED anchor + pageToken (never re-captures)', async () => {
  existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: 'pt-1', window: 'newer_than:90d' });
  pages([['c']], { fromToken: 'pt-1' }); outcomes({ c: 'persisted' });
  await runBackfill(ctx);
  expect(profileCalls()).toBe(0);
});
it('completion: ONE fenced write sets {phase:incremental, historyId:anchor} and clears backfill fields', async () => {
  existingState({ phase: 'backfill', anchorHistoryId: '500', pageToken: null, window: 'newer_than:90d' });
  pages([['a']]); outcomes({ a: 'persisted' });
  const s = await runBackfill(ctx);
  expect(s.completed).toBe(true);
  expect(stateWrites().at(-1)).toMatchObject({ phase: 'incremental', historyId: '500', anchorHistoryId: null, pageToken: null });
});
```
(Same injected-dependency harness style as Task 5.)

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** `backfill.ts`:
```ts
import type { GmailClient } from './gmailClient';
import { GmailApiError } from './gmailClient';
import { mapMessage, type GmailMessage } from './mapMessage';
import type { ProjectOutcome } from './emitMessage';
import type { GmailSyncState } from './gmailSyncState';

export interface BackfillCtx {
  mailbox: string; windowDays: number;
  existing: GmailSyncState;                                     // strongly-read state at run start
  client: Pick<GmailClient, 'getProfile' | 'messagesList' | 'messagesGetMetadata'>;
  project: (mapped: ReturnType<typeof mapMessage>) => Promise<ProjectOutcome>;
  persist: (fields: Partial<GmailSyncState>) => Promise<{ lost: boolean }>;   // fenced
}

// Spec §7 (R4/R6): anchor captured + persisted BEFORE page 1; the pageToken advances only when
// EVERY message on the page is persisted/terminal_skip; completion is one fenced phase transition.
export async function runBackfill(ctx: BackfillCtx): Promise<{ completed: boolean; counters: Record<string, number>; aborted?: boolean }> {
  const counters = { persisted: 0, terminal_skip: 0, retryable_failure: 0, skipped_filter: 0, pages: 0 };
  let anchor = ctx.existing.anchorHistoryId ?? null;
  let pageToken = ctx.existing.pageToken ?? null;
  const window = ctx.existing.window ?? `newer_than:${ctx.windowDays}d`;

  if (!anchor) {                                                 // fresh backfill: capture-then-persist FIRST
    const profile = await ctx.client.getProfile() as { historyId?: string };
    anchor = String(profile.historyId);
    const w = await ctx.persist({ phase: 'backfill', anchorHistoryId: anchor, pageToken: null, window });
    if (w.lost) return { completed: false, counters, aborted: true };
  }

  for (;;) {
    counters.pages += 1;
    const page = await ctx.client.messagesList(window, pageToken ?? undefined) as
      { messages?: { id: string }[]; nextPageToken?: string };
    let pageClean = true;
    for (const ref of page.messages ?? []) {
      const full = await ctx.client.messagesGetMetadata(ref.id).catch((err) => {
        if (err instanceof GmailApiError && err.classification === 'not_found') return null;
        throw err;
      });
      if (full === null) { counters.terminal_skip += 1; continue; }
      const mapped = mapMessage(full as GmailMessage, ctx.mailbox);
      if (mapped.kind === 'skip') { counters.skipped_filter += 1; continue; }
      const out = await ctx.project(mapped);
      counters[out.outcome] += 1;
      if (out.outcome === 'retryable_failure') pageClean = false;
    }
    if (!pageClean) return { completed: false, counters };       // R7/blocker-1: retain the INPUT cursor; page retries next run
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
    const w = await ctx.persist({ pageToken });                   // advance only after complete page success
    if (w.lost) return { completed: false, counters, aborted: true };
  }
  const w = await ctx.persist({ phase: 'incremental', historyId: anchor, anchorHistoryId: null, pageToken: null, window: null });
  if (w.lost) return { completed: true, counters, aborted: true };
  return { completed: true, counters };
}
```

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/lib/backfill.ts amplify/functions/gmail-sync/lib/backfill.test.ts
git commit -m "feat(comms-p2): backfill state machine — anchor-first, page-complete cursor, fenced completion"
```

---

### Task 7: gmail-sync handler + resource (the run orchestrator)

**Files:**
- Create: `amplify/functions/gmail-sync/handler.ts`, `amplify/functions/gmail-sync/resource.ts`
- Test: `amplify/functions/gmail-sync/handler.test.ts`

- [ ] **Step 1: Failing tests** (mock all lib modules): lease-held → `{skippedLeaseHeld:true}` and NO Google calls; fresh mailbox (no state) → backfill path; `phase:'incremental'` → incremental path with the stored watermark; `needsReanchor` → clears to backfill mode via a fenced write and logs; run summary logged as `gmail.sync.summary`; release called with unexpired-lease semantics; a `lost` release logged, not thrown.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `resource.ts`:
```ts
import { defineFunction } from '@aws-amplify/backend';
export const gmailSync = defineFunction({
  name: 'gmail-sync',
  entry: './handler.ts',
  timeoutSeconds: 120,
  resourceGroupName: 'gmail-sync-stack',
});
```
`handler.ts` — per mailbox in `MAILBOXES` (env, default `info@ninescrolls.com`): `acquireLease` → `readState` → if `phase !== 'incremental'` run `runBackfill` else `runIncremental` (checkpoint persist = `writeStateFenced` guarded by `isNewerHistoryId`) → on `needsReanchor`, fenced-write `{phase:'backfill', anchorHistoryId:null, pageToken:null}` (next run re-seeds) → `releaseLease` with `lastSummary` → log `gmail.sync.summary`. Any `lost` result: log `gmail.sync.lease_lost` and stop immediately (invariant 2). Wrap the whole mailbox loop so one mailbox's failure doesn't skip others.

- [ ] **Step 4: Run** + tsc — PASS/clean.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/gmail-sync/handler.ts amplify/functions/gmail-sync/handler.test.ts amplify/functions/gmail-sync/resource.ts
git commit -m "feat(comms-p2): gmail-sync handler — lease-gated backfill/incremental orchestration"
```

---

### Task 8: Rendering — GraphQL fields, mapper, frontend row/chip/safe link

**Files:**
- Modify: `amplify/data/resource.ts` (`OrganizationTimelineItem` + `direction`/`bodySnippet`/`externalUrl`), `amplify/functions/crm-api/lib/read/organizationTimelineItem.ts`, the timeline components (`src/components/admin/timeline/*` — locate via `git grep -l "sourceFilterGroup" src/`), `src/...` chip config
- Test: `organizationTimelineItem.test.ts` (append) + the timeline component test

- [ ] **Step 1: Failing tests.** Mapper: a stored gmail event (`source:'gmail'`, `kind:'email'`, subject/snippet/direction/`payload.gmailLink`) maps to `primaryLabel` = subject (fallback `"(no subject)"`), `bodySnippet`, `direction`, `externalUrl` = the payload link, `sourceFilterGroup:'email'`, direction icon (`mail`/`send`). Frontend: email row renders subject+snippet+icon; the external link has `target="_blank"`, `rel="noopener noreferrer"`, and renders ONLY when `externalUrl` origin is exactly `https://mail.google.com`; the Email chip filters rows.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** Schema: add the three nullable `a.string()` fields to `OrganizationTimelineItem`. Mapper: extend the `StoredTimelineEvent` input interface with the comms fields (they exist on `TimelineEventItem`); add `gmail: 'email'` to `GROUP_BY_SOURCE`, direction-based icon; populate the three outputs (null for every other source). Frontend: regenerated types flow through; the row component renders the new fields; `buildSourceLink` gains `gmail → item.externalUrl` with the origin check:
```ts
const safeGmailUrl = (u: string | null | undefined) => {
  try { return u && new URL(u).origin === 'https://mail.google.com' ? u : null; } catch { return null; }
};
```
Add the `email` chip to the chip config.

- [ ] **Step 4 (plan-review clarification — client types):** this repo has **no codegen step** — frontend client types derive from `ClientSchema<typeof schema>` in `amplify/data/resource.ts` and flow through TypeScript directly. "Regenerating types" = re-running `npx tsc --noEmit` after the schema edit; do that here explicitly and confirm the new `direction`/`bodySnippet`/`externalUrl` fields appear on the frontend `Schema` types (a frontend type-usage in the row component compiling IS the check). Do not hunt for an `ampx generate` step — none is required or configured for client types.
- [ ] **Step 5: Run** mapper + frontend timeline tests + both tscs (backend first, unchained — see Part 1 Task 15's command form) + eslint — PASS/clean.
- [ ] **Step 6: Commit**
```bash
git add amplify/data/resource.ts amplify/functions/crm-api/lib/read/organizationTimelineItem.ts amplify/functions/crm-api/lib/read/organizationTimelineItem.test.ts src/
git commit -m "feat(comms-p2): email rendering — schema fields, mapper case, chip, origin-validated link"
```

---

### Task 9: Infra wiring — secret, IAM (LeadingKeys), cron, env + synth verification

**Files:**
- Modify: `amplify/backend.ts`
- Create: `docs/runbooks/2026-07-09-gmail-sync-setup.md`

- [ ] **Step 1: Wire in `backend.ts`** (mirroring the existing channel-Lambda + cron patterns):
```ts
// gmail-sync (P2 comms): Google adapter + its ONE state item. Spec §10.
// plan-review R3 — GMAIL_SA_SECRET_ARN supply & validation, per environment:
//   prod (Amplify Console build): set as an Amplify Console environment variable (runbook step) —
//     available to backend.ts at synth via process.env.
//   sandbox (`ampx sandbox`): developer shell env var; UNSET by default ⇒ the whole gmail-sync
//     wiring below is SKIPPED (secret grant, cron, env) — the function deploys inert. This keeps
//     every developer sandbox synthesizable with zero Google setup.
//   validation: if SET but malformed, FAIL SYNTH LOUDLY (a typo'd ARN must not deploy a broken grant).
const GMAIL_SA_SECRET_ARN = process.env.GMAIL_SA_SECRET_ARN ?? '';
const SECRET_ARN_RE = /^arn:aws:secretsmanager:[a-z0-9-]+:\d{12}:secret:[A-Za-z0-9/_+=.@-]+-[A-Za-z0-9]{6}$/;  // COMPLETE arn incl. the 6-char suffix
if (GMAIL_SA_SECRET_ARN && !SECRET_ARN_RE.test(GMAIL_SA_SECRET_ARN)) {
  throw new Error(`GMAIL_SA_SECRET_ARN is set but not a complete Secrets Manager ARN (must include the 6-char suffix): ${GMAIL_SA_SECRET_ARN}`);
}
const gmailSyncEnabled = GMAIL_SA_SECRET_ARN !== '';

backend.gmailSync.addEnvironment('GMAIL_SA_SECRET_ARN', GMAIL_SA_SECRET_ARN);       // empty in a bare sandbox — the handler validates at runtime and reports 'not_configured' in its summary instead of crash-looping
backend.gmailSync.addEnvironment('MAILBOXES', 'info@ninescrolls.com');
backend.gmailSync.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
// plan-review R2/R3 — EXACT Secrets Manager pattern: CDK import + grantRead.
// grantRead on an ARN-IMPORTED secret grants secretsmanager:GetSecretValue + DescribeSecret ONLY —
// it can NOT add kms:Decrypt automatically (the imported ref has no key association). The secret is
// created with the default aws/secretsmanager key, which needs no extra grant; if it is EVER moved
// to a customer-managed KMS key, an explicit kms:Decrypt PolicyStatement on that key MUST be added
// here (runbook carries the same warning). Spec §10 amended to this exact permission set.
// Import into the gmail-sync stack (Stack.of the lambda) so no cross-stack edge is created.
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';                             // (top of file)
const gmailSyncStack = Stack.of(backend.gmailSync.resources.lambda);                 // hoisted — also used by the cron below
if (gmailSyncEnabled) {
  const gmailSaSecret = Secret.fromSecretCompleteArn(gmailSyncStack, 'GmailSaSecret', GMAIL_SA_SECRET_ARN);
  gmailSaSecret.grantRead(backend.gmailSync.resources.lambda);
}
backend.gmailSync.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
  resources: [intelligenceTable.tableArn],                                           // base table only, no /index/*
  conditions: { 'ForAllValues:StringLike': { 'dynamodb:LeadingKeys': ['GMAIL_SYNC#*'] } },
}));
// invoke crm-api (the submit-rfq/lead pattern)
backend.gmailSync.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW, actions: ['lambda:InvokeFunction'], resources: [backend.crmApi.resources.lambda.functionArn],
}));
backend.gmailSync.addEnvironment('CRM_API_FUNCTION_NAME', backend.crmApi.resources.lambda.functionName);
if (!isSandbox && gmailSyncEnabled) {   // an unconfigured function must not be cron-invoked
  // gmailSyncStack hoisted above (shared with the secret import)
  new Rule(gmailSyncStack, 'GmailSyncRule', {
    schedule: Schedule.cron({ minute: '*/10', hour: '*', day: '*', month: '*', year: '*' }),
    targets: [new LambdaFunctionTarget(backend.gmailSync.resources.lambda, {
      event: RuleTargetInput.fromObject({ action: 'sync' }),
    })],
  });
}
```
Also: register `gmailSync` in `defineBackend`, import its resource, add `reservedConcurrentExecutions: 1` (via `(backend.gmailSync.resources.cfnResources.cfnFunction).reservedConcurrentExecutions = 1` or the defineFunction option if available — check the existing repo idiom first).

- [ ] **Step 2: Verification (spec §10 — plan-review fix, repository-valid + executable):** local synth doesn't exist in this repo (the Amplify Console build is the binding synth gate — established project history). So verification is three concrete layers:
  1. **Pre-merge executable assertion** — create `amplify/backend.gmailSync.test.ts`, a source-contract test run by vitest:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./backend.ts', import.meta.url), 'utf8');
describe('gmail-sync IAM source contract', () => {
  it('carries the LeadingKeys condition exactly', () =>
    expect(src).toMatch(/ForAllValues:StringLike[\s\S]{0,120}dynamodb:LeadingKeys[\s\S]{0,80}GMAIL_SYNC#\*/));
  it('grants the base table ARN only (no /index/*) for gmail-sync dynamo access', () =>
    expect(src).not.toMatch(/gmailSync[\s\S]{0,400}index\/\*/));
  it('cron rule lives in the gmail-sync stack, gated on sandbox AND secret configuration', () => {
    expect(src).toMatch(/if \(!isSandbox && gmailSyncEnabled\)[\s\S]{0,600}GmailSyncRule/);
    expect(src).toMatch(/Stack\.of\(backend\.gmailSync\.resources\.lambda\)/);
  });
  it('validates GMAIL_SA_SECRET_ARN format at synth and gates the secret grant on it', () => {
    expect(src).toMatch(/SECRET_ARN_RE/);
    expect(src).toMatch(/if \(gmailSyncEnabled\)[\s\S]{0,300}fromSecretCompleteArn/);
  });
});
```
  2. **Reproducible pre-merge synth+deploy gate (plan-review R3 — honest description):** this is a REAL deployment to a sandbox stack in the dev AWS account, not local-only synthesis — CDK synth runs locally first (structural failures, including the nested-stack-cycle class that broke deploys twice before, fail before anything deploys), and then real resources are created:
```bash
npx ampx sandbox --identifier commsp2gate --once
```
  - Unique identifier `commsp2gate` keeps this gate's stack separate from any developer's default sandbox.
  - No crons fire (`isSandbox`-gated) and gmail-sync deploys inert when `GMAIL_SA_SECRET_ARN` is unset.
  - Requires live AWS creds — if SSO is expired, ask the user to re-auth rather than skipping.
  - **Cleanup policy:** after the gate passes (or on abandoning the branch), delete the stack:
```bash
npx ampx sandbox delete --identifier commsp2gate
```
  The Amplify Console build remains the final binding gate on merge; this step just makes synth failures visible pre-merge.
  3. **Post-deploy IAM assertion** (runbook, exact commands):
```bash
ROLE=$(aws lambda get-function-configuration --function-name <gmail-sync fn name> --query 'Role' --output text | awk -F/ '{print $NF}')
for P in $(aws iam list-role-policies --role-name "$ROLE" --query 'PolicyNames[]' --output text); do
  aws iam get-role-policy --role-name "$ROLE" --policy-name "$P" --query 'PolicyDocument' | grep -q 'GMAIL_SYNC#\*' && echo "LeadingKeys condition present in $P"
done
```

- [ ] **Step 3: Runbook** — write `docs/runbooks/2026-07-09-gmail-sync-setup.md`: dedicated GCP project + SA creation; enable DWD; Admin-console scope authorization for the SA client-id (`gmail.readonly`); create the Secrets Manager secret with the **default `aws/secretsmanager` key** (record the COMPLETE ARN incl. 6-char suffix → `GMAIL_SA_SECRET_ARN`; **set it as an Amplify Console environment variable for the prod branch** — that is how backend.ts receives it at build; sandbox devs export it in-shell only when testing gmail-sync; ⚠️ if the secret is ever moved to a customer-managed KMS key, an explicit `kms:Decrypt` grant must be added in backend.ts — grantRead cannot do it for an ARN-imported secret); CloudTrail alarm on `GetSecretValue`; key-rotation cadence; §0 precondition re-check; watermark/backfill-state reset procedure (delete the `GMAIL_SYNC#<mailbox>` item → next run re-seeds); poison-mailbox alarm response; backfill window `N` default 90.
  **Handler runtime guard (same commit, `amplify/functions/gmail-sync/handler.ts`):** if `process.env.GMAIL_SA_SECRET_ARN` is empty, return `{ status: 'not_configured' }` in the run summary immediately — never throw/crash-loop on an inert deployment; add a handler test for it.

- [ ] **Step 4:** tsc clean; run the new source-contract test (`npx vitest run amplify/backend.gmailSync.test.ts` — PASS); commit **including the test file** (plan-review R2: it must be staged, not just written):
```bash
git add amplify/backend.ts amplify/backend.gmailSync.test.ts docs/runbooks/2026-07-09-gmail-sync-setup.md
git commit -m "feat(comms-p2): gmail-sync infra — secret grant, LeadingKeys IAM, cron, env, runbook + source-contract test"
```

---

### Task 10: Cross-part integration chain test (executable — plan-review fix)

**Files:**
- Create: `amplify/functions/crm-api/lib/link/gmailLinkChain.integration.test.ts`

**Honest scope (plan-review R2):** this is an INTEGRATION test over the real code chain with an in-memory table fake — it is NOT DynamoDB E2E coverage. What the fake cannot prove (real ConditionExpression grammar acceptance, transact semantics, IAM): covered by (a) the fake evaluating the exact condition forms this plan uses (shared harness from Part 1 Task 14), and (b) the post-deploy runbook verification (first real sync + timeline spot-check). Say exactly this in the test file's header comment.

- [ ] **Step 1: Write the executable chain test** — the chain starts at a RAW Gmail API message and crosses the real gmail-sync boundary (plan-review R2: mapper/projector included, not just crm-api internals): `mapMessage` (real, Task 3) → `projectMessage` (real, Task 4) with its `invokeCrmApi` transport mocked to call the REAL crm-api `emitTimelineEvent` against the in-memory table → `needsLinkingQueue` → `linkStructuredUnit` → Contact → second message auto-resolving:
```ts
// RAW Gmail metadata message → REAL mapMessage → REAL projectMessage (transport mocked to the
// REAL emitTimelineEvent) → needsLinkingQueue → linkStructuredUnit → Contact →
// a SECOND message auto-resolving via contact_email_exact.
it('gmail chain: raw message → mapped → emitted unresolved → queue unit → link → Contact → exact resolution', async () => {
  // 0. the real mapper+projector run on a raw metadata-format message fixture
  const mapped = mapMessage(rawGmailMetadataMessage('m1', { from: 'Bob <bob@gmail.com>', to: 'info@ninescrolls.com' }), 'info@ninescrolls.com');
  expect(mapped.kind).toBe('ingest');                       // not skipped by the alias/label rules
  await projectMessage(mapped, invokeCrmApiToRealEmit);     // transport mock → REAL emitTimelineEvent
  // 1. the emitted gmail event resolved to the collapse partition (free-mail → unresolved-gmail-<email>)
  expect(table.get('TLEVENT#' + idOf('m1')).orgId).toBe('unresolved-gmail-bob@gmail.com');
  // 2. queue collapses to ONE unit with a representativeEventId
  const q = await needsLinkingQueue({});
  const unit = q.items.find((i) => i.unitKey === 'unresolved-gmail-bob@gmail.com')!;
  expect(unit.representativeEventId).toBeDefined();
  expect(unit.signal.email).toBe('bob@gmail.com');
  // 3. link by representative → event moves + Contact created with the link generation
  const res = await linkStructuredUnit({ representativeEventId: unit.representativeEventId, targetOrgId: 'acme.com', operator: 'admin@ninescrolls.com' });
  expect(res.moved).toBe(1);
  expect(table.get('TLEVENT#' + idOf('m1')).orgId).toBe('acme.com');
  const contact = table.byGsi4('EMAIL#bob@gmail.com');
  expect(contact.orgId).toBe('acme.com');
  expect(contact.lastLinkGeneration).toMatch(/^E\d{8}#[0-9A-HJKMNP-TV-Z]{26}$/);   // R10 composite stamp
  // 4. a SUBSEQUENT raw message from the same address flows mapper→projector→emit and auto-resolves
  const mapped2 = mapMessage(rawGmailMetadataMessage('m2', { from: 'Bob <bob@gmail.com>', to: 'sales@ninescrolls.com' }), 'info@ninescrolls.com');
  await projectMessage(mapped2, invokeCrmApiToRealEmit);
  const ev2 = table.get('TLEVENT#' + idOf('m2'));
  expect(ev2.orgId).toBe('acme.com');
  expect(ev2.resolutionReason).toBe('contact_email_exact');
});
```
Harness: **reuse Part 1 Task 14's `linkTestHarness.ts`** (the stateful in-memory table with ConditionExpression evaluation) rather than a second local fake — extend it with the GSI4 email lookup if Task 14 didn't need it. `invokeCrmApiToRealEmit` is a ~10-line adapter: it takes the projector's crm-api payload and calls the real `emitTimelineEvent(payload)` directly (bypassing Lambda transport only). `orgExists` mocked true; rollup/audit fns pass through. Fixture `rawGmailMetadataMessage` returns a realistic `format=metadata` API shape (id, threadId, labelIds, `payload.headers` array) — copy a real (redacted) response shape from the Gmail API docs.

- [ ] **Step 2: Run** `npx vitest run amplify/functions/crm-api/lib/link/gmailLinkChain.integration.test.ts` — PASS.
- [ ] **Step 3: Commit**
```bash
git add amplify/functions/crm-api/lib/link/gmailLinkChain.integration.test.ts amplify/functions/crm-api/lib/link/linkTestHarness.ts
git commit -m "test(comms-p2): executable integration chain — raw message → map → project → emit → link → Contact → exact resolution"
```

---

### Task 11: Part-2 green-bar + adversarial checkpoint

- [ ] **Step 1:** `npx vitest run amplify/functions/gmail-sync amplify/functions/crm-api` — ALL pass.
- [ ] **Step 2:** frontend timeline + needslinking tests — pass.
- [ ] **Step 3 (no pipes that eat compiler status — same form as Part 1 Task 15):**
```bash
npx tsc --noEmit -p amplify/tsconfig.json
```
Expected: no output, exit 0.
```bash
npx tsc --noEmit > .tsc-app.out 2>&1; echo "tsc exit: $?"; grep -v "main.tsx" .tsc-app.out | grep "error TS"; echo "new-error grep exit: $? (1 = PASS: no new errors)"; rm .tsc-app.out
```
`tsc exit` is expected nonzero (pre-existing `main.tsx` error); the gate is `new-error grep exit: 1` (no `error TS` lines outside `main.tsx`; `0` = new errors printed above — fix them).
eslint clean on all touched files.
- [ ] **Step 4:** Re-verify the 10 header invariants against the full Part-2 diff.
- [ ] **Step 5:** Commit fixups scoped to touched files; report counts + invariant confirmation. Post-merge activation (PR body): runbook execution → first `gmail.sync.summary` (backfill) → spot-check an org timeline shows email rows → verify a Sent item produced outbound (spec R1/M4 spike note).
