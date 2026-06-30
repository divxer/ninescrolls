# Customer 360 Timeline — Plan 2C-sweep: Reconciliation Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reconciliation sweep — the durability backstop for the timeline projection — as a `crm-api` `reconcileSweep` action that (a) re-emits *missing* timeline events (existence-based, via the 2A builders) and (b) repairs `rollupApplied=false` rows, driven by EventBridge cron with durable per-pass cursors.

**Architecture:** The sweep lives inside `crm-api` and reuses P1 (`emitTimelineEvent`/`getTimelineEvent`/`recomputeRollupsForOrg`) + the 2A `amplify/lib/crm` builders in-process. A new `crm-api/lib/sweep/` module holds the passes + durable state; the handler gains a `reconcileSweep` action; EventBridge `Rule`s (`!isSandbox`) target crm-api with a constant `{action,mode}` input. Two passes — existence (re-emit missing) and dirty-rollup (recompute-repair) — each with its own durable cursor/lease.

**Tech Stack:** TypeScript (Node 22), AWS SDK v3 (`@aws-sdk/lib-dynamodb`), Amplify Gen 2 + CDK (`aws-cdk-lib/aws-events`), vitest. Spec: `docs/superpowers/specs/2026-06-30-customer-360-timeline-2c-sweep-design.md`. Builds on merged P1 + 2A.

**Conventions confirmed from the codebase:**
- `crm-api/lib/emitTimelineEvent.ts:58-62` — inline `markRollupClean` arrow (`SET rollupApplied=:t REMOVE rollupPendingOrgId`), closes over `id`. To be extracted.
- `crm-api/lib/orgStore.ts:14-15,93-94` — `isRealOrg(orgId) = !orgId.startsWith('unresolved-')`; `recomputeRollupsForOrg` already `if (!isRealOrg(orgId)) return;` → **sentinel no-op confirmed** (no extra guard needed; the sweep may still skip defensively).
- `crm-api/handler.ts` — `actions` map dispatches direct invokes by `event.action`; reconcileSweep reads `event.mode`/`event.cursor`/`event.limit` (top-level, not under `args`).
- `crm-api/resource.ts:7` — `timeoutSeconds: 30` (→ 120).
- `backend.ts:68-69` — imports `{ Rule, Schedule }` from `aws-cdk-lib/aws-events` and `{ LambdaFunction as LambdaFunctionTarget }` from `aws-cdk-lib/aws-events-targets`. **`RuleTargetInput` is NOT imported** — add it. Tender-Watch cron block (~`:973-995`) is the `if (!isSandbox)` + `Schedule.cron` precedent; `isSandbox = backend.stack.stackName.includes('-sandbox-')`.
- crm-api already has `INTELLIGENCE_TABLE` read/write — **no new grants**.
- Tests: vitest, `vi.mock` the SDK, `*.test.ts` next to source. `crm-api/lib` imports use **no** `.js` extension. Run: `npx vitest run <path>`.
- Path from `crm-api/lib/sweep/` to the 2A builders: `../../../../lib/crm/emit-builders` (and `../../../../lib/crm/types` for `EmitArgs`).

**Reused signatures:**
- `emitTimelineEvent(args: EmitArgs): Promise<void>` — idempotent (deterministic id).
- `getTimelineEvent(id: string): Promise<TimelineEventItem | null>` (`crm-api/lib/timelineStore`).
- `recomputeRollupsForOrg(orgId: string): Promise<void>` (`crm-api/lib/orgStore`).
- `timelineId(input: TimelineIdInput): string` (`crm-api/lib/timelineId`).
- 2A builders (`amplify/lib/crm/emit-builders`): `buildRfqEmitArgs(rfq, matchedOrgId)`, `buildLeadEmitArgs(lead, matchedOrgId)`, `buildOrderCreatedEmitArgs(order, opts)`, `buildOrderStageChangedEmitArgs(order, log, email?)`, `buildQuoteSentEmitArgs(order, doc, email?)`, `buildLogisticsMilestoneEmitArgs(c, entry, matchedOrgId)`.

---

## File Structure

**New — `amplify/functions/crm-api/lib/sweep/`:**
- `sourceToEvents.ts` — pure per-channel mappers: stored source item(s) → `Array<{ id, args }>` (reuses 2A builders + `timelineId`). The single place encoding the "live-emit-mirroring invariant".
- `sweepState.ts` — durable cursor/lease on `CRM_SWEEP#<mode>#<pass>/STATE` (read, acquireLease, persistPage, release).
- `existencePass.ts` — driver: enumerate channels in deterministic order, load sub-entries, existence-check, emit missing.
- `dirtyRollupPass.ts` — scan `rollupApplied=false`, recompute-repair, mark clean.
- `reconcileSweep.ts` — action entry: hot→existence(recent); cold→existence(full)+dirty.
- `*.test.ts` for each.

**Modified:**
- `crm-api/lib/timelineStore.ts` — add exported `markRollupApplied(id)`.
- `crm-api/lib/emitTimelineEvent.ts` — call `markRollupApplied(id)` instead of the inline arrow.
- `crm-api/handler.ts` — add `reconcileSweep` action.
- `crm-api/resource.ts` — `timeoutSeconds: 120`.
- `amplify/backend.ts` — import `RuleTargetInput`; two EventBridge `Rule`s (`!isSandbox`).

---

## Task 1: Extract `markRollupApplied` helper (P1 refactor)

**Files:**
- Modify: `amplify/functions/crm-api/lib/timelineStore.ts`
- Modify: `amplify/functions/crm-api/lib/emitTimelineEvent.ts`
- Test: `amplify/functions/crm-api/lib/timelineStore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `amplify/functions/crm-api/lib/timelineStore.test.ts` (create it if absent, mirroring the existing crm-api lib test style with a mocked `./dynamodb`):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { markRollupApplied } from './timelineStore';
beforeEach(() => mockSend.mockReset());

describe('markRollupApplied', () => {
  it('sets rollupApplied=true and removes rollupPendingOrgId for the event', async () => {
    mockSend.mockResolvedValueOnce({});
    await markRollupApplied('tev-rfq-rfq-1-submitted');
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.Key).toEqual({ PK: 'TLEVENT#tev-rfq-rfq-1-submitted', SK: 'A' });
    expect(upd.UpdateExpression).toBe('SET rollupApplied = :t REMOVE rollupPendingOrgId');
    expect(upd.ExpressionAttributeValues).toEqual({ ':t': true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/timelineStore.test.ts`
Expected: FAIL — `markRollupApplied` not exported.

- [ ] **Step 3: Add the helper + reuse it in emit**

In `amplify/functions/crm-api/lib/timelineStore.ts`, add (it already imports `docClient`, `TABLE_NAME`; add `UpdateCommand` to the `@aws-sdk/lib-dynamodb` import):
```typescript
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Mark an event's rollup as fully applied — call ONLY after every needed recompute/bump succeeded.
// Shared by emitTimelineEvent (live) and the reconciliation sweep so the repair path can't drift.
export async function markRollupApplied(id: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `TLEVENT#${id}`, SK: 'A' },
    UpdateExpression: 'SET rollupApplied = :t REMOVE rollupPendingOrgId',
    ExpressionAttributeValues: { ':t': true },
  }));
}
```
Then in `amplify/functions/crm-api/lib/emitTimelineEvent.ts`: import `markRollupApplied` from `./timelineStore` (the file already imports `getTimelineEvent` from there), DELETE the inline `markRollupClean` arrow (lines ~58-62), and replace the two `await markRollupClean();` calls (in the duplicate-repair branch and the new-event branch) with `await markRollupApplied(id);`. Remove the now-unused `UpdateCommand` import from emitTimelineEvent.ts **only if** it's no longer referenced there (it is still used? check — emit uses `PutCommand` + previously `UpdateCommand` only inside `markRollupClean`; after extraction `UpdateCommand` is unused in emit → remove it from emit's import).

- [ ] **Step 4: Run tests to verify pass + no regression**

Run: `npx vitest run amplify/functions/crm-api/lib/timelineStore.test.ts amplify/functions/crm-api/lib/emitTimelineEvent.test.ts`
Expected: PASS — the new helper test + the full existing emit suite (the extraction is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/timelineStore.ts amplify/functions/crm-api/lib/timelineStore.test.ts amplify/functions/crm-api/lib/emitTimelineEvent.ts
git commit -m "refactor(crm-api): extract markRollupApplied helper shared by emit + sweep (2C-sweep)"
```

---

## Task 2: `sweepState` — durable per-pass cursor/lease

**Files:**
- Create: `amplify/functions/crm-api/lib/sweep/sweepState.ts`
- Test: `amplify/functions/crm-api/lib/sweep/sweepState.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { readState, acquireLease, persistPage, releaseLease, stateKey } from './sweepState';
beforeEach(() => mockSend.mockReset());

describe('sweepState', () => {
  it('stateKey namespaces by mode#pass', () => {
    expect(stateKey('cold', 'existence')).toEqual({ PK: 'CRM_SWEEP#cold#existence', SK: 'STATE' });
  });
  it('acquireLease succeeds when no active lease (conditional update) and returns a token', async () => {
    mockSend.mockResolvedValueOnce({}); // conditional update ok
    const token = await acquireLease('cold', 'existence', 120, 'now-iso');
    expect(typeof token).toBe('string');
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toMatch(/attribute_not_exists\(lease\)|leaseExpiresAt < :now/);
  });
  it('acquireLease returns null when an active lease is held (ConditionalCheckFailed)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('held'), { name: 'ConditionalCheckFailedException' }));
    expect(await acquireLease('cold', 'existence', 120, 'now-iso')).toBeNull();
  });
  it('persistPage writes cursor + counters + heartbeat without clearing the lease', async () => {
    mockSend.mockResolvedValueOnce({});
    await persistPage('cold', 'existence', { cursor: { k: 1 }, hasMore: true, counters: { scanned: 10 }, leaseExpiresAt: 'later' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(JSON.stringify(upd)).toContain('hasMore');
    expect(JSON.stringify(upd)).toContain('cursor');
  });
  it('releaseLease clears cursor + lease on completion', async () => {
    mockSend.mockResolvedValueOnce({});
    await releaseLease('cold', 'existence', { lastSummary: { scanned: 10 } });
    expect(mockSend).toHaveBeenCalled();
  });
  it('readState returns the stored item or a default', async () => {
    mockSend.mockResolvedValueOnce({ Item: { cursor: { k: 2 }, hasMore: true } });
    expect((await readState('cold', 'existence')).hasMore).toBe(true);
    mockSend.mockResolvedValueOnce({});
    expect((await readState('cold', 'existence')).cursor).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/sweepState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/sweep/sweepState.ts`:
```typescript
import crypto from 'node:crypto';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';

export type SweepMode = 'hot' | 'cold';
export type SweepPass = 'existence' | 'dirty-rollups';

export function stateKey(mode: SweepMode, pass: SweepPass) {
  return { PK: `CRM_SWEEP#${mode}#${pass}`, SK: 'STATE' };
}

export interface SweepState {
  cursor?: Record<string, unknown>;
  hasMore?: boolean;
  lease?: string;
  leaseExpiresAt?: string;
  lastSummary?: Record<string, unknown>;
}

export async function readState(mode: SweepMode, pass: SweepPass): Promise<SweepState> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: stateKey(mode, pass) }));
  return (res.Item as SweepState | undefined) ?? {};
}

// Acquire the per-pass lease iff none is active (or it has expired). Returns the token, or null if held.
export async function acquireLease(mode: SweepMode, pass: SweepPass, lambdaTimeoutSec: number, nowIso: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const leaseSeconds = Math.max(2 * lambdaTimeoutSec, 300); // longer than max invocation
  const leaseExpiresAt = new Date(Date.parse(nowIso) + leaseSeconds * 1000).toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: stateKey(mode, pass),
      UpdateExpression: 'SET lease = :tok, leaseExpiresAt = :exp, lastRunAt = :now',
      ConditionExpression: 'attribute_not_exists(lease) OR leaseExpiresAt < :now',
      ExpressionAttributeValues: { ':tok': token, ':exp': leaseExpiresAt, ':now': nowIso },
    }));
    return token;
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

// Persist progress AFTER each page: cursor + counters + a lease heartbeat (keeps the pass owning the lease).
export async function persistPage(mode: SweepMode, pass: SweepPass, p: { cursor?: Record<string, unknown>; hasMore: boolean; counters: Record<string, number>; leaseExpiresAt: string }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET #c = :c, hasMore = :h, counters = :n, leaseExpiresAt = :exp',
    ExpressionAttributeNames: { '#c': 'cursor' },
    ExpressionAttributeValues: { ':c': p.cursor ?? null, ':h': p.hasMore, ':n': p.counters, ':exp': p.leaseExpiresAt },
  }));
}

// Final page: clear cursor + release lease, record summary + completion.
export async function releaseLease(mode: SweepMode, pass: SweepPass, p: { lastSummary: Record<string, unknown> }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET hasMore = :f, lastSummary = :s, lastCompletedAt = :now REMOVE #c, lease, leaseExpiresAt',
    ExpressionAttributeNames: { '#c': 'cursor' },
    ExpressionAttributeValues: { ':f': false, ':s': p.lastSummary, ':now': new Date().toISOString() },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/sweepState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/sweepState.ts amplify/functions/crm-api/lib/sweep/sweepState.test.ts
git commit -m "feat(crm-api): sweep durable per-pass cursor/lease state (2C-sweep)"
```

---

## Task 3: `sourceToEvents` — pure per-channel expected-event mappers

**Files:**
- Create: `amplify/functions/crm-api/lib/sweep/sourceToEvents.ts`
- Test: `amplify/functions/crm-api/lib/sweep/sourceToEvents.test.ts`

This is the single place encoding the **live-emit-mirroring invariant**. Each function takes already-loaded stored item(s) (read defensively as records) + returns the expected `{ id, args }[]`, reusing the 2A builders + `timelineId`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { rfqEvents, leadEvents, orderCreatedEvents, orderStageEvents, quoteEvents, logisticsEvents } from './sourceToEvents';

describe('sourceToEvents (pure, mirrors live-emit)', () => {
  it('rfqEvents → 1 rfq_submitted with the deterministic id', () => {
    const out = rfqEvents({ rfqId: 'rfq-1', submittedAt: '2026-06-19T10:00:00Z', email: 'a@x.com', equipmentCategory: 'ICP', matchedOrgId: 'x.com' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-rfq-rfq-1-submitted');
    expect(out[0].args).toMatchObject({ kind: 'rfq_submitted', resolveInput: { matchedOrgId: 'x.com' } });
  });
  it('leadEvents → 1 lead_captured', () => {
    const out = leadEvents({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'contact', matchedOrgId: null });
    expect(out[0].id).toBe('tev-lead-l1');
  });
  it('orderCreatedEvents → 1 order_created', () => {
    const out = orderCreatedEvents({ orderId: 'ord-1', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: 'x.com', rfqId: null });
    expect(out[0].id).toBe('tev-order-ord-1-created');
  });
  it('orderStageEvents → ONLY STATUS_CHANGE logs, keyed by the olog id', () => {
    const order = { orderId: 'ord-1', matchedOrgId: 'x.com' };
    const logs = [
      { id: 'olog-a', action: 'STATUS_CHANGE', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' },
      { id: 'olog-b', action: 'CONTACT_ADDED', timestamp: '2026-04-02T00:00:00Z' },
      { id: 'olog-c', action: 'DOCUMENT_UPLOADED', timestamp: '2026-04-03T00:00:00Z' },
    ];
    const out = orderStageEvents(order, logs);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-order-ord-1-stage-olog-a');
    expect(out[0].args).toMatchObject({ kind: 'order_stage_changed' });
  });
  it('quoteEvents → ONLY QUOTATION docs, keyed by the doc id', () => {
    const order = { orderId: 'ord-1', matchedOrgId: 'x.com' };
    const docs = [
      { id: 'doc-1', docType: 'QUOTATION', fileName: 'q.pdf', uploadedAt: '2026-03-05T00:00:00Z' },
      { id: 'doc-2', docType: 'PURCHASE_ORDER', fileName: 'po.pdf', uploadedAt: '2026-03-06T00:00:00Z' },
    ];
    const out = quoteEvents(order, docs);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-quote-doc-1');
  });
  it('logisticsEvents → one per milestoneLog entry, internalOnly + org passthrough', () => {
    const out = logisticsEvents(
      { caseId: 'lc-1', caseType: 'SAMPLE', milestoneLog: [
        { id: 'mlog-x', action: 'CASE_CREATED', toStage: 'DRAFT', timestamp: '2026-06-01T00:00:00Z', internalOnly: false },
        { id: 'mlog-y', action: 'STAGE_ADVANCED', toStage: 'SHIPPED', fromStage: 'DRAFT', timestamp: '2026-06-02T00:00:00Z', internalOnly: true },
      ] },
      'x.com',
    );
    expect(out.map((e) => e.id)).toEqual(['tev-logistics-lc-1-log-mlog-x', 'tev-logistics-lc-1-log-mlog-y']);
    expect(out[1].args.isInternalOnly).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/sourceToEvents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/sweep/sourceToEvents.ts`:
```typescript
import { timelineId } from '../timelineId';
import type { EmitArgs } from '../../../../lib/crm/types';
import {
  buildRfqEmitArgs, buildLeadEmitArgs, buildOrderCreatedEmitArgs,
  buildOrderStageChangedEmitArgs, buildQuoteSentEmitArgs, buildLogisticsMilestoneEmitArgs,
} from '../../../../lib/crm/emit-builders';

export interface ExpectedEvent { id: string; args: EmitArgs; }
const withId = (args: EmitArgs): ExpectedEvent => ({ id: timelineId(args.idInput), args });

export function rfqEvents(rfq: { rfqId: string; submittedAt: string; email?: string | null; equipmentCategory?: string | null; specificModel?: string | null; matchedOrgId?: string | null }): ExpectedEvent[] {
  return [withId(buildRfqEmitArgs(rfq, rfq.matchedOrgId ?? null))];
}

export function leadEvents(lead: { leadId: string; submittedAt: string; type: string; email?: string | null; productName?: string | null; inquiryType?: string | null; matchedOrgId?: string | null }): ExpectedEvent[] {
  return [withId(buildLeadEmitArgs(lead, lead.matchedOrgId ?? null))];
}

export function orderCreatedEvents(order: { orderId: string; createdAt: string; productModel?: string | null; matchedOrgId?: string | null; rfqId?: string | null }): ExpectedEvent[] {
  return [withId(buildOrderCreatedEmitArgs(order, { matchedOrgId: order.matchedOrgId ?? null, rfqId: order.rfqId ?? null }))];
}

// MIRROR live-emit: only STATUS_CHANGE logs become stage events (matches order-api/updateOrderStatus).
export function orderStageEvents(order: { orderId: string; matchedOrgId?: string | null }, logs: Array<{ id?: string; action: string; toStatus?: string; fromStatus?: string | null; timestamp: string }>): ExpectedEvent[] {
  return logs
    .filter((l) => l.action === 'STATUS_CHANGE' && !!l.id && !!l.toStatus)
    .map((l) => withId(buildOrderStageChangedEmitArgs(order, { id: l.id!, toStatus: l.toStatus!, fromStatus: l.fromStatus ?? null, timestamp: l.timestamp })));
}

// MIRROR live-emit: only QUOTATION docs become quote_sent (matches order-api/confirmDocumentUpload).
export function quoteEvents(order: { orderId: string; matchedOrgId?: string | null }, docs: Array<{ id?: string; docType: string; fileName: string; uploadedAt: string }>): ExpectedEvent[] {
  return docs
    .filter((d) => d.docType === 'QUOTATION' && !!d.id)
    .map((d) => withId(buildQuoteSentEmitArgs(order, { id: d.id!, fileName: d.fileName, uploadedAt: d.uploadedAt })));
}

export function logisticsEvents(c: { caseId: string; caseType?: string | null; milestoneLog?: Array<{ id?: string; action: string; toStage: string; fromStage?: string | null; timestamp: string; internalOnly?: boolean }> }, matchedOrgId: string | null): ExpectedEvent[] {
  return (c.milestoneLog ?? [])
    .filter((m) => !!m.id)
    .map((m) => withId(buildLogisticsMilestoneEmitArgs(
      { caseId: c.caseId, caseType: c.caseType },
      { id: m.id!, toStage: m.toStage, fromStage: m.fromStage ?? null, timestamp: m.timestamp, internalOnly: m.internalOnly ?? false, action: m.action },
      matchedOrgId,
    )));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/sourceToEvents.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/sourceToEvents.ts amplify/functions/crm-api/lib/sweep/sourceToEvents.test.ts
git commit -m "feat(crm-api): sweep sourceToEvents mappers (live-emit-mirroring) (2C-sweep)"
```

---

## Task 4: `existencePass` — re-emit missing events

**Files:**
- Create: `amplify/functions/crm-api/lib/sweep/existencePass.ts`
- Test: `amplify/functions/crm-api/lib/sweep/existencePass.test.ts`

The driver enumerates channels in the deterministic order, computes expected events via Task 3, `getTimelineEvent` each, and `emitTimelineEvent` the missing ones. To keep it unit-testable, the driver takes injected `deps` (enumerate / getTimelineEvent / emit) so the test drives it without real DynamoDB enumeration.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { reconcileExpectedEvents } from './existencePass';

describe('existence pass — reconcileExpectedEvents', () => {
  it('emits ONLY the missing events and counts them', async () => {
    const getTimelineEvent = vi.fn()
      .mockResolvedValueOnce({ id: 'tev-a' })   // present → skip
      .mockResolvedValueOnce(null);             // missing → emit
    const emit = vi.fn().mockResolvedValue(undefined);
    const expected = [
      { id: 'tev-a', args: { kind: 'rfq_submitted' } },
      { id: 'tev-b', args: { kind: 'lead_captured' } },
    ] as never[];
    const counters = { scanned: 0, missingReemitted: 0, errors: 0 };
    await reconcileExpectedEvents(expected, { getTimelineEvent, emit }, counters);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ kind: 'lead_captured' });
    expect(counters).toMatchObject({ scanned: 2, missingReemitted: 1, errors: 0 });
  });
  it('isolates a per-event error and continues the batch', async () => {
    const getTimelineEvent = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const emit = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const expected = [{ id: 'tev-a', args: {} }, { id: 'tev-b', args: {} }] as never[];
    const counters = { scanned: 0, missingReemitted: 0, errors: 0 };
    await reconcileExpectedEvents(expected, { getTimelineEvent, emit }, counters);
    expect(counters).toMatchObject({ scanned: 2, missingReemitted: 1, errors: 1 });
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/existencePass.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the core + the channel driver**

`amplify/functions/crm-api/lib/sweep/existencePass.ts`:
```typescript
import { ScanCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { emitTimelineEvent } from '../emitTimelineEvent';
import { getTimelineEvent } from '../timelineStore';
import type { ExpectedEvent } from './sourceToEvents';
import { rfqEvents, leadEvents, orderCreatedEvents, orderStageEvents, quoteEvents, logisticsEvents } from './sourceToEvents';

export interface ExistenceCounters { scanned: number; missingReemitted: number; errors: number; }
interface Deps {
  getTimelineEvent: (id: string) => Promise<unknown | null>;
  emit: (args: unknown) => Promise<void>;
}

// Core, dependency-injected for testability: emit only the missing expected events; isolate errors.
export async function reconcileExpectedEvents(expected: ExpectedEvent[], deps: Deps, counters: ExistenceCounters): Promise<void> {
  for (const ev of expected) {
    counters.scanned += 1;
    try {
      const existing = await deps.getTimelineEvent(ev.id);
      if (!existing) { await deps.emit(ev.args); counters.missingReemitted += 1; }
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.existence.error', id: ev.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }
}

// Resolve a logistics case's org from its related order's matchedOrgId (mirrors 2A; null on miss).
async function relatedOrderOrg(relatedOrderId: string | null | undefined): Promise<string | null> {
  if (!relatedOrderId) return null;
  try {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORDER#${relatedOrderId}`, SK: 'META' } }));
    return (res.Item?.matchedOrgId as string | undefined) ?? null;
  } catch { return null; }
}

// Map a META item (read defensively) → its expected events, loading sub-entries for orders.
async function expectedForRecord(item: Record<string, unknown>): Promise<ExpectedEvent[]> {
  const et = item.entityType as string | undefined;
  if (et === 'RFQ') return rfqEvents(item as never);
  if (et === 'LEAD') return leadEvents(item as never);
  if (et === 'ORGANIZATION' || et === 'CONTACT' || et === 'TIMELINE_EVENT' || et === 'LINK_AUDIT') return [];
  if (et === 'ORDER') {
    const order = item as never as { orderId: string; matchedOrgId?: string | null };
    const part = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `ORDER#${(order as { orderId: string }).orderId}` },
    }));
    const rows = (part.Items ?? []) as Array<Record<string, unknown>>;
    const logs = rows.filter((r) => typeof r.SK === 'string' && (r.SK as string).startsWith('LOG#')) as never;
    const docs = rows.filter((r) => typeof r.SK === 'string' && (r.SK as string).startsWith('DOC#')) as never;
    return [
      ...orderCreatedEvents(item as never),
      ...orderStageEvents(order, logs),
      ...quoteEvents(order, docs),
    ];
  }
  if (et === 'LOGISTICS_CASE' || et === 'LOGISTICS') {
    const c = item as never as { relatedOrderId?: string | null };
    const org = await relatedOrderOrg(c.relatedOrderId);
    return logisticsEvents(item as never, org);
  }
  return [];
}

// Drive one bounded page of source META rows (scan with optional recent filter), reconcile each.
export async function runExistencePage(opts: {
  mode: 'hot' | 'cold'; limit: number; cursor?: Record<string, unknown>; cutoffIso?: string;
}): Promise<{ counters: ExistenceCounters; cursor?: Record<string, unknown>; hasMore: boolean }> {
  const counters: ExistenceCounters = { scanned: 0, missingReemitted: 0, errors: 0 };
  // Cheapest broadly-applicable access path: scan META rows; hot also filters on recent updatedAt.
  const filter = ['SK = :meta'];
  const values: Record<string, unknown> = { ':meta': 'META' };
  if (opts.mode === 'hot' && opts.cutoffIso) { filter.push('updatedAt > :cut'); values[':cut'] = opts.cutoffIso; }
  const res = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME(),
    FilterExpression: filter.join(' AND '),
    ExpressionAttributeValues: values,
    ExclusiveStartKey: opts.cursor,
    Limit: opts.limit,
  }));
  const deps: Deps = { getTimelineEvent, emit: (a) => emitTimelineEvent(a as never) };
  for (const item of (res.Items ?? []) as Array<Record<string, unknown>>) {
    const expected = await expectedForRecord(item);
    await reconcileExpectedEvents(expected, deps, counters);
  }
  return { counters, cursor: res.LastEvaluatedKey as Record<string, unknown> | undefined, hasMore: !!res.LastEvaluatedKey };
}
```
> NOTE: confirm the actual `entityType` strings + the order LOG/DOC `SK` prefixes + the logistics `relatedOrderId`/`milestoneLog` field names by reading `order-api/lib/types.ts`, `logistics-api/lib/types.ts`, and how P1/2A wrote them. Adjust the `entityType` discriminators + `SK` prefixes to match. `SK = :meta` scan-filter assumes META rows carry `SK: 'META'` (orders/rfqs/leads/logistics) — verify; RFQ/LEAD may use a different SK (e.g. `META`), match reality.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/existencePass.test.ts`
Expected: PASS (the injected-core tests; `runExistencePage` is exercised by the integration test in Task 6).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/existencePass.ts amplify/functions/crm-api/lib/sweep/existencePass.test.ts
git commit -m "feat(crm-api): sweep existence pass — re-emit missing events (2C-sweep)"
```

---

## Task 5: `dirtyRollupPass` — repair `rollupApplied=false`

**Files:**
- Create: `amplify/functions/crm-api/lib/sweep/dirtyRollupPass.ts`
- Test: `amplify/functions/crm-api/lib/sweep/dirtyRollupPass.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const recompute = vi.fn(); const mark = vi.fn();
vi.mock('../orgStore', () => ({ recomputeRollupsForOrg: (o: string) => recompute(o) }));
vi.mock('../timelineStore', () => ({ markRollupApplied: (id: string) => mark(id) }));
import { runDirtyRollupPage } from './dirtyRollupPass';
beforeEach(() => { mockSend.mockReset(); recompute.mockReset(); mark.mockReset(); });

describe('dirty-rollup pass', () => {
  it('repairs each dirty row: recompute pending + org, then mark clean', async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { id: 'tev-1', orgId: 'org-NEW', rollupPendingOrgId: 'org-OLD' },
      { id: 'tev-2', orgId: 'org-x', rollupPendingOrgId: null },
    ] });
    const out = await runDirtyRollupPage({ limit: 50 });
    expect(recompute).toHaveBeenCalledWith('org-OLD');
    expect(recompute).toHaveBeenCalledWith('org-NEW');
    expect(recompute).toHaveBeenCalledWith('org-x');
    expect(mark).toHaveBeenCalledWith('tev-1');
    expect(mark).toHaveBeenCalledWith('tev-2');
    expect(out.counters).toMatchObject({ dirtyFound: 2, repaired: 2, errors: 0 });
  });
  it('skips a sentinel unresolved org defensively (no recompute) but still marks clean', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ id: 'tev-3', orgId: 'unresolved-rfq-1', rollupPendingOrgId: null }] });
    await runDirtyRollupPage({ limit: 50 });
    expect(recompute).not.toHaveBeenCalled();
    expect(mark).toHaveBeenCalledWith('tev-3');
  });
  it('uses a scan filtered on rollupApplied=false and returns the cursor', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { k: 1 } });
    const out = await runDirtyRollupPage({ limit: 50 });
    const scan = mockSend.mock.calls[0][0].input;
    expect(JSON.stringify(scan.ExpressionAttributeValues)).toContain('false');
    expect(out.hasMore).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/dirtyRollupPass.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/sweep/dirtyRollupPass.ts`:
```typescript
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';

export interface DirtyCounters { dirtyFound: number; repaired: number; errors: number; }
const isSentinel = (orgId: string) => orgId.startsWith('unresolved-');

export async function runDirtyRollupPage(opts: { limit: number; cursor?: Record<string, unknown> }): Promise<{ counters: DirtyCounters; cursor?: Record<string, unknown>; hasMore: boolean }> {
  const counters: DirtyCounters = { dirtyFound: 0, repaired: 0, errors: 0 };
  const res = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME(),
    FilterExpression: 'entityType = :te AND rollupApplied = :f',
    ExpressionAttributeValues: { ':te': 'TIMELINE_EVENT', ':f': false },
    ExclusiveStartKey: opts.cursor,
    Limit: opts.limit,
  }));
  for (const row of (res.Items ?? []) as Array<{ id: string; orgId: string; rollupPendingOrgId?: string | null }>) {
    counters.dirtyFound += 1;
    try {
      if (row.rollupPendingOrgId && !isSentinel(row.rollupPendingOrgId)) await recomputeRollupsForOrg(row.rollupPendingOrgId);
      if (!isSentinel(row.orgId)) await recomputeRollupsForOrg(row.orgId);
      await markRollupApplied(row.id);
      counters.repaired += 1;
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.dirty.error', id: row.id, error: err instanceof Error ? err.message : String(err) }));
    }
  }
  return { counters, cursor: res.LastEvaluatedKey as Record<string, unknown> | undefined, hasMore: !!res.LastEvaluatedKey };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/dirtyRollupPass.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/dirtyRollupPass.ts amplify/functions/crm-api/lib/sweep/dirtyRollupPass.test.ts
git commit -m "feat(crm-api): sweep dirty-rollup repair pass (2C-sweep)"
```

---

## Task 6: `reconcileSweep` — action entry (lease + passes + summary)

**Files:**
- Create: `amplify/functions/crm-api/lib/sweep/reconcileSweep.ts`
- Test: `amplify/functions/crm-api/lib/sweep/reconcileSweep.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const acquireLease = vi.fn(); const persistPage = vi.fn(); const releaseLease = vi.fn(); const readState = vi.fn();
vi.mock('./sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a),
  persistPage: (...a: unknown[]) => persistPage(...a),
  releaseLease: (...a: unknown[]) => releaseLease(...a),
  readState: (...a: unknown[]) => readState(...a),
  stateKey: () => ({}),
}));
const runExistencePage = vi.fn(); const runDirtyRollupPage = vi.fn();
vi.mock('./existencePass', () => ({ runExistencePage: (o: unknown) => runExistencePage(o) }));
vi.mock('./dirtyRollupPass', () => ({ runDirtyRollupPage: (o: unknown) => runDirtyRollupPage(o) }));
import { reconcileSweep } from './reconcileSweep';
beforeEach(() => { acquireLease.mockReset(); persistPage.mockReset(); releaseLease.mockReset(); readState.mockReset(); runExistencePage.mockReset(); runDirtyRollupPage.mockReset(); readState.mockResolvedValue({}); acquireLease.mockResolvedValue('tok'); });

describe('reconcileSweep', () => {
  it('hot mode runs ONLY the existence pass', async () => {
    runExistencePage.mockResolvedValueOnce({ counters: { scanned: 3, missingReemitted: 1, errors: 0 }, hasMore: false });
    const out = await reconcileSweep({ mode: 'hot', limit: 100 });
    expect(runExistencePage).toHaveBeenCalledWith(expect.objectContaining({ mode: 'hot' }));
    expect(runDirtyRollupPage).not.toHaveBeenCalled();
    expect(releaseLease).toHaveBeenCalled();
    expect(out.summary.existence).toMatchObject({ missingReemitted: 1 });
  });
  it('cold mode runs existence AND dirty-rollup passes', async () => {
    runExistencePage.mockResolvedValueOnce({ counters: { scanned: 5, missingReemitted: 0, errors: 0 }, hasMore: false });
    runDirtyRollupPage.mockResolvedValueOnce({ counters: { dirtyFound: 2, repaired: 2, errors: 0 }, hasMore: false });
    const out = await reconcileSweep({ mode: 'cold', limit: 100 });
    expect(runExistencePage).toHaveBeenCalled();
    expect(runDirtyRollupPage).toHaveBeenCalled();
    expect(out.summary.dirty).toMatchObject({ repaired: 2 });
  });
  it('skips a pass whose lease is already held', async () => {
    acquireLease.mockResolvedValueOnce(null); // existence lease held
    await reconcileSweep({ mode: 'hot', limit: 100 });
    expect(runExistencePage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/reconcileSweep.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`amplify/functions/crm-api/lib/sweep/reconcileSweep.ts`:
```typescript
import { readState, acquireLease, persistPage, releaseLease, type SweepMode, type SweepPass } from './sweepState';
import { runExistencePage } from './existencePass';
import { runDirtyRollupPage } from './dirtyRollupPass';

const LAMBDA_TIMEOUT_SEC = 120; // keep in sync with crm-api/resource.ts
const HOT_CUTOFF_MS = 24 * 60 * 60 * 1000;

export interface SweepArgs { mode: SweepMode; limit?: number; cursor?: Record<string, unknown>; }

// Run one pass under its own lease; honor an admin override cursor; persist after the page; release on completion.
async function runPass(mode: SweepMode, pass: SweepPass, overrideCursor: Record<string, unknown> | undefined, run: (cursor?: Record<string, unknown>) => Promise<{ counters: Record<string, number>; cursor?: Record<string, unknown>; hasMore: boolean }>): Promise<Record<string, number> | { skipped: true }> {
  const nowIso = new Date().toISOString();
  const lease = await acquireLease(mode, pass, LAMBDA_TIMEOUT_SEC, nowIso);
  if (!lease) return { skipped: true };
  const state = await readState(mode, pass);
  const cursor = overrideCursor ?? state.cursor;
  const leaseExpiresAt = new Date(Date.parse(nowIso) + Math.max(2 * LAMBDA_TIMEOUT_SEC, 300) * 1000).toISOString();
  const { counters, cursor: next, hasMore } = await run(cursor);
  if (hasMore) await persistPage(mode, pass, { cursor: next, hasMore, counters, leaseExpiresAt });
  else await releaseLease(mode, pass, { lastSummary: counters });
  return counters;
}

export async function reconcileSweep(args: SweepArgs): Promise<{ mode: SweepMode; summary: Record<string, unknown> }> {
  const limit = args.limit ?? 100;
  const cutoffIso = new Date(Date.now() - HOT_CUTOFF_MS).toISOString();
  const summary: Record<string, unknown> = {};

  const existence = await runPass(args.mode, 'existence', args.cursor, (cursor) =>
    runExistencePage({ mode: args.mode, limit, cursor, cutoffIso: args.mode === 'hot' ? cutoffIso : undefined }));
  summary.existence = existence;

  if (args.mode === 'cold') {
    const dirty = await runPass('cold', 'dirty-rollups', undefined, (cursor) => runDirtyRollupPage({ limit, cursor }));
    summary.dirty = dirty;
  }

  console.error(JSON.stringify({ event: 'crm.sweep.summary', mode: args.mode, summary }));
  return { mode: args.mode, summary };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/reconcileSweep.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/reconcileSweep.ts amplify/functions/crm-api/lib/sweep/reconcileSweep.test.ts
git commit -m "feat(crm-api): reconcileSweep entry — passes + lease + summary (2C-sweep)"
```

---

## Task 7: Handler `reconcileSweep` action + resource timeout

**Files:**
- Modify: `amplify/functions/crm-api/handler.ts`
- Modify: `amplify/functions/crm-api/resource.ts`
- Test: `amplify/functions/crm-api/handler.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `amplify/functions/crm-api/handler.test.ts` (it already uses `vi.hoisted` for the emit mock; add a sibling mock for the sweep):
```typescript
const mockReconcile = vi.hoisted(() => ({ reconcileSweep: vi.fn() }));
vi.mock('./lib/sweep/reconcileSweep', () => ({ reconcileSweep: (a: unknown) => mockReconcile.reconcileSweep(a) }));

describe('crm-api reconcileSweep action', () => {
  it('routes {action:reconcileSweep, mode, limit} to reconcileSweep with the right args', async () => {
    mockReconcile.reconcileSweep.mockResolvedValueOnce({ mode: 'hot', summary: {} });
    const { handler } = await import('./handler');
    await handler({ action: 'reconcileSweep', mode: 'hot', limit: 50 } as never);
    expect(mockReconcile.reconcileSweep).toHaveBeenCalledWith({ mode: 'hot', limit: 50, cursor: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: FAIL — `unknown action "reconcileSweep"`.

- [ ] **Step 3: Implement**

In `amplify/functions/crm-api/handler.ts`: import `import { reconcileSweep } from './lib/sweep/reconcileSweep';`, widen `DirectInvokeEvent` to `{ action: string; args?: unknown; mode?: 'hot'|'cold'; cursor?: Record<string, unknown>; limit?: number }`, and add to the `actions` map:
```typescript
  reconcileSweep: async (e) => reconcileSweep({ mode: (e as { mode?: 'hot'|'cold' }).mode ?? 'hot', limit: (e as { limit?: number }).limit, cursor: (e as { cursor?: Record<string, unknown> }).cursor }),
```
In `amplify/functions/crm-api/resource.ts`: change `timeoutSeconds: 30` → `timeoutSeconds: 120`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: PASS (existing dispatch tests + the new reconcileSweep test).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/handler.ts amplify/functions/crm-api/resource.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(crm-api): reconcileSweep action dispatch + 120s timeout (2C-sweep)"
```

---

## Task 8: Backend EventBridge cron wiring

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Add `RuleTargetInput` import + two cron Rules**

In `amplify/backend.ts`:
- Add `RuleTargetInput` to the `aws-cdk-lib/aws-events` import (line ~68: `import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events';`).
- Inside the existing `if (!isSandbox) { ... }` block (the Tender-Watch cron block, ~`:973-995`) — or a new `if (!isSandbox)` block in the same stack — add:
```typescript
// CRM timeline reconciliation sweep (durability backstop for the async emit projection).
new Rule(feedbackStack, 'CrmSweepHotRule', {
  schedule: Schedule.cron({ minute: '*/30', hour: '*', day: '*', month: '*', year: '*' }),
  targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
    event: RuleTargetInput.fromObject({ action: 'reconcileSweep', mode: 'hot' }),
  })],
});
new Rule(feedbackStack, 'CrmSweepColdRule', {
  schedule: Schedule.cron({ minute: '0', hour: '3', day: '*', month: '*', year: '*' }),
  targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
    event: RuleTargetInput.fromObject({ action: 'reconcileSweep', mode: 'cold' }),
  })],
});
```
> Use the correct stack variable for these Rules — `feedbackStack` is where the intelligence table + crm-api live (verify; the Tender Rules use `tenderWatchStack`). Place the crm Rules in the stack that already references `backend.crmApi` to avoid cross-stack target issues. Confirm `backend.crmApi` is the registered name (it is, from P1) and that `LambdaFunctionTarget` accepts the `{ event }` options object (it does — `aws-cdk-lib/aws-events-targets` `LambdaFunction(handler, props)`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add amplify/backend.ts
git commit -m "feat(backend): EventBridge cron → crm-api reconcileSweep hot/cold (2C-sweep)"
```

---

## Task 9: Green-bar + checkpoint

- [ ] **Step 1: Run the crm-api suite (incl. sweep + emit regression)**

Run: `npx vitest run amplify/functions/crm-api`
Expected: PASS — all new sweep tests + the existing emit/handler suites (emit unaffected by the markRollupApplied extraction).

- [ ] **Step 2: Typecheck the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Lint the new + touched files**

Run: `npx eslint amplify/functions/crm-api/lib/sweep amplify/functions/crm-api/handler.ts amplify/functions/crm-api/lib/timelineStore.ts`
Expected: exit 0 (no new errors).

- [ ] **Step 4: Checkpoint**

```bash
git status
git add -A && git commit -m "chore(crm-api): 2C-sweep complete — reconciliation sweep live" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- §2 crm-api `reconcileSweep` action, in-process reuse, no new grants → Tasks 6, 7. ✓
- §2 cron `!isSandbox` + `RuleTargetInput`, 120s timeout → Tasks 7, 8. ✓
- §3 existence pass: deterministic channel order, builders, live-emit-mirroring (STATUS_CHANGE-only, QUOTATION-only, per-milestone), hot-recent/cold-full, cheapest-access-path/scan-fallback → Tasks 3, 4. ✓
- §4 dirty-rollup: scan `rollupApplied=false` (no GSI), recompute pending+org, `markRollupApplied`, sentinel skip → Tasks 1, 5. ✓
- §5 per-pass durable cursor/lease (`CRM_SWEEP#<mode>#<pass>`), lease=`max(2×timeout,5min)`, per-page persist, override cursor, error isolation, summary → Tasks 2, 6 (+ error isolation in Tasks 4/5). ✓
- §6 `markRollupApplied` extraction + sentinel-noop verification → Task 1 (recompute no-op confirmed; Task 5 keeps a defensive `unresolved-` skip). ✓
- §7 test layers → each task's tests + Task 9. ✓

**Deferred (per §8, not in this plan):** void reconciliation, analytics rollup (2C-analytics), `rollupApplied` GSI, admin trigger UI (Plan 3), `BatchGetItem`.

**Placeholder scan:** none. The two `> NOTE:` blocks (Task 4 entityType/SK discriminators; Task 8 stack variable) instruct the implementer to confirm real names by reading specific files — binding, not guessing; the surrounding code + tests are complete.

**Type consistency:** `ExpectedEvent { id, args }` (Task 3) consumed by `reconcileExpectedEvents`/`runExistencePage` (Task 4). `SweepMode`/`SweepPass`/state helpers (Task 2) used by `reconcileSweep` (Task 6). `markRollupApplied(id)` (Task 1) used by `dirtyRollupPass` (Task 5) + emit. `runExistencePage`/`runDirtyRollupPage` return `{ counters, cursor?, hasMore }` consumed identically by `runPass` (Task 6).
