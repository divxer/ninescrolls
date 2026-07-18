# RFQ Secure Drafts P3 — Public Draft API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the P2 draft store over HTTP as a dedicated public `rfq-draft-api` Lambda — `POST /api/rfq/draft` (create), `GET`/`PATCH /api/rfq/draft/{rfqId}` — with credential-header auth, a Secrets-Manager-backed versioned pepper, non-disclosing error responses, credential-safe caching/CORS headers, and per-route throttling.

**Architecture:** A new Lambda `amplify/functions/rfq-draft-api/` owns the HTTP boundary; all persistence stays in P2's `draftStore`. Two unit-testable modules — `pepperProvider.ts` (parse the versioned secret JSON into a live pepper + a verification resolver) and `handler.ts` (route, parse credential headers, map `draftStore` results to HTTP) — plus deploy-time wiring in `resource.ts` and `backend.ts`. The pepper never leaves the Lambda; credentials never appear in logs, responses (beyond the create payload the client needs), URLs, or CORS-exposed headers. The submit key (`X-RFQ-Submit-Key`) and draft→pending upgrade are **P4**, not here.

**Tech Stack:** TypeScript, `@aws-sdk/lib-dynamodb`, AWS Amplify Gen 2 (`defineFunction`/`secret`), API Gateway REST (`LambdaIntegration`), Vitest.

---

## File Structure

- Create `amplify/functions/rfq-draft-api/pepperProvider.ts` — parse `RFQ_DRAFT_PEPPER` secret JSON `{ "current": n, "keys": { "1": "<hex>", ... } }` into `{ pepper, keyVersion, resolvePepper }`.
- Create `amplify/functions/rfq-draft-api/pepperProvider.test.ts`.
- Create `amplify/functions/rfq-draft-api/handler.ts` — HTTP routing + credential parsing + response mapping over `draftStore`.
- Create `amplify/functions/rfq-draft-api/handler.test.ts` — handler tests against `fakeDdb` + a fixed test pepper.
- Create `amplify/functions/rfq-draft-api/resource.ts` — `defineFunction` with `RFQ_DRAFT_PEPPER = secret('RFQ_DRAFT_PEPPER')`.
- Modify `amplify/backend.ts` — register the Lambda, add the `/api/rfq/draft` + `/api/rfq/draft/{rfqId}` routes, grant the intelligence table, set `INTELLIGENCE_TABLE`, add throttling.

`pepperProvider` and `handler` are unit-tested. `resource.ts` + `backend.ts` are **deploy-verified** (typecheck in CI, then a post-deploy smoke test) — they cannot be exercised by unit tests.

**Test command for the plan's testable core:** `npx vitest run amplify/functions/rfq-draft-api --exclude '**/.claude/**'`

---

### Task 1: Pepper provider

Parse the versioned secret into the live signing pepper and a verification resolver that
also reads retired keys (rotation overlap). Reject a malformed or empty secret loudly at
cold start rather than silently signing with a bad key.

**Files:**
- Create: `amplify/functions/rfq-draft-api/pepperProvider.ts`
- Test: `amplify/functions/rfq-draft-api/pepperProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/functions/rfq-draft-api/pepperProvider.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { parsePepperSecret } from './pepperProvider';

const k1 = crypto.randomBytes(32).toString('hex');
const k2 = crypto.randomBytes(32).toString('hex');
const secret = JSON.stringify({ current: 2, keys: { 1: k1, 2: k2 } });

describe('parsePepperSecret', () => {
  it('exposes the current signing pepper + version and resolves all versions', () => {
    const p = parsePepperSecret(secret);
    expect(p.keyVersion).toBe(2);
    expect(p.pepper.equals(Buffer.from(k2, 'hex'))).toBe(true);
    expect(p.resolvePepper(1)!.equals(Buffer.from(k1, 'hex'))).toBe(true);
    expect(p.resolvePepper(2)!.equals(Buffer.from(k2, 'hex'))).toBe(true);
    expect(p.resolvePepper(9)).toBeUndefined();
  });

  it('throws on a missing current key, empty keys, or non-32-byte key', () => {
    expect(() => parsePepperSecret(JSON.stringify({ current: 3, keys: { 1: k1 } }))).toThrow();
    expect(() => parsePepperSecret(JSON.stringify({ current: 1, keys: {} }))).toThrow();
    expect(() => parsePepperSecret(JSON.stringify({ current: 1, keys: { 1: 'abcd' } }))).toThrow();
    expect(() => parsePepperSecret('not json')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/rfq-draft-api/pepperProvider.test.ts`
Expected: FAIL — `Failed to resolve import "./pepperProvider"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/functions/rfq-draft-api/pepperProvider.ts
export interface PepperSet {
  pepper: Buffer;
  keyVersion: number;
  resolvePepper: (keyVersion: number) => Buffer | undefined;
}

/** Parse `{ current: n, keys: { "n": "<64 hex>" } }` into a signing + verification set. */
export function parsePepperSecret(raw: string): PepperSet {
  const parsed = JSON.parse(raw) as { current?: number; keys?: Record<string, string> };
  const current = parsed.current;
  const keys = parsed.keys ?? {};
  const decoded = new Map<number, Buffer>();
  for (const [k, hex] of Object.entries(keys)) {
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`rfq-draft pepper: key ${k} is not 32 bytes hex`);
    decoded.set(Number(k), Buffer.from(hex, 'hex'));
  }
  if (typeof current !== 'number' || !decoded.has(current)) {
    throw new Error('rfq-draft pepper: current key version missing');
  }
  if (decoded.size === 0) throw new Error('rfq-draft pepper: no keys');
  return {
    pepper: decoded.get(current)!,
    keyVersion: current,
    resolvePepper: (v) => decoded.get(v),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/rfq-draft-api/pepperProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/rfq-draft-api/pepperProvider.ts amplify/functions/rfq-draft-api/pepperProvider.test.ts
git commit -m "feat(rfq-draft-api): versioned pepper provider"
```

---

### Task 2: Credential-header parsing + response helpers

Small pure helpers the handler composes: pull the credential headers case-insensitively,
and build the non-disclosing / credential-safe responses. Credential-bearing responses get
`Cache-Control: no-store` and `Referrer-Policy: no-referrer`; CORS never exposes credentials.

**Files:**
- Create: `amplify/functions/rfq-draft-api/handler.ts` (helpers + exports; routing added in Task 3)
- Test: `amplify/functions/rfq-draft-api/handler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// amplify/functions/rfq-draft-api/handler.test.ts
import { describe, it, expect } from 'vitest';
import { header, jsonResponse, DRAFT_UNAVAILABLE_RESPONSE } from './handler';

describe('header', () => {
  it('reads a header case-insensitively', () => {
    const h = { 'X-RFQ-Draft-Token': 'abc' };
    expect(header(h, 'x-rfq-draft-token')).toBe('abc');
    expect(header(h, 'X-RFQ-Draft-Token')).toBe('abc');
    expect(header({}, 'x-missing')).toBeUndefined();
  });
});

describe('responses', () => {
  it('credential-bearing responses set no-store + no-referrer', () => {
    const r = jsonResponse(201, { rfqId: 'x' }, 'https://ninescrolls.com', { credential: true });
    expect(r.statusCode).toBe(201);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.headers['Referrer-Policy']).toBe('no-referrer');
    expect(r.headers['Access-Control-Allow-Origin']).toBe('https://ninescrolls.com');
  });

  it('DRAFT_UNAVAILABLE is a flat non-disclosing 404', () => {
    const r = DRAFT_UNAVAILABLE_RESPONSE('https://ninescrolls.com');
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body)).toEqual({ error: 'Draft unavailable' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/rfq-draft-api/handler.test.ts`
Expected: FAIL — `Failed to resolve import "./handler"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// amplify/functions/rfq-draft-api/handler.ts
const ALLOWED_ORIGINS = [
  'https://ninescrolls.com',
  'https://www.ninescrolls.com',
  'http://localhost:5173',
];

export function allowedOrigin(origin?: string): string {
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

/** Case-insensitive header read (API Gateway lower-cases v2 but not always v1). */
export function header(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === target) return v;
  return undefined;
}

interface ApiResponse { statusCode: number; headers: Record<string, string>; body: string }

export function jsonResponse(
  statusCode: number, body: unknown, origin: string, opts: { credential?: boolean } = {},
): ApiResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,GET,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-RFQ-Draft-Create-Nonce,X-RFQ-Draft-Token',
    'Access-Control-Max-Age': '300',
  };
  if (opts.credential) {
    headers['Cache-Control'] = 'no-store';
    headers['Referrer-Policy'] = 'no-referrer';
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

/** The single non-disclosing failure for missing/wrong-token/expired/non-draft. */
export function DRAFT_UNAVAILABLE_RESPONSE(origin: string): ApiResponse {
  return jsonResponse(404, { error: 'Draft unavailable' }, origin, { credential: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/rfq-draft-api/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/rfq-draft-api/handler.ts amplify/functions/rfq-draft-api/handler.test.ts
git commit -m "feat(rfq-draft-api): credential header + non-disclosing response helpers"
```

---

### Task 3: Route dispatch — create / get / patch

Wire the three routes to `draftStore`, validating bodies with the P1 draft schemas and
mapping store results to HTTP. Missing/invalid credentials and every store failure collapse
to `Draft unavailable`; a version conflict returns the current whitelisted draft.

**Files:**
- Modify: `amplify/functions/rfq-draft-api/handler.ts`
- Test: `amplify/functions/rfq-draft-api/handler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to amplify/functions/rfq-draft-api/handler.test.ts
import crypto from 'node:crypto';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { FakeDdb } from '../price-api/lib/testing/fakeDdb';
import { encodeCredential } from '../../lib/rfq/draftCredentials';
import { makeHandler } from './handler';

const pepper = crypto.randomBytes(32);
const CREATE = {
  name: 'Jane Researcher', email: 'jane@stanford.edu', institution: 'Stanford University',
  equipmentCategory: 'Probe-Station', applicationDescription: 'Wafer probing for photonics devices.',
  quantity: 2,
};
function ctx() {
  const ddb = new FakeDdb();
  const handler = makeHandler({
    send: (c: unknown) => ddb.send(c as never), tableName: 't',
    pepper, keyVersion: 1, resolvePepper: (v: number) => (v === 1 ? pepper : undefined),
    now: () => '2026-07-15T00:00:00.000Z',
  });
  return { ddb, handler };
}
const evt = (method: string, path: string, headers: Record<string, string>, body?: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '1.2.3.4' } },
  rawPath: path, pathParameters: path.split('/').pop()?.match(/^[A-Za-z0-9_-]{20,}$/) ? { rfqId: path.split('/').pop() } : undefined,
  headers: { origin: 'https://ninescrolls.com', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('rfq-draft-api routing', () => {
  it('POST create → 201 with rfqId, then GET with the token returns the fields', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await handler(evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE));
    expect(created.statusCode).toBe(201);
    const { rfqId, draftToken } = JSON.parse(created.body);
    const got = await handler(evt('GET', `/api/rfq/draft/${rfqId}`, { 'x-rfq-draft-token': draftToken }));
    expect(got.statusCode).toBe(200);
    expect(JSON.parse(got.body).fields.email).toBe('jane@stanford.edu');
  });

  it('GET with a wrong token → 404 Draft unavailable', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await handler(evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE));
    const { rfqId } = JSON.parse(created.body);
    const wrong = encodeCredential(crypto.randomBytes(32));
    const got = await handler(evt('GET', `/api/rfq/draft/${rfqId}`, { 'x-rfq-draft-token': wrong }));
    expect(got.statusCode).toBe(404);
    expect(JSON.parse(got.body)).toEqual({ error: 'Draft unavailable' });
  });

  it('PATCH bumps version; a stale draftVersion → 409 with the current draft', async () => {
    const { handler } = ctx();
    const nonce = encodeCredential(crypto.randomBytes(32));
    const created = await handler(evt('POST', '/api/rfq/draft', { 'x-rfq-draft-create-nonce': nonce }, CREATE));
    const { rfqId, draftToken } = JSON.parse(created.body);
    const h = { 'x-rfq-draft-token': draftToken };
    const ok = await handler(evt('PATCH', `/api/rfq/draft/${rfqId}`, h, { draftVersion: 1, patch: { quantity: 7 } }));
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body).draftVersion).toBe(2);
    const stale = await handler(evt('PATCH', `/api/rfq/draft/${rfqId}`, h, { draftVersion: 1, patch: { quantity: 8 } }));
    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body).draftVersion).toBe(2);
    expect(JSON.parse(stale.body).fields.quantity).toBe(7);
  });

  it('POST create is missing its nonce → 404 (no disclosure of the reason)', async () => {
    const { handler } = ctx();
    const r = await handler(evt('POST', '/api/rfq/draft', {}, CREATE));
    expect(r.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/rfq-draft-api/handler.test.ts`
Expected: FAIL — `makeHandler is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to amplify/functions/rfq-draft-api/handler.ts
import { createDraft, getDraft, updateDraft, type DraftStoreDeps } from '../../lib/rfq/draftStore';
import { draftCreateSchema, draftPatchRequestSchema, normalizeDraftPatch } from '../../lib/rfq/draftContract';

interface DraftEvent {
  requestContext?: { http?: { method?: string; path?: string; sourceIp?: string } };
  httpMethod?: string;
  rawPath?: string;
  path?: string;
  pathParameters?: { rfqId?: string } | null;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

const parseBody = (event: DraftEvent): unknown => {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { return null; }
};

/** Build the handler from injected deps (tested) — the deployed entry calls this with real deps. */
export function makeHandler(deps: DraftStoreDeps) {
  return async (event: DraftEvent) => {
    const method = event.requestContext?.http?.method ?? event.httpMethod ?? 'GET';
    const path = event.requestContext?.http?.path ?? event.rawPath ?? event.path ?? '';
    const origin = allowedOrigin(header(event.headers, 'origin'));
    if (method === 'OPTIONS') return jsonResponse(200, {}, origin);
    const rfqId = event.pathParameters?.rfqId ?? path.split('/').filter(Boolean).pop();

    // POST /api/rfq/draft — create
    if (method === 'POST') {
      const nonce = header(event.headers, 'x-rfq-draft-create-nonce');
      const body = parseBody(event);
      const parsed = draftCreateSchema.safeParse(body);
      if (!nonce || !parsed.success) return DRAFT_UNAVAILABLE_RESPONSE(origin);
      try {
        const r = await createDraft(deps, nonce, parsed.data);
        return jsonResponse(201, r, origin, { credential: true });
      } catch { return DRAFT_UNAVAILABLE_RESPONSE(origin); }
    }

    const token = header(event.headers, 'x-rfq-draft-token');
    if (!rfqId || !token) return DRAFT_UNAVAILABLE_RESPONSE(origin);

    // GET /api/rfq/draft/{rfqId}
    if (method === 'GET') {
      const r = await getDraft(deps, rfqId, token);
      if (!r.ok) return DRAFT_UNAVAILABLE_RESPONSE(origin);
      return jsonResponse(200, {
        fields: r.fields, draftVersion: r.draftVersion, expiresAt: r.expiresAt,
      }, origin, { credential: true });
    }

    // PATCH /api/rfq/draft/{rfqId}
    if (method === 'PATCH') {
      const body = parseBody(event) as { draftVersion?: unknown; patch?: unknown } | null;
      if (!body || typeof body.draftVersion !== 'number') return DRAFT_UNAVAILABLE_RESPONSE(origin);
      const parsed = draftPatchRequestSchema.safeParse(body.patch);
      if (!parsed.success) return jsonResponse(400, { error: 'Invalid draft fields' }, origin, { credential: true });
      const r = await updateDraft(deps, rfqId, token, body.draftVersion, normalizeDraftPatch(parsed.data));
      if (r.status === 'unavailable') return DRAFT_UNAVAILABLE_RESPONSE(origin);
      if (r.status === 'conflict') {
        return jsonResponse(409, { error: 'Version conflict', fields: r.fields, draftVersion: r.draftVersion }, origin, { credential: true });
      }
      return jsonResponse(200, { fields: r.status === 'updated' ? r.fields : undefined, draftVersion: r.draftVersion }, origin, { credential: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/rfq-draft-api/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/rfq-draft-api/handler.ts amplify/functions/rfq-draft-api/handler.test.ts
git commit -m "feat(rfq-draft-api): create/get/patch route dispatch over draftStore"
```

---

### Task 4: Lambda entry + resource definition

The deployed entry resolves the pepper once at cold start and delegates to `makeHandler`.

**Files:**
- Modify: `amplify/functions/rfq-draft-api/handler.ts` (add the deployed `handler` export)
- Create: `amplify/functions/rfq-draft-api/resource.ts`

- [ ] **Step 1: Add the deployed entry (no new unit test — covered by Task 3 + deploy smoke)**

```ts
// append to amplify/functions/rfq-draft-api/handler.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { parsePepperSecret } from './pepperProvider';

let cached: ReturnType<typeof makeHandler> | undefined;
function deployed() {
  if (cached) return cached;
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const { pepper, keyVersion, resolvePepper } = parsePepperSecret(process.env.RFQ_DRAFT_PEPPER!);
  cached = makeHandler({
    send: (c) => doc.send(c as never) as Promise<{ Item?: Record<string, unknown> }>,
    tableName: process.env.INTELLIGENCE_TABLE!,
    pepper, keyVersion, resolvePepper,
    now: () => new Date().toISOString(),
  });
  return cached;
}

export const handler = (event: unknown) => deployed()(event as never);
```

```ts
// amplify/functions/rfq-draft-api/resource.ts
import { defineFunction, secret } from '@aws-amplify/backend';

export const rfqDraftApi = defineFunction({
  name: 'rfq-draft-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 256,
  environment: {
    RFQ_DRAFT_PEPPER: secret('RFQ_DRAFT_PEPPER'),
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck:amplify`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add amplify/functions/rfq-draft-api/handler.ts amplify/functions/rfq-draft-api/resource.ts
git commit -m "feat(rfq-draft-api): deployed Lambda entry + resource definition"
```

---

### Task 5: Wire routes, IAM, and throttling in backend.ts

**Deploy-verified, not unit-tested.** Follow the exact `submit-rfq` wiring idiom.

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Register the function and env/grants**

- Import: `import { rfqDraftApi } from './functions/rfq-draft-api/resource';`
- Add `rfqDraftApi,` to the `defineBackend({ ... })` object.
- Near the existing `intelligenceTable.grantReadWriteData(backend.submitRfq...)` block, add:

```ts
intelligenceTable.grantReadWriteData(backend.rfqDraftApi.resources.lambda);
backend.rfqDraftApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
```

- [ ] **Step 2: Add the routes under the existing `rfqResource`**

```ts
// after the /api/rfq/upload-url wiring
const rfqDraftIntegration = new LambdaIntegration(backend.rfqDraftApi.resources.lambda, { proxy: true });
const rfqDraftResource = rfqResource.addResource('draft');
rfqDraftResource.addMethod('POST', rfqDraftIntegration);
rfqDraftResource.addMethod('OPTIONS', rfqDraftIntegration);
const rfqDraftItemResource = rfqDraftResource.addResource('{rfqId}');
rfqDraftItemResource.addMethod('GET', rfqDraftIntegration);
rfqDraftItemResource.addMethod('PATCH', rfqDraftIntegration);
rfqDraftItemResource.addMethod('OPTIONS', rfqDraftIntegration);
```

- [ ] **Step 3: Add throttling in the stage `methodOptions`**

Alongside `/api/rfq/upload-url/POST` and `/api/rfq/POST`, add — matching the spec's
"10 creates / 120 reads-updates per 5-min window per IP" intent as an aggregate API-Gateway
ceiling (per-IP WAF is the follow-on defense, same note the existing routes carry):

```ts
'/api/rfq/draft/POST': { throttlingRateLimit: 5, throttlingBurstLimit: 10 },
'/api/rfq/draft/{rfqId}/GET': { throttlingRateLimit: 20, throttlingBurstLimit: 40 },
'/api/rfq/draft/{rfqId}/PATCH': { throttlingRateLimit: 20, throttlingBurstLimit: 40 },
```

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck:amplify`
Expected: no errors. (Route/IAM behavior is verified post-deploy — see Task 6.)

```bash
git add amplify/backend.ts
git commit -m "feat(rfq-draft-api): wire /api/rfq/draft routes, IAM grant, throttling"
```

---

### Task 6: Verification

- [ ] **Step 1: Unit-testable core**

Run: `npx vitest run amplify/functions/rfq-draft-api --exclude '**/.claude/**'`
Expected: PASS — pepperProvider + handler routing.

- [ ] **Step 2: Typecheck + lint + full regression**

Run: `npx tsc --noEmit && npm run typecheck:amplify && npx eslint amplify/functions/rfq-draft-api && npx vitest run --exclude '**/.claude/**'`
Expected: clean; no repo-wide regression.

- [ ] **Step 3: Create the secret before deploy (manual, documented — not code)**

`RFQ_DRAFT_PEPPER` must exist as an Amplify secret holding `{"current":1,"keys":{"1":"<64 hex>"}}`
before this deploys, or the Lambda throws at cold start. Generate a key with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it via the
Amplify secret mechanism. Record this in the PR so the deployer sets it.

- [ ] **Step 4: Post-deploy smoke (after merge + deploy)**

`POST /api/rfq/draft` with a random nonce header + a minimal valid body should return `201`;
`GET /api/rfq/draft/{rfqId}` with a wrong token should return `404 {"error":"Draft unavailable"}`.

---

## Self-Review

**Spec coverage (P3 scope — spec §"Workflow 2: Public Draft API"):**
- `POST` create, `GET`/`PATCH` read/update endpoints; both `rfqId`+token required for read/update — Task 3.
- Versioned peppered verification with rotation-overlap resolver — Task 1.
- Non-disclosing `404 {"error":"Draft unavailable"}` for missing/malformed/wrong/expired; `409 {"error":"Version conflict", ...current}` only for an authenticated live draft — Tasks 2–3.
- `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CORS allow-list limited to the two credential headers — Task 2.
- Per-route throttling — Task 5.

**Deferred (out of P3):** `X-RFQ-Submit-Key` + draft→pending upgrade + receipt/outbox (P4); per-IP WAF rate rule and application-level conditional counters (P3 ships the API-Gateway aggregate ceiling; the WAF rule is the same follow-on the existing routes note); frontend autosave (P6); admin/cleanup (P5). The spec's log/tracing redaction is honored by never placing credentials in responses/log lines here; a project-wide access-log template audit is tracked with the WAF follow-on.

**Placeholder scan:** none — every code step is complete. Task 5/6 "deploy-verified" notes are explicit verification instructions for infra that unit tests cannot exercise, not deferred code.

**Type consistency:** `makeHandler(DraftStoreDeps)` reuses P2's exact deps type; `header`/`jsonResponse`/`allowedOrigin`/`DRAFT_UNAVAILABLE_RESPONSE` are defined in Task 2 and consumed in Task 3; `parsePepperSecret` returns the `{ pepper, keyVersion, resolvePepper }` shape the deployed entry (Task 4) and tests (Task 1) both use.

**Note for the implementer:** the handler is split into `makeHandler(deps)` (pure, injected — unit-tested against `fakeDdb`) and a thin `handler` entry that resolves the pepper once per cold start. Never log the nonce/token; the only credential material that leaves the Lambda is the create response body (`rfqId` + `draftToken`) the client needs, and it carries `no-store`.
