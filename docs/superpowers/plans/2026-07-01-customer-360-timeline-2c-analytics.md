# Customer 360 Timeline — Plan 2C-analytics: `site_visit_session` Rollup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize website analytics sessions as `site_visit_session` timeline events with real org resolution — a `VISITOR#` identity bridge written by RFQ/Lead submissions, a 30-min cron rollup that closes and materializes sessions, and a bounded retro-resolve that attaches a visitor's anonymous research trail the moment they identify.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-01-customer-360-timeline-2c-analytics-design.md` (commit `ff175492`). New `crm-api/lib/analytics/` (markers, window, materialize, driver, retro, backfill) + a shared `amplify/lib/crm/visitor-bridge.ts` used by submit-rfq/submit-lead and crm-api. The rollup reads the SEPARATE AnalyticsEvent table (read grant + env), reuses the 2C-sweep `sweepState` lease/cursor (unions widened), and emits via the untouched P1 `emitTimelineEvent`.

**Tech Stack:** TypeScript (Node 22), AWS SDK v3 (`@aws-sdk/lib-dynamodb`), Amplify Gen 2 + CDK, vitest, zod (submit-* schemas).

**Verification results baked in (spec §6 plan-level tasks — DONE during planning, 2026-07-01):**
- **(a) `emitTimelineEvent` re-emit: NO changes needed.** Same-id re-emit → ConditionalCheckFailed branch: a pure payload/summary refresh overwrites the full item and stays clean (`emitTimelineEvent.ts:75-79`); an org change (`linkMoved`) takes the durable repair path — full item rewrite with new orgId/GSI2 keys, pending-org recompute, new-org recompute, `markRollupApplied` (`:81-89`). Sentinel orgs no-op in recompute. NOTE: LinkAuditLog is NOT part of the emit path (manual-relink only) — the real machinery is `rollupPendingOrgId → recompute`.
- **(b) `resolveLinks`: NO changes needed.** `ResolveInput.channel` union already contains `'analytics'`; `priorVisitorOrgId?` exists and is applied ONLY for the analytics channel (`resolveLinks.ts:47-49`, reason `visitor_prior_event`, confidence 0.5); sentinel is `unresolved-${sourceEntityType}-${sourceEntityId}` (`:51`) — so `sourceEntityType` MUST be exactly `'analytics'` to produce the spec'd `unresolved-analytics-{sessionId}`.

**Other conventions confirmed from the codebase:**
- `TimelineSource` union already includes `'analytics'` (`crm-api/lib/types.ts:5-7`).
- `timelineId`: `{ kind: 'site_visit_session'; sessionId }` → `tev-analytics-session-${sessionId}` (`timelineId.ts:11,40`) — already shipped in P1.
- `sweepState.ts`: `SweepMode = 'hot'|'cold'`, `SweepPass = 'existence'|'dirty-rollups'`; `stateKey(mode, pass)` → `CRM_SWEEP#<mode>#<pass>/STATE`; `SweepState.cursor` is `Record<string, unknown>` — the rollup's `{watermark, activeRunCutoff, pageCursor, pendingSessionIds}` state fits inside `cursor` unchanged.
- Analytics table: `backend.data.resources.tables['AnalyticsEvent']` (`backend.ts:204`); server-track precedent for env: `backend.serverTrack.addEnvironment('ANALYTICS_EVENT_TABLE', analyticsEventTable.tableName)` (`:206`).
- **GSI physical names** (Amplify Gen 2 convention, confirmed by working production code `IndexName: 'insightsPostsBySlug'` at `generate-sitemaps/handler.ts:219` for `InsightsPost.index('slug')`): `index('eventType').sortKeys(['timestamp'])` → **`analyticsEventsByEventTypeAndTimestamp`**; `index('sessionId').sortKeys(['timestamp'])` → **`analyticsEventsBySessionIdAndTimestamp`** (`data/resource.ts:190-193`). Task 12 includes a pre-merge `describe-table` verification; a wrong name also surfaces immediately as `errors` in the first cron's summary log.
- **Flush rows** (`server-track/handler.ts:380-410`) carry: `id, eventType:'page_time_flush', timestamp (ISO), visitorId, pageViewId, sessionId, tabId, pathname, pageTitle, activeSeconds, idleSeconds, hiddenSeconds, wallClockSeconds, flushReason, isFinal, flushSequence, maxScrollDepth, isBot` (+ ip/org fallback enrichment). **visitorId and pathname are ON the flush** — pv-join is enrichment-only.
- **pv rows** (`pv-${pageViewId}`, GetItem by deterministic id) carry: `pathname, pageTitle, productId, productName, referrer, utmSource/Medium/Campaign/Term/Content, org, orgName, organizationType, companyType, country, region, productPagesViewed, pdfDownloads, returnVisits, trafficChannel, isPaidTraffic, isBot, visitorId`.
- `submit-lead/handler.ts`: schema `visitorId: z.string().max(100).optional()` (`:56`), stored `visitorId: data.visitorId` (`:256`), org upsert + matchedOrgId backfill (`:646-685`), emit (`:687`). `submit-rfq/handler.ts`: `rfqSchema` at `:86` (NO visitorId today), item build `:547-562`, org upsert + backfill `:601-635`. Both have `const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!` and existing test suites (`handler.test.ts`).
- Frontend: lead precedent `body: JSON.stringify({ ...data, visitorId: getVisitorId() })` (`src/services/leadsService.ts:73`); `getVisitorId` exported from `src/services/analyticsStorageService.ts:19`. RFQ submitters: `src/components/common/QuoteModal.tsx:114-115` (JSON body) and `src/pages/RFQPage.tsx:545-549` (FormData `data` field + JSON variant).
- `invoke-crm-api.ts`: `invokeCrmApi(payload: CrmEmitPayload)` is emit-typed (its catch logs `payload.args.*`) — Task 4 adds a sibling generic `invokeCrmAction` rather than widening it.
- crm-api `handler.ts`: `actions` map + `DirectInvokeEvent { action; args?; mode?; cursor?; limit? }` (from 2C-sweep). Timeout already 120s.
- Tests: vitest, `vi.mock('../dynamodb')` / `vi.mock('./dynamodb')` style, no `.js` extensions in crm-api lib imports. Run: `npx vitest run <path>`.
- **Never `git add -A`** — the untracked `docs/seo/ninescrolls-news-task-prompt.md` must never be swept in. Every commit stages exact paths.

---

## File Structure

**Frontend (modified):** `src/components/common/QuoteModal.tsx`, `src/pages/RFQPage.tsx` — add `visitorId: getVisitorId()` to the RFQ payloads.

**Shared lib (new/modified):**
- Create `amplify/lib/crm/visitor-bridge.ts` — bridge read/upsert (upgrade-only + provenance), dependency-injected `(send, tableName)` so submit-* Lambdas AND crm-api both use it.
- Modify `amplify/lib/crm/invoke-crm-api.ts` — add generic `invokeCrmAction`.

**Channel Lambdas (modified):** `amplify/functions/submit-rfq/handler.ts` (schema + stored visitorId + bridge + retro-fire), `amplify/functions/submit-lead/handler.ts` (bridge + retro-fire), + their tests.

**crm-api (new `lib/analytics/`):**
- `sessionMarkers.ts` — SESSION# marker + RETRO#STATE read/write/list.
- `sessionWindow.ts` — analytics-table access: discover flush pages (eventType GSI), load a session's flushes (sessionId GSI), close-check.
- `materializeSession.ts` — the ONE path: pv-join → threshold → inputHash → three-tier resolveInput → emit → marker. `forceReemit` semantics.
- `rollupAnalyticsSessions.ts` — lease/cursor driver (state machine per spec §3).
- `reResolveVisitorSessions.ts` — bounded retro with RETRO#STATE resume.
- `backfillVisitorBridge.ts` — one-time paginated scan driver.

**crm-api (modified):** `lib/sweep/sweepState.ts` (widen unions), `handler.ts` (3 actions).

**Backend (modified):** `amplify/backend.ts` — crm-api read grant on AnalyticsEvent table + env + `*/30` cron Rule in `Stack.of(backend.crmApi.resources.lambda)`, `!isSandbox`.

---

## Task 1: Frontend — RFQ payloads carry `visitorId`

**Files:**
- Modify: `src/components/common/QuoteModal.tsx` (~:114)
- Modify: `src/pages/RFQPage.tsx` (payload build feeding `:545-549`)

No new unit test (component-level fetch): verification = typecheck + grep + existing suites stay green. Mirror the lead precedent `leadsService.ts:73`.

- [ ] **Step 1: QuoteModal.tsx** — add the import (top of file, alongside existing service imports):
```typescript
import { getVisitorId } from '../../services/analyticsStorageService';
```
Then find where `rfqPayload` is constructed (just above the `fetch('https://api.ninescrolls.com/api/rfq', ...)` at ~:114) and add the field to the object literal:
```typescript
        visitorId: getVisitorId(),
```

- [ ] **Step 2: RFQPage.tsx** — add the import:
```typescript
import { getVisitorId } from '../services/analyticsStorageService';
```
Find the `payload` object that is serialized into the request (`fd.append('data', JSON.stringify(payload))` at `:545` — the SAME payload feeds the JSON variant at `:549`) and add:
```typescript
        visitorId: getVisitorId(),
```
READ both files first — match the exact object-literal style; if a file builds the payload in more than one place, add the field to each construction site feeding `/api/rfq`.

- [ ] **Step 3: Verify**
Run: `npx tsc --noEmit` (frontend project tsconfig) — expected exit 0.
Run: `grep -n "visitorId: getVisitorId()" src/components/common/QuoteModal.tsx src/pages/RFQPage.tsx` — expected: one hit per construction site.

- [ ] **Step 4: Commit**
```bash
git add src/components/common/QuoteModal.tsx src/pages/RFQPage.tsx
git commit -m "feat(rfq): send visitorId with RFQ submissions (2C-analytics)"
```

---

## Task 2: submit-rfq — accept + store `visitorId`

**Files:**
- Modify: `amplify/functions/submit-rfq/handler.ts` (`rfqSchema` `:86+`; item build `:547-562`)
- Test: `amplify/functions/submit-rfq/handler.test.ts` (append)

- [ ] **Step 1: Write the failing test** — append to the existing suite (read the file first; reuse its existing event-builder/mocks — it already exercises the store path):
```typescript
describe('visitorId capture (2C-analytics)', () => {
  it('stores visitorId on the RFQ META when provided', async () => {
    // Reuse the suite's existing happy-path event builder; add visitorId to the body.
    // Assert the PutCommand item for PK RFQ#... includes visitorId: 'v-123'.
    // (Adapt to the suite's mock style — it captures docClient.send calls.)
  });
  it('accepts a missing visitorId (optional field, old clients)', async () => {
    // Same happy-path WITHOUT visitorId → no validation error; stored item has undefined visitorId.
  });
});
```
NOTE to implementer: the skeleton above states the two behaviors; write the real assertions against the suite's existing mock-capture pattern (it already asserts stored-item fields — mirror those assertions exactly). Do not weaken existing tests.

- [ ] **Step 2: Run to verify the first test fails** — `npx vitest run amplify/functions/submit-rfq/handler.test.ts` → the "stores visitorId" test FAILS (field absent from schema/store).

- [ ] **Step 3: Implement** — in `rfqSchema` (`:86+`), add alongside the other optional fields (exact lead precedent `submit-lead/handler.ts:56`):
```typescript
    visitorId: z.string().max(100).optional(),
```
In the item build (`:547-562`), add next to `ipHash`:
```typescript
            visitorId: data.visitorId,
```

- [ ] **Step 4: Run to verify pass + no regression** — `npx vitest run amplify/functions/submit-rfq/handler.test.ts` → PASS (all existing + 2 new).

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts
git commit -m "feat(submit-rfq): accept + store optional visitorId (2C-analytics)"
```

---

## Task 3: Shared `visitor-bridge` helper (upgrade-only + provenance)

**Files:**
- Create: `amplify/lib/crm/visitor-bridge.ts`
- Test: `amplify/lib/crm/visitor-bridge.test.ts`

Dependency-injected `(send, tableName)` so submit-* Lambdas AND crm-api reuse one implementation. The upgrade decision is computed from a read-then-conditional-write; both create and existing-item updates use conditions so a stale writer cannot downgrade a bridge written by a concurrent real-org submission.

- [ ] **Step 1: Write the failing test** — `amplify/lib/crm/visitor-bridge.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertVisitorBridge, readVisitorBridge, type VisitorBridge } from './visitor-bridge';

const send = vi.fn();
beforeEach(() => send.mockReset());
const T = 'TBL';
const base = { visitorId: 'v-1', email: 'a@lab.edu', sourceEntityType: 'rfq' as const, sourceEntityId: 'rfq-1', now: '2026-07-01T00:00:00.000Z' };

describe('upsertVisitorBridge (upgrade-only + provenance)', () => {
  it('creates a new bridge with orgSource provenance and reports created+orgUpgraded', async () => {
    send.mockResolvedValueOnce({ Item: undefined });            // read: no bridge
    send.mockResolvedValueOnce({});                              // write ok
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: true, orgUpgraded: true });
    const put = send.mock.calls[1][0].input;
    expect(put.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('upgrades null→real org (orgUpgraded true) and stamps the new provenance', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: 'a@lab.edu', firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, sourceEntityType: 'lead', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: true });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'lead_match' });
  });
  it('NEVER downgrades a real org: incoming null org leaves org untouched (fills email only)', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: null, firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu' });
  });
  it('latest-real-wins: real→different-real updates org + provenance (orgUpgraded false — no unresolved→resolved transition)', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'old.edu', orgSource: 'lead_match', email: 'a@lab.edu', firstSeenAt: 'x' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'new.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send.mock.calls[1][0].input.Item).toMatchObject({ matchedOrgId: 'new.edu', orgSource: 'rfq_match' });
  });
  it('no-op when nothing would change: skips the write entirely', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'rfq_match', email: 'a@lab.edu', firstSeenAt: 'x' } });
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send).toHaveBeenCalledTimes(1); // read only
  });
  it('guards against a blank visitorId (no VISITOR#undefined keys)', async () => {
    const r = await upsertVisitorBridge(send, T, { ...base, visitorId: '', matchedOrgId: 'lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send).not.toHaveBeenCalled();
  });
  it('stale writer cannot downgrade a real org written by a racing submitter', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: null, orgSource: null, email: null, updatedAt: 'old' } });
    send.mockRejectedValueOnce(Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu', orgSource: 'lead_match', email: null, updatedAt: 'new' } });
    send.mockResolvedValueOnce({});
    const r = await upsertVisitorBridge(send, T, { ...base, matchedOrgId: null, email: 'a@lab.edu' });
    expect(r).toEqual({ created: false, orgUpgraded: false });
    expect(send.mock.calls.at(-1)![0].input.Item).toMatchObject({ matchedOrgId: 'lab.edu', orgSource: 'lead_match', email: 'a@lab.edu' });
  });
});

describe('readVisitorBridge', () => {
  it('returns the item or null', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'VISITOR#v-1', SK: 'STATE', matchedOrgId: 'lab.edu' } });
    expect(((await readVisitorBridge(send, T, 'v-1')) as VisitorBridge).matchedOrgId).toBe('lab.edu');
    send.mockResolvedValueOnce({});
    expect(await readVisitorBridge(send, T, 'v-1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run amplify/lib/crm/visitor-bridge.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement** — `amplify/lib/crm/visitor-bridge.ts`:
```typescript
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// The VISITOR# identity bridge (spec §2.1). PROVENANCE RULE (structural): matchedOrgId may ONLY be
// populated from RFQ/Lead identity matching — orgSource records which. No code path may ever write
// an IP-derived org here; that is what keeps "IP-org never resolves a session" enforceable.
export interface VisitorBridge {
  PK: string; SK: 'STATE';
  matchedOrgId: string | null;
  orgSource: 'rfq_match' | 'lead_match' | null;
  email: string | null;
  sourceEntityType: 'rfq' | 'lead';
  sourceEntityId: string;
  firstSeenAt: string; updatedAt: string;
}

type Send = (cmd: unknown) => Promise<{ Item?: Record<string, unknown> }>;

export async function readVisitorBridge(send: Send, tableName: string, visitorId: string): Promise<VisitorBridge | null> {
  if (!visitorId) return null;
  const res = await send(new GetCommand({ TableName: tableName, Key: { PK: `VISITOR#${visitorId}`, SK: 'STATE' } }));
  return (res.Item as VisitorBridge | undefined) ?? null;
}

export interface UpsertBridgeInput {
  visitorId: string; matchedOrgId: string | null; email: string | null;
  sourceEntityType: 'rfq' | 'lead'; sourceEntityId: string; now: string;
}

// Upgrade-only: a real matchedOrgId is never downgraded (latest-real-wins); email fills when null.
// Returns { created, orgUpgraded } — orgUpgraded means an unresolved→resolved identity transition
// (new bridge with a real org, or null→real), which is what triggers retro-resolve.
export async function upsertVisitorBridge(send: Send, tableName: string, input: UpsertBridgeInput, attempt = 0): Promise<{ created: boolean; orgUpgraded: boolean }> {
  if (!input.visitorId) return { created: false, orgUpgraded: false };
  const incomingOrg = input.matchedOrgId || null; // '' → null (unmatched-order convention)
  const orgSource = input.sourceEntityType === 'rfq' ? 'rfq_match' as const : 'lead_match' as const;
  const existing = await readVisitorBridge(send, tableName, input.visitorId);

  if (!existing) {
    await send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: `VISITOR#${input.visitorId}`, SK: 'STATE',
        matchedOrgId: incomingOrg, orgSource: incomingOrg ? orgSource : null,
        email: input.email ?? null,
        sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId,
        firstSeenAt: input.now, updatedAt: input.now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return { created: true, orgUpgraded: !!incomingOrg };
  }

  const nextOrg = incomingOrg ?? existing.matchedOrgId;                 // never downgrade real→null
  const nextOrgSource = incomingOrg ? orgSource : existing.orgSource;   // provenance follows the org
  const nextEmail = existing.email ?? input.email ?? null;              // fill-when-null only
  const orgUpgraded = !existing.matchedOrgId && !!incomingOrg;          // unresolved→resolved transition
  const changed = nextOrg !== existing.matchedOrgId || nextEmail !== existing.email || nextOrgSource !== existing.orgSource;
  if (!changed) return { created: false, orgUpgraded: false };

  try {
    await send(new PutCommand({
      TableName: tableName,
      Item: {
        ...existing,
        matchedOrgId: nextOrg, orgSource: nextOrgSource, email: nextEmail,
        sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId,
        updatedAt: input.now,
      },
      // Stale-read protection: if a racing writer changed the bridge after our read, re-read and merge.
      // Legacy bridge rows may lack updatedAt; those are allowed only while updatedAt is still absent.
      ConditionExpression: 'attribute_not_exists(updatedAt) OR updatedAt = :expectedUpdatedAt',
      ExpressionAttributeValues: { ':expectedUpdatedAt': existing.updatedAt ?? '__missing__' },
    }));
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException' && attempt < 2) {
      return upsertVisitorBridge(send, tableName, input, attempt + 1);
    }
    throw err;
  }
  return { created: false, orgUpgraded };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run amplify/lib/crm/visitor-bridge.test.ts` → PASS (9 tests).

- [ ] **Step 5: Commit**
```bash
git add amplify/lib/crm/visitor-bridge.ts amplify/lib/crm/visitor-bridge.test.ts
git commit -m "feat(crm): shared VISITOR# identity bridge — upgrade-only + provenance (2C-analytics)"
```

---

## Task 4: `invokeCrmAction` + wire bridge + retro-fire into submit-lead & submit-rfq

**Files:**
- Modify: `amplify/lib/crm/invoke-crm-api.ts` (+ test `amplify/lib/crm/invoke-crm-api.test.ts` — append)
- Modify: `amplify/functions/submit-lead/handler.ts` (after matchedOrgId backfill, `:673-685`)
- Modify: `amplify/functions/submit-rfq/handler.ts` (after matchedOrgId backfill, `:601-635`)
- Tests: append to both handler suites.

- [ ] **Step 1: Failing test for `invokeCrmAction`** — append to `amplify/lib/crm/invoke-crm-api.test.ts` (read it first; it mocks `@aws-sdk/client-lambda` — reuse that mock):
```typescript
describe('invokeCrmAction (generic direct-invoke)', () => {
  it('fires an async Event invoke with the raw action payload', async () => {
    // Using the suite's existing LambdaClient mock: call
    //   await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: 'v-1' });
    // Assert InvocationType 'Event' and the decoded Payload equals the object.
  });
  it('swallows + logs dispatch failure (business path never blocked)', async () => {
    // Make the mocked send reject; expect NO throw and a console.error containing 'crm.action.dispatch_failed'.
  });
});
```
(Write real assertions in the suite's established mock style.)

- [ ] **Step 2: Run to verify fail** — `npx vitest run amplify/lib/crm/invoke-crm-api.test.ts` → new tests FAIL (`invokeCrmAction` not exported).

- [ ] **Step 3: Implement `invokeCrmAction`** — append to `amplify/lib/crm/invoke-crm-api.ts`:
```typescript
/**
 * Generic async action invoke (fire-and-forget, Event). Same contract as invokeCrmApi: a dispatch
 * failure is logged and swallowed — the business mutation is never blocked. Used for non-emit
 * actions (e.g. reResolveVisitorSessions); emit stays on the typed emitTimelineEventToCrm path.
 */
export async function invokeCrmAction(payload: { action: string } & Record<string, unknown>): Promise<void> {
  try {
    await lambda.send(new InvokeCommand({
      FunctionName: FUNCTION_NAME(),
      InvocationType: 'Event',
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: 'crm.action.dispatch_failed', action: payload.action,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}
```

- [ ] **Step 4: Failing tests for the two handlers** — append to each of `submit-lead/handler.test.ts` and `submit-rfq/handler.test.ts` (read each suite first; both mock the doc client and the crm invoke module — extend those mocks to also export `invokeCrmAction` and the visitor-bridge module):
```typescript
describe('visitor bridge + retro fire (2C-analytics)', () => {
  it('writes the VISITOR# bridge after org match when visitorId present', async () => {
    // happy-path submit WITH visitorId + a matched org →
    // assert upsertVisitorBridge was called with { visitorId, matchedOrgId, email, sourceEntityType: '<lead|rfq>' }.
  });
  it('fires reResolveVisitorSessions ONLY on identity upgrade', async () => {
    // mock upsertVisitorBridge → { created: true, orgUpgraded: true }  ⇒ invokeCrmAction called with the action + visitorId.
    // mock → { created: false, orgUpgraded: false }                    ⇒ invokeCrmAction NOT called.
  });
  it('skips the bridge entirely when visitorId is absent (no VISITOR#undefined)', async () => {
    // submit WITHOUT visitorId ⇒ upsertVisitorBridge not called.
  });
  it('bridge failure is non-fatal to the submission', async () => {
    // mock upsertVisitorBridge to reject ⇒ handler still returns success; error logged.
  });
});
```

- [ ] **Step 5: Implement the wiring** — in EACH handler, import at top:
```typescript
import { upsertVisitorBridge } from '../../lib/crm/visitor-bridge';
import { invokeCrmAction } from '../../lib/crm/invoke-crm-api';
```
Then AFTER the matchedOrgId backfill block and BEFORE/alongside the existing `emitTimelineEventToCrm` call (lead `:685-687`, rfq after `:635`), add (adapt variable names to each handler — lead uses `data.visitorId`/`data.email`, rfq uses `data.visitorId`/`data.email`; ids: `leadId` / `rfqId`):
```typescript
        // 2C-analytics: VISITOR# identity bridge + retro-resolve fire (non-fatal; upgrade-only).
        if (data.visitorId) {
            try {
                const bridge = await upsertVisitorBridge(
                    (c) => docClient.send(c as never) as never, TABLE_NAME(),
                    { visitorId: data.visitorId, matchedOrgId: matchedOrgId ?? null, email: data.email ?? null,
                      sourceEntityType: 'lead', sourceEntityId: leadId, now: submittedAt },
                );
                if (bridge.created || bridge.orgUpgraded) {
                    await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: data.visitorId });
                }
            } catch (err) {
                console.error(JSON.stringify({ event: 'crm.visitor_bridge.write_failed', visitorId: data.visitorId, error: err instanceof Error ? err.message : String(err) }));
            }
        }
```
(In submit-rfq: `sourceEntityType: 'rfq'`, `sourceEntityId: rfqId`. Fire on `created || orgUpgraded`: a brand-new bridge is itself an identity upgrade even org-less — its email may resolve sessions via the ladder.)

- [ ] **Step 6: Run all three suites** — `npx vitest run amplify/lib/crm/invoke-crm-api.test.ts amplify/functions/submit-lead/handler.test.ts amplify/functions/submit-rfq/handler.test.ts` → PASS, no regressions.

- [ ] **Step 7: Commit**
```bash
git add amplify/lib/crm/invoke-crm-api.ts amplify/lib/crm/invoke-crm-api.test.ts amplify/functions/submit-lead/handler.ts amplify/functions/submit-lead/handler.test.ts amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts
git commit -m "feat(crm): wire VISITOR# bridge + retro-resolve fire into submit-lead/submit-rfq (2C-analytics)"
```

---

## Task 5: Widen `sweepState` unions for the analytics rollup

**Files:**
- Modify: `amplify/functions/crm-api/lib/sweep/sweepState.ts` (2 lines)
- Test: `amplify/functions/crm-api/lib/sweep/sweepState.test.ts` (append 1 test)

- [ ] **Step 1: Failing test** — append inside the existing `describe('sweepState')`:
```typescript
  it('stateKey supports the analytics rollup namespace', () => {
    expect(stateKey('analytics', 'sessions')).toEqual({ PK: 'CRM_SWEEP#analytics#sessions', SK: 'STATE' });
  });
```
- [ ] **Step 2: Run to verify fail** — `npx vitest run amplify/functions/crm-api/lib/sweep/sweepState.test.ts` → FAIL (type error: `'analytics'` not assignable).
- [ ] **Step 3: Implement** — in `sweepState.ts` change the two unions:
```typescript
export type SweepMode = 'hot' | 'cold' | 'analytics';
export type SweepPass = 'existence' | 'dirty-rollups' | 'sessions';
```
- [ ] **Step 4: Run to verify pass** — full sweep dir stays green: `npx vitest run amplify/functions/crm-api/lib/sweep/` → PASS.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/sweep/sweepState.ts amplify/functions/crm-api/lib/sweep/sweepState.test.ts
git commit -m "feat(crm-api): widen sweepState unions for analytics rollup state (2C-analytics)"
```

---

## Task 6: `sessionMarkers` — SESSION# markers + RETRO#STATE

**Files:**
- Create: `amplify/functions/crm-api/lib/analytics/sessionMarkers.ts`
- Test: `amplify/functions/crm-api/lib/analytics/sessionMarkers.test.ts`

- [ ] **Step 1: Failing test**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { readMarker, writeMarker, listMarkers, readRetroState, writeRetroState, clearRetroState, type SessionMarker } from './sessionMarkers';
beforeEach(() => mockSend.mockReset());

const MARKER: SessionMarker = {
  sessionId: 's-1', timelineEventId: 'tev-analytics-session-s-1', occurredAt: '2026-07-01T00:00:00Z',
  resolutionStatus: 'unresolved', resolvedOrgId: null,
  lastFlushTs: '2026-07-01T00:10:00Z', flushCount: 3, inputHash: 'abc', emittedAt: '2026-07-01T01:00:00Z',
};

describe('sessionMarkers', () => {
  it('writeMarker keys VISITOR#<vid>/SESSION#<sid> and stores the full marker', async () => {
    mockSend.mockResolvedValueOnce({});
    await writeMarker('v-1', MARKER);
    const put = mockSend.mock.calls[0][0].input;
    expect(put.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'SESSION#s-1', inputHash: 'abc', timelineEventId: 'tev-analytics-session-s-1' });
  });
  it('readMarker returns the marker or null', async () => {
    mockSend.mockResolvedValueOnce({ Item: { ...MARKER, PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    expect((await readMarker('v-1', 's-1'))?.inputHash).toBe('abc');
    mockSend.mockResolvedValueOnce({});
    expect(await readMarker('v-1', 's-1')).toBeNull();
  });
  it('listMarkers pages with begins_with(SESSION#) and honors startSk', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ ...MARKER, SK: 'SESSION#s-1' }], LastEvaluatedKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    const page = await listMarkers('v-1', { limit: 1, startKey: undefined });
    expect(mockSend.mock.calls[0][0].input.KeyConditionExpression).toContain('begins_with');
    expect(page.markers).toHaveLength(1);
    expect(page.lastKey).toEqual({ PK: 'VISITOR#v-1', SK: 'SESSION#s-1' });
  });
  it('guards blank visitorId: readMarker/writeMarker/listMarkers no-op', async () => {
    expect(await readMarker('', 's-1')).toBeNull();
    await writeMarker('', MARKER);
    expect((await listMarkers('', {})).markers).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('RETRO#STATE round-trips and clears', async () => {
    mockSend.mockResolvedValueOnce({});
    await writeRetroState('v-1', { cursor: { PK: 'x' } });
    expect(mockSend.mock.calls[0][0].input.Item).toMatchObject({ PK: 'VISITOR#v-1', SK: 'RETRO#STATE' });
    mockSend.mockResolvedValueOnce({ Item: { cursor: { PK: 'x' } } });
    expect((await readRetroState('v-1'))?.cursor).toEqual({ PK: 'x' });
    mockSend.mockResolvedValueOnce({});
    await clearRetroState('v-1');
    expect(mockSend.mock.calls[2][0].input.Key).toEqual({ PK: 'VISITOR#v-1', SK: 'RETRO#STATE' });
  });
});
```
- [ ] **Step 2: Run to verify fail** — module not found.
- [ ] **Step 3: Implement** — `sessionMarkers.ts`:
```typescript
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';

// Session markers (spec §2.2): one per materialized session per visitor. Written ONLY for sessions
// that have a visitorId (spec §6 — no VISITOR#undefined keys); the no-marker rule is about lacking a
// retro-resolve handle, never about event materialization.
export interface SessionMarker {
  sessionId: string; timelineEventId: string; occurredAt: string;
  resolutionStatus: 'resolved' | 'unresolved' | 'below_threshold';
  resolvedOrgId: string | null;
  lastFlushTs: string; flushCount: number; inputHash: string;
  emittedAt: string;
}

export async function readMarker(visitorId: string, sessionId: string): Promise<SessionMarker | null> {
  if (!visitorId) return null;
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `VISITOR#${visitorId}`, SK: `SESSION#${sessionId}` } }));
  return (res.Item as SessionMarker | undefined) ?? null;
}

export async function writeMarker(visitorId: string, marker: SessionMarker): Promise<void> {
  if (!visitorId) return;
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: { PK: `VISITOR#${visitorId}`, SK: `SESSION#${marker.sessionId}`, ...marker } }));
}

export async function listMarkers(visitorId: string, opts: { limit?: number; startKey?: Record<string, unknown> }): Promise<{ markers: SessionMarker[]; lastKey?: Record<string, unknown> }> {
  if (!visitorId) return { markers: [] };
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :pre)',
    ExpressionAttributeValues: { ':pk': `VISITOR#${visitorId}`, ':pre': 'SESSION#' },
    Limit: opts.limit, ExclusiveStartKey: opts.startKey,
  }));
  return { markers: (res.Items ?? []) as SessionMarker[], lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// RETRO#STATE (spec §4): resume cursor for an interrupted retro-resolve of one visitor.
export async function readRetroState(visitorId: string): Promise<{ cursor: Record<string, unknown> } | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `VISITOR#${visitorId}`, SK: 'RETRO#STATE' } }));
  return (res.Item as { cursor: Record<string, unknown> } | undefined) ?? null;
}
export async function writeRetroState(visitorId: string, state: { cursor: Record<string, unknown> }): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: { PK: `VISITOR#${visitorId}`, SK: 'RETRO#STATE', ...state } }));
}
export async function clearRetroState(visitorId: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME(), Key: { PK: `VISITOR#${visitorId}`, SK: 'RETRO#STATE' } }));
}
```
- [ ] **Step 4: Run to verify pass** — 5 tests.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/analytics/sessionMarkers.ts amplify/functions/crm-api/lib/analytics/sessionMarkers.test.ts
git commit -m "feat(crm-api): analytics session markers + RETRO#STATE (2C-analytics)"
```

---

## Task 7: `sessionWindow` — analytics-table discovery + close-check

**Files:**
- Create: `amplify/functions/crm-api/lib/analytics/sessionWindow.ts`
- Test: `amplify/functions/crm-api/lib/analytics/sessionWindow.test.ts`

- [ ] **Step 1: Failing test**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { discoverFlushPage, loadSessionFlushes, isSessionClosed, computeCutoff, ANALYTICS_TABLE } from './sessionWindow';
beforeEach(() => { mockSend.mockReset(); process.env.ANALYTICS_EVENT_TABLE = 'ANALYTICS'; });

describe('sessionWindow', () => {
  it('computeCutoff = now − 30min (ISO)', () => {
    expect(computeCutoff('2026-07-01T01:00:00.000Z')).toBe('2026-07-01T00:30:00.000Z');
  });
  it('discoverFlushPage queries the eventType GSI over (watermark−overlap, cutoff], skipping bots + sessionless rows', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { sessionId: 's-1', isBot: false }, { sessionId: 's-1', isBot: false },
      { sessionId: 's-bot', isBot: true }, { pathname: '/x' } ] });
    const out = await discoverFlushPage({ watermark: '2026-07-01T00:00:00.000Z', cutoff: '2026-07-01T00:30:00.000Z' });
    const q = mockSend.mock.calls[0][0].input;
    expect(q.TableName).toBe('ANALYTICS');
    expect(q.IndexName).toBe('analyticsEventsByEventTypeAndTimestamp');
    expect(q.ExpressionAttributeValues[':et']).toBe('page_time_flush');
    expect(q.ExpressionAttributeValues[':from']).toBe('2026-06-30T23:50:00.000Z'); // watermark − 10min overlap
    expect(q.ExpressionAttributeValues[':to']).toBe('2026-07-01T00:30:00.000Z');
    expect(out.sessionIds).toEqual(['s-1']);
    expect(out.skippedBots).toBe(1);
  });
  it('discoverFlushPage forwards + returns the page cursor', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { k: 1 } });
    const out = await discoverFlushPage({ watermark: 'w', cutoff: 'c', startKey: { k: 0 } });
    expect(mockSend.mock.calls[0][0].input.ExclusiveStartKey).toEqual({ k: 0 });
    expect(out.lastKey).toEqual({ k: 1 });
  });
  it('loadSessionFlushes pages the sessionId GSI to completion', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ sessionId: 's-1', timestamp: 't1' }], LastEvaluatedKey: { k: 1 } });
    mockSend.mockResolvedValueOnce({ Items: [{ sessionId: 's-1', timestamp: 't2' }] });
    const flushes = await loadSessionFlushes('s-1');
    expect(mockSend.mock.calls[0][0].input.IndexName).toBe('analyticsEventsBySessionIdAndTimestamp');
    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ k: 1 });
    expect(flushes).toHaveLength(2);
  });
  it('isSessionClosed: last flush ≤ now−30min → closed', () => {
    const f = (ts: string) => ({ timestamp: ts } as never);
    expect(isSessionClosed([f('2026-07-01T00:00:00Z'), f('2026-07-01T00:20:00Z')], '2026-07-01T00:55:00.000Z')).toBe(true);
    expect(isSessionClosed([f('2026-07-01T00:40:00Z')], '2026-07-01T00:55:00.000Z')).toBe(false);
  });
});
```
- [ ] **Step 2: Run to verify fail** — module not found.
- [ ] **Step 3: Implement** — `sessionWindow.ts`:
```typescript
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../dynamodb';

export const ANALYTICS_TABLE = () => process.env.ANALYTICS_EVENT_TABLE!;
// Physical GSI names — Amplify Gen2 convention (verified against the shipped `insightsPostsBySlug`
// index in generate-sitemaps): <pluralCamelModel>By<Pk>[And<Sk>]. Task 12 verifies via describe-table
// pre-merge; a mismatch also surfaces instantly as `errors` in the first cron's summary log.
const GSI_BY_EVENT_TYPE = 'analyticsEventsByEventTypeAndTimestamp';
const GSI_BY_SESSION = 'analyticsEventsBySessionIdAndTimestamp';

const SESSION_IDLE_MS = 30 * 60 * 1000;   // P1 §4.3 close window
const OVERLAP_MS = 10 * 60 * 1000;        // spec §3 clock-skew/late-beacon overlap

export type FlushRow = Record<string, unknown> & { sessionId?: string; timestamp?: string; isBot?: boolean; pageViewId?: string; visitorId?: string };

export const computeCutoff = (nowIso: string): string => new Date(Date.parse(nowIso) - SESSION_IDLE_MS).toISOString();

// One discovery page over the eventType GSI: page_time_flush rows with ts ∈ [watermark − overlap, cutoff].
// The lower bound is intentionally inclusive because deterministic session ids make boundary duplicates harmless.
export async function discoverFlushPage(opts: { watermark: string; cutoff: string; startKey?: Record<string, unknown>; limit?: number }): Promise<{ sessionIds: string[]; skippedBots: number; lastKey?: Record<string, unknown> }> {
  const from = new Date(Date.parse(opts.watermark) - OVERLAP_MS).toISOString();
  const res = await docClient.send(new QueryCommand({
    TableName: ANALYTICS_TABLE(), IndexName: GSI_BY_EVENT_TYPE,
    KeyConditionExpression: 'eventType = :et AND #ts BETWEEN :from AND :to',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':et': 'page_time_flush', ':from': from, ':to': opts.cutoff },
    ExclusiveStartKey: opts.startKey, Limit: opts.limit,
  }));
  const ids = new Set<string>();
  let skippedBots = 0;
  for (const r of (res.Items ?? []) as FlushRow[]) {
    if (r.isBot === true) { skippedBots += 1; continue; }
    if (typeof r.sessionId === 'string' && r.sessionId) ids.add(r.sessionId);
  }
  return { sessionIds: [...ids], skippedBots, lastKey: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}

// ALL of one session's flushes (paginated to completion — full session content never depends on the
// discovery window). Audit-tool rule: never silently truncate.
export async function loadSessionFlushes(sessionId: string): Promise<FlushRow[]> {
  const out: FlushRow[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: ANALYTICS_TABLE(), IndexName: GSI_BY_SESSION,
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': sessionId },
      ExclusiveStartKey: start,
    }));
    out.push(...((res.Items ?? []) as FlushRow[]));
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);
  return out;
}

export function isSessionClosed(flushes: FlushRow[], nowIso: string): boolean {
  const last = flushes.reduce<string>((m, f) => (typeof f.timestamp === 'string' && f.timestamp > m ? f.timestamp : m), '');
  return !!last && Date.parse(last) <= Date.parse(nowIso) - SESSION_IDLE_MS;
}
```
- [ ] **Step 4: Run to verify pass** — 5 tests.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/analytics/sessionWindow.ts amplify/functions/crm-api/lib/analytics/sessionWindow.test.ts
git commit -m "feat(crm-api): analytics session window — discovery + close-check (2C-analytics)"
```

---

## Task 8: `materializeSession` — the ONE shared path

**Files:**
- Create: `amplify/functions/crm-api/lib/analytics/materializeSession.ts`
- Test: `amplify/functions/crm-api/lib/analytics/materializeSession.test.ts`

- [ ] **Step 1: Failing test**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const emitMock = vi.fn();
vi.mock('../emitTimelineEvent', () => ({ emitTimelineEvent: (a: unknown) => emitMock(a) }));
const loadFlushes = vi.fn();
vi.mock('./sessionWindow', async (orig) => ({ ...(await orig()), loadSessionFlushes: (s: string) => loadFlushes(s), ANALYTICS_TABLE: () => 'ANALYTICS' }));
const readMarkerMock = vi.fn(); const writeMarkerMock = vi.fn(); const listMarkersMock = vi.fn();
vi.mock('./sessionMarkers', () => ({ readMarker: (...a: unknown[]) => readMarkerMock(...a), writeMarker: (...a: unknown[]) => writeMarkerMock(...a), listMarkers: (...a: unknown[]) => listMarkersMock(...a) }));
const readBridgeMock = vi.fn();
vi.mock('../../../../lib/crm/visitor-bridge', () => ({ readVisitorBridge: (...a: unknown[]) => readBridgeMock(...a) }));

import { materializeSession, computeInputHash } from './materializeSession';
beforeEach(() => { mockSend.mockReset(); emitMock.mockReset(); loadFlushes.mockReset(); readMarkerMock.mockReset(); writeMarkerMock.mockReset(); listMarkersMock.mockReset(); readBridgeMock.mockReset(); listMarkersMock.mockResolvedValue({ markers: [] }); });

const FLUSH = (over: Record<string, unknown> = {}) => ({ eventType: 'page_time_flush', sessionId: 's-1', visitorId: 'v-1', pageViewId: 'p-1', pathname: '/products/icp-etcher', timestamp: '2026-07-01T00:00:00Z', activeSeconds: 60, maxScrollDepth: 80, isBot: false, ...over });
const PV = (over: Record<string, unknown> = {}) => ({ Item: { id: 'pv-p-1', pathname: '/products/icp-etcher', productPagesViewed: 1, pdfDownloads: 0, returnVisits: 0, orgName: 'Some ISP', utmSource: 'g', trafficChannel: 'paid', country: 'US', region: 'CA', ...over } });

describe('materializeSession', () => {
  it('emits site_visit_session with deterministic id + tier-3 unresolved resolveInput (no bridge, no prior)', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());          // pv join
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');
    const args = emitMock.mock.calls[0][0];
    expect(args.kind).toBe('site_visit_session');
    expect(args.idInput).toEqual({ kind: 'site_visit_session', sessionId: 's-1' });
    expect(args.resolveInput).toMatchObject({ channel: 'analytics', sourceEntityType: 'analytics', sourceEntityId: 's-1' });
    expect(args.resolveInput.matchedOrgId).toBeUndefined();
    expect(args.occurredAt).toBe('2026-07-01T00:00:00Z');  // earliest flush ts
    expect(args.payload).toMatchObject({ visitorId: 'v-1', pageCount: 1, productPagesViewed: 1, orgNameDisplay: 'Some ISP' });
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'unresolved', timelineEventId: 'tev-analytics-session-s-1' }));
  });
  it('tier-1: bridge {matchedOrgId,email} flows into resolveInput; marker resolved', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(emitMock.mock.calls[0][0].resolveInput).toMatchObject({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu' }));
  });
  it('email-only bridge is emitted for resolver use but marker remains unresolved locally', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: null, email: 'a@newcorp.example' });
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.resolutionSource).toBe('unresolved');
    expect(emitMock.mock.calls[0][0].resolveInput).toMatchObject({ email: 'a@newcorp.example' });
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'unresolved', resolvedOrgId: null }));
  });
  it('tier-2: no bridge but a prior resolved marker → priorVisitorOrgId passed', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    listMarkersMock.mockResolvedValue({ markers: [{ sessionId: 's-0', resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu', emittedAt: '2026-06-30T00:00:00Z' }] });
    emitMock.mockResolvedValueOnce(undefined);
    await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(emitMock.mock.calls[0][0].resolveInput.priorVisitorOrgId).toBe('lab.edu');
  });
  it('below threshold (1 non-product page, no downloads) → marker below_threshold, NO emit', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH({ pathname: '/', pageViewId: 'p-9' })]);
    mockSend.mockResolvedValueOnce({ Item: { id: 'pv-p-9', pathname: '/', productPagesViewed: 0, pdfDownloads: 0, returnVisits: 0 } });
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('below_threshold');
    expect(emitMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'below_threshold' }));
  });
  it('fast-skip: unchanged inputHash + no resolution upgrade + not forceReemit → skipped, no emit, no marker rewrite', async () => {
    const flushes = [FLUSH()];
    loadFlushes.mockResolvedValueOnce(flushes);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    const hash = computeInputHash(flushes as never, [PV().Item as never]);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'unresolved', inputHash: hash });
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('skipped');
    expect(emitMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).not.toHaveBeenCalled();
  });
  it('unchanged hash BUT bridge now offers an upgrade → re-emits (resolution upgrade beats fast-skip)', async () => {
    const flushes = [FLUSH()];
    loadFlushes.mockResolvedValueOnce(flushes);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    const hash = computeInputHash(flushes as never, [PV().Item as never]);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'unresolved', inputHash: hash });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');
  });
  it('forceReemit re-emits an unresolved session with unchanged hash even without upgrade check shortcuts', async () => {
    const flushes = [FLUSH()];
    loadFlushes.mockResolvedValueOnce(flushes);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    const hash = computeInputHash(flushes as never, [PV().Item as never]);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'unresolved', inputHash: hash });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z', forceReemit: true });
    expect(out.outcome).toBe('emitted');
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu' }));
  });
  it('session with NO visitorId still emits (valid sessionId id) but writes NO marker', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH({ visitorId: undefined }), FLUSH({ visitorId: undefined, pageViewId: 'p-2' }), FLUSH({ visitorId: undefined, pageViewId: 'p-3' })]);
    mockSend.mockResolvedValue({ Item: { pathname: '/x', productPagesViewed: 0, pdfDownloads: 0, returnVisits: 0 } });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');                      // ≥3 pages passes threshold
    expect(readBridgeMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).not.toHaveBeenCalled();
  });
});
```
- [ ] **Step 2: Run to verify fail** — module not found.
- [ ] **Step 3: Implement** — `materializeSession.ts`:
```typescript
import crypto from 'node:crypto';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { emitTimelineEvent } from '../emitTimelineEvent';
import { loadSessionFlushes, ANALYTICS_TABLE, type FlushRow } from './sessionWindow';
import { readMarker, writeMarker, listMarkers, type SessionMarker } from './sessionMarkers';
import { readVisitorBridge } from '../../../../lib/crm/visitor-bridge';

export type MaterializeOutcome = 'emitted' | 'below_threshold' | 'skipped' | 'no_flushes';
export type ResolutionSource = 'bridge' | 'prior' | 'unresolved';
type PvRow = Record<string, unknown>;

// Content digest over the SELECTED materialization inputs (spec §2.2): sorted flush ids + the
// per-page fields the threshold/payload read. Same inputs ⇒ same hash ⇒ fast-skip (unless a
// resolution upgrade is available or forceReemit).
export function computeInputHash(flushes: FlushRow[], pages: PvRow[]): string {
  const f = flushes.map((x) => `${x.pageViewId}#${x.timestamp}#${x.activeSeconds ?? 0}#${x.maxScrollDepth ?? 0}`).sort();
  const p = pages.map((x) => `${x.id ?? ''}#${x.pathname ?? ''}#${x.productPagesViewed ?? 0}#${x.pdfDownloads ?? 0}#${x.returnVisits ?? 0}`).sort();
  return crypto.createHash('sha256').update(JSON.stringify([f, p])).digest('hex').slice(0, 32);
}

// P1 §5.2 signal threshold, computed from joined parent pv rows + flush paths (spec §2.3 signal sources).
function passesThreshold(flushes: FlushRow[], pages: PvRow[]): boolean {
  const paths = new Set<string>();
  for (const f of flushes) if (typeof f.pathname === 'string') paths.add(f.pathname);
  for (const p of pages) if (typeof p.pathname === 'string') paths.add(p.pathname as string);
  const productPage = [...paths].some((p) => p.startsWith('/products/')) || pages.some((p) => !!p.productId) || pages.some((p) => Number(p.productPagesViewed ?? 0) > 0);
  const rfqPage = [...paths].some((p) => p.startsWith('/rfq'));
  const download = pages.some((p) => Number(p.pdfDownloads ?? 0) > 0);
  const returnVisit = pages.some((p) => Number(p.returnVisits ?? 0) > 0);
  const pageCount = new Set(flushes.map((f) => f.pageViewId).filter(Boolean)).size;
  return productPage || rfqPage || download || returnVisit || pageCount >= 3;
}

export async function materializeSession(opts: { sessionId: string; nowIso: string; forceReemit?: boolean }): Promise<{ outcome: MaterializeOutcome; resolvedOrgId?: string | null; resolutionSource?: ResolutionSource }> {
  const flushes = (await loadSessionFlushes(opts.sessionId)).filter((f) => f.isBot !== true);
  if (flushes.length === 0) return { outcome: 'no_flushes' };

  // Join parent pv rows (deterministic ids) for enrichment: paths, product ids, UTM, IP-org display, counters.
  const pageViewIds = [...new Set(flushes.map((f) => f.pageViewId).filter((x): x is string => typeof x === 'string' && !!x))];
  const pages: PvRow[] = [];
  for (const pvId of pageViewIds) {
    try {
      const res = await docClient.send(new GetCommand({ TableName: ANALYTICS_TABLE(), Key: { id: `pv-${pvId}` } }));
      if (res.Item && (res.Item as PvRow).isBot !== true) pages.push(res.Item as PvRow);
    } catch { /* enrichment-only: a missing pv row degrades the payload, never fails the session */ }
  }

  const visitorId = (flushes.find((f) => typeof f.visitorId === 'string' && f.visitorId)?.visitorId
    ?? pages.find((p) => typeof p.visitorId === 'string' && p.visitorId)?.visitorId ?? '') as string;
  const inputHash = computeInputHash(flushes, pages);
  const existingMarker = visitorId ? await readMarker(visitorId, opts.sessionId) : null;
  const bridge = visitorId ? await readVisitorBridge((c) => docClient.send(c as never) as never, TABLE_NAME(), visitorId) : null;

  // Tier-2 lookup: latest prior RESOLVED marker for this visitor (markers are the prior-event index).
  let priorVisitorOrgId: string | undefined;
  if (visitorId && !(bridge?.matchedOrgId)) {
    const { markers } = await listMarkers(visitorId, {});
    const prior = markers.filter((m) => m.resolutionStatus === 'resolved' && m.resolvedOrgId && m.sessionId !== opts.sessionId)
      .sort((a, b) => (a.emittedAt < b.emittedAt ? 1 : -1))[0];
    priorVisitorOrgId = prior?.resolvedOrgId ?? undefined;
  }

  // Fast-skip (normal mode only): same input AND no resolution upgrade available.
  const upgradeAvailable = existingMarker?.resolutionStatus === 'unresolved' && (!!bridge?.matchedOrgId || !!priorVisitorOrgId);
  if (!opts.forceReemit && existingMarker && existingMarker.inputHash === inputHash && !upgradeAvailable) {
    return { outcome: 'skipped', resolvedOrgId: existingMarker.resolvedOrgId };
  }

  const sorted = flushes.map((f) => f.timestamp as string).filter(Boolean).sort();
  const occurredAt = sorted[0];
  const lastFlushTs = sorted[sorted.length - 1];

  if (!passesThreshold(flushes, pages)) {
    if (visitorId) await writeMarker(visitorId, {
      sessionId: opts.sessionId, timelineEventId: `tev-analytics-session-${opts.sessionId}`, occurredAt,
      resolutionStatus: 'below_threshold', resolvedOrgId: null,
      lastFlushTs, flushCount: flushes.length, inputHash, emittedAt: opts.nowIso,
    });
    return { outcome: 'below_threshold' };
  }

  // Payload (spec §2.3) — IP-org is DISPLAY ONLY; it never enters resolveInput.
  const pathCounts = new Map<string, number>();
  for (const f of flushes) if (typeof f.pathname === 'string') pathCounts.set(f.pathname, (pathCounts.get(f.pathname) ?? 0) + 1);
  for (const p of pages) if (typeof p.pathname === 'string') pathCounts.set(p.pathname as string, (pathCounts.get(p.pathname as string) ?? 0) + 1);
  const topPaths = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p);
  const bestPv = pages.find((p) => p.orgName || p.utmSource || p.country) ?? pages[0] ?? {};
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const payload = {
    visitorId: visitorId || null, pageCount: new Set(flushes.map((f) => f.pageViewId).filter(Boolean)).size,
    topPaths, productPagesViewed: Math.max(0, ...pages.map((p) => num(p.productPagesViewed))),
    downloads: Math.max(0, ...pages.map((p) => num(p.pdfDownloads))),
    returnVisit: pages.some((p) => num(p.returnVisits) > 0),
    activeSeconds: flushes.reduce((s, f) => s + num(f.activeSeconds), 0),
    maxScrollDepth: Math.max(0, ...flushes.map((f) => num(f.maxScrollDepth))),
    orgNameDisplay: (bestPv.orgName as string) ?? null,
    utmSource: (bestPv.utmSource as string) ?? null, utmMedium: (bestPv.utmMedium as string) ?? null,
    utmCampaign: (bestPv.utmCampaign as string) ?? null, trafficChannel: (bestPv.trafficChannel as string) ?? null,
    country: (bestPv.country as string) ?? null, region: (bestPv.region as string) ?? null,
  };

  // Three-tier resolveInput (spec §2.3): bridge → priorVisitorOrgId → bare (unresolved sentinel).
  const resolveInput = {
    sourceEntityType: 'analytics', sourceEntityId: opts.sessionId, channel: 'analytics' as const,
    ...(bridge?.matchedOrgId ? { matchedOrgId: bridge.matchedOrgId } : {}),
    ...(bridge?.email ? { email: bridge.email } : {}),
    ...(!bridge?.matchedOrgId && priorVisitorOrgId ? { priorVisitorOrgId } : {}),
  };

  await emitTimelineEvent({
    source: 'analytics', kind: 'site_visit_session',
    sourceEntityType: 'analytics', sourceEntityId: opts.sessionId,
    occurredAt, summary: `Site visit — ${payload.pageCount} page${payload.pageCount === 1 ? '' : 's'}${payload.orgNameDisplay ? ` (${payload.orgNameDisplay})` : ''}`,
    idInput: { kind: 'site_visit_session', sessionId: opts.sessionId },
    resolveInput, isInternalOnly: false, payload,
  });

  const resolvedOrgId = bridge?.matchedOrgId ?? priorVisitorOrgId ?? null;
  const resolutionSource: ResolutionSource = bridge?.matchedOrgId ? 'bridge' : priorVisitorOrgId ? 'prior' : 'unresolved';
  const marker: SessionMarker = {
    sessionId: opts.sessionId, timelineEventId: `tev-analytics-session-${opts.sessionId}`, occurredAt,
    // Marker state is local and conservative: email-only bridge input may or may not resolve inside
    // resolveLinks, whose result emitTimelineEvent does not return. Keep such markers unresolved so a
    // later real matchedOrgId or prior marker can still retro-resolve them.
    resolutionStatus: resolvedOrgId ? 'resolved' : 'unresolved', resolvedOrgId,
    lastFlushTs, flushCount: flushes.length, inputHash, emittedAt: opts.nowIso,
  };
  if (visitorId) await writeMarker(visitorId, marker);
  return { outcome: 'emitted', resolvedOrgId, resolutionSource };
}
```
NOTE to implementer: marker `resolutionStatus` is deliberately conservative because `emitTimelineEvent` does not return the resolver result. A bridge email may resolve inside `resolveLinks`, but without a local `matchedOrgId`/prior org the marker stays `unresolved` so a later real bridge upgrade can still retro-resolve it. Do not mark email-only sessions resolved unless `emitTimelineEvent` is changed to return authoritative resolution.
- [ ] **Step 4: Run to verify pass** — 9 tests.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/analytics/materializeSession.ts amplify/functions/crm-api/lib/analytics/materializeSession.test.ts
git commit -m "feat(crm-api): materializeSession — threshold, inputHash, 3-tier resolution (2C-analytics)"
```

---

## Task 9: `rollupAnalyticsSessions` — the driver state machine

**Files:**
- Create: `amplify/functions/crm-api/lib/analytics/rollupAnalyticsSessions.ts`
- Test: `amplify/functions/crm-api/lib/analytics/rollupAnalyticsSessions.test.ts`

- [ ] **Step 1: Failing test**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const acquireLease = vi.fn(); const persistPage = vi.fn(); const releaseLeaseKeepCursor = vi.fn(); const readState = vi.fn();
vi.mock('../sweep/sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a), persistPage: (...a: unknown[]) => persistPage(...a),
  releaseLeaseKeepCursor: (...a: unknown[]) => releaseLeaseKeepCursor(...a), readState: (...a: unknown[]) => readState(...a), stateKey: () => ({}),
}));
const discover = vi.fn(); const loadFlushes = vi.fn(); const closed = vi.fn();
vi.mock('./sessionWindow', () => ({
  discoverFlushPage: (o: unknown) => discover(o), loadSessionFlushes: (s: string) => loadFlushes(s),
  isSessionClosed: (...a: unknown[]) => closed(...a), computeCutoff: (n: string) => new Date(Date.parse(n) - 1800000).toISOString(),
  ANALYTICS_TABLE: () => 'ANALYTICS',
}));
const materialize = vi.fn();
vi.mock('./materializeSession', () => ({ materializeSession: (o: unknown) => materialize(o) }));
import { rollupAnalyticsSessions } from './rollupAnalyticsSessions';
beforeEach(() => { [acquireLease, persistPage, releaseLeaseKeepCursor, readState, discover, loadFlushes, closed, materialize].forEach((m) => m.mockReset());
  acquireLease.mockResolvedValue('tok'); readState.mockResolvedValue({}); loadFlushes.mockResolvedValue([{ timestamp: 't' }]); });

describe('rollupAnalyticsSessions', () => {
  it('skips when the lease is held', async () => {
    acquireLease.mockResolvedValueOnce(null);
    const out = await rollupAnalyticsSessions({});
    expect(out.summary).toMatchObject({ skipped: true });
    expect(discover).not.toHaveBeenCalled();
  });
  it('happy path: freezes activeRunCutoff, materializes closed sessions, advances watermark, releases', async () => {
    readState.mockResolvedValue({ cursor: { watermark: '2026-07-01T00:00:00.000Z' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2'] });                 // no lastKey → final page
    closed.mockReturnValueOnce(true).mockReturnValueOnce(false);                     // s-2 still open
    materialize.mockResolvedValueOnce({ outcome: 'emitted', resolutionSource: 'bridge' });
    const out = await rollupAnalyticsSessions({});
    expect(materialize).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-1' }));
    expect(releaseLeaseKeepCursor).toHaveBeenCalledTimes(1);
    const summary = releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as Record<string, unknown>;
    expect(summary).toMatchObject({ discovered: 2, closed: 1, emitted: 1, bridgeResolved: 1 });
    // watermark advanced to the frozen cutoff on completion:
    expect((releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as { watermark?: string }).watermark).toBeDefined();
    expect(out.summary).toMatchObject({ hasMore: false });
  });
  it('resumes an ACTIVE run: reuses persisted activeRunCutoff + pageCursor + drains pendingSessionIds first', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0', activeRunCutoff: 'CUT', pageCursor: { k: 1 }, pendingSessionIds: ['s-9'] } });
    closed.mockReturnValue(true);
    materialize.mockResolvedValue({ outcome: 'emitted' });
    discover.mockResolvedValueOnce({ sessionIds: [] });                              // final page
    await rollupAnalyticsSessions({});
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-9' }));      // backlog drained
    expect(discover).toHaveBeenCalledWith(expect.objectContaining({ cutoff: 'CUT', startKey: { k: 1 } }));
  });
  it('hits the session cap: persists pending backlog + cursor, returns hasMore, does NOT advance watermark or release', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2', 's-3'], lastKey: { k: 2 } });
    closed.mockReturnValue(true);
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await rollupAnalyticsSessions({ maxSessions: 2 });
    expect(materialize).toHaveBeenCalledTimes(2);
    expect(releaseLeaseKeepCursor).not.toHaveBeenCalled();
    const persisted = persistPage.mock.calls.at(-1)![3].cursor as Record<string, unknown>;
    expect(persisted.pendingSessionIds).toEqual(['s-3']);
    expect(persisted.pageCursor).toEqual({ k: 2 });
    expect(persisted.watermark).toBe('w0');                                          // NOT advanced
    expect(out.summary).toMatchObject({ hasMore: true });
  });
  it('isolates a per-session materialize failure and continues', async () => {
    readState.mockResolvedValue({ cursor: { watermark: 'w0' } });
    discover.mockResolvedValueOnce({ sessionIds: ['s-1', 's-2'] });
    closed.mockReturnValue(true);
    materialize.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ outcome: 'emitted' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await rollupAnalyticsSessions({});
    const summary = releaseLeaseKeepCursor.mock.calls[0][3].lastSummary as Record<string, unknown>;
    expect(summary).toMatchObject({ errors: 1, emitted: 1 });
    errSpy.mockRestore();
  });
});
```
- [ ] **Step 2: Run to verify fail** — module not found.
- [ ] **Step 3: Implement** — first add the additive helper to `sweepState.ts`:
```typescript
// Release ONLY the lease fields, PRESERVING the durable cursor (used by the analytics rollup, whose
// watermark must survive between runs — unlike sweep passes, which reset their cursor on completion).
export async function releaseLeaseKeepCursor(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { lastSummary: Record<string, unknown> }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET hasMore = :f, lastSummary = :s, lastCompletedAt = :now REMOVE lease, leaseExpiresAt',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeValues: { ':f': false, ':s': p.lastSummary, ':now': new Date().toISOString(), ':token': leaseToken },
  }));
}
```
Add one `sweepState.test.ts` assertion that `releaseLeaseKeepCursor` does **not** remove `cursor`/`#c`.

Then create `rollupAnalyticsSessions.ts`:
```typescript
import { readState, acquireLease, persistPage, releaseLeaseKeepCursor } from '../sweep/sweepState';
import { discoverFlushPage, isSessionClosed, loadSessionFlushes, computeCutoff } from './sessionWindow';
import { materializeSession } from './materializeSession';

const LAMBDA_TIMEOUT_SEC = 120;                       // keep in sync with crm-api/resource.ts
const LEASE_MS = Math.max(2 * LAMBDA_TIMEOUT_SEC, 300) * 1000;
const DEFAULT_MAX_SESSIONS = 200;                     // per-invocation safety cap
const MAX_DISCOVERY_PAGES = 50;

// Rollup run state — lives inside SweepState.cursor (spec §3 state shape).
type RollupCursor = {
  watermark?: string;                                  // last COMPLETED run's frozen cutoff
  activeRunCutoff?: string | null;                     // frozen window end for an in-flight run
  pageCursor?: Record<string, unknown> | null;         // discovery GSI LastEvaluatedKey
  pendingSessionIds?: string[];                        // discovered-but-unprocessed backlog
};
export interface RollupArgs { limit?: number; maxSessions?: number; cursor?: Record<string, unknown>; }

export async function rollupAnalyticsSessions(args: RollupArgs): Promise<{ summary: Record<string, unknown> }> {
  const counters: Record<string, number> = { discovered: 0, closed: 0, emitted: 0, belowThreshold: 0, skipped: 0, skippedBots: 0, bridgeResolved: 0, priorResolved: 0, unresolved: 0, errors: 0 };
  try {
    const nowIso = new Date().toISOString();
    const lease = await acquireLease('analytics', 'sessions', LAMBDA_TIMEOUT_SEC, nowIso);
    if (!lease) return { summary: { skipped: true } };
    const state = await readState('analytics', 'sessions');
    const cur: RollupCursor = { ...(state.cursor as RollupCursor | undefined), ...(args.cursor as RollupCursor | undefined) };
    // Freeze the window: an in-flight run keeps its cutoff; a fresh run pins cutoff = now − 30min.
    const cutoff = cur.activeRunCutoff ?? computeCutoff(nowIso);
    const watermark = cur.watermark ?? cutoff;         // go-live: forward-only from first cron fire
    let pageCursor = cur.pageCursor ?? undefined;
    let pending = [...(cur.pendingSessionIds ?? [])];
    const maxSessions = args.maxSessions ?? DEFAULT_MAX_SESSIONS;
    const seen = new Set<string>(pending);
    let processed = 0;
    let discoveryDone = false;

    const persist = async (hasMore: boolean) => {
      const cursor: RollupCursor = hasMore
        ? { watermark, activeRunCutoff: cutoff, pageCursor: pageCursor ?? null, pendingSessionIds: pending }
        : { watermark: cutoff, activeRunCutoff: null, pageCursor: null, pendingSessionIds: [] };
      const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString();
      await persistPage('analytics', 'sessions', lease, { cursor: cursor as Record<string, unknown>, hasMore, counters: { ...counters }, leaseExpiresAt });
    };

    const processOne = async (sessionId: string): Promise<void> => {
      try {
        const flushes = await loadSessionFlushes(sessionId);
        if (!isSessionClosed(flushes, nowIso)) return;               // still open — later flushes rediscover it
        counters.closed += 1;
        const r = await materializeSession({ sessionId, nowIso });
        if (r.outcome === 'emitted') counters.emitted += 1;
        else if (r.outcome === 'below_threshold') counters.belowThreshold += 1;
        else if (r.outcome === 'skipped') counters.skipped += 1;
        if (r.outcome === 'emitted') {
          if (r.resolutionSource === 'bridge') counters.bridgeResolved += 1;
          else if (r.resolutionSource === 'prior') counters.priorResolved += 1;
          else counters.unresolved += 1;
        }
      } catch (err) {
        counters.errors += 1;
        console.error(JSON.stringify({ event: 'crm.analytics.rollup.session_error', sessionId, error: err instanceof Error ? err.message : String(err) }));
      }
    };

    for (let page = 0; page < MAX_DISCOVERY_PAGES; page++) {
      // Drain the backlog BEFORE reading the next discovery page (spec §3.1).
      while (pending.length > 0) {
        if (processed >= maxSessions) { await persist(true); return { summary: { ...counters, hasMore: true } }; }
        const sid = pending.shift()!;
        processed += 1;
        await processOne(sid);
      }
      if (discoveryDone) break;
      const { sessionIds, skippedBots, lastKey } = await discoverFlushPage({ watermark, cutoff, startKey: pageCursor });
      for (const sid of sessionIds) if (!seen.has(sid)) { seen.add(sid); pending.push(sid); }
      counters.discovered += sessionIds.filter(Boolean).length;
      counters.skippedBots += skippedBots ?? 0;
      pageCursor = lastKey;
      if (!lastKey) discoveryDone = true;
      await persist(true);                                            // durable progress each page
    }

    if (pending.length > 0 || !discoveryDone) {                       // page budget exhausted mid-run
      await persist(true);
      console.log(JSON.stringify({ event: 'crm.analytics.rollup.summary', ...counters, hasMore: true }));
      return { summary: { ...counters, hasMore: true } };
    }

    // Complete: advance the watermark to the frozen cutoff, clear active run fields, and release only
    // the lease fields. Unlike sweep passes, analytics must preserve the durable watermark between runs.
    await persist(false);
    await releaseLeaseKeepCursor('analytics', 'sessions', lease, { lastSummary: { ...counters, watermark: cutoff } });
    console.log(JSON.stringify({ event: 'crm.analytics.rollup.summary', ...counters, hasMore: false }));
    return { summary: { ...counters, hasMore: false } };
  } catch (err) {
    console.error(JSON.stringify({ event: 'crm.analytics.rollup.failed', error: err instanceof Error ? err.message : String(err) }));
    return { summary: { failed: true, error: err instanceof Error ? err.message : String(err), ...counters } };
  }
}
```
- [ ] **Step 4: Run to verify pass** — `npx vitest run amplify/functions/crm-api/lib/analytics/rollupAnalyticsSessions.test.ts amplify/functions/crm-api/lib/sweep/sweepState.test.ts` → PASS.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/analytics/rollupAnalyticsSessions.ts amplify/functions/crm-api/lib/analytics/rollupAnalyticsSessions.test.ts amplify/functions/crm-api/lib/sweep/sweepState.ts amplify/functions/crm-api/lib/sweep/sweepState.test.ts
git commit -m "feat(crm-api): analytics rollup driver — frozen-cutoff state machine (2C-analytics)"
```

---

## Task 10: `reResolveVisitorSessions` — bounded retro with resume

**Files:**
- Create: `amplify/functions/crm-api/lib/analytics/reResolveVisitorSessions.ts`
- Test: `amplify/functions/crm-api/lib/analytics/reResolveVisitorSessions.test.ts`

- [ ] **Step 1: Failing test**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const listMarkersMock = vi.fn(); const readRetro = vi.fn(); const writeRetro = vi.fn(); const clearRetro = vi.fn();
vi.mock('./sessionMarkers', () => ({
  listMarkers: (...a: unknown[]) => listMarkersMock(...a), readRetroState: (v: string) => readRetro(v),
  writeRetroState: (...a: unknown[]) => writeRetro(...a), clearRetroState: (v: string) => clearRetro(v),
}));
const materialize = vi.fn();
vi.mock('./materializeSession', () => ({ materializeSession: (o: unknown) => materialize(o) }));
import { reResolveVisitorSessions } from './reResolveVisitorSessions';
beforeEach(() => { [listMarkersMock, readRetro, writeRetro, clearRetro, materialize].forEach((m) => m.mockReset()); readRetro.mockResolvedValue(null); });

const M = (sid: string, status: string) => ({ sessionId: sid, resolutionStatus: status, resolvedOrgId: null, emittedAt: 'x' });

describe('reResolveVisitorSessions', () => {
  it('re-materializes ONLY unresolved markers with forceReemit', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved'), M('s-2', 'resolved'), M('s-3', 'below_threshold')] });
    materialize.mockResolvedValue({ outcome: 'emitted', resolvedOrgId: 'lab.edu' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(materialize).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-1', forceReemit: true }));
    expect(out.summary).toMatchObject({ examined: 3, reemitted: 1 });
    expect(clearRetro).toHaveBeenCalledWith('v-1');   // finished clean → no stale resume state
  });
  it('persists RETRO#STATE when the marker query has more pages than the cap allows', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved'), M('s-2', 'unresolved')], lastKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-2' } });
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1', maxSessions: 2 });
    expect(writeRetro).toHaveBeenCalledWith('v-1', { cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-2' } });
    expect(out.summary).toMatchObject({ hasMore: true });
  });
  it('when maxSessions is smaller than a page, queries only the remaining allowance and resumes after the last processed marker', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved')], lastKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    materialize.mockResolvedValue({ outcome: 'emitted' });
    const out = await reResolveVisitorSessions({ visitorId: 'v-1', maxSessions: 1 });
    expect(listMarkersMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ limit: 1 }));
    expect(writeRetro).toHaveBeenCalledWith('v-1', { cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-1' } });
    expect(out.summary).toMatchObject({ hasMore: true });
  });
  it('resumes from persisted RETRO#STATE', async () => {
    readRetro.mockResolvedValueOnce({ cursor: { PK: 'VISITOR#v-1', SK: 'SESSION#s-5' } });
    listMarkersMock.mockResolvedValueOnce({ markers: [] });
    await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(listMarkersMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ startKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-5' } }));
  });
  it('guards a blank visitorId (no-op)', async () => {
    const out = await reResolveVisitorSessions({ visitorId: '' });
    expect(out.summary).toMatchObject({ skipped: true });
    expect(listMarkersMock).not.toHaveBeenCalled();
  });
  it('isolates a per-session failure and continues', async () => {
    listMarkersMock.mockResolvedValueOnce({ markers: [M('s-1', 'unresolved'), M('s-2', 'unresolved')] });
    materialize.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ outcome: 'emitted' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await reResolveVisitorSessions({ visitorId: 'v-1' });
    expect(out.summary).toMatchObject({ errors: 1, reemitted: 1 });
    errSpy.mockRestore();
  });
});
```
- [ ] **Step 2: Run to verify fail** — module not found.
- [ ] **Step 3: Implement** — `reResolveVisitorSessions.ts`:
```typescript
import { listMarkers, readRetroState, writeRetroState, clearRetroState } from './sessionMarkers';
import { materializeSession } from './materializeSession';

const DEFAULT_MAX_SESSIONS = 200;   // a session ≈ one query + a few GetItems + emit — hundreds fit in 120s
const PAGE_LIMIT = 100;

export interface RetroArgs { visitorId: string; startSessionSk?: string; maxSessions?: number; }

// Spec §4: bounded to ONE visitor's markers; re-runs the shared materialize path with forceReemit
// so an unresolved session re-emits under its deterministic id now that the bridge exists.
export async function reResolveVisitorSessions(args: RetroArgs): Promise<{ summary: Record<string, unknown> }> {
  if (!args.visitorId) return { summary: { skipped: true } };
  const counters: Record<string, number> = { examined: 0, reemitted: 0, errors: 0 };
  const nowIso = new Date().toISOString();
  const max = args.maxSessions ?? DEFAULT_MAX_SESSIONS;
  if (max <= 0) return { summary: { skipped: true, hasMore: true } };

  const resume = await readRetroState(args.visitorId);
  let startKey: Record<string, unknown> | undefined = resume?.cursor
    ?? (args.startSessionSk ? { PK: `VISITOR#${args.visitorId}`, SK: args.startSessionSk } : undefined);

  let processed = 0;
  do {
    const remaining = max - processed;
    const { markers, lastKey } = await listMarkers(args.visitorId, { limit: Math.min(PAGE_LIMIT, remaining), startKey });
    for (const m of markers) {
      counters.examined += 1;
      if (m.resolutionStatus !== 'unresolved') continue;   // skip resolved + below_threshold (spec §4)
      processed += 1;
      try {
        const r = await materializeSession({ sessionId: m.sessionId, nowIso, forceReemit: true });
        if (r.outcome === 'emitted') counters.reemitted += 1;
      } catch (err) {
        counters.errors += 1;
        console.error(JSON.stringify({ event: 'crm.analytics.retro.session_error', sessionId: m.sessionId, error: err instanceof Error ? err.message : String(err) }));
      }
    }
    if (lastKey && processed >= max) {
      await writeRetroState(args.visitorId, { cursor: lastKey });
      console.warn(JSON.stringify({ event: 'crm.analytics.retro.truncated', visitorId: args.visitorId }));
      return { summary: { ...counters, hasMore: true } };
    }
    startKey = lastKey;
  } while (startKey);

  await clearRetroState(args.visitorId);
  console.log(JSON.stringify({ event: 'crm.analytics.retro.summary', visitorId: args.visitorId, ...counters }));
  return { summary: { ...counters, hasMore: false } };
}
```
- [ ] **Step 4: Run to verify pass** — 6 tests.
- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/analytics/reResolveVisitorSessions.ts amplify/functions/crm-api/lib/analytics/reResolveVisitorSessions.test.ts
git commit -m "feat(crm-api): bounded retro-resolve with RETRO#STATE resume (2C-analytics)"
```

---

## Task 11: `backfillVisitorBridge` + the three handler actions

**Files:**
- Create: `amplify/functions/crm-api/lib/analytics/backfillVisitorBridge.ts` (+ test)
- Modify: `amplify/functions/crm-api/handler.ts` (+ append to `handler.test.ts`)

- [ ] **Step 1: Failing test for the backfill** — `backfillVisitorBridge.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const upsert = vi.fn();
vi.mock('../../../../lib/crm/visitor-bridge', () => ({ upsertVisitorBridge: (...a: unknown[]) => upsert(...a) }));
import { backfillVisitorBridge } from './backfillVisitorBridge';
beforeEach(() => { mockSend.mockReset(); upsert.mockReset(); upsert.mockResolvedValue({ created: true, orgUpgraded: false }); });

describe('backfillVisitorBridge', () => {
  it('scans RFQ/LEAD METAs with visitorId and upgrade-writes bridges; returns cursor', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { PK: 'RFQ#r-1', SK: 'META', visitorId: 'v-1', matchedOrgId: 'lab.edu', email: 'a@lab.edu', submittedAt: 't1' },
      { PK: 'LEAD#l-1', SK: 'META', visitorId: 'v-2', matchedOrgId: '', email: 'b@x.com', submittedAt: 't2' },
    ], LastEvaluatedKey: { k: 1 } });
    const out = await backfillVisitorBridge({});
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.FilterExpression).toContain('begins_with(PK, :rfq) OR begins_with(PK, :lead)');
    expect(scan.FilterExpression).toContain('attribute_exists(visitorId)');
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][2]).toMatchObject({ visitorId: 'v-1', matchedOrgId: 'lab.edu', sourceEntityType: 'rfq', sourceEntityId: 'r-1' });
    expect(upsert.mock.calls[1][2]).toMatchObject({ visitorId: 'v-2', matchedOrgId: null, sourceEntityType: 'lead' });
    expect(out).toMatchObject({ processed: 2, hasMore: true, nextCursor: { k: 1 } });
  });
  it('NO retro fire during backfill (spec §5 default)', async () => {
    // structural: the module imports upsertVisitorBridge only — no invokeCrmAction import exists.
    mockSend.mockResolvedValueOnce({ Items: [] });
    const out = await backfillVisitorBridge({});
    expect(out).toMatchObject({ processed: 0, hasMore: false });
  });
});
```
- [ ] **Step 2: Implement** — `backfillVisitorBridge.ts`:
```typescript
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { upsertVisitorBridge } from '../../../../lib/crm/visitor-bridge';

// One-time bridge backfill (spec §5): paginated scan of RFQ/LEAD METAs that already carry a
// visitorId → upgrade-only bridge writes. NO retro fire by default — markers only exist for
// post-go-live sessions (forward-only), so there is nothing to re-resolve yet.
export async function backfillVisitorBridge(args: { cursor?: Record<string, unknown>; limit?: number }): Promise<{ processed: number; upgraded: number; hasMore: boolean; nextCursor?: Record<string, unknown> }> {
  const res = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME(),
    FilterExpression: '(begins_with(PK, :rfq) OR begins_with(PK, :lead)) AND SK = :meta AND attribute_exists(visitorId)',
    ExpressionAttributeValues: { ':rfq': 'RFQ#', ':lead': 'LEAD#', ':meta': 'META' },
    ExclusiveStartKey: args.cursor, Limit: args.limit ?? 200,
  }));
  let processed = 0, upgraded = 0;
  const send = (c: unknown) => docClient.send(c as never) as never;
  for (const row of (res.Items ?? []) as Array<Record<string, unknown>>) {
    const pk = row.PK as string;
    const isRfq = pk.startsWith('RFQ#');
    const r = await upsertVisitorBridge(send, TABLE_NAME(), {
      visitorId: (row.visitorId as string) ?? '',
      matchedOrgId: ((row.matchedOrgId as string) || null),
      email: (row.email as string) ?? null,
      sourceEntityType: isRfq ? 'rfq' : 'lead',
      sourceEntityId: pk.slice(isRfq ? 4 : 5),
      now: (row.submittedAt as string) ?? new Date().toISOString(),
    });
    processed += 1;
    if (r.created || r.orgUpgraded) upgraded += 1;
  }
  return { processed, upgraded, hasMore: !!res.LastEvaluatedKey, nextCursor: res.LastEvaluatedKey as Record<string, unknown> | undefined };
}
```
- [ ] **Step 3: Failing handler tests** — append to `crm-api/handler.test.ts` (sibling hoisted mocks, same pattern as the reconcileSweep block):
```typescript
const mockAnalytics = vi.hoisted(() => ({ rollup: vi.fn(), retro: vi.fn(), backfill: vi.fn() }));
vi.mock('./lib/analytics/rollupAnalyticsSessions', () => ({ rollupAnalyticsSessions: (a: unknown) => mockAnalytics.rollup(a) }));
vi.mock('./lib/analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (a: unknown) => mockAnalytics.retro(a) }));
vi.mock('./lib/analytics/backfillVisitorBridge', () => ({ backfillVisitorBridge: (a: unknown) => mockAnalytics.backfill(a) }));

describe('crm-api 2C-analytics actions', () => {
  it('routes rollupAnalyticsSessions with limit/cursor', async () => {
    mockAnalytics.rollup.mockResolvedValueOnce({ summary: {} });
    await handler({ action: 'rollupAnalyticsSessions', limit: 50 } as never);
    expect(mockAnalytics.rollup).toHaveBeenCalledWith({ limit: 50, cursor: undefined });
  });
  it('routes reResolveVisitorSessions with visitorId/startSessionSk', async () => {
    mockAnalytics.retro.mockResolvedValueOnce({ summary: {} });
    await handler({ action: 'reResolveVisitorSessions', visitorId: 'v-1' } as never);
    expect(mockAnalytics.retro).toHaveBeenCalledWith({ visitorId: 'v-1', startSessionSk: undefined });
  });
  it('routes backfillVisitorBridge with cursor/limit', async () => {
    mockAnalytics.backfill.mockResolvedValueOnce({ processed: 0, hasMore: false });
    await handler({ action: 'backfillVisitorBridge' } as never);
    expect(mockAnalytics.backfill).toHaveBeenCalledWith({ cursor: undefined, limit: undefined });
  });
});
```
- [ ] **Step 4: Implement handler wiring** — in `crm-api/handler.ts`, add imports:
```typescript
import { rollupAnalyticsSessions } from './lib/analytics/rollupAnalyticsSessions';
import { reResolveVisitorSessions } from './lib/analytics/reResolveVisitorSessions';
import { backfillVisitorBridge } from './lib/analytics/backfillVisitorBridge';
```
Widen `DirectInvokeEvent` (keep all existing fields):
```typescript
type DirectInvokeEvent = { action: string; args?: unknown; mode?: 'hot' | 'cold'; cursor?: Record<string, unknown>; limit?: number; visitorId?: string; startSessionSk?: string };
```
Add to the `actions` map (fields read directly off `e` — house style, no inline casts):
```typescript
  rollupAnalyticsSessions: async (e) => rollupAnalyticsSessions({ limit: e.limit, cursor: e.cursor }),
  reResolveVisitorSessions: async (e) => reResolveVisitorSessions({ visitorId: e.visitorId ?? '', startSessionSk: e.startSessionSk }),
  backfillVisitorBridge: async (e) => backfillVisitorBridge({ cursor: e.cursor, limit: e.limit }),
```
- [ ] **Step 5: Run** — `npx vitest run amplify/functions/crm-api/lib/analytics/backfillVisitorBridge.test.ts amplify/functions/crm-api/handler.test.ts` → PASS (existing handler tests stay green).
- [ ] **Step 6: Commit**
```bash
git add amplify/functions/crm-api/lib/analytics/backfillVisitorBridge.ts amplify/functions/crm-api/lib/analytics/backfillVisitorBridge.test.ts amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(crm-api): 2C-analytics actions — rollup, retro, bridge backfill (2C-analytics)"
```

---

## Task 12: Backend wiring — grant + env + cron

**Files:**
- Modify: `amplify/backend.ts`

Typecheck-gated (no unit test). Two edits:

- [ ] **Step 1: Grant + env** — immediately after the existing server-track analytics wiring (`backend.ts:204-206`, `const analyticsEventTable = backend.data.resources.tables['AnalyticsEvent']` already in scope there), add:
```typescript
// 2C-analytics: crm-api reads raw analytics (page_time_flush / pv- rows) for the session rollup.
analyticsEventTable.grantReadData(backend.crmApi.resources.lambda);
backend.crmApi.addEnvironment('ANALYTICS_EVENT_TABLE', analyticsEventTable.tableName);
```
NOTE: `grantReadData` (READ-ONLY) — the rollup never writes analytics rows.
- [ ] **Step 2: Cron** — inside/alongside the existing CRM sweep cron block (`if (!isSandbox)` with `crmApiStack = Stack.of(backend.crmApi.resources.lambda)` — REUSE that const; it exists from the #229 hotfix), add:
```typescript
    // 2C-analytics: session rollup every 30 min (offset from the sweep's */30 by :15 to avoid
    // co-scheduling two 120s-capped invocations of the same Lambda).
    new Rule(crmApiStack, 'CrmAnalyticsRollupRule', {
        schedule: Schedule.cron({ minute: '15/30', hour: '*', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
            event: RuleTargetInput.fromObject({ action: 'rollupAnalyticsSessions' }),
        })],
    });
```
(Same stack as the target Lambda — the #229 rule. If the sweep block declared the stack inline rather than as a const, hoist `const crmApiStack = Stack.of(backend.crmApi.resources.lambda);` once and use it for all three Rules.)
- [ ] **Step 3: Typecheck** — `npx tsc --noEmit -p amplify/tsconfig.json` → exit 0.
- [ ] **Step 4: PRE-MERGE VERIFY (GSI names)** — with AWS creds (`aws sso login` if needed):
```bash
aws dynamodb describe-table --table-name <deployed AnalyticsEvent table name> \
  --query 'Table.GlobalSecondaryIndexes[].IndexName'
```
Expected to include `analyticsEventsByEventTypeAndTimestamp` and `analyticsEventsBySessionIdAndTimestamp`. If the names differ, update the two constants in `sessionWindow.ts` + its test. If creds are unavailable, flag this in the task report — it becomes a merge-gate checklist item (a wrong name also surfaces as `errors` in the first cron's summary).
- [ ] **Step 5: Commit**
```bash
git add amplify/backend.ts
git commit -m "feat(backend): crm-api analytics read grant + session rollup cron (2C-analytics)"
```

---

## Task 13: Green-bar + checkpoint

- [ ] **Step 1:** `npx vitest run amplify/functions/crm-api amplify/functions/submit-rfq amplify/functions/submit-lead amplify/lib/crm` → ALL PASS.
- [ ] **Step 2:** `npx tsc --noEmit -p amplify/tsconfig.json` → exit 0. `npx tsc --noEmit` (frontend) → exit 0.
- [ ] **Step 3:** `npx eslint amplify/functions/crm-api/lib/analytics amplify/lib/crm/visitor-bridge.ts amplify/functions/crm-api/handler.ts src/components/common/QuoteModal.tsx src/pages/RFQPage.tsx` → exit 0.
- [ ] **Step 4: Checkpoint** (targeted — NEVER `git add -A`; `docs/seo/ninescrolls-news-task-prompt.md` stays untracked):
```bash
git status
git add amplify/functions/crm-api amplify/functions/submit-rfq amplify/functions/submit-lead amplify/lib/crm amplify/backend.ts src/components/common/QuoteModal.tsx src/pages/RFQPage.tsx docs/superpowers/plans/2026-07-01-customer-360-timeline-2c-analytics.md
git commit -m "chore(crm-api): 2C-analytics complete — site_visit_session rollup live" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage:** §1 bridge (T3/T4) + RFQ capture (T1/T2) + backfill (T11) ✓; §2.1 provenance/upgrade rules (T3) ✓; §2.2 marker incl. inputHash/forceReemit semantics (T6/T8) ✓; §2.3 payload + signal sources + three-tier resolveInput with `sourceEntityType:'analytics'` sentinel match (T8) ✓; §3 frozen `activeRunCutoff`/`pageCursor`/`pendingSessionIds` state machine, watermark-advance-only-on-complete, summary log (T9) ✓; §4 retro forceReemit + RETRO#STATE + bounds (T10) ✓; §5 change surface (T1-T12) + no-retro-in-backfill default (T11) ✓; §6 verification tasks — RESOLVED during planning (header: emit + resolver need NO changes) ✓; edge cases: bots (T7/T8), no-sessionId (T7), no-visitorId-still-emits-no-marker (T8 test), VISITOR#undefined guards (T3/T6) ✓; §7 test layers per task + T13 green-bar ✓.

**Placeholder scan:** Tasks 2 and 4 contain test SKELETONS with instructions to write real assertions against each suite's established mock style — deliberate (the suites' internal helpers can't be safely reproduced here without reading them; the behaviors to assert are fully specified). No TBD/TODO elsewhere; all impl code complete.

**Type consistency:** `upsertVisitorBridge(send, table, input) → {created, orgUpgraded}` (T3) used in T4/T11. `SessionMarker` (T6) consumed by T8/T10. `discoverFlushPage/loadSessionFlushes/isSessionClosed/computeCutoff/ANALYTICS_TABLE/FlushRow` (T7) consumed by T8/T9. `materializeSession({sessionId, nowIso, forceReemit?}) → {outcome, resolvedOrgId?, resolutionSource?}` (T8) consumed by T9/T10. `releaseLeaseKeepCursor` added in T9 alongside the widened unions from T5. Handler actions (T11) match module signatures.

**Known judgment calls (documented, not defects):** marker `resolutionStatus` is conservative because `emitTimelineEvent` does not return resolver outcome, so email-only bridge sessions remain marker-unresolved until a concrete org is known (T8 note); cron offset `:15/30` avoids co-scheduling with the sweep; GSI names are convention-derived constants with a pre-merge verify step (T12).
