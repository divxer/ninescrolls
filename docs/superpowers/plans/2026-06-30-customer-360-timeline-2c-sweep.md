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
    const token = await acquireLease('cold', 'existence', 120, '2026-06-30T00:00:00.000Z');
    expect(typeof token).toBe('string');
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toMatch(/attribute_not_exists\(lease\)|leaseExpiresAt < :now/);
  });
  it('acquireLease returns null when an active lease is held (ConditionalCheckFailed)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('held'), { name: 'ConditionalCheckFailedException' }));
    expect(await acquireLease('cold', 'existence', 120, '2026-06-30T00:00:00.000Z')).toBeNull();
  });
  it('persistPage writes cursor + counters + heartbeat, conditioned on the lease token', async () => {
    mockSend.mockResolvedValueOnce({});
    await persistPage('cold', 'existence', 'tok', { cursor: { k: 1 }, hasMore: true, counters: { scanned: 10 }, leaseExpiresAt: 'later' });
    const upd = mockSend.mock.calls[0][0].input;
    expect(JSON.stringify(upd)).toContain('hasMore');
    expect(JSON.stringify(upd)).toContain('cursor');
    expect(upd.ConditionExpression).toBe('lease = :token');
    expect(upd.ExpressionAttributeValues[':token']).toBe('tok');
  });
  it('persistPage rejects when the lease token is stale (another owner re-acquired)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' }));
    await expect(persistPage('cold', 'existence', 'old', { cursor: {}, hasMore: true, counters: {}, leaseExpiresAt: 'x' })).rejects.toThrow();
  });
  it('releaseLease clears cursor + lease, conditioned on the lease token', async () => {
    mockSend.mockResolvedValueOnce({});
    await releaseLease('cold', 'existence', 'tok', { lastSummary: { scanned: 10 } });
    const upd = mockSend.mock.calls[0][0].input;
    expect(upd.ConditionExpression).toBe('lease = :token');
    expect(upd.ExpressionAttributeValues[':token']).toBe('tok');
  });
  it('releaseLease rejects when the lease token is stale', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('stale'), { name: 'ConditionalCheckFailedException' }));
    await expect(releaseLease('cold', 'existence', 'old', { lastSummary: {} })).rejects.toThrow();
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

// Persist progress AFTER each page: cursor + counters + a lease heartbeat. Conditioned on `lease = :token`
// so ONLY the current owner can advance the cursor — if a stale invocation (whose lease expired and was
// re-acquired by another fire) tries to persist, the conditional fails and the write is rejected.
export async function persistPage(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { cursor?: Record<string, unknown>; hasMore: boolean; counters: Record<string, number>; leaseExpiresAt: string }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET #c = :c, hasMore = :h, counters = :n, leaseExpiresAt = :exp',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeNames: { '#c': 'cursor' },
    ExpressionAttributeValues: { ':c': p.cursor ?? null, ':h': p.hasMore, ':n': p.counters, ':exp': p.leaseExpiresAt, ':token': leaseToken },
  }));
}

// Final page: clear cursor + release lease, record summary + completion. Also conditioned on `lease = :token`
// so a stale owner can't clear a lease another fire now holds.
export async function releaseLease(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { lastSummary: Record<string, unknown> }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET hasMore = :f, lastSummary = :s, lastCompletedAt = :now REMOVE #c, lease, leaseExpiresAt',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeNames: { '#c': 'cursor' },
    ExpressionAttributeValues: { ':f': false, ':s': p.lastSummary, ':now': new Date().toISOString(), ':token': leaseToken },
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
import { describe, it, expect, vi } from 'vitest';
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
  it('quoteEvents → ONLY QUOTATION docs, keyed by the stored docId', () => {
    const order = { orderId: 'ord-1', matchedOrgId: 'x.com' };
    // Stored DOC items use `docId` (SK: DOC#<stage>#<docId>), NOT `id`.
    const docs = [
      { docId: 'doc-1', docType: 'QUOTATION', fileName: 'q.pdf', uploadedAt: '2026-03-05T00:00:00Z' },
      { docId: 'doc-2', docType: 'PURCHASE_ORDER', fileName: 'po.pdf', uploadedAt: '2026-03-06T00:00:00Z' },
    ];
    const out = quoteEvents(order, docs);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tev-quote-doc-1');
  });
  it('logisticsEvents → one per usable entry; skips legacy entries missing id/toStage/timestamp', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = logisticsEvents(
      { caseId: 'lc-1', caseType: 'SAMPLE', milestoneLog: [
        { id: 'mlog-x', action: 'CASE_CREATED', toStage: 'DRAFT', timestamp: '2026-06-01T00:00:00Z', internalOnly: false },
        { id: 'mlog-y', action: 'STAGE_ADVANCED', toStage: 'SHIPPED', fromStage: 'DRAFT', timestamp: '2026-06-02T00:00:00Z', internalOnly: true },
        { id: 'mlog-z', action: 'NOTE', timestamp: '2026-06-03T00:00:00Z', internalOnly: false }, // legacy: no toStage → skipped
      ] },
      'x.com',
    );
    expect(out.map((e) => e.id)).toEqual(['tev-logistics-lc-1-log-mlog-x', 'tev-logistics-lc-1-log-mlog-y']);
    expect(out[1].args.isInternalOnly).toBe(true);
    expect(warnSpy).toHaveBeenCalled(); // malformed-skip is logged, not silent
    warnSpy.mockRestore();
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
// Stored DOC items carry `docId` (not `id`); accept `id` too for forward-compat.
export function quoteEvents(order: { orderId: string; matchedOrgId?: string | null }, docs: Array<{ docId?: string; id?: string; docType: string; fileName: string; uploadedAt: string }>): ExpectedEvent[] {
  return docs
    .map((d) => ({ d, docId: d.docId ?? d.id }))
    .filter(({ d, docId }) => d.docType === 'QUOTATION' && !!docId)
    .map(({ d, docId }) => withId(buildQuoteSentEmitArgs(order, { id: docId!, fileName: d.fileName, uploadedAt: d.uploadedAt })));
}

// `toStage`/`timestamp` are OPTIONAL on the source LogisticsLogEntry (legacy entries predate the
// stable-id + structured-stage fields). Skip entries missing id/toStage/timestamp rather than emit a
// malformed event; log a count so silent drops are visible (this is an audit tool).
export function logisticsEvents(c: { caseId: string; caseType?: string | null; milestoneLog?: Array<{ id?: string; action: string; toStage?: string | null; fromStage?: string | null; timestamp?: string; internalOnly?: boolean }> }, matchedOrgId: string | null): ExpectedEvent[] {
  const entries = c.milestoneLog ?? [];
  const usable = entries.filter((m) => !!m.id && !!m.toStage && !!m.timestamp);
  if (usable.length !== entries.length) {
    console.warn(JSON.stringify({ event: 'crm.sweep.logistics.skipped_malformed', caseId: c.caseId, skipped: entries.length - usable.length }));
  }
  return usable.map((m) => withId(buildLogisticsMilestoneEmitArgs(
    { caseId: c.caseId, caseType: c.caseType },
    { id: m.id!, toStage: m.toStage!, fromStage: m.fromStage ?? null, timestamp: m.timestamp!, internalOnly: m.internalOnly ?? false, action: m.action },
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
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const getTimelineEventMock = vi.fn();
vi.mock('../timelineStore', () => ({ getTimelineEvent: (id: string) => getTimelineEventMock(id) }));
const emitMock = vi.fn();
vi.mock('../emitTimelineEvent', () => ({ emitTimelineEvent: (a: unknown) => emitMock(a) }));

import { reconcileExpectedEvents, runExistencePage } from './existencePass';
beforeEach(() => { mockSend.mockReset(); getTimelineEventMock.mockReset(); emitMock.mockReset(); });

describe('existence pass — reconcileExpectedEvents (injected core)', () => {
  it('emits ONLY the missing events and counts them', async () => {
    const getTimelineEvent = vi.fn().mockResolvedValueOnce({ id: 'tev-a' }).mockResolvedValueOnce(null);
    const emit = vi.fn().mockResolvedValue(undefined);
    const expected = [ { id: 'tev-a', args: { kind: 'rfq_submitted' } }, { id: 'tev-b', args: { kind: 'lead_captured' } } ] as never[];
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

describe('existence pass — runExistencePage (PK-prefix channels + channel cursor)', () => {
  it('discriminates rfq by PK prefix, emits the missing rfq_submitted, advances the cursor to lead', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#rfq-1', SK: 'META', submittedAt: '2026-06-19T10:00:00Z', email: 'a@x.com', equipmentCategory: 'ICP', matchedOrgId: 'x.com' }] });
    getTimelineEventMock.mockResolvedValueOnce(null); // missing → emit
    emitMock.mockResolvedValueOnce(undefined);
    const out = await runExistencePage({ mode: 'cold', limit: 100 });
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.ExpressionAttributeValues[':pre']).toBe('RFQ#'); // discriminated by PK prefix, NOT entityType
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rfq_submitted', sourceEntityId: 'rfq-1' }));
    expect(out.counters).toMatchObject({ scanned: 1, missingReemitted: 1 });
    expect(out.cursor).toEqual({ channel: 'lead' }); // channel advanced (no LastEvaluatedKey)
    expect(out.hasMore).toBe(true);
  });
  it('hot mode filters each channel by its OWN recency field (rfq → submittedAt)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await runExistencePage({ mode: 'hot', limit: 100, cutoffIso: '2026-06-29T00:00:00Z' });
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.ExpressionAttributeNames['#r']).toBe('submittedAt');
    expect(scan.FilterExpression).toContain('#r > :cut');
  });
  it('a page with a LastEvaluatedKey keeps the same channel + carries the key', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { PK: 'RFQ#rfq-9' } });
    const out = await runExistencePage({ mode: 'cold', limit: 100 });
    expect(out.cursor).toEqual({ channel: 'rfq', key: { PK: 'RFQ#rfq-9' } });
    expect(out.hasMore).toBe(true);
  });
  it('the LAST channel exhausted (no LastEvaluatedKey) → hasMore false, cursor cleared', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'logistics' } });
    expect(out.hasMore).toBe(false);
    expect(out.cursor).toBeUndefined();
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

// Load ALL child rows of an order partition, PAGINATED — never silently truncate (this is an audit tool).
async function loadOrderChildren(orderId: string): Promise<{ logs: Array<Record<string, unknown>>; docs: Array<Record<string, unknown>> }> {
  const logs: Array<Record<string, unknown>> = [];
  const docs: Array<Record<string, unknown>> = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `ORDER#${orderId}` },
      ExclusiveStartKey: start,
    }));
    for (const r of (res.Items ?? []) as Array<Record<string, unknown>>) {
      const sk = r.SK as string | undefined;
      if (typeof sk === 'string' && sk.startsWith('LOG#')) logs.push(r);
      else if (typeof sk === 'string' && sk.startsWith('DOC#')) docs.push(r);
    }
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);
  return { logs, docs };
}

const idFromPk = (m: Record<string, unknown>, prefix: string) => (m.PK as string).slice(prefix.length);
// createOrder writes matchedOrgId:'' for an unmatched order; normalize '' → null.
const orgOrNull = (v: unknown) => ((v as string) || null);

// Channels in deterministic order, discriminated by PK PREFIX + SK='META' (source rows carry NO
// `entityType`). Each has its own hot-recency field: rfq/lead → submittedAt; order/logistics → updatedAt.
// Field mappings below are baked from the confirmed stored shapes (RFQ/LEAD/ORDER/LOGISTICS writes).
interface Channel { name: string; pkPrefix: string; recencyField: string; expand: (meta: Record<string, unknown>) => Promise<ExpectedEvent[]>; }

const CHANNELS: Channel[] = [
  { name: 'rfq', pkPrefix: 'RFQ#', recencyField: 'submittedAt', expand: async (m) => rfqEvents({
      rfqId: idFromPk(m, 'RFQ#'), submittedAt: m.submittedAt as string, email: m.email as string | undefined,
      equipmentCategory: m.equipmentCategory as string | undefined, specificModel: m.specificModel as string | undefined,
      matchedOrgId: orgOrNull(m.matchedOrgId),
    }) },
  { name: 'lead', pkPrefix: 'LEAD#', recencyField: 'submittedAt', expand: async (m) => leadEvents({
      leadId: idFromPk(m, 'LEAD#'), submittedAt: m.submittedAt as string, type: m.type as string,
      email: m.email as string | undefined, productName: m.productName as string | undefined,
      inquiryType: m.inquiryType as string | undefined, matchedOrgId: orgOrNull(m.matchedOrgId),
    }) },
  { name: 'order', pkPrefix: 'ORDER#', recencyField: 'updatedAt', expand: async (m) => {
      const orderId = idFromPk(m, 'ORDER#');
      const order = { orderId, matchedOrgId: orgOrNull(m.matchedOrgId) };
      const { logs, docs } = await loadOrderChildren(orderId);
      return [
        ...orderCreatedEvents({ orderId, createdAt: m.createdAt as string, productModel: m.productModel as string | undefined, matchedOrgId: order.matchedOrgId, rfqId: (m.rfqId as string) ?? null }),
        ...orderStageEvents(order, logs as never),
        ...quoteEvents(order, docs as never),
      ];
    } },
  { name: 'logistics', pkPrefix: 'LOGISTICS#', recencyField: 'updatedAt', expand: async (m) => {
      const org = await relatedOrderOrg(m.relatedOrderId as string | undefined);
      return logisticsEvents({ caseId: idFromPk(m, 'LOGISTICS#'), caseType: m.caseType as string | undefined, milestoneLog: m.milestoneLog as never }, org);
    } },
];

const channelIndexByName = (name?: string) => { const i = CHANNELS.findIndex((c) => c.name === name); return i < 0 ? 0 : i; };

function buildChannelScan(channel: Channel, mode: 'hot' | 'cold', cutoffIso: string | undefined, limit: number, key?: Record<string, unknown>) {
  const values: Record<string, unknown> = { ':pre': channel.pkPrefix, ':meta': 'META' };
  let filter = 'begins_with(PK, :pre) AND SK = :meta';
  let names: Record<string, string> | undefined;
  if (mode === 'hot' && cutoffIso) { names = { '#r': channel.recencyField }; values[':cut'] = cutoffIso; filter += ' AND #r > :cut'; }
  return new ScanCommand({ TableName: TABLE_NAME(), FilterExpression: filter, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ExclusiveStartKey: key, Limit: limit });
}

export interface ChannelCursor { channel: string; key?: Record<string, unknown>; }

// One scan page of the CURRENT channel (per cursor). Advances to the next channel when one is exhausted;
// hasMore=false only after the LAST channel is exhausted. Per-record expand errors are isolated.
export async function runExistencePage(opts: { mode: 'hot' | 'cold'; limit: number; cursor?: ChannelCursor; cutoffIso?: string }): Promise<{ counters: ExistenceCounters; cursor?: ChannelCursor; hasMore: boolean }> {
  const counters: ExistenceCounters = { scanned: 0, missingReemitted: 0, errors: 0 };
  const idx = channelIndexByName(opts.cursor?.channel);
  const channel = CHANNELS[idx];
  const res = await docClient.send(buildChannelScan(channel, opts.mode, opts.cutoffIso, opts.limit, opts.cursor?.key));
  const deps: Deps = { getTimelineEvent, emit: (a) => emitTimelineEvent(a as never) };
  for (const item of (res.Items ?? []) as Array<Record<string, unknown>>) {
    try {
      await reconcileExpectedEvents(await channel.expand(item), deps, counters);
    } catch (err) {
      counters.errors += 1;
      console.error(JSON.stringify({ event: 'crm.sweep.existence.expand_error', pk: item.PK, error: err instanceof Error ? err.message : String(err) }));
    }
  }
  const key = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  if (key) return { counters, cursor: { channel: channel.name, key }, hasMore: true };
  const next = CHANNELS[idx + 1];
  return next ? { counters, cursor: { channel: next.name }, hasMore: true } : { counters, cursor: undefined, hasMore: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/existencePass.test.ts`
Expected: PASS (injected-core + the `runExistencePage` PK-prefix / channel-cursor / per-channel-hot-recency tests).

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
  it('isolates a whole-pass failure (logs pass_failed) and still runs the cold dirty-rollup pass', async () => {
    runExistencePage.mockRejectedValueOnce(new Error('scan boom'));
    runDirtyRollupPage.mockResolvedValueOnce({ counters: { dirtyFound: 1, repaired: 1, errors: 0 }, hasMore: false });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await reconcileSweep({ mode: 'cold', limit: 100 });
    expect(out.summary.existence).toMatchObject({ failed: true });
    expect(runDirtyRollupPage).toHaveBeenCalled();          // existence failure did NOT block dirty-rollup
    expect(out.summary.dirty).toMatchObject({ repaired: 1 });
    expect(releaseLease).toHaveBeenCalledTimes(1);           // only dirty released; the failed existence pass left its lease to expire
    errSpy.mockRestore();
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
const MAX_PAGES_PER_INVOCATION = 50; // safety bound within the 120s timeout

const LEASE_MS = Math.max(2 * LAMBDA_TIMEOUT_SEC, 300) * 1000; // longer than any single invocation

export interface SweepArgs { mode: SweepMode; limit?: number; cursor?: Record<string, unknown>; }
type PageResult = { counters: Record<string, number>; cursor?: unknown; hasMore: boolean };
type PassSummary = Record<string, number> | { skipped: true } | { failed: true; error: string };

// Run a pass under its own lease, LOOPING pages and PERSISTING AFTER EACH page (cursor + counters +
// a freshly-computed lease heartbeat); release on completion. Every state write carries the lease
// token, so a stale invocation can't corrupt a pass another fire now owns. A WHOLE-PASS throw
// (scan/query/state error, or a lost-lease conditional failure) is CAUGHT here: it is logged as
// `crm.sweep.pass_failed`, the lease is left to expire (NOT released), and a failed summary is
// returned — so the caller's other pass still runs and the next fire resumes from the persisted
// cursor. An admin override cursor is honored.
async function runPass(mode: SweepMode, pass: SweepPass, overrideCursor: unknown, runner: (cursor: unknown) => Promise<PageResult>): Promise<PassSummary> {
  try {
    const lease = await acquireLease(mode, pass, LAMBDA_TIMEOUT_SEC, new Date().toISOString());
    if (!lease) return { skipped: true };
    const state = await readState(mode, pass);
    let cursor: unknown = overrideCursor ?? state.cursor;
    const total: Record<string, number> = {};
    for (let page = 0; page < MAX_PAGES_PER_INVOCATION; page++) {
      const { counters, cursor: next, hasMore } = await runner(cursor);
      for (const [k, v] of Object.entries(counters)) total[k] = (total[k] ?? 0) + v;
      cursor = next;
      if (!hasMore) { await releaseLease(mode, pass, lease, { lastSummary: total }); return total; }
      const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString(); // per-page heartbeat
      // Persist a SNAPSHOT copy of the running total — `total` keeps mutating on later pages, so
      // passing it by reference would risk a slow marshal capturing a newer value than this page.
      await persistPage(mode, pass, lease, { cursor: next as Record<string, unknown> | undefined, hasMore: true, counters: { ...total }, leaseExpiresAt });
    }
    return total; // hit the page budget; cursor is persisted + lease expires → the next fire resumes
  } catch (err) {
    console.error(JSON.stringify({ event: 'crm.sweep.pass_failed', mode, pass, error: err instanceof Error ? err.message : String(err) }));
    return { failed: true, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reconcileSweep(args: SweepArgs): Promise<{ mode: SweepMode; summary: Record<string, unknown> }> {
  const limit = args.limit ?? 100;
  const cutoffIso = new Date(Date.now() - HOT_CUTOFF_MS).toISOString();
  const summary: Record<string, unknown> = {};

  // runPass never throws — it catches its own pass failure — so the cold dirty-rollup pass runs
  // independently of the existence pass's outcome.
  // NOTE: the runner returns `{ counters: { ...r.counters }, ... }` — the spread widens the page
  // runner's CLOSED counter interface (ExistenceCounters/DirtyCounters) to PageResult's open
  // `Record<string, number>` (a bare assignment is TS2322: closed interface → indexless Record).
  summary.existence = await runPass(args.mode, 'existence', args.cursor, async (cursor) => {
    const r = await runExistencePage({ mode: args.mode, limit, cursor: cursor as never, cutoffIso: args.mode === 'hot' ? cutoffIso : undefined });
    return { counters: { ...r.counters }, cursor: r.cursor, hasMore: r.hasMore };
  });

  if (args.mode === 'cold') {
    summary.dirty = await runPass('cold', 'dirty-rollups', undefined, async (cursor) => {
      const r = await runDirtyRollupPage({ limit, cursor: cursor as never });
      return { counters: { ...r.counters }, cursor: r.cursor, hasMore: r.hasMore };
    });
  }

  // Operational telemetry, not an error — info-level.
  console.log(JSON.stringify({ event: 'crm.sweep.summary', mode: args.mode, summary }));
  return { mode: args.mode, summary };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/reconcileSweep.test.ts`
Expected: PASS (4 tests).

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

In `amplify/functions/crm-api/handler.ts`: import `import { reconcileSweep } from './lib/sweep/reconcileSweep';`, widen `DirectInvokeEvent` to `{ action: string; args?: unknown; mode?: 'hot'|'cold'; cursor?: Record<string, unknown>; limit?: number }`, and add to the `actions` map (the widened type means the fields are read directly off `e` — no inline casts, matching the sibling `emitTimelineEvent` entry):
```typescript
  reconcileSweep: async (e) => reconcileSweep({ mode: e.mode ?? 'hot', limit: e.limit, cursor: e.cursor }),
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
- Add the Rules to **`feedbackStack`** — confirmed (`amplify/backend.ts:401`) as the stack that creates the `intelligenceTable` and grants `backend.crmApi` read/write to it (`amplify/backend.ts:531`). The `backend.crmApi` Lambda construct lives in its own Amplify-generated stack, so the Rule→Lambda target is a cross-stack reference; CDK resolves it automatically (exports/imports). Guard with `if (!isSandbox)` (the module-level const at `amplify/backend.ts:596`). **Placement:** add the block AFTER line 596 (so `isSandbox` is defined) — e.g. alongside the existing `if (!isSandbox)` cron blocks (~`:980+`); `feedbackStack` and `backend.crmApi` are both in scope there. Add a sibling `if (!isSandbox) { ... }` block:
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
> Stack is **`feedbackStack`** (confirmed above) — the same stack that owns the intelligence table and grants `backend.crmApi`. The Rule→Lambda target may be cross-stack (the crm-api Lambda is in its own Amplify-generated stack); CDK resolves that automatically, and the backend typecheck/synth is the backstop. `backend.crmApi` is the registered name (from P1). `LambdaFunctionTarget` accepts the `{ event }` options object (`aws-cdk-lib/aws-events-targets` `LambdaFunction(handler, props)`). The `isSandbox` flag already exists in `backend.ts` (Tender crons use it); reuse it — do not redefine.

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
# Targeted add — each prior task already committed its own files, so this catches only stragglers
# within the 2C-sweep surface. Do NOT use `git add -A`: an unrelated untracked file
# (docs/seo/ninescrolls-news-task-prompt.md) is present in the tree and must not be swept in.
git add amplify/functions/crm-api amplify/backend.ts docs/superpowers/plans/2026-06-30-customer-360-timeline-2c-sweep.md
git commit -m "chore(crm-api): 2C-sweep complete — reconciliation sweep live" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- §2 crm-api `reconcileSweep` action, in-process reuse, no new grants → Tasks 6, 7. ✓
- §2 cron `!isSandbox` + `RuleTargetInput`, 120s timeout → Tasks 7, 8. ✓
- §3 existence pass: deterministic channel order, builders, live-emit-mirroring (STATUS_CHANGE-only, QUOTATION-only, per-milestone), hot-recent/cold-full, cheapest-access-path/scan-fallback → Tasks 3, 4. ✓
- §4 dirty-rollup: scan `rollupApplied=false` (no GSI), recompute pending+org, `markRollupApplied`, sentinel skip → Tasks 1, 5. ✓
- §5 per-pass durable cursor/lease (`CRM_SWEEP#<mode>#<pass>`), lease=`max(2×timeout,5min)`, **token-conditioned** per-page persist (per-page heartbeat expiry), override cursor, per-record error isolation, **whole-pass catch → `pass_failed` + cold dirty-rollup still runs**, summary → Tasks 2, 6 (+ error isolation in Tasks 4/5). ✓
- §6 `markRollupApplied` extraction + sentinel-noop verification → Task 1 (recompute no-op confirmed; Task 5 keeps a defensive `unresolved-` skip). ✓
- §7 test layers → each task's tests + Task 9. ✓

**Deferred (per §8, not in this plan):** void reconciliation, analytics rollup (2C-analytics), `rollupApplied` GSI, admin trigger UI (Plan 3), `BatchGetItem`.

**Placeholder scan:** none. Source-row shapes are now **baked** (no "confirm later"): the existence pass (Task 4) discriminates source channels by **PK prefix + `SK='META'`** (source rows carry NO `entityType`), with per-channel hot-recency (`submittedAt` for rfq/lead, `updatedAt` for order/logistics) and stored DOC `docId` — all verified against the live RFQ/LEAD/ORDER/LOGISTICS writes. The dirty-rollup pass (Task 5) filters the **materialized** `TLEVENT#` rows on `entityType = 'TIMELINE_EVENT'`, which those rows DO carry (`emitTimelineEvent` sets it). Task 8's stack is now resolved to **`feedbackStack`** (confirmed at `amplify/backend.ts:401` table-owner + `:531` crm-api grant; `isSandbox` const at `:596`) — no "verify" hedging left.

**Type consistency:** `ExpectedEvent { id, args }` (Task 3) consumed by `reconcileExpectedEvents`/`runExistencePage` (Task 4). `SweepMode`/`SweepPass`/state helpers (Task 2) used by `reconcileSweep` (Task 6). `persistPage(mode, pass, leaseToken, {...})` / `releaseLease(mode, pass, leaseToken, {...})` (Task 2) — the `leaseToken` 3rd arg is threaded from `acquireLease`'s return through `runPass` (Task 6). `markRollupApplied(id)` (Task 1) used by `dirtyRollupPass` (Task 5) + emit. `runExistencePage`/`runDirtyRollupPage` return `{ counters, cursor?, hasMore }` consumed identically by `runPass` (Task 6), whose `PassSummary` is `Record<string,number> | { skipped: true } | { failed: true, error }`.
