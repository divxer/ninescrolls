# Customer 360 Timeline — Plan 3C: CRM Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durably and idempotently self-heal the post-commit side-effect gap left open by Plan 3B (source `matchedOrgId` backfill, `LinkAuditLog`, analytics retro), and give admins a thin read-only `/admin/crm-health` panel to confirm it works.

**Architecture:** A repair-outbox marker (`CRM_REPAIR#<unitType>#<unitKey>`, sparse `GSI1 CRM_REPAIR#pending|#stuck`) is written after the durable commit carrying the *committed* target; a shared `replaySideEffects` module runs the (now idempotent) backfill + deterministic-id audit + retro on both the happy path and a dedicated `reconcileRepair` drainer (own lease + `*/15` cron); conflict / max-attempts → terminal `stuck` (Health-read-only). See spec `docs/superpowers/specs/2026-07-08-customer-360-timeline-3c-crm-health-design.md`.

**Tech Stack:** AWS Amplify Gen2, AppSync (`a.query`/`a.mutation`/`a.customType`), DynamoDB single-table (`INTELLIGENCE_TABLE`, GSI1/GSI2) via `@aws-sdk/lib-dynamodb`, `crm-api` Lambda, React/Vite admin UI, vitest (module-mock style). Work in the isolated worktree `scratchpad/wt-3c` on branch `feature/customer-360-timeline-3c` (off `origin/main` `d0e29a68`; node_modules symlinked to the main repo).

**Test command:** `npx vitest run <paths>` from the worktree root. Full backend suite: `npx vitest run amplify/functions/crm-api`. Typecheck: `npx tsc --noEmit && npx tsc --noEmit -p amplify/tsconfig.json` (the only pre-existing tsc error is `amplify_outputs.json` in `main.tsx` — untracked, expected). Lint: `npx eslint <changed files>`.

**Invariants every backend task must preserve (re-check at each review gate):**
1. Audit id derives ONLY from committed target (`reason|unitKey|targetOrgId`), never a stale request target.
2. A stale/losing linker (`moved===0`, empty-partition `alreadyLinked`, `linkVisitor` already-manual / alreadyResolved / lost-race) MUST NOT put a marker.
3. Marker is written AFTER the durable commit, BEFORE the fragile side effects, and only when the commit actually happened.
4. `writeLinkAuditLog` with a deterministic id throwing `ConditionalCheckFailedException` = idempotent no-op = SUCCESS (never counted transient).
5. Post-commit side effects NEVER throw out of the orchestrator; failure ⇒ marker survives + `postCommitStatus:'post_commit_failed'`.
6. Drainer Queries `CRM_REPAIR#pending` only; `#stuck` is terminal / Health-read-only.
7. `crmHealth` does NO table Scan.

---

### Task 1: Deterministic audit id + optional-id audit write

**Files:**
- Modify: `amplify/functions/crm-api/lib/idGenerators.ts`
- Modify: `amplify/functions/crm-api/lib/auditStore.ts`
- Test: `amplify/functions/crm-api/lib/idGenerators.test.ts` (exists), `amplify/functions/crm-api/lib/auditStore.test.ts` (exists)

- [ ] **Step 1: Write failing test for `deterministicAuditId`**

Append to `amplify/functions/crm-api/lib/idGenerators.test.ts`:
```ts
import { deterministicAuditId } from './idGenerators';

describe('deterministicAuditId', () => {
  it('is stable for the same (reason, unitKey, targetOrgId)', () => {
    const a = deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'acme.com');
    const b = deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'acme.com');
    expect(a).toBe(b);
    expect(a).toMatch(/^audit-[0-9a-f]{16}$/);
  });
  it('differs when the committed target org differs (corrective re-link gets its own row)', () => {
    expect(deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'acme.com'))
      .not.toBe(deterministicAuditId('manual_link_unit', 'unresolved-rfq-1', 'other.com'));
  });
  it('differs by reason (structured vs analytics)', () => {
    expect(deterministicAuditId('manual_link_unit', 'v1', 'acme.com'))
      .not.toBe(deterministicAuditId('manual_link_visitor', 'v1', 'acme.com'));
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/idGenerators.test.ts`
Expected: FAIL — `deterministicAuditId is not a function`.

- [ ] **Step 3: Implement `deterministicAuditId`**

Append to `amplify/functions/crm-api/lib/idGenerators.ts`:
```ts
// Deterministic audit id so a repaired audit write is an idempotent no-op (attribute_not_exists(PK)),
// never a duplicate row. INVARIANT: derived ONLY from the COMMITTED target (unitKey + targetOrgId),
// never a stale request target. A corrective re-link to a different org gets its own id (targetOrgId in hash).
export function deterministicAuditId(reason: string, unitKey: string, targetOrgId: string): string {
  return `audit-${crypto.createHash('sha256').update(`${reason}|${unitKey}|${targetOrgId}`).digest('hex').slice(0, 16)}`;
}
```

- [ ] **Step 4: Write failing test for optional `id` in `writeLinkAuditLog`**

Append to `amplify/functions/crm-api/lib/auditStore.test.ts` (mirror the existing mock style in that file — it mocks `docClient`). Add:
```ts
it('uses a caller-supplied deterministic id when provided (else random)', async () => {
  const returned = await writeLinkAuditLog({
    id: 'audit-deadbeef00000000', operator: 'op@x', reason: 'manual_link_unit',
    timestamp: '2026-07-08T00:00:00.000Z', newOrgId: 'acme.com', details: { unitType: 'structured' },
  });
  expect(returned).toBe('audit-deadbeef00000000');
  // the PutCommand Item.id and Item.PK carry the supplied id
  const putArg = sendMock.mock.calls.at(-1)![0].input;
  expect(putArg.Item.id).toBe('audit-deadbeef00000000');
  expect(putArg.Item.PK).toBe('AUDIT#audit-deadbeef00000000');
  expect(putArg.ConditionExpression).toContain('attribute_not_exists(PK)');
});
```
(If `auditStore.test.ts` does not already expose a `sendMock`, follow the file's existing mock accessor — read the top of the file and reuse it; assert the same three facts by whatever accessor the file uses.)

- [ ] **Step 5: Run it — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/auditStore.test.ts`
Expected: FAIL — supplied `id` ignored (random id returned).

- [ ] **Step 6: Add optional `id` to `writeLinkAuditLog`**

In `amplify/functions/crm-api/lib/auditStore.ts`, change the args type to add `id?: string;` and the first line of the body:
```ts
export async function writeLinkAuditLog(args: {
  id?: string;
  timelineEventId?: string | null; contactId?: string | null;
  oldOrgId?: string | null; newOrgId?: string | null;
  oldContactId?: string | null; newContactId?: string | null;
  operator: string; reason: string; timestamp: string;
  details?: Record<string, unknown> | null;
}): Promise<string> {
  const id = args.id ?? generateAuditId();
  // ...unchanged...
```

- [ ] **Step 7: Run both tests — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/idGenerators.test.ts amplify/functions/crm-api/lib/auditStore.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add amplify/functions/crm-api/lib/idGenerators.ts amplify/functions/crm-api/lib/idGenerators.test.ts amplify/functions/crm-api/lib/auditStore.ts amplify/functions/crm-api/lib/auditStore.test.ts
git commit -m "feat(3C): deterministic audit id + optional id in writeLinkAuditLog"
```

---

### Task 2: Repair marker store (put/delete/stuck/query)

**Files:**
- Create: `amplify/functions/crm-api/lib/repair/repairMarker.ts`
- Test: `amplify/functions/crm-api/lib/repair/repairMarker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/lib/repair/repairMarker.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
import { putRepairMarker, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, queryPendingMarkers, repairMarkerKeys } from './repairMarker';

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

describe('repairMarker', () => {
  it('put writes a pending marker with deterministic PK + GSI1 pending partition', async () => {
    await putRepairMarker({ unitType: 'structured', unitKey: 'unresolved-rfq-1', targetOrgId: 'acme.com',
      operator: 'op', createdAt: '2026-07-08T00:00:00.000Z', sourceType: 'rfq', sourceEntityId: '1',
      backfillPk: 'RFQ#1', affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked' });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('CRM_REPAIR#structured#unresolved-rfq-1');
    expect(item.SK).toBe('STATE');
    expect(item.GSI1PK).toBe('CRM_REPAIR#pending');
    expect(item.GSI1SK).toBe('2026-07-08T00:00:00.000Z#unresolved-rfq-1');
    expect(item.status).toBe('pending');
    expect(item.attemptCount).toBe(0);
    expect(item.backfillPk).toBe('RFQ#1');
  });
  it('analytics put omits structured fields', async () => {
    await putRepairMarker({ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z' });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe('CRM_REPAIR#analytics#v1');
    expect(item.backfillPk ?? null).toBeNull();
  });
  it('delete removes by deterministic key', async () => {
    await deleteRepairMarker('analytics', 'v1');
    expect(send.mock.calls[0][0].input.Key).toEqual({ PK: 'CRM_REPAIR#analytics#v1', SK: 'STATE' });
  });
  it('markStuck moves the marker to the stuck partition with a reason', async () => {
    await markStuck({ unitType: 'structured', unitKey: 'unresolved-rfq-1', attemptCount: 4 } as never, 'source_conflict', 'source_conflict', '2026-07-08T01:00:00.000Z');
    const u = send.mock.calls[0][0].input;
    expect(u.Key).toEqual({ PK: 'CRM_REPAIR#structured#unresolved-rfq-1', SK: 'STATE' });
    expect(u.ExpressionAttributeValues[':g']).toBe('CRM_REPAIR#stuck');
    expect(u.ExpressionAttributeValues[':st']).toBe('stuck');
    expect(u.ExpressionAttributeValues[':sr']).toBe('source_conflict');
  });
  it('bumpAttempt increments attemptCount and stays pending', async () => {
    await bumpAttempt({ unitType: 'analytics', unitKey: 'v1', attemptCount: 1 } as never, 'boom', '2026-07-08T01:00:00.000Z');
    const u = send.mock.calls[0][0].input;
    expect(u.ExpressionAttributeValues[':a']).toBe(2);
    expect(u.ExpressionAttributeValues[':e']).toBe('boom');
  });
  it('queryPendingMarkers Queries GSI1 pending oldest-first with a limit', async () => {
    send.mockResolvedValueOnce({ Items: [{ unitKey: 'a' }], LastEvaluatedKey: { x: 1 } });
    const r = await queryPendingMarkers(50);
    const q = send.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI1');
    expect(q.ExpressionAttributeValues[':pk']).toBe('CRM_REPAIR#pending');
    expect(q.ScanIndexForward).toBe(true);
    expect(q.Limit).toBe(50);
    expect(r.markers).toHaveLength(1);
    expect(r.hasMore).toBe(true);
  });
  it('repairMarkerKeys builds the deterministic PK', () => {
    expect(repairMarkerKeys('structured', 'u1')).toEqual({ PK: 'CRM_REPAIR#structured#u1', SK: 'STATE' });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/repairMarker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `repairMarker.ts`**

Create `amplify/functions/crm-api/lib/repair/repairMarker.ts`:
```ts
import { PutCommand, DeleteCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';

export type RepairUnitType = 'structured' | 'analytics';

export interface RepairMarkerItem {
  PK: string; SK: 'STATE';
  GSI1PK: 'CRM_REPAIR#pending' | 'CRM_REPAIR#stuck'; GSI1SK: string;
  entityType: 'CRM_REPAIR';
  unitType: RepairUnitType; unitKey: string;
  targetOrgId: string; operator: string; createdAt: string;
  status: 'pending' | 'stuck'; stuckReason: 'source_conflict' | 'max_attempts' | null;
  attemptCount: number; lastAttemptAt: string | null; lastError: string | null;
  sourceType?: string; sourceEntityId?: string; backfillPk?: string | null;
  affectedEventIds?: string[]; movedCount?: number; contactStatus?: string;
}

export function repairMarkerKeys(unitType: RepairUnitType, unitKey: string) {
  return { PK: `CRM_REPAIR#${unitType}#${unitKey}`, SK: 'STATE' as const };
}

// Deterministic-PK Put — overwrites the same committed unit's metadata; never mints a duplicate.
// Reached ONLY after a durable commit (moved>0 / bridge upsert written), so targetOrgId is committed.
export async function putRepairMarker(args: {
  unitType: RepairUnitType; unitKey: string; targetOrgId: string; operator: string; createdAt: string;
  sourceType?: string; sourceEntityId?: string; backfillPk?: string | null;
  affectedEventIds?: string[]; movedCount?: number; contactStatus?: string;
}): Promise<void> {
  const item: RepairMarkerItem = {
    ...repairMarkerKeys(args.unitType, args.unitKey),
    GSI1PK: 'CRM_REPAIR#pending', GSI1SK: `${args.createdAt}#${args.unitKey}`,
    entityType: 'CRM_REPAIR',
    unitType: args.unitType, unitKey: args.unitKey,
    targetOrgId: args.targetOrgId, operator: args.operator, createdAt: args.createdAt,
    status: 'pending', stuckReason: null, attemptCount: 0, lastAttemptAt: null, lastError: null,
    ...(args.unitType === 'structured' ? {
      sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk: args.backfillPk ?? null,
      affectedEventIds: args.affectedEventIds ?? [], movedCount: args.movedCount ?? 0, contactStatus: args.contactStatus ?? 'missing_email',
    } : {}),
  };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME(), Item: item }));
}

export async function deleteRepairMarker(unitType: RepairUnitType, unitKey: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME(), Key: repairMarkerKeys(unitType, unitKey) }));
}

// Terminal: move OFF the pending partition; never auto-retried (Health-read-only).
export async function markStuck(m: RepairMarkerItem, reason: 'source_conflict' | 'max_attempts', lastError: string, nowIso: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: repairMarkerKeys(m.unitType, m.unitKey),
    UpdateExpression: 'SET GSI1PK = :g, #s = :st, stuckReason = :sr, lastError = :e, lastAttemptAt = :now, attemptCount = :a',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':g': 'CRM_REPAIR#stuck', ':st': 'stuck', ':sr': reason, ':e': lastError, ':now': nowIso, ':a': (m.attemptCount ?? 0) + 1 },
  }));
}

// Transient failure: stay pending, count the attempt.
export async function bumpAttempt(m: RepairMarkerItem, lastError: string, nowIso: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: repairMarkerKeys(m.unitType, m.unitKey),
    UpdateExpression: 'SET attemptCount = :a, lastError = :e, lastAttemptAt = :now',
    ExpressionAttributeValues: { ':a': (m.attemptCount ?? 0) + 1, ':e': lastError, ':now': nowIso },
  }));
}

// Progress (analytics retro hasMore): stay pending, not an error.
export async function touchInProgress(m: RepairMarkerItem, nowIso: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: repairMarkerKeys(m.unitType, m.unitKey),
    UpdateExpression: 'SET lastAttemptAt = :now',
    ExpressionAttributeValues: { ':now': nowIso },
  }));
}

export async function queryPendingMarkers(limit: number): Promise<{ markers: RepairMarkerItem[]; hasMore: boolean }> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'CRM_REPAIR#pending' },
    ScanIndexForward: true, // oldest-first (GSI1SK = createdAt#unitKey)
    Limit: limit,
  }));
  return { markers: (res.Items ?? []) as RepairMarkerItem[], hasMore: !!res.LastEvaluatedKey };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/repairMarker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/repair/repairMarker.ts amplify/functions/crm-api/lib/repair/repairMarker.test.ts
git commit -m "feat(3C): repair marker store (put/delete/markStuck/bumpAttempt/queryPending)"
```

---

### Task 3: Shared replay — structured (backfill re-resolution + deterministic audit)

**Files:**
- Create: `amplify/functions/crm-api/lib/repair/replaySideEffects.ts`
- Test: `amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const writeLinkAuditLog = vi.fn();
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (...a: unknown[]) => writeLinkAuditLog(...a) }));
import { replayStructuredSideEffects } from './replaySideEffects';

const base = { sourceType: 'rfq', sourceEntityId: '1', backfillPk: 'RFQ#1', targetOrgId: 'acme.com',
  unitKey: 'unresolved-rfq-1', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z',
  affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked' };

beforeEach(() => { send.mockReset(); writeLinkAuditLog.mockReset(); writeLinkAuditLog.mockResolvedValue('audit-x'); });

describe('replayStructuredSideEffects', () => {
  it('ok: backfill written + audit written with deterministic id', async () => {
    send.mockResolvedValueOnce({}); // conditional Update succeeds
    const r = await replayStructuredSideEffects(base);
    expect(r).toEqual({ ok: true, backfillStatus: 'written' });
    expect(writeLinkAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^audit-[0-9a-f]{16}$/), reason: 'manual_link_unit', timestamp: base.createdAt,
      details: expect.objectContaining({ sourceBackfillStatus: 'written', affectedEventIds: ['e1'] }),
    }));
  });
  it('already_set: conditional fails but source already points at target → ok', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { matchedOrgId: 'acme.com' } }); // Get
    const r = await replayStructuredSideEffects(base);
    expect(r.ok).toBe(true); expect(r.backfillStatus).toBe('already_set');
  });
  it('source_conflict: source points at a DIFFERENT real org → audit still written, not ok', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ccfe'), { name: 'ConditionalCheckFailedException' }));
    send.mockResolvedValueOnce({ Item: { matchedOrgId: 'other.com' } });
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' });
    expect(writeLinkAuditLog).toHaveBeenCalled(); // audit written despite conflict
  });
  it('audit CCFE (already written) is idempotent success, not transient', async () => {
    send.mockResolvedValueOnce({}); // backfill ok
    writeLinkAuditLog.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const r = await replayStructuredSideEffects(base);
    expect(r.ok).toBe(true);
  });
  it('transient: backfill Update throws a non-CCFE error → transient', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const r = await replayStructuredSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('logistics with NO cached backfillPk re-resolves via LOGISTICS META Get', async () => {
    send.mockResolvedValueOnce({ Item: { relatedOrderId: 'o9' } }); // resolveBackfillPk Get
    send.mockResolvedValueOnce({}); // backfill Update on ORDER#o9
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'logistics', sourceEntityId: 'lc1', backfillPk: null });
    expect(r.ok).toBe(true);
    const updateInput = send.mock.calls[1][0].input;
    expect(updateInput.Key.PK).toBe('ORDER#o9');
  });
  it('logistics re-resolve Get throws → transient (never a lost backfill)', async () => {
    send.mockRejectedValueOnce(new Error('get boom'));
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'logistics', sourceEntityId: 'lc1', backfillPk: null });
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('no source (pk resolves null) → no_source counts as ok', async () => {
    const r = await replayStructuredSideEffects({ ...base, sourceType: 'quote', sourceEntityId: 'q1', backfillPk: null });
    expect(r).toMatchObject({ ok: true, backfillStatus: 'no_source' });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the structured half of `replaySideEffects.ts`**

Create `amplify/functions/crm-api/lib/repair/replaySideEffects.ts`:
```ts
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { writeLinkAuditLog } from '../auditStore';
import { deterministicAuditId } from '../idGenerators';

export type BackfillStatus = 'written' | 'already_set' | 'conflict' | 'no_source';

// Contract: NEVER throws out. transient dominates conflict/in_progress. Extra fields feed the
// happy-path orchestrators' return values; the drainer only reads ok + errorType.
export interface ReplayResult {
  ok: boolean;
  errorType?: 'transient' | 'source_conflict' | 'in_progress';
  error?: string;
  backfillStatus?: BackfillStatus;   // structured
  sessionsResolved?: number;         // analytics
  pending?: boolean;                 // analytics (retro hasMore)
  retroSummary?: Record<string, unknown>; // analytics
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const SOURCE_PK: Record<string, (id: string) => string> = { rfq: (id) => `RFQ#${id}`, lead: (id) => `LEAD#${id}`, order: (id) => `ORDER#${id}` };

// Drain-safe pk resolution (no `events`): pure for rfq/lead/order, a Get for logistics.
// Quote is unresolvable here (needs in-memory events) → caller MUST cache backfillPk at link time.
export async function resolveBackfillPk(sourceType: string, sourceEntityId: string): Promise<string | null> {
  if (SOURCE_PK[sourceType]) return SOURCE_PK[sourceType](sourceEntityId);
  if (sourceType === 'logistics') {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `LOGISTICS#${sourceEntityId}`, SK: 'META' } }));
    const rel = (res.Item as Record<string, unknown> | undefined)?.relatedOrderId as string | undefined;
    return rel ? `ORDER#${rel}` : null;
  }
  return null;
}

async function backfillByPk(pk: string, targetOrgId: string): Promise<BackfillStatus> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
      UpdateExpression: 'SET matchedOrgId = :o',
      ConditionExpression: 'attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres)',
      ExpressionAttributeValues: { ':o': targetOrgId, ':empty': '', ':unres': 'unresolved-', ':nullType': 'NULL' },
    }));
    return 'written';
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    const cur = (await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }))).Item as Record<string, unknown> | undefined;
    return (cur?.matchedOrgId as string | undefined) === targetOrgId ? 'already_set' : 'conflict';
  }
}

// audit CCFE = row already exists = idempotent success (NOT transient).
async function writeAuditIdempotent(args: Parameters<typeof writeLinkAuditLog>[0]): Promise<string | undefined> {
  try { await writeLinkAuditLog(args); return undefined; }
  catch (err) { return (err as { name?: string }).name === 'ConditionalCheckFailedException' ? undefined : msg(err); }
}

export async function replayStructuredSideEffects(args: {
  sourceType: string; sourceEntityId: string; backfillPk: string | null;
  targetOrgId: string; unitKey: string; operator: string; createdAt: string;
  affectedEventIds: string[]; movedCount: number; contactStatus: string;
}): Promise<ReplayResult> {
  let transientError: string | undefined;

  // 1. resolve pk (cached else drain-safe resolve)
  let pk = args.backfillPk;
  if (!pk) {
    try { pk = await resolveBackfillPk(args.sourceType, args.sourceEntityId); }
    catch (err) { return { ok: false, errorType: 'transient', error: msg(err) }; }
  }

  // 2. backfill
  let backfillStatus: BackfillStatus = 'no_source';
  if (pk) {
    try { backfillStatus = await backfillByPk(pk, args.targetOrgId); }
    catch (err) { transientError = msg(err); }
  }

  // 3. audit (deterministic id, always attempted so a conflict does not lose the audit)
  const auditErr = await writeAuditIdempotent({
    id: deterministicAuditId('manual_link_unit', args.unitKey, args.targetOrgId),
    operator: args.operator, reason: 'manual_link_unit', timestamp: args.createdAt, newOrgId: args.targetOrgId,
    details: { unitType: 'structured', unitKey: args.unitKey, targetOrgId: args.targetOrgId,
               affectedCount: args.movedCount, affectedEventIds: args.affectedEventIds,
               sourceBackfillStatus: backfillStatus, contactStatus: args.contactStatus },
  });
  transientError = transientError ?? auditErr;

  // 4. decide (transient dominates conflict)
  if (transientError) return { ok: false, errorType: 'transient', error: transientError, backfillStatus };
  if (backfillStatus === 'conflict') return { ok: false, errorType: 'source_conflict', backfillStatus };
  return { ok: true, backfillStatus };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/repair/replaySideEffects.ts amplify/functions/crm-api/lib/repair/replaySideEffects.structured.test.ts
git commit -m "feat(3C): replayStructuredSideEffects — backfill re-resolution + deterministic audit"
```

---

### Task 4: Shared replay — analytics (retro + deterministic audit)

**Files:**
- Modify: `amplify/functions/crm-api/lib/repair/replaySideEffects.ts`
- Test: `amplify/functions/crm-api/lib/repair/replaySideEffects.analytics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/lib/repair/replaySideEffects.analytics.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../dynamodb', () => ({ docClient: { send: vi.fn() }, TABLE_NAME: () => 'T' }));
const writeLinkAuditLog = vi.fn();
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (...a: unknown[]) => writeLinkAuditLog(...a) }));
const reResolve = vi.fn();
vi.mock('../analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (...a: unknown[]) => reResolve(...a) }));
import { replayAnalyticsSideEffects } from './replaySideEffects';

const base = { visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: '2026-07-08T00:00:00.000Z' };
beforeEach(() => { writeLinkAuditLog.mockReset(); writeLinkAuditLog.mockResolvedValue('a'); reResolve.mockReset(); });

describe('replayAnalyticsSideEffects', () => {
  it('ok: retro done (hasMore false) + audit written with deterministic id', async () => {
    reResolve.mockResolvedValueOnce({ summary: { reemitted: 2, hasMore: false } });
    const r = await replayAnalyticsSideEffects(base);
    expect(r.ok).toBe(true); expect(r.pending).toBe(false);
    expect(writeLinkAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^audit-[0-9a-f]{16}$/), reason: 'manual_link_visitor',
      details: expect.objectContaining({ unitType: 'analytics', retroSummary: expect.any(Object) }),
    }));
  });
  it('in_progress: retro hasMore → not ok, marker kept', async () => {
    reResolve.mockResolvedValueOnce({ summary: { reemitted: 5, hasMore: true } });
    const r = await replayAnalyticsSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'in_progress', pending: true });
    expect(writeLinkAuditLog).toHaveBeenCalled(); // audit still written
  });
  it('transient: retro throws → transient (audit still attempted, idempotent)', async () => {
    reResolve.mockRejectedValueOnce(new Error('boom'));
    const r = await replayAnalyticsSideEffects(base);
    expect(r).toMatchObject({ ok: false, errorType: 'transient' });
  });
  it('audit CCFE is idempotent success, not transient', async () => {
    reResolve.mockResolvedValueOnce({ summary: { hasMore: false } });
    writeLinkAuditLog.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'ConditionalCheckFailedException' }));
    const r = await replayAnalyticsSideEffects(base);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/replaySideEffects.analytics.test.ts`
Expected: FAIL — `replayAnalyticsSideEffects is not a function`.

- [ ] **Step 3: Append `replayAnalyticsSideEffects` to `replaySideEffects.ts`**

Add the import at the top of `amplify/functions/crm-api/lib/repair/replaySideEffects.ts`:
```ts
import { reResolveVisitorSessions } from '../analytics/reResolveVisitorSessions';
```
And append the function (reuse the existing module-private `msg` and `writeAuditIdempotent`):
```ts
export async function replayAnalyticsSideEffects(args: {
  visitorId: string; targetOrgId: string; operator: string; createdAt: string;
}): Promise<ReplayResult> {
  let transientError: string | undefined;
  let summary: Record<string, unknown> = {};
  let hasMore = false;

  try {
    const retro = await reResolveVisitorSessions({ visitorId: args.visitorId });
    summary = (retro?.summary ?? {}) as Record<string, unknown>;
    hasMore = summary.hasMore === true;
  } catch (err) { transientError = msg(err); }

  const auditErr = await writeAuditIdempotent({
    id: deterministicAuditId('manual_link_visitor', args.visitorId, args.targetOrgId),
    operator: args.operator, reason: 'manual_link_visitor', timestamp: args.createdAt, newOrgId: args.targetOrgId,
    details: { unitType: 'analytics', unitKey: args.visitorId, targetOrgId: args.targetOrgId, retroSummary: summary },
  });
  transientError = transientError ?? auditErr;

  // Preserve linkVisitor's existing return expression exactly (no behavior change vs 3B).
  const sessionsResolved = Number(summary.resolved ?? summary.emitted ?? 0);
  if (transientError) return { ok: false, errorType: 'transient', error: transientError, sessionsResolved, pending: hasMore, retroSummary: summary };
  if (hasMore) return { ok: false, errorType: 'in_progress', sessionsResolved, pending: true, retroSummary: summary };
  return { ok: true, sessionsResolved, pending: false, retroSummary: summary };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/replaySideEffects.analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/repair/replaySideEffects.ts amplify/functions/crm-api/lib/repair/replaySideEffects.analytics.test.ts
git commit -m "feat(3C): replayAnalyticsSideEffects — retro + deterministic audit"
```

---

### Task 5: Wire `linkStructuredUnit` to marker + shared replay

**Files:**
- Modify: `amplify/functions/crm-api/lib/link/linkStructuredUnit.ts`
- Test: `amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts` (exists — ADD cases)

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

Append cases (mirror the file's existing mock setup — it mocks `docClient`, `orgStore`, `manualMoveTimelineEvent`, `sourceEmail`, `auditStore`). Add mocks for the two new modules at the top-level `vi.mock` block if not present:
```ts
// add near the other vi.mock calls:
const putRepairMarker = vi.fn(); const deleteRepairMarker = vi.fn();
vi.mock('../repair/repairMarker', () => ({
  putRepairMarker: (...a: unknown[]) => putRepairMarker(...a),
  deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a),
}));
const replayStructuredSideEffects = vi.fn();
vi.mock('../repair/replaySideEffects', () => ({ replayStructuredSideEffects: (...a: unknown[]) => replayStructuredSideEffects(...a) }));
// reset them in beforeEach; default replay ok:
// putRepairMarker.mockReset(); deleteRepairMarker.mockReset(); replayStructuredSideEffects.mockReset();
// replayStructuredSideEffects.mockResolvedValue({ ok: true, backfillStatus: 'written' });
```
Cases:
```ts
it('writes a repair marker AFTER commit then deletes it on replay ok', async () => {
  // arrange: one unresolved event moved successfully (reuse the file's happy-path arrange)
  // ...set up query returning 1 event, manualMove → { moved:true, contactStatus:'linked' }...
  const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
  expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'structured', targetOrgId: 'acme.com' }));
  expect(replayStructuredSideEffects).toHaveBeenCalled();
  expect(deleteRepairMarker).toHaveBeenCalledWith('structured', 'unresolved-rfq-1');
  expect(out.postCommitStatus).toBe('ok');
});
it('keeps the marker (no delete) + post_commit_failed when replay is not ok', async () => {
  replayStructuredSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient', backfillStatus: 'written' });
  const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
  expect(deleteRepairMarker).not.toHaveBeenCalled();
  expect(out.postCommitStatus).toBe('post_commit_failed');
});
it('moved===0 does NOT put a marker', async () => {
  // arrange: event(s) present but manualMove → { moved:false, skipped:true }
  const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
  expect(out.moved).toBe(0);
  expect(putRepairMarker).not.toHaveBeenCalled();
});
it('empty synthetic partition (alreadyLinked) does NOT put a marker', async () => {
  // arrange: query returns zero events
  const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
  expect(out.alreadyLinked).toBe(true);
  expect(putRepairMarker).not.toHaveBeenCalled();
});
it('marker still written when link-time backfillTargetPk throws (logistics), with backfillPk null', async () => {
  // arrange: one moved event; make readSourceEmailForUnit ok; force backfillTargetPk to throw for logistics
  // (mock ../link/sourceEmail backfillTargetPk to reject once)
  const out = await linkStructuredUnit({ sourceType: 'logistics', sourceEntityId: 'lc1', targetOrgId: 'acme.com', operator: 'op' });
  expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ backfillPk: null, sourceType: 'logistics' }));
  expect(out.moved).toBe(1);
});
it('deleteRepairMarker failure ⇒ success + post_commit_failed (drainer will re-drive)', async () => {
  deleteRepairMarker.mockRejectedValueOnce(new Error('delete boom'));
  const out = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: '1', targetOrgId: 'acme.com', operator: 'op' });
  expect(out.postCommitStatus).toBe('post_commit_failed');
});
it('quote marker always caches backfillPk (order) from in-memory events', async () => {
  // arrange: one moved quote event with payload.orderId = 'o9'
  await linkStructuredUnit({ sourceType: 'quote', sourceEntityId: 'q1', targetOrgId: 'acme.com', operator: 'op' });
  expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ backfillPk: 'ORDER#o9' }));
});
```
Note: the existing file already mocks `backfillTargetPk`? It is imported from `./sourceEmail` inside `linkStructuredUnit` via `backfillSource`. After this task `backfillSource` is removed (replay owns backfill), and `backfillTargetPk` is called directly for caching — so ensure `../link/sourceEmail` is mocked to expose `backfillTargetPk` and `readSourceEmailForUnit`, `backfillTargetPk` (mockResolvedValue e.g. `'RFQ#1'`, or the quote/logistics variants per case).

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts`
Expected: FAIL — marker not written; `backfillSource` still used.

- [ ] **Step 3: Rewrite the post-commit block of `linkStructuredUnit.ts`**

Replace the imports of `writeLinkAuditLog` and the `backfillSource` helper + the post-`moved` block. New imports:
```ts
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { manualMoveTimelineEvent, type ContactStatus } from './manualMoveTimelineEvent';
import { readSourceEmailForUnit, backfillTargetPk } from './sourceEmail';
import { putRepairMarker, deleteRepairMarker } from '../repair/repairMarker';
import { replayStructuredSideEffects } from '../repair/replaySideEffects';
import type { TimelineEventItem } from '../types';
```
(Delete the `GetCommand, UpdateCommand` import and the `writeLinkAuditLog` import and the whole `backfillSource` function and the `BackfillStatus` type — they now live in `replaySideEffects.ts`.)

Replace everything from `if (moved === 0) return ...` to the end of `linkStructuredUnit`:
```ts
  if (moved === 0) return { affected: events.length, moved: 0, skipped, errors };

  // Resolve the backfill PK best-effort for caching. logistics does a Get that CAN throw; if it does,
  // the marker is still written with backfillPk:null and the drainer re-resolves (spec §5).
  let backfillPk: string | null = null;
  try { backfillPk = await backfillTargetPk(args.sourceType, args.sourceEntityId, events); } catch { /* drainer re-resolves */ }

  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';

  // Marker written AFTER the durable commit (moved>0), BEFORE the fragile side effects, carrying the committed target.
  try {
    await putRepairMarker({
      unitType: 'structured', unitKey: syntheticOrgId, targetOrgId: args.targetOrgId, operator: args.operator, createdAt: nowIso,
      sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk,
      affectedEventIds, movedCount: moved, contactStatus,
    });
  } catch (err) {
    postCommitStatus = 'post_commit_failed';
    console.error(JSON.stringify({ event: 'crm.link.marker_put_error', unitKey: syntheticOrgId, error: err instanceof Error ? err.message : String(err) }));
  }

  const replay = await replayStructuredSideEffects({
    sourceType: args.sourceType, sourceEntityId: args.sourceEntityId, backfillPk, targetOrgId: args.targetOrgId,
    unitKey: syntheticOrgId, operator: args.operator, createdAt: nowIso, affectedEventIds, movedCount: moved, contactStatus,
  });
  if (replay.ok) {
    try { await deleteRepairMarker('structured', syntheticOrgId); }
    catch { postCommitStatus = 'post_commit_failed'; }
  } else {
    postCommitStatus = 'post_commit_failed';
  }

  return { affected: events.length, moved, skipped, errors, sourceBackfillStatus: replay.backfillStatus ?? 'not_attempted', contactStatus, postCommitStatus };
```

- [ ] **Step 4: Run — expect PASS (whole file)**

Run: `npx vitest run amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts`
Expected: PASS (existing cases still green; new cases green).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/link/linkStructuredUnit.ts amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts
git commit -m "feat(3C): linkStructuredUnit writes repair marker + shared replay"
```

---

### Task 6: Wire `linkVisitor` to marker + shared replay

**Files:**
- Modify: `amplify/functions/crm-api/lib/link/linkVisitor.ts`
- Test: `amplify/functions/crm-api/lib/link/linkVisitor.test.ts` (exists — ADD cases)

- [ ] **Step 1: Write the failing tests (append)**

Add mocks (top-level) + cases:
```ts
const putRepairMarker = vi.fn(); const deleteRepairMarker = vi.fn();
vi.mock('../repair/repairMarker', () => ({ putRepairMarker: (...a: unknown[]) => putRepairMarker(...a), deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a) }));
const replayAnalyticsSideEffects = vi.fn();
vi.mock('../repair/replaySideEffects', () => ({ replayAnalyticsSideEffects: (...a: unknown[]) => replayAnalyticsSideEffects(...a) }));
// beforeEach: reset; replayAnalyticsSideEffects.mockResolvedValue({ ok: true, sessionsResolved: 2, pending: false });
```
```ts
it('written bridge → marker after commit, replay, delete on ok', async () => {
  // arrange: readVisitorBridge → undefined (no bridge); upsertManualVisitorBridge → { written:true }
  const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
  expect(putRepairMarker).toHaveBeenCalledWith(expect.objectContaining({ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com' }));
  expect(deleteRepairMarker).toHaveBeenCalledWith('analytics', 'v1');
  expect(out.postCommitStatus).toBe('ok');
  expect(out.sessionsResolved).toBe(2);
});
it('replay not ok → keep marker + post_commit_failed', async () => {
  replayAnalyticsSideEffects.mockResolvedValueOnce({ ok: false, errorType: 'transient', pending: false, sessionsResolved: 0 });
  const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
  expect(deleteRepairMarker).not.toHaveBeenCalled();
  expect(out.postCommitStatus).toBe('post_commit_failed');
});
it('already-manual bridge → NO marker (existing idempotent retro only)', async () => {
  // arrange: readVisitorBridge → { orgSource:'manual', matchedOrgId:'acme.com' }
  const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
  expect(out.alreadyLinked).toBe(true);
  expect(putRepairMarker).not.toHaveBeenCalled();
});
it('lost race (upsert not written) → NO marker', async () => {
  // arrange: readVisitorBridge → undefined; upsert → { written:false, existingOrgId:'x' }
  const out = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
  expect(out.alreadyResolved).toBe(true);
  expect(putRepairMarker).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/link/linkVisitor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `linkVisitor.ts`**

```ts
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { readVisitorBridge, upsertManualVisitorBridge, toSend } from '../../../../lib/crm/visitor-bridge';
import { reResolveVisitorSessions } from '../analytics/reResolveVisitorSessions';
import { putRepairMarker, deleteRepairMarker } from '../repair/repairMarker';
import { replayAnalyticsSideEffects } from '../repair/replaySideEffects';

export async function linkVisitor(args: { visitorId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);
  const send = toSend(docClient);
  const bridge = await readVisitorBridge(send, TABLE_NAME(), args.visitorId);

  if (bridge?.orgSource === 'manual') {
    // already committed-manual: heal sessions a prior attempt's retro missed (idempotent). NO marker.
    let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';
    try { await reResolveVisitorSessions({ visitorId: args.visitorId }); }
    catch (err) {
      postCommitStatus = 'post_commit_failed';
      console.error(JSON.stringify({ event: 'crm.link.post_commit_error', visitorId: args.visitorId, phase: 'repair_retro', error: err instanceof Error ? err.message : String(err) }));
    }
    return { alreadyLinked: true, existingOrgId: bridge.matchedOrgId, postCommitStatus };
  }
  if (bridge?.matchedOrgId) return { alreadyResolved: true, existingOrgId: bridge.matchedOrgId };

  const nowIso = new Date().toISOString();
  const up = await upsertManualVisitorBridge(send, TABLE_NAME(), { visitorId: args.visitorId, matchedOrgId: args.targetOrgId, now: nowIso });
  if (!up.written) return { alreadyResolved: true, existingOrgId: up.existingOrgId };

  let postCommitStatus: 'ok' | 'post_commit_failed' = 'ok';
  try {
    await putRepairMarker({ unitType: 'analytics', unitKey: args.visitorId, targetOrgId: args.targetOrgId, operator: args.operator, createdAt: nowIso });
  } catch (err) {
    postCommitStatus = 'post_commit_failed';
    console.error(JSON.stringify({ event: 'crm.link.marker_put_error', visitorId: args.visitorId, error: err instanceof Error ? err.message : String(err) }));
  }

  const replay = await replayAnalyticsSideEffects({ visitorId: args.visitorId, targetOrgId: args.targetOrgId, operator: args.operator, createdAt: nowIso });
  if (replay.ok) {
    try { await deleteRepairMarker('analytics', args.visitorId); }
    catch { postCommitStatus = 'post_commit_failed'; }
  } else {
    postCommitStatus = 'post_commit_failed';
  }

  return { sessionsResolved: replay.sessionsResolved ?? 0, pending: replay.pending ?? false, existingOrgId: args.targetOrgId, postCommitStatus };
}
```

- [ ] **Step 4: Run — expect PASS (whole file)**

Run: `npx vitest run amplify/functions/crm-api/lib/link/linkVisitor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/link/linkVisitor.ts amplify/functions/crm-api/lib/link/linkVisitor.test.ts
git commit -m "feat(3C): linkVisitor writes repair marker + shared replay"
```

---

### Task 7: Widen sweep unions + `releaseLeaseKeepCursor` optional `hasMore`

**Files:**
- Modify: `amplify/functions/crm-api/lib/sweep/sweepState.ts`
- Test: `amplify/functions/crm-api/lib/sweep/sweepState.test.ts` (exists — ADD a case)

- [ ] **Step 1: Write the failing test (append)**

```ts
it('releaseLeaseKeepCursor keeps hasMore:true when passed (defaults false)', async () => {
  // the file mocks docClient.send — assert the UpdateExpression sets hasMore from the arg
  await releaseLeaseKeepCursor('repair', 'drain', 'tok', { lastSummary: { repaired: 1 }, hasMore: true });
  const input = sendMock.mock.calls.at(-1)![0].input;
  expect(input.ExpressionAttributeValues[':f']).toBe(true);
  // default path unchanged:
  await releaseLeaseKeepCursor('analytics', 'sessions', 'tok', { lastSummary: {} });
  const input2 = sendMock.mock.calls.at(-1)![0].input;
  expect(input2.ExpressionAttributeValues[':f']).toBe(false);
});
```
(Use whatever `send` mock accessor `sweepState.test.ts` already defines.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/sweepState.test.ts`
Expected: FAIL — `hasMore` ignored (always false).

- [ ] **Step 3: Widen unions + add the param**

In `amplify/functions/crm-api/lib/sweep/sweepState.ts`:
```ts
export type SweepMode = 'hot' | 'cold' | 'analytics' | 'repair';
export type SweepPass = 'existence' | 'dirty-rollups' | 'sessions' | 'drain';
```
Change `releaseLeaseKeepCursor` to accept optional `hasMore` (default false):
```ts
export async function releaseLeaseKeepCursor(mode: SweepMode, pass: SweepPass, leaseToken: string, p: { lastSummary: Record<string, unknown>; hasMore?: boolean }): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: stateKey(mode, pass),
    UpdateExpression: 'SET hasMore = :f, lastSummary = :s, lastCompletedAt = :now REMOVE lease, leaseExpiresAt',
    ConditionExpression: 'lease = :token',
    ExpressionAttributeValues: { ':f': p.hasMore ?? false, ':s': p.lastSummary, ':now': new Date().toISOString(), ':token': leaseToken },
  }));
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/sweep/sweepState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/sweep/sweepState.ts amplify/functions/crm-api/lib/sweep/sweepState.test.ts
git commit -m "feat(3C): widen sweep unions (repair/drain) + releaseLeaseKeepCursor hasMore"
```

---

### Task 8: `reconcileRepair` drainer

**Files:**
- Create: `amplify/functions/crm-api/lib/repair/reconcileRepair.ts`
- Test: `amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const acquireLease = vi.fn(); const releaseLeaseKeepCursor = vi.fn();
vi.mock('../sweep/sweepState', () => ({
  acquireLease: (...a: unknown[]) => acquireLease(...a),
  releaseLeaseKeepCursor: (...a: unknown[]) => releaseLeaseKeepCursor(...a),
}));
const queryPendingMarkers = vi.fn(); const deleteRepairMarker = vi.fn();
const markStuck = vi.fn(); const bumpAttempt = vi.fn(); const touchInProgress = vi.fn();
vi.mock('./repairMarker', () => ({
  queryPendingMarkers: (...a: unknown[]) => queryPendingMarkers(...a),
  deleteRepairMarker: (...a: unknown[]) => deleteRepairMarker(...a),
  markStuck: (...a: unknown[]) => markStuck(...a),
  bumpAttempt: (...a: unknown[]) => bumpAttempt(...a),
  touchInProgress: (...a: unknown[]) => touchInProgress(...a),
}));
const replayStructured = vi.fn(); const replayAnalytics = vi.fn();
vi.mock('./replaySideEffects', () => ({
  replayStructuredSideEffects: (...a: unknown[]) => replayStructured(...a),
  replayAnalyticsSideEffects: (...a: unknown[]) => replayAnalytics(...a),
}));
import { reconcileRepair } from './reconcileRepair';

const struct = { unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', operator: 'op', createdAt: 't',
  sourceType: 'rfq', sourceEntityId: '1', backfillPk: 'RFQ#1', affectedEventIds: ['e1'], movedCount: 1, contactStatus: 'linked', attemptCount: 0 };
const ana = { unitType: 'analytics', unitKey: 'v1', targetOrgId: 'acme.com', operator: 'op', createdAt: 't', attemptCount: 0 };

beforeEach(() => {
  [acquireLease, releaseLeaseKeepCursor, queryPendingMarkers, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, replayStructured, replayAnalytics].forEach((m) => m.mockReset());
  acquireLease.mockResolvedValue('tok');
  queryPendingMarkers.mockResolvedValue({ markers: [], hasMore: false });
});

describe('reconcileRepair', () => {
  it('lease held → skippedLeaseHeld, no query', async () => {
    acquireLease.mockResolvedValueOnce(null);
    const out = await reconcileRepair({});
    expect(out).toEqual({ skippedLeaseHeld: true });
    expect(queryPendingMarkers).not.toHaveBeenCalled();
  });
  it('replay ok → delete marker (repaired++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: true, backfillStatus: 'written' });
    const out = await reconcileRepair({});
    expect(deleteRepairMarker).toHaveBeenCalledWith('structured', 'u1');
    expect(out.repaired).toBe(1);
    expect(releaseLeaseKeepCursor).toHaveBeenCalledWith('repair', 'drain', 'tok', expect.objectContaining({ hasMore: false }));
  });
  it('in_progress (analytics retro hasMore) → touchInProgress, keep', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [ana], hasMore: false });
    replayAnalytics.mockResolvedValueOnce({ ok: false, errorType: 'in_progress', pending: true });
    const out = await reconcileRepair({});
    expect(touchInProgress).toHaveBeenCalled();
    expect(deleteRepairMarker).not.toHaveBeenCalled();
    expect(out.inProgress).toBe(1);
  });
  it('source_conflict → markStuck(source_conflict) immediately (blocked++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'source_conflict', backfillStatus: 'conflict' });
    const out = await reconcileRepair({});
    expect(markStuck).toHaveBeenCalledWith(struct, 'source_conflict', expect.any(String), expect.any(String));
    expect(out.blocked).toBe(1);
  });
  it('transient below MAX → bumpAttempt (retrying++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...struct, attemptCount: 1 }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'transient', error: 'boom' });
    const out = await reconcileRepair({});
    expect(bumpAttempt).toHaveBeenCalled();
    expect(out.retrying).toBe(1);
  });
  it('transient at MAX → markStuck(max_attempts) (stuck++)', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [{ ...struct, attemptCount: 4 }], hasMore: false });
    replayStructured.mockResolvedValueOnce({ ok: false, errorType: 'transient', error: 'boom' });
    const out = await reconcileRepair({});
    expect(markStuck).toHaveBeenCalledWith(expect.objectContaining({ attemptCount: 4 }), 'max_attempts', 'boom', expect.any(String));
    expect(out.stuck).toBe(1);
  });
  it('propagates hasMore:true to releaseLeaseKeepCursor', async () => {
    queryPendingMarkers.mockResolvedValueOnce({ markers: [struct], hasMore: true });
    replayStructured.mockResolvedValueOnce({ ok: true });
    const out = await reconcileRepair({ limit: 1 });
    expect(out.hasMore).toBe(true);
    expect(releaseLeaseKeepCursor).toHaveBeenCalledWith('repair', 'drain', 'tok', expect.objectContaining({ hasMore: true }));
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `reconcileRepair.ts`**

Create `amplify/functions/crm-api/lib/repair/reconcileRepair.ts`:
```ts
import { acquireLease, releaseLeaseKeepCursor } from '../sweep/sweepState';
import { queryPendingMarkers, deleteRepairMarker, markStuck, bumpAttempt, touchInProgress, type RepairMarkerItem } from './repairMarker';
import { replayStructuredSideEffects, replayAnalyticsSideEffects, type ReplayResult } from './replaySideEffects';

const LAMBDA_TIMEOUT_SEC = 120; // keep in sync with crm-api/resource.ts
const MAX_ATTEMPTS = 5;

async function replayFor(m: RepairMarkerItem): Promise<ReplayResult> {
  if (m.unitType === 'analytics') {
    return replayAnalyticsSideEffects({ visitorId: m.unitKey, targetOrgId: m.targetOrgId, operator: m.operator, createdAt: m.createdAt });
  }
  return replayStructuredSideEffects({
    sourceType: m.sourceType ?? '', sourceEntityId: m.sourceEntityId ?? '', backfillPk: m.backfillPk ?? null,
    targetOrgId: m.targetOrgId, unitKey: m.unitKey, operator: m.operator, createdAt: m.createdAt,
    affectedEventIds: m.affectedEventIds ?? [], movedCount: m.movedCount ?? 0, contactStatus: m.contactStatus ?? 'missing_email',
  });
}

export async function reconcileRepair(args: { limit?: number }): Promise<Record<string, unknown>> {
  const nowIso = new Date().toISOString();
  const lease = await acquireLease('repair', 'drain', LAMBDA_TIMEOUT_SEC, nowIso);
  if (!lease) return { skippedLeaseHeld: true };

  const limit = args.limit ?? 100;
  const counters = { examined: 0, repaired: 0, inProgress: 0, blocked: 0, retrying: 0, stuck: 0 };
  const { markers, hasMore } = await queryPendingMarkers(limit);

  for (const m of markers) {
    counters.examined += 1;
    const r = await replayFor(m);
    if (r.ok) {
      await deleteRepairMarker(m.unitType, m.unitKey); counters.repaired += 1;
    } else if (r.errorType === 'in_progress') {
      await touchInProgress(m, nowIso); counters.inProgress += 1;
    } else if (r.errorType === 'source_conflict') {
      await markStuck(m, 'source_conflict', 'source_conflict', nowIso); counters.blocked += 1;
    } else { // transient
      const err = r.error ?? 'transient';
      if ((m.attemptCount ?? 0) + 1 >= MAX_ATTEMPTS) { await markStuck(m, 'max_attempts', err, nowIso); counters.stuck += 1; }
      else { await bumpAttempt(m, err, nowIso); counters.retrying += 1; }
    }
  }

  const summary = { ...counters, hasMore };
  await releaseLeaseKeepCursor('repair', 'drain', lease, { lastSummary: summary, hasMore });
  console.log(JSON.stringify({ event: 'crm.repair.summary', ...summary }));
  return summary;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/repair/reconcileRepair.ts amplify/functions/crm-api/lib/repair/reconcileRepair.test.ts
git commit -m "feat(3C): reconcileRepair drainer (transition matrix + lease + hasMore)"
```

---

### Task 9: `crmHealth` read (zero-scan)

**Files:**
- Create: `amplify/functions/crm-api/lib/repair/crmHealth.ts`
- Test: `amplify/functions/crm-api/lib/repair/crmHealth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `amplify/functions/crm-api/lib/repair/crmHealth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => send(...a) }, TABLE_NAME: () => 'T' }));
const readState = vi.fn();
vi.mock('../sweep/sweepState', () => ({ readState: (...a: unknown[]) => readState(...a) }));
import { crmHealth } from './crmHealth';

beforeEach(() => {
  send.mockReset(); readState.mockReset();
  // two GSI1 Queries: pending, stuck
  send.mockImplementation((cmd: { input: { ExpressionAttributeValues: Record<string, string> } }) => {
    const pk = cmd.input.ExpressionAttributeValues[':pk'];
    if (pk === 'CRM_REPAIR#pending') return Promise.resolve({ Items: [{ unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', attemptCount: 1, lastError: 'x', createdAt: 't' }], LastEvaluatedKey: undefined });
    return Promise.resolve({ Items: [{ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'b.com', stuckReason: 'source_conflict', lastError: 'c', createdAt: 't2' }], LastEvaluatedKey: { z: 1 } });
  });
  readState.mockImplementation((mode: string, pass: string) => {
    if (mode === 'repair') return Promise.resolve({ lastSummary: { repaired: 3 } });
    if (mode === 'hot') return Promise.resolve({ lastSummary: { expected: 9 }, hasMore: false });
    if (mode === 'cold' && pass === 'existence') return Promise.resolve({ lastSummary: { expected: 42 }, hasMore: true });
    return Promise.resolve({ lastSummary: { repaired: 2 } }); // cold dirty-rollups
  });
});

describe('crmHealth', () => {
  it('returns bounded repair buckets + four sweep summaries with NO Scan', async () => {
    const h = await crmHealth();
    // no ScanCommand ever constructed:
    for (const c of send.mock.calls) expect(c[0].constructor.name).not.toBe('ScanCommand');
    expect(h.repairPending).toMatchObject({ count: 1, more: false });
    expect((h.repairPending as { sample: unknown[] }).sample[0]).toMatchObject({ unitKey: 'u1' });
    expect(h.repairStuck).toMatchObject({ count: 1, more: true });
    expect(h.lastRepairSummary).toEqual({ repaired: 3 });
    expect(h.lastHotSweep).toMatchObject({ expected: 9, hasMore: false });
    expect(h.lastColdSweep).toMatchObject({ expected: 42, hasMore: true });
    expect(h.lastDirtyRollupSweep).toEqual({ repaired: 2 });
  });
  it('caps the Query Limit at the sample size', async () => {
    await crmHealth();
    for (const c of send.mock.calls) expect(c[0].input.Limit).toBe(25);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/crmHealth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `crmHealth.ts`**

Create `amplify/functions/crm-api/lib/repair/crmHealth.ts`:
```ts
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { readState } from '../sweep/sweepState';
import type { RepairMarkerItem } from './repairMarker';

const SAMPLE = 25;

function toSample(m: RepairMarkerItem) {
  return {
    unitType: m.unitType, unitKey: m.unitKey, targetOrgId: m.targetOrgId,
    attemptCount: m.attemptCount ?? 0, stuckReason: m.stuckReason ?? null,
    lastError: m.lastError ?? null, createdAt: m.createdAt,
  };
}

async function bucket(pk: 'CRM_REPAIR#pending' | 'CRM_REPAIR#stuck') {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
    ScanIndexForward: true, Limit: SAMPLE,
  }));
  const items = (res.Items ?? []) as RepairMarkerItem[];
  // count is a floor (up to SAMPLE); `more` signals the true count exceeds the sample. No Scan.
  return { count: items.length, more: !!res.LastEvaluatedKey, sample: items.map(toSample) };
}

function withHasMore(s: { lastSummary?: Record<string, unknown>; hasMore?: boolean }) {
  return s.lastSummary ? { ...s.lastSummary, hasMore: s.hasMore ?? false } : null;
}

export async function crmHealth(): Promise<Record<string, unknown>> {
  const [pending, stuck, repairState, hotState, coldState, dirtyState] = await Promise.all([
    bucket('CRM_REPAIR#pending'),
    bucket('CRM_REPAIR#stuck'),
    readState('repair', 'drain'),
    readState('hot', 'existence'),
    readState('cold', 'existence'),
    readState('cold', 'dirty-rollups'),
  ]);
  return {
    repairPending: pending,
    repairStuck: stuck,
    lastRepairSummary: repairState.lastSummary ?? null,
    lastHotSweep: withHasMore(hotState),
    lastColdSweep: withHasMore(coldState),
    lastDirtyRollupSweep: dirtyState.lastSummary ?? null,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/lib/repair/crmHealth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/lib/repair/crmHealth.ts amplify/functions/crm-api/lib/repair/crmHealth.test.ts
git commit -m "feat(3C): crmHealth zero-scan read (repair buckets + sweep summaries)"
```

---

### Task 10: Handler wiring — `reconcileRepair` action + `runCrmRepair` + `crmHealth` resolvers

**Files:**
- Modify: `amplify/functions/crm-api/handler.ts`
- Test: `amplify/functions/crm-api/handler.test.ts` (exists — ADD cases; if absent, create following the file's style)

- [ ] **Step 1: Write the failing tests (append or create)**

```ts
// mock the three targets
const reconcileRepair = vi.fn(); const crmHealthFn = vi.fn();
vi.mock('./lib/repair/reconcileRepair', () => ({ reconcileRepair: (...a: unknown[]) => reconcileRepair(...a) }));
vi.mock('./lib/repair/crmHealth', () => ({ crmHealth: (...a: unknown[]) => crmHealthFn(...a) }));
// beforeEach reset; reconcileRepair.mockResolvedValue({ repaired: 0 }); crmHealthFn.mockResolvedValue({ repairPending: { count: 0 } });

it('direct action reconcileRepair dispatches with limit', async () => {
  await handler({ action: 'reconcileRepair', limit: 50 } as never);
  expect(reconcileRepair).toHaveBeenCalledWith({ limit: 50 });
});
it('runCrmRepair mutation dispatches to reconcileRepair', async () => {
  await handler({ info: { fieldName: 'runCrmRepair' }, arguments: { limit: 10 }, identity: { claims: { email: 'a@x' } } } as never);
  expect(reconcileRepair).toHaveBeenCalledWith({ limit: 10 });
});
it('crmHealth query dispatches to crmHealth()', async () => {
  await handler({ info: { fieldName: 'crmHealth' }, arguments: {} } as never);
  expect(crmHealthFn).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: FAIL — unknown fieldName/action.

- [ ] **Step 3: Wire the handler**

In `amplify/functions/crm-api/handler.ts` add imports:
```ts
import { reconcileRepair } from './lib/repair/reconcileRepair';
import { crmHealth } from './lib/repair/crmHealth';
```
Add to the `resolvers` map (AppSync query/mutation):
```ts
  crmHealth: async () => crmHealth(),
  runCrmRepair: async (e) => {
    const a = (e.arguments ?? {}) as { limit?: number };
    return reconcileRepair({ limit: a.limit });
  },
```
Add to the `actions` map (direct-invoke cron) and widen `DirectInvokeEvent` mode type is not needed (repair uses `limit` only):
```ts
  reconcileRepair: async (e) => reconcileRepair({ limit: e.limit }),
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(3C): handler wires reconcileRepair action + runCrmRepair + crmHealth"
```

---

### Task 11: GraphQL schema — customTypes + `crmHealth` query + `runCrmRepair` mutation

**Files:**
- Modify: `amplify/data/resource.ts`

(No unit test — schema is validated by `tsc` + the deploy synth. This task is a checkpoint for typecheck.)

- [ ] **Step 1: Add the customTypes**

In `amplify/data/resource.ts`, next to `LinkVisitorResult` (around line 356), add:
```ts
  RepairMarkerSample: a.customType({
    unitType: a.string(), unitKey: a.string(), targetOrgId: a.string(),
    attemptCount: a.integer(), stuckReason: a.string(), lastError: a.string(), createdAt: a.string(),
  }),
  RepairBucket: a.customType({
    count: a.integer().required(), more: a.boolean().required(),
    sample: a.ref('RepairMarkerSample').array().required(),
  }),
  CrmHealthResult: a.customType({
    repairPending: a.ref('RepairBucket').required(),
    repairStuck: a.ref('RepairBucket').required(),
    lastRepairSummary: a.json(),
    lastHotSweep: a.json(),
    lastColdSweep: a.json(),
    lastDirtyRollupSweep: a.json(),
  }),
  RunCrmRepairResult: a.customType({
    skippedLeaseHeld: a.boolean(),
    examined: a.integer(), repaired: a.integer(), inProgress: a.integer(),
    blocked: a.integer(), retrying: a.integer(), stuck: a.integer(), hasMore: a.boolean(),
  }),
```

- [ ] **Step 2: Add the query + mutation**

Next to `needsLinkingQueue` (around line 932) add the query, and next to `linkVisitor` (around line 1277) add the mutation:
```ts
  crmHealth: a
    .query()
    .returns(a.ref('CrmHealthResult').required())
    .handler(a.handler.function(crmApi))
    .authorization((allow) => [allow.authenticated()]),
```
```ts
  runCrmRepair: a
    .mutation()
    .arguments({ limit: a.integer() })
    .returns(a.ref('RunCrmRepairResult').required())
    .handler(a.handler.function(crmApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: clean (no output).

- [ ] **Step 4: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(3C): GraphQL crmHealth query + runCrmRepair mutation + result customTypes"
```

---

### Task 12: Backend cron — `*/15` `reconcileRepair` in the crm-api stack

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Add the Rule inside the existing `if (!isSandbox)` crm-api block**

In `amplify/backend.ts`, inside the block that already defines `const crmApiStack = Stack.of(backend.crmApi.resources.lambda);` and the `CrmSweepHotRule`/`CrmSweepColdRule`/`CrmAnalyticsRollupRule` (around lines 1042–1061), append:
```ts
    new Rule(crmApiStack, 'CrmRepairDrainRule', {
        schedule: Schedule.cron({ minute: '*/15', hour: '*', day: '*', month: '*', year: '*' }),
        targets: [new LambdaFunctionTarget(backend.crmApi.resources.lambda, {
            event: RuleTargetInput.fromObject({ action: 'reconcileRepair' }),
        })],
    });
```

- [ ] **Step 2: Typecheck the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add amplify/backend.ts
git commit -m "feat(3C): */15 reconcileRepair cron in crm-api stack (!isSandbox)"
```

---

### Task 13: Frontend service + hook

**Files:**
- Modify: `src/services/organizationAdminService.ts`
- Create: `src/hooks/useCrmHealth.ts`
- Test: `src/hooks/useCrmHealth.test.ts` (if the repo tests hooks; otherwise a service test `src/services/organizationAdminService.crmHealth.test.ts`)

- [ ] **Step 1: Write the failing test (service)**

Create `src/services/organizationAdminService.crmHealth.test.ts` mirroring existing service tests (they mock `./amplifyClient`):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const crmHealth = vi.fn(); const runCrmRepair = vi.fn();
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ queries: { crmHealth }, mutations: { runCrmRepair } }) }));
import { getCrmHealth, runCrmRepair as runRepair } from './organizationAdminService';

beforeEach(() => { crmHealth.mockReset(); runCrmRepair.mockReset(); });

describe('crm health service', () => {
  it('getCrmHealth returns data', async () => {
    crmHealth.mockResolvedValueOnce({ data: { repairPending: { count: 0 } }, errors: undefined });
    expect(await getCrmHealth()).toEqual({ repairPending: { count: 0 } });
  });
  it('runCrmRepair passes limit and returns data', async () => {
    runCrmRepair.mockResolvedValueOnce({ data: { repaired: 2 }, errors: undefined });
    expect(await runRepair({ limit: 50 })).toEqual({ repaired: 2 });
    expect(runCrmRepair).toHaveBeenCalledWith({ limit: 50 }, expect.anything());
  });
  it('throws on errors', async () => {
    crmHealth.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    await expect(getCrmHealth()).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/services/organizationAdminService.crmHealth.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Add the service methods**

Append to `src/services/organizationAdminService.ts`:
```ts
export async function getCrmHealth() {
  const { data, errors } = await client().queries.crmHealth({}, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function runCrmRepair(args: { limit?: number } = {}) {
  const { data, errors } = await client().mutations.runCrmRepair(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
```

- [ ] **Step 4: Create the hook**

Create `src/hooks/useCrmHealth.ts`:
```ts
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

type HealthData = Awaited<ReturnType<typeof svc.getCrmHealth>>;

export function useCrmHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await svc.getCrmHealth()); }
    catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runRepair = useCallback(async () => {
    setRunMsg(null);
    try {
      const res = await svc.runCrmRepair({});
      setRunMsg(res?.skippedLeaseHeld ? 'already running — the scheduled repair is in progress' : `repaired ${res?.repaired ?? 0}, stuck ${res?.stuck ?? 0}`);
      await load();
    } catch (err) { setRunMsg(`failed: ${(err as Error).message}`); }
  }, [load]);

  return { data, loading, error, runMsg, reload: load, runRepair };
}
```

- [ ] **Step 5: Run the service test — expect PASS**

Run: `npx vitest run src/services/organizationAdminService.crmHealth.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/organizationAdminService.ts src/services/organizationAdminService.crmHealth.test.ts src/hooks/useCrmHealth.ts
git commit -m "feat(3C): frontend service (getCrmHealth/runCrmRepair) + useCrmHealth hook"
```

---

### Task 14: Frontend page + route + nav

**Files:**
- Create: `src/pages/admin/CrmHealthPage.tsx`
- Modify: `src/routes/AdminRoutes.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`
- Test: `src/pages/admin/CrmHealthPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/CrmHealthPage.test.tsx` (mirror the existing NeedsLinkingPage test style; mock the hook):
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
const runRepair = vi.fn();
vi.mock('../../hooks/useCrmHealth', () => ({ useCrmHealth: () => ({
  data: { repairPending: { count: 2, more: false, sample: [{ unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', attemptCount: 1, lastError: 'x', createdAt: 't' }] },
          repairStuck: { count: 1, more: false, sample: [{ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'b.com', stuckReason: 'source_conflict', createdAt: 't2' }] },
          lastRepairSummary: { repaired: 3 }, lastHotSweep: { expected: 9, hasMore: false }, lastColdSweep: null, lastDirtyRollupSweep: null },
  loading: false, error: null, runMsg: null, reload: vi.fn(), runRepair,
}) }));
import { CrmHealthPage } from './CrmHealthPage';

describe('CrmHealthPage', () => {
  it('renders pending + stuck counts and a Run repair now button', () => {
    render(<CrmHealthPage />);
    expect(screen.getByText(/CRM Health/i)).toBeInTheDocument();
    expect(screen.getByText('u1')).toBeInTheDocument();
    expect(screen.getByText(/source_conflict/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Run repair now/i }));
    expect(runRepair).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/pages/admin/CrmHealthPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CrmHealthPage.tsx`**

Create `src/pages/admin/CrmHealthPage.tsx`:
```tsx
import { useCrmHealth } from '../../hooks/useCrmHealth';

type Sample = { unitType: string; unitKey: string; targetOrgId: string; attemptCount?: number; stuckReason?: string | null; lastError?: string | null; createdAt: string };
type Bucket = { count: number; more: boolean; sample: Sample[] };

function BucketCard({ title, bucket }: { title: string; bucket?: Bucket | null }) {
  const b = bucket ?? { count: 0, more: false, sample: [] };
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>{title}: {b.count}{b.more ? '+' : ''}</h3>
      {b.sample.length === 0 ? <p style={{ color: '#6b7280' }}>None</p> : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Type</th><th align="left">Unit</th><th align="left">Target org</th><th align="left">Attempts</th><th align="left">Reason / error</th><th align="left">Created</th></tr></thead>
          <tbody>
            {b.sample.map((s) => (
              <tr key={`${s.unitType}-${s.unitKey}`}>
                <td>{s.unitType}</td><td>{s.unitKey}</td><td>{s.targetOrgId}</td>
                <td>{s.attemptCount ?? 0}</td><td>{s.stuckReason ?? s.lastError ?? ''}</td><td>{s.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SummaryCard({ title, summary }: { title: string; summary?: Record<string, unknown> | null }) {
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
      {summary ? <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary, null, 2)}</pre> : <p style={{ color: '#6b7280' }}>No run yet</p>}
    </section>
  );
}

export function CrmHealthPage() {
  const { data, loading, error, runMsg, runRepair } = useCrmHealth();
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>CRM Health</h1>
        <button onClick={() => void runRepair()} style={{ padding: '8px 16px' }}>Run repair now</button>
      </div>
      {runMsg && <p style={{ color: '#374151' }}>{runMsg}</p>}
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>Error: {error.message}</p>}
      {data && (
        <>
          <BucketCard title="Pending repairs" bucket={data.repairPending as Bucket} />
          <BucketCard title="Stuck repairs (needs attention)" bucket={data.repairStuck as Bucket} />
          <SummaryCard title="Last repair run" summary={data.lastRepairSummary as Record<string, unknown> | null} />
          <SummaryCard title="Last hot sweep" summary={data.lastHotSweep as Record<string, unknown> | null} />
          <SummaryCard title="Last cold sweep" summary={data.lastColdSweep as Record<string, unknown> | null} />
          <SummaryCard title="Last dirty-rollup sweep" summary={data.lastDirtyRollupSweep as Record<string, unknown> | null} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Register the route**

In `src/routes/AdminRoutes.tsx`, add the lazy import next to the `NeedsLinkingPage` import (line ~25):
```ts
const CrmHealthPage = lazyWithReload(() => import('../pages/admin/CrmHealthPage').then(m => ({ default: m.CrmHealthPage })));
```
And add the route next to the `needs-linking` route (line ~65):
```tsx
          <Route path="crm-health" element={<CrmHealthPage />} />
```

- [ ] **Step 5: Add the nav item**

In `src/components/admin/AdminLayout.tsx`, add to `NAV_ITEMS` right after the Needs Linking entry (line ~18):
```ts
  { path: '/admin/crm-health', label: 'CRM Health', icon: 'health_and_safety' },
```

- [ ] **Step 6: Run the page test — expect PASS**

Run: `npx vitest run src/pages/admin/CrmHealthPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/CrmHealthPage.tsx src/pages/admin/CrmHealthPage.test.tsx src/routes/AdminRoutes.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(3C): CrmHealthPage + /admin/crm-health route + nav item"
```

---

### Task 15: Green bar + checkpoint

**Files:** none (verification only)

- [ ] **Step 1: Full crm-api backend suite**

Run: `npx vitest run amplify/functions/crm-api`
Expected: PASS (all existing + new). Note the count for the checkpoint.

- [ ] **Step 2: Frontend suite for the touched areas**

Run: `npx vitest run src/pages/admin/CrmHealthPage.test.tsx src/services/organizationAdminService.crmHealth.test.ts src/hooks 'src/pages/admin/NeedsLinkingPage.test.tsx'`
Expected: PASS.

- [ ] **Step 3: Typecheck (app + amplify)**

Run: `npx tsc --noEmit && npx tsc --noEmit -p amplify/tsconfig.json`
Expected: only the pre-existing `amplify_outputs.json` error in `main.tsx` (untracked, expected). No 3C errors.

- [ ] **Step 4: Lint the changed files**

Run: `npx eslint amplify/functions/crm-api/lib/repair amplify/functions/crm-api/lib/link/linkStructuredUnit.ts amplify/functions/crm-api/lib/link/linkVisitor.ts amplify/functions/crm-api/handler.ts src/pages/admin/CrmHealthPage.tsx src/hooks/useCrmHealth.ts`
Expected: clean (no new errors; pre-existing `as any` warnings elsewhere are not from 3C).

- [ ] **Step 5: Commit any lint fixups, then checkpoint**

```bash
git add -A -- amplify/functions/crm-api src/pages/admin src/hooks src/services src/routes src/components/admin amplify/data amplify/backend.ts
git commit -m "chore(3C): green-bar checkpoint — repair outbox + CRM Health panel" || echo "nothing to commit"
```
Report: test counts, tsc/eslint status, and the invariant re-check (1–7 from the header) before opening the PR.

---

## Post-implementation (not tasks — for the PR/deploy phase)

- **Deploy gate:** Amplify Console synth. No new GSI, no new table grant (crm-api owns `INTELLIGENCE_TABLE` incl. `/index/*`); the new cron Rule is intra-stack (`Stack.of(crmApi.lambda)`) so no nested-stack cycle. crm-api already `resourceGroupName:'data'`.
- **Post-deploy check:** confirm the first `crm.repair.summary` fire (`examined:0` on a healthy system); load `/admin/crm-health` and verify it renders live (repair buckets empty, last hot/cold sweep summaries present). No backfill job — the outbox fills only on real post-commit failures going forward.
- **Adversarial review** before merge (this project's norm — expect ≥1 real finding per round on concurrency code): re-check the 7 header invariants + the two NULL cases (DynamoDB NULL in the backfill condition; deterministic-audit-id derived from committed target).
