# Customer 360 Timeline — Plan 3B (Needs-Linking + Manual Re-link) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a Needs-Linking queue that surfaces unresolved TimelineEvents as link units, plus two unit-aware manual re-link paths (structured source-entity + analytics visitor) that resolve each unit to a real org durably and auditably.

**Architecture:** A `needsLinkingQueue` AppSync query reads the sparse GSI1 unresolved index, collapses events into link units, and enriches them server-side. Two mutations — `linkStructuredUnit` (conditional per-event move + source backfill + contact completion) and `linkVisitor` (manual visitor bridge + retro-resolve) — perform the writes with first-writer-wins concurrency, P1 rollup durability, server-derived operator, and a per-unit audit row. A two-pane triage UI drives it.

**Tech Stack:** AWS Amplify Gen2, AppSync, DynamoDB single table (`INTELLIGENCE_TABLE`, GSI1/GSI2/GSI4), `@aws-sdk/lib-dynamodb`, React + Amplify data client, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-08-customer-360-timeline-3b-needs-linking-design.md`
**Worktree/branch:** `feature/customer-360-timeline-3b` (isolated worktree off `2562a1d1`).

**In-repo conventions (verified):**
- DDB: `import { QueryCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'; import { docClient, TABLE_NAME } from '../dynamodb';`. Test mock: `vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));`
- Keys (`lib/keys.ts`): `timelineEventKeys(e)` sets `PK: TLEVENT#<id>`, `SK: 'A'`, `GSI2PK: ORG#<orgId>`, `GSI2SK/GSI3SK: TLEVENT#<occurredAt>#<id>`, `GSI3PK: SRC#<type>#<id>`, and **only when `resolutionStatus==='unresolved'`** adds `GSI1PK: 'TLEVENT_STATUS#unresolved'`, `GSI1SK: <occurredAt>#<id>`; adds `GSI4PK: CONTACT#<contactId>` when contactId present. `contactIdForEmail(normalizedEmail)`, `auditKeys({id,orgId,timestamp})`.
- `timelineStore.ts`: `getTimelineEvent(id)` (Get TLEVENT#<id>/A), `markRollupApplied(id)` (Update rollupApplied=true, clears rollupPendingOrgId).
- `orgStore.ts`: `recomputeRollupsForOrg(orgId)`, `ORG#<orgId>/META` rows.
- `contactStore.ts`: `upsertContact({email, orgId, source, occurredAt, ...}) → contactId` (handles existing/linkLocked, GSI4 index).
- `auditStore.ts`: `writeLinkAuditLog(args) → id` (immutable Put, `attribute_not_exists(PK)`).
- `visitor-bridge.ts` (`amplify/lib/crm/`): `VisitorBridge` (`orgSource: 'rfq_match'|'lead_match'|null`), `readVisitorBridge(send,table,vid)`, `upsertVisitorBridge(...)`, `toSend(dc)`.
- `reResolveVisitorSessions({ visitorId, startSessionSk?, maxSessions? })` returns `{ summary }`.
- Handler AppSync event type already includes `identity?: { sub?: string; claims?: { email?: string } }`.
- The unresolved synthetic org id is `unresolved-<sourceEntityType>-<sourceEntityId>` (all of a source entity's events share it).

---

## Task 1: Extend the audit model with a `details` payload

**Files:**
- Modify: `amplify/functions/crm-api/lib/types.ts` (add `details` to `LinkAuditLogItem`)
- Modify: `amplify/functions/crm-api/lib/auditStore.ts` (accept + persist `details`)
- Test: `amplify/functions/crm-api/lib/auditStore.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
vi.mock('./idGenerators', () => ({ generateAuditId: () => 'aud-1' }));
import { writeLinkAuditLog } from './auditStore';

beforeEach(() => mockSend.mockReset());

describe('writeLinkAuditLog details payload', () => {
  it('persists an arbitrary details object on the audit item', async () => {
    mockSend.mockResolvedValueOnce({});
    await writeLinkAuditLog({ operator: 'a@x.com', reason: 'manual_link_unit', timestamp: '2026-07-08T00:00:00Z',
      newOrgId: 'acme.com', details: { unitType: 'structured', unitKey: 'unresolved-rfq-r1', affectedCount: 2, affectedEventIds: ['tev-a', 'tev-b'] } });
    const item = mockSend.mock.calls[0][0].input.Item;
    expect(item.details).toEqual({ unitType: 'structured', unitKey: 'unresolved-rfq-r1', affectedCount: 2, affectedEventIds: ['tev-a', 'tev-b'] });
    expect(item.entityType).toBe('LINK_AUDIT');
    expect(mockSend.mock.calls[0][0].input.ConditionExpression).toContain('attribute_not_exists');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run amplify/functions/crm-api/lib/auditStore.test.ts` → FAIL (details not persisted / type error).

- [ ] **Step 3: Implement.** In `types.ts`, add to `LinkAuditLogItem` interface: `details: Record<string, unknown> | null;`. In `auditStore.ts`, add `details?: Record<string, unknown> | null` to the args, and set `details: args.details ?? null,` in the item object.

- [ ] **Step 4: Run** the test → PASS. Also `npx vitest run amplify/functions/crm-api/lib/auditStore.test.ts` full file green.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/types.ts amplify/functions/crm-api/lib/auditStore.ts amplify/functions/crm-api/lib/auditStore.test.ts
git commit -m "feat(crm-api): audit LinkAuditLog.details payload (3B)"
```

---

## Task 2: `manual` provenance in the visitor bridge

**Files:**
- Modify: `amplify/lib/crm/visitor-bridge.ts`
- Test: `amplify/lib/crm/visitor-bridge.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { describe, it, expect, vi } from 'vitest';
import { upsertVisitorBridge, upsertManualVisitorBridge, type Send } from './visitor-bridge';

const sendWith = (existing: unknown) => {
  const calls: unknown[] = [];
  const send: Send = async (cmd: unknown) => { calls.push(cmd); const c = cmd as { input: { Key?: unknown } }; return c.input?.Key ? { Item: existing as Record<string, unknown> } : {}; };
  return { send, calls };
};

describe('manual visitor bridge provenance', () => {
  it('upsertManualVisitorBridge writes orgSource=manual', async () => {
    const { send, calls } = sendWith(null);
    await upsertManualVisitorBridge(send, 'T', { visitorId: 'v1', matchedOrgId: 'acme.com', now: '2026-07-08T00:00:00Z' });
    const put = (calls.find((c) => (c as { input: { Item?: unknown } }).input.Item) as { input: { Item: Record<string, unknown> } }).input.Item;
    expect(put.orgSource).toBe('manual');
    expect(put.matchedOrgId).toBe('acme.com');
  });

  it('a later rfq_match upsert does NOT overwrite a manual bridge org', async () => {
    const manual = { PK: 'VISITOR#v1', SK: 'STATE', matchedOrgId: 'acme.com', orgSource: 'manual', email: null, sourceEntityType: 'rfq', sourceEntityId: 'x', firstSeenAt: 't', updatedAt: 't' };
    const { send, calls } = sendWith(manual);
    await upsertVisitorBridge(send, 'T', { visitorId: 'v1', matchedOrgId: 'other.com', email: null, sourceEntityType: 'rfq', sourceEntityId: 'r9', now: '2026-07-08T01:00:00Z' });
    const puts = calls.filter((c) => (c as { input: { Item?: unknown } }).input.Item) as Array<{ input: { Item: Record<string, unknown> } }>;
    // either no write (no material change) or a write that KEEPS acme.com/manual
    if (puts.length) { expect(puts[0].input.Item.matchedOrgId).toBe('acme.com'); expect(puts[0].input.Item.orgSource).toBe('manual'); }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run amplify/lib/crm/visitor-bridge.test.ts` → FAIL (`upsertManualVisitorBridge` missing; rfq overwrite not guarded).

- [ ] **Step 3: Implement.** In `visitor-bridge.ts`:
- Widen the type: `orgSource: 'rfq_match' | 'lead_match' | 'manual' | null;`
- Add the manual helper:
```ts
export async function upsertManualVisitorBridge(send: Send, tableName: string, input: { visitorId: string; matchedOrgId: string; now: string }): Promise<void> {
  const existing = await readVisitorBridge(send, tableName, input.visitorId);
  const item = {
    PK: `VISITOR#${input.visitorId}`, SK: 'STATE' as const,
    matchedOrgId: input.matchedOrgId, orgSource: 'manual' as const,
    email: existing?.email ?? null,
    sourceEntityType: existing?.sourceEntityType ?? 'rfq', sourceEntityId: existing?.sourceEntityId ?? 'manual',
    firstSeenAt: existing?.firstSeenAt ?? input.now, updatedAt: input.now,
  };
  await send(new PutCommand({ TableName: tableName, Item: item }));
}
```
- Guard the merge path in `upsertVisitorBridge`: after computing `existing`, if `existing.orgSource === 'manual'`, force `nextOrg = existing.matchedOrgId` and `nextOrgSource = 'manual'` (manual is never overwritten by rfq/lead):
```ts
  const manualLocked = existing.orgSource === 'manual';
  const nextOrg = manualLocked ? existing.matchedOrgId : (incomingOrg ?? existing.matchedOrgId);
  const nextOrgSource = manualLocked ? 'manual' : (incomingOrg ? orgSource : existing.orgSource);
```
(Import `PutCommand` is already present.)

- [ ] **Step 4: Run** the test → PASS. Full file: `npx vitest run amplify/lib/crm/visitor-bridge.test.ts` green.

- [ ] **Step 5: Commit**
```bash
git add amplify/lib/crm/visitor-bridge.ts amplify/lib/crm/visitor-bridge.test.ts
git commit -m "feat(crm): manual visitor-bridge provenance (highest tier, never overwritten) (3B)"
```

---

## Task 3: `orgExists` guard

**Files:**
- Modify: `amplify/functions/crm-api/lib/orgStore.ts`
- Test: `amplify/functions/crm-api/lib/orgStore.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
describe('orgExists', () => {
  it('true for an existing ORG#/META, false for missing or unresolved-*', async () => {
    mockSend.mockResolvedValueOnce({ Item: { PK: 'ORG#acme.com', SK: 'META' } });
    expect(await orgExists('acme.com')).toBe(true);
    mockSend.mockClear(); mockSend.mockResolvedValueOnce({});
    expect(await orgExists('nope.com')).toBe(false);
    expect(await orgExists('unresolved-rfq-r1')).toBe(false); // rejected without a read
  });
});
```
(Use the existing `mockSend` mock in that test file; add `orgExists` to the imports from `./orgStore`.)

- [ ] **Step 2: Run** `npx vitest run amplify/functions/crm-api/lib/orgStore.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `orgStore.ts`:
```ts
export async function orgExists(orgId: string): Promise<boolean> {
  if (!orgId || orgId.startsWith('unresolved-')) return false;
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORG#${orgId}`, SK: ORG_META_SK } }));
  return !!res.Item;
}
```
(Add `GetCommand` to the `@aws-sdk/lib-dynamodb` import if not present.)

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/orgStore.ts amplify/functions/crm-api/lib/orgStore.test.ts
git commit -m "feat(crm-api): orgExists guard (rejects missing + unresolved-*) (3B)"
```

---

## Task 4: `manualMoveTimelineEvent` — conditional move + rollup durability + contact completion

**Files:**
- Create: `amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts`
- Test: `amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.test.ts`

Contract: `manualMoveTimelineEvent({ event, targetOrgId, email, operator, nowIso }) → { moved: boolean; skipped: boolean; contactStatus: 'linked'|'missing_email'|'enrichment_error' }`. `event` is the stored `TimelineEventItem` (still unresolved under a synthetic org).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const recomputeMock = vi.fn(); const markMock = vi.fn(); const upsertContactMock = vi.fn();
vi.mock('../orgStore', () => ({ recomputeRollupsForOrg: (o: string) => recomputeMock(o) }));
vi.mock('../timelineStore', () => ({ markRollupApplied: (id: string) => markMock(id) }));
vi.mock('../contactStore', () => ({ upsertContact: (a: unknown) => upsertContactMock(a) }));
import { manualMoveTimelineEvent } from './manualMoveTimelineEvent';

const ev = (o = {}) => ({ id: 'tev-a', orgId: 'unresolved-rfq-r1', kind: 'rfq_submitted', occurredAt: '2026-03-01T00:00:00Z', source: 'rfq', sourceEntityType: 'rfq', sourceEntityId: 'r1', resolutionStatus: 'unresolved', isInternalOnly: false, contactId: null, ...o }) as never;
beforeEach(() => { mockSend.mockReset(); recomputeMock.mockReset(); markMock.mockReset(); upsertContactMock.mockReset(); });

describe('manualMoveTimelineEvent', () => {
  it('conditionally rewrites the row to manually_linked, drops GSI1, orders dirty→recompute→mark', async () => {
    mockSend.mockResolvedValueOnce({}); // conditional Put
    upsertContactMock.mockResolvedValueOnce('ct-1');
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: 'a@acme.com', operator: 'op', nowIso: '2026-07-08T00:00:00Z' });
    const put = mockSend.mock.calls[0][0].input;
    expect(put.ConditionExpression).toBe('resolutionStatus = :unres AND orgId = :syn');
    expect(put.ExpressionAttributeValues[':unres']).toBe('unresolved');
    expect(put.ExpressionAttributeValues[':syn']).toBe('unresolved-rfq-r1');
    expect(put.Item.resolutionStatus).toBe('manually_linked');
    expect(put.Item.resolutionReason).toBe('manual');
    expect(put.Item.orgId).toBe('acme.com');
    expect(put.Item.GSI2PK).toBe('ORG#acme.com');
    expect(put.Item.GSI1PK).toBeUndefined(); // dropped
    expect(put.Item.rollupApplied).toBe(false); // dirty first
    // ordering: recompute(target) BEFORE markRollupApplied
    expect(recomputeMock).toHaveBeenCalledWith('acme.com');
    const recomputeOrder = recomputeMock.mock.invocationCallOrder[0];
    const markOrder = markMock.mock.invocationCallOrder[0];
    expect(recomputeOrder).toBeLessThan(markOrder);
    expect(r).toMatchObject({ moved: true, skipped: false, contactStatus: 'linked' });
    expect(put.Item.contactId).toBe('ct-1');
  });

  it('condition failure → skipped, no recompute/mark (never re-points a linked event)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }));
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: 'a@acme.com', operator: 'op', nowIso: 'n' });
    expect(r).toMatchObject({ moved: false, skipped: true });
    expect(recomputeMock).not.toHaveBeenCalled();
    expect(markMock).not.toHaveBeenCalled();
  });

  it('no email → still moves, contactStatus=missing_email, contactId stays null', async () => {
    mockSend.mockResolvedValueOnce({});
    const r = await manualMoveTimelineEvent({ event: ev(), targetOrgId: 'acme.com', email: null, operator: 'op', nowIso: 'n' });
    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ moved: true, contactStatus: 'missing_email' });
    expect(mockSend.mock.calls[0][0].input.Item.contactId).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { timelineEventKeys } from '../keys';
import { recomputeRollupsForOrg } from '../orgStore';
import { markRollupApplied } from '../timelineStore';
import { upsertContact } from '../contactStore';
import type { TimelineEventItem } from '../types';

export type ContactStatus = 'linked' | 'missing_email' | 'enrichment_error';

export async function manualMoveTimelineEvent(args: {
  event: TimelineEventItem; targetOrgId: string; email: string | null;
  operator: string; nowIso: string; enrichmentError?: boolean;
}): Promise<{ moved: boolean; skipped: boolean; contactStatus: ContactStatus }> {
  const { event, targetOrgId, email } = args;
  const syntheticOrgId = event.orgId;

  let contactId: string | null = event.contactId ?? null;
  let contactStatus: ContactStatus = args.enrichmentError ? 'enrichment_error' : 'missing_email';
  if (email) {
    contactId = await upsertContact({ email, orgId: targetOrgId, source: event.source, occurredAt: event.occurredAt });
    contactStatus = 'linked';
  }

  const keys = timelineEventKeys({
    id: event.id, orgId: targetOrgId, contactId, occurredAt: event.occurredAt,
    resolutionStatus: 'manually_linked', sourceEntityType: event.sourceEntityType, sourceEntityId: event.sourceEntityId,
  });
  const movedItem: TimelineEventItem = {
    ...event, ...keys,
    orgId: targetOrgId, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1,
    contactId, rollupApplied: false, rollupPendingOrgId: null, updatedAt: args.nowIso,
    // GSI1 keys are intentionally absent (timelineEventKeys omits them for non-unresolved status).
    GSI1PK: undefined, GSI1SK: undefined,
  } as TimelineEventItem;

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME(), Item: movedItem,
      ConditionExpression: 'resolutionStatus = :unres AND orgId = :syn',
      ExpressionAttributeValues: { ':unres': 'unresolved', ':syn': syntheticOrgId },
    }));
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return { moved: false, skipped: true, contactStatus };
    }
    throw err;
  }

  // Durable rollup ordering: item already written dirty (rollupApplied=false); recompute target, THEN mark clean.
  await recomputeRollupsForOrg(targetOrgId);
  await markRollupApplied(event.id);
  return { moved: true, skipped: false, contactStatus };
}
```
Note: strip `GSI1PK/GSI1SK` explicitly (spread of `event` carries the old ones; setting them `undefined` drops them from the DynamoDB item — the DocumentClient omits `undefined`).

- [ ] **Step 4: Run** → PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.ts amplify/functions/crm-api/lib/link/manualMoveTimelineEvent.test.ts
git commit -m "feat(crm-api): manualMoveTimelineEvent — conditional move + rollup durability + contact completion (3B)"
```

---

## Task 5: `linkStructuredUnit` orchestrator

**Files:**
- Create: `amplify/functions/crm-api/lib/link/linkStructuredUnit.ts`
- Test: `amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts`

Contract: `linkStructuredUnit({ sourceType, sourceEntityId, targetOrgId, operator }) → { alreadyLinked?, existingOrgId?, affected, moved, skipped, errors, sourceBackfillStatus, contactStatus }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const moveMock = vi.fn(); const auditMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o), recomputeRollupsForOrg: vi.fn() }));
vi.mock('./manualMoveTimelineEvent', () => ({ manualMoveTimelineEvent: (a: unknown) => moveMock(a) }));
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (a: unknown) => auditMock(a) }));
import { linkStructuredUnit } from './linkStructuredUnit';

const unresolvedEvent = { id: 'tev-a', orgId: 'unresolved-rfq-r1', kind: 'rfq_submitted', source: 'rfq', sourceEntityType: 'rfq', sourceEntityId: 'r1', occurredAt: 't', resolutionStatus: 'unresolved' };
beforeEach(() => { mockSend.mockReset(); orgExistsMock.mockReset(); moveMock.mockReset(); auditMock.mockReset(); });

describe('linkStructuredUnit', () => {
  it('rejects a non-existent / unresolved-* target before any write', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'nope.com', operator: 'op' })).rejects.toThrow(/target/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('empty synthetic partition → alreadyLinked no-op, writes nothing', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend.mockResolvedValueOnce({ Items: [] }); // query synthetic partition
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyLinked: true, affected: 0 });
    expect(moveMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it('moves each unresolved event, backfills source when empty, writes one per-unit audit', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })                         // synthetic partition query
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com', matchedOrgId: '' } }) // source META for backfill+email
      .mockResolvedValueOnce({});                                                   // backfill update
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op@x.com' });
    expect(moveMock).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ affected: 1, moved: 1, skipped: 0, errors: 0, sourceBackfillStatus: 'written' });
    const audit = auditMock.mock.calls[0][0];
    expect(audit.reason).toBe('manual_link_unit');
    expect(audit.operator).toBe('op@x.com');
    expect(audit.details).toMatchObject({ unitType: 'structured', unitKey: 'unresolved-rfq-r1', targetOrgId: 'acme.com', affectedCount: 1, affectedEventIds: ['tev-a'] });
  });

  it('does NOT overwrite a real different source matchedOrgId (→ conflict)', async () => {
    orgExistsMock.mockResolvedValueOnce(true);
    mockSend
      .mockResolvedValueOnce({ Items: [unresolvedEvent] })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r1', SK: 'META', email: 'a@acme.com', matchedOrgId: 'other.com' } });
    moveMock.mockResolvedValueOnce({ moved: true, skipped: false, contactStatus: 'linked' });
    auditMock.mockResolvedValueOnce('aud-1');
    const r = await linkStructuredUnit({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'op' });
    expect(r.sourceBackfillStatus).toBe('conflict');
    // no backfill Update issued (only the partition query + source GET)
    const updates = mockSend.mock.calls.filter((c) => c[0].constructor?.name === 'UpdateCommand');
    expect(updates.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { manualMoveTimelineEvent, type ContactStatus } from './manualMoveTimelineEvent';
import { writeLinkAuditLog } from '../auditStore';
import type { TimelineEventItem } from '../types';

type BackfillStatus = 'written' | 'already_set' | 'conflict' | 'no_source' | 'not_applicable';
const SOURCE_PK: Record<string, (id: string) => string> = { rfq: (id) => `RFQ#${id}`, lead: (id) => `LEAD#${id}`, order: (id) => `ORDER#${id}` };

export async function linkStructuredUnit(args: { sourceType: string; sourceEntityId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);
  const syntheticOrgId = `unresolved-${args.sourceType}-${args.sourceEntityId}`;
  const nowIso = new Date().toISOString();

  // 1. All still-unresolved events of this unit (they share the synthetic partition on GSI2).
  const q = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME(), IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :tl)',
    FilterExpression: 'resolutionStatus = :unres',
    ExpressionAttributeValues: { ':pk': `ORG#${syntheticOrgId}`, ':tl': 'TLEVENT#', ':unres': 'unresolved' },
  }));
  const events = (q.Items ?? []) as TimelineEventItem[];
  if (events.length === 0) return { alreadyLinked: true, affected: 0, moved: 0, skipped: 0, errors: 0 };

  // 2. Enrich email from source META (for contact completion + it is also the backfill target).
  const sourceEmail = await readSourceEmail(args.sourceType, args.sourceEntityId, events);

  // 3. Move each event (conditional; per-event isolated).
  let moved = 0, skipped = 0, errors = 0; let contactStatus: ContactStatus = 'missing_email';
  const affectedEventIds: string[] = [];
  for (const ev of events) {
    try {
      const r = await manualMoveTimelineEvent({ event: ev, targetOrgId: args.targetOrgId, email: sourceEmail, operator: args.operator, nowIso });
      if (r.moved) { moved += 1; affectedEventIds.push(ev.id); contactStatus = r.contactStatus; }
      else if (r.skipped) skipped += 1;
    } catch { errors += 1; }
  }

  // 4. Source backfill — first-writer-wins.
  const sourceBackfillStatus = await backfillSource(args.sourceType, args.sourceEntityId, args.targetOrgId, events);

  // 5. Per-unit audit.
  await writeLinkAuditLog({
    operator: args.operator, reason: 'manual_link_unit', timestamp: nowIso, newOrgId: args.targetOrgId,
    details: { unitType: 'structured', unitKey: syntheticOrgId, targetOrgId: args.targetOrgId, affectedCount: moved, affectedEventIds, sourceBackfillStatus, contactStatus },
  });

  return { affected: events.length, moved, skipped, errors, sourceBackfillStatus, contactStatus };
}

async function readSourceEmail(sourceType: string, sourceEntityId: string, events: TimelineEventItem[]): Promise<string | null> {
  const orderId = sourceType === 'quote' ? (events[0]?.payload?.orderId as string | undefined) : sourceEntityId;
  const pk = SOURCE_PK[sourceType]?.(sourceEntityId) ?? (orderId ? `ORDER#${orderId}` : null);
  if (!pk) return null;
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }));
  const m = res.Item as Record<string, unknown> | undefined;
  if (!m) return null;
  const gsi4 = m.GSI4PK as string | undefined;
  if (typeof gsi4 === 'string' && gsi4.startsWith('EMAIL#')) return gsi4.slice('EMAIL#'.length) || null;
  return (m.email as string | undefined) ?? null;
}

async function backfillSource(sourceType: string, sourceEntityId: string, targetOrgId: string, events: TimelineEventItem[]): Promise<BackfillStatus> {
  // quote/logistics have no own org field → backfill the underlying order.
  let pk: string | null = SOURCE_PK[sourceType]?.(sourceEntityId) ?? null;
  if (!pk) {
    const orderId = (events[0]?.payload?.orderId as string | undefined) ?? undefined;
    pk = orderId ? `ORDER#${orderId}` : null;
  }
  if (!pk) return 'no_source';
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' } }));
  const m = res.Item as Record<string, unknown> | undefined;
  if (!m) return 'no_source';
  const cur = (m.matchedOrgId as string | undefined) ?? '';
  if (cur && !cur.startsWith('unresolved-') && cur !== targetOrgId) return 'conflict';
  if (cur === targetOrgId) return 'already_set';
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME(), Key: { PK: pk, SK: 'META' },
    UpdateExpression: 'SET matchedOrgId = :o', ExpressionAttributeValues: { ':o': targetOrgId },
  }));
  return 'written';
}
```

- [ ] **Step 4: Run** → PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/link/linkStructuredUnit.ts amplify/functions/crm-api/lib/link/linkStructuredUnit.test.ts
git commit -m "feat(crm-api): linkStructuredUnit orchestrator (validate/move/backfill/audit, first-writer-wins) (3B)"
```

---

## Task 6: `linkVisitor` orchestrator

**Files:**
- Create: `amplify/functions/crm-api/lib/link/linkVisitor.ts`
- Test: `amplify/functions/crm-api/lib/link/linkVisitor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const orgExistsMock = vi.fn(); const readBridgeMock = vi.fn(); const upsertManualMock = vi.fn(); const retroMock = vi.fn(); const auditMock = vi.fn();
vi.mock('../orgStore', () => ({ orgExists: (o: string) => orgExistsMock(o) }));
vi.mock('../../../../lib/crm/visitor-bridge', () => ({ readVisitorBridge: (...a: unknown[]) => readBridgeMock(...a), upsertManualVisitorBridge: (...a: unknown[]) => upsertManualMock(...a), toSend: () => 'send' }));
vi.mock('../analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (a: unknown) => retroMock(a) }));
vi.mock('../auditStore', () => ({ writeLinkAuditLog: (a: unknown) => auditMock(a) }));
import { linkVisitor } from './linkVisitor';

beforeEach(() => { mockSend.mockReset(); orgExistsMock.mockReset(); readBridgeMock.mockReset(); upsertManualMock.mockReset(); retroMock.mockReset(); auditMock.mockReset(); });

describe('linkVisitor', () => {
  it('no bridge → writes manual, triggers retro, audits', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce(null);
    upsertManualMock.mockResolvedValueOnce(undefined); retroMock.mockResolvedValueOnce({ summary: { resolved: 3, hasMore: false } }); auditMock.mockResolvedValueOnce('a');
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'op' });
    expect(upsertManualMock).toHaveBeenCalled();
    expect(retroMock).toHaveBeenCalledWith({ visitorId: 'v1' });
    expect(r).toMatchObject({ sessionsResolved: 3, pending: false });
  });

  it('already manual → alreadyLinked no-op (no upsert, no retro)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'manual' });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'other.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyLinked: true, existingOrgId: 'acme.com' });
    expect(upsertManualMock).not.toHaveBeenCalled();
  });

  it('already real non-manual → alreadyResolved no-op (no manual overwrite)', async () => {
    orgExistsMock.mockResolvedValueOnce(true); readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'acme.com', orgSource: 'rfq_match' });
    const r = await linkVisitor({ visitorId: 'v1', targetOrgId: 'other.com', operator: 'op' });
    expect(r).toMatchObject({ alreadyResolved: true, existingOrgId: 'acme.com' });
    expect(upsertManualMock).not.toHaveBeenCalled();
  });

  it('rejects invalid target', async () => {
    orgExistsMock.mockResolvedValueOnce(false);
    await expect(linkVisitor({ visitorId: 'v1', targetOrgId: 'nope', operator: 'op' })).rejects.toThrow(/target/i);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
import { docClient, TABLE_NAME } from '../dynamodb';
import { orgExists } from '../orgStore';
import { readVisitorBridge, upsertManualVisitorBridge, toSend } from '../../../../lib/crm/visitor-bridge';
import { reResolveVisitorSessions } from '../analytics/reResolveVisitorSessions';
import { writeLinkAuditLog } from '../auditStore';

export async function linkVisitor(args: { visitorId: string; targetOrgId: string; operator: string }): Promise<Record<string, unknown>> {
  if (!(await orgExists(args.targetOrgId))) throw new Error(`invalid target org: ${args.targetOrgId}`);
  const send = toSend(docClient);
  const bridge = await readVisitorBridge(send, TABLE_NAME(), args.visitorId);
  if (bridge?.orgSource === 'manual') return { alreadyLinked: true, existingOrgId: bridge.matchedOrgId };
  if (bridge?.matchedOrgId) return { alreadyResolved: true, existingOrgId: bridge.matchedOrgId };

  const nowIso = new Date().toISOString();
  await upsertManualVisitorBridge(send, TABLE_NAME(), { visitorId: args.visitorId, matchedOrgId: args.targetOrgId, now: nowIso });
  const retro = await reResolveVisitorSessions({ visitorId: args.visitorId });
  const summary = (retro?.summary ?? {}) as Record<string, unknown>;
  const sessionsResolved = Number(summary.resolved ?? summary.emitted ?? 0);
  const pending = summary.hasMore === true;
  await writeLinkAuditLog({
    operator: args.operator, reason: 'manual_link_visitor', timestamp: nowIso, newOrgId: args.targetOrgId,
    details: { unitType: 'analytics', unitKey: args.visitorId, targetOrgId: args.targetOrgId, retroSummary: summary },
  });
  return { visitorId: args.visitorId, sessionsResolved, pending, existingOrgId: args.targetOrgId };
}
```

- [ ] **Step 4: Run** → PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/link/linkVisitor.ts amplify/functions/crm-api/lib/link/linkVisitor.test.ts
git commit -m "feat(crm-api): linkVisitor orchestrator (manual bridge + retro, no-op guards) (3B)"
```

---

## Task 7: `needsLinkingQueue` read + enrichment

**Files:**
- Create: `amplify/functions/crm-api/lib/read/needsLinkingQueue.ts`
- Test: `amplify/functions/crm-api/lib/read/needsLinkingQueue.test.ts`

Open item resolved: **import** the source-email helper by extracting `readSourceEmail` (Task 5) into `lib/link/sourceEmail.ts` and importing it here — do that refactor as Step 0 of this task (move the function, update Task 5's import). Representative kind = the event with the newest `occurredAt` in the unit.

- [ ] **Step 0: Extract** `readSourceEmail` + `sourceDomain(email)` into `amplify/functions/crm-api/lib/link/sourceEmail.ts` (pure-ish: takes the source PK resolution + a `docClient` get). Update `linkStructuredUnit.ts` to import it. Keep Task 5 tests green.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const sourceEmailMock = vi.fn();
vi.mock('../link/sourceEmail', () => ({ readSourceEmailForUnit: (...a: unknown[]) => sourceEmailMock(...a), sourceDomain: (e: string) => e.split('@')[1] ?? null }));
import { needsLinkingQueue } from './needsLinkingQueue';

const rfqEv = { id: 'tev-r', orgId: 'unresolved-rfq-r1', source: 'rfq', kind: 'rfq_submitted', sourceEntityId: 'r1', occurredAt: '2026-03-01T00:00:00Z', voided: false, isInternalOnly: false, payload: { equipmentCategory: 'ICP' } };
const analyticsEv = { id: 'tev-a', orgId: 'unresolved-analytics-s1', source: 'analytics', kind: 'site_visit_session', sourceEntityId: 's1', occurredAt: '2026-03-02T00:00:00Z', voided: false, isInternalOnly: false, payload: { visitorId: 'v1', orgNameDisplay: 'Verizon Business', country: 'US', topPaths: ['/x'], pageCount: 1 } };
beforeEach(() => { mockSend.mockReset(); sourceEmailMock.mockReset(); });

describe('needsLinkingQueue', () => {
  it('reads GSI1 unresolved, excludes voided+internal, collapses to units', async () => {
    mockSend.mockResolvedValueOnce({ Items: [rfqEv, analyticsEv] });
    sourceEmailMock.mockResolvedValueOnce('j@nanofab.com');
    const r = await needsLinkingQueue({});
    const q = mockSend.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI1');
    expect(q.KeyConditionExpression).toContain('GSI1PK = :pk');
    expect(q.ExpressionAttributeValues[':pk']).toBe('TLEVENT_STATUS#unresolved');
    expect(q.FilterExpression).toContain('voided = :false');
    expect(q.FilterExpression).toContain('isInternalOnly = :false');
    const struct = r.items.find((u) => u.linkUnitType === 'structured')!;
    expect(struct).toMatchObject({ unitKey: 'unresolved-rfq-r1', source: 'rfq', signal: { email: 'j@nanofab.com', domain: 'nanofab.com', enrichmentStatus: 'ok' } });
    const analytics = r.items.find((u) => u.linkUnitType === 'analytics')!;
    expect(analytics).toMatchObject({ unitKey: 'v1', visitorId: 'v1', signal: { orgNameDisplay: 'Verizon Business', country: 'US' } });
  });

  it('structured enrichment failure is isolated per unit', async () => {
    mockSend.mockResolvedValueOnce({ Items: [rfqEv] });
    sourceEmailMock.mockRejectedValueOnce(new Error('boom'));
    const r = await needsLinkingQueue({});
    expect(r.items[0].signal.enrichmentStatus).toBe('error');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — query GSI1 (`begins_with`/filter voided+internal), group by unit key (structured: `orgId`; analytics: `payload.visitorId`), pick newest-occurredAt as representative, enrich structured via `readSourceEmailForUnit` (per-unit try/catch → `enrichmentStatus`). Return `{ items, nextToken }`. (Full implementation mirrors the test's expected shape; `eventCount` = count within the page for that unit.)

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/lib/read/needsLinkingQueue.ts amplify/functions/crm-api/lib/read/needsLinkingQueue.test.ts amplify/functions/crm-api/lib/link/sourceEmail.ts amplify/functions/crm-api/lib/link/linkStructuredUnit.ts
git commit -m "feat(crm-api): needsLinkingQueue read + per-unit enrichment (3B)"
```

---

## Task 8: Handler wiring (1 query + 2 mutation resolvers, server-derived operator)

**Files:**
- Modify: `amplify/functions/crm-api/handler.ts`
- Test: `amplify/functions/crm-api/handler.test.ts`

- [ ] **Step 1: Write the failing test** (append) — assert an AppSync event with `info.fieldName='linkStructuredUnit'` routes to the orchestrator with the operator taken from `identity.claims.email` (NOT from a client-supplied `operator` arg), and `needsLinkingQueue`/`linkVisitor` route correctly.

```ts
const linkStructuredMock = vi.fn(); const linkVisitorMock = vi.fn(); const queueMock = vi.fn();
vi.mock('./lib/link/linkStructuredUnit', () => ({ linkStructuredUnit: (a: unknown) => linkStructuredMock(a) }));
vi.mock('./lib/link/linkVisitor', () => ({ linkVisitor: (a: unknown) => linkVisitorMock(a) }));
vi.mock('./lib/read/needsLinkingQueue', () => ({ needsLinkingQueue: (a: unknown) => queueMock(a) }));

describe('handler — 3B resolvers', () => {
  beforeEach(() => { linkStructuredMock.mockReset(); linkVisitorMock.mockReset(); queueMock.mockReset(); });
  it('derives operator server-side from identity, ignores any client operator arg', async () => {
    linkStructuredMock.mockResolvedValueOnce({ moved: 1 });
    await handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: { sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'ATTACKER' }, identity: { claims: { email: 'admin@x.com' } } } as never);
    expect(linkStructuredMock).toHaveBeenCalledWith({ sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com', operator: 'admin@x.com' });
  });
  it('routes linkVisitor and needsLinkingQueue', async () => {
    linkVisitorMock.mockResolvedValueOnce({ sessionsResolved: 2 });
    await handler({ info: { fieldName: 'linkVisitor' }, arguments: { visitorId: 'v1', targetOrgId: 'acme.com' }, identity: { sub: 'sub-1' } } as never);
    expect(linkVisitorMock).toHaveBeenCalledWith({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'sub-1' });
    queueMock.mockResolvedValueOnce({ items: [], nextToken: null });
    const r = await handler({ info: { fieldName: 'needsLinkingQueue' }, arguments: { limit: 25 } } as never);
    expect(r).toEqual({ items: [], nextToken: null });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — add to the `resolvers` map: `needsLinkingQueue`, `linkStructuredUnit`, `linkVisitor`. Add an operator helper: `const operatorOf = (e: AppSyncEvent) => e.identity?.claims?.email ?? e.identity?.sub ?? 'unknown';`. In the two mutation resolvers, build the orchestrator args from `e.arguments` but set `operator: operatorOf(e)` — never read `arguments.operator`. Keep the direct-action path unchanged.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(crm-api): wire needsLinkingQueue/linkStructuredUnit/linkVisitor; server-derived operator (3B)"
```

---

## Task 9: AppSync schema

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1** Add types + operations (near the existing CRM/timeline block): `NeedsLinkingSignal` (customType: email/domain/productModel/equipmentCategory/orgNameDisplay/country/region/topPaths[string[]]/enrichmentStatus, all optional except enrichmentStatus required), `NeedsLinkingItem` (unitKey/linkUnitType/source/kind/occurredAt/eventCount required; sourceEntityId/visitorId optional; signal ref required), `NeedsLinkingConnection` (items + nextToken), and result types `LinkStructuredResult` (affected/moved/skipped/errors ints, sourceBackfillStatus/contactStatus strings, alreadyLinked boolean, existingOrgId string) + `LinkVisitorResult` (sessionsResolved int, pending boolean, alreadyLinked/alreadyResolved boolean, existingOrgId string). Add:
```ts
  needsLinkingQueue: a.query().arguments({ limit: a.integer(), nextToken: a.string() })
    .returns(a.ref('NeedsLinkingConnection').required()).handler(a.handler.function(crmApi)).authorization((allow) => [allow.authenticated()]),
  linkStructuredUnit: a.mutation().arguments({ sourceType: a.string().required(), sourceEntityId: a.string().required(), targetOrgId: a.string().required() })
    .returns(a.ref('LinkStructuredResult').required()).handler(a.handler.function(crmApi)).authorization((allow) => [allow.authenticated()]),
  linkVisitor: a.mutation().arguments({ visitorId: a.string().required(), targetOrgId: a.string().required() })
    .returns(a.ref('LinkVisitorResult').required()).handler(a.handler.function(crmApi)).authorization((allow) => [allow.authenticated()]),
```
Also add `details: a.json()` to the existing `LinkAuditLog` custom type (if present; else note it for the audit read surface — not consumed by 3B UI, safe to add).

- [ ] **Step 2** `npx tsc --noEmit -p amplify/tsconfig.json` → clean. (Mutations on crm-api are safe: crm-api is already `resourceGroupName:'data'`.)

- [ ] **Step 3: Commit**
```bash
git add amplify/data/resource.ts
git commit -m "feat(data): needsLinkingQueue query + linkStructuredUnit/linkVisitor mutations + types (3B)"
```

---

## Task 10: Frontend service calls

**Files:**
- Modify: `src/services/organizationAdminService.ts` (or a new `crmLinkingService.ts` — keep with org service since it reuses `client`/`AUTH`)

- [ ] **Step 1** Add `getNeedsLinkingQueue({limit?,nextToken?})`, `linkStructuredUnit({sourceType,sourceEntityId,targetOrgId})`, `linkVisitor({visitorId,targetOrgId})`, each mirroring the existing `client().queries.X`/`client().mutations.X(args, AUTH)` + error-throw pattern.

- [ ] **Step 2** `npx tsc --noEmit` → clean (schema-derived client type includes the new ops).

- [ ] **Step 3: Commit**
```bash
git add src/services/organizationAdminService.ts
git commit -m "feat(admin): needs-linking service calls (3B)"
```

---

## Task 11: `useNeedsLinkingQueue` hook

**Files:**
- Create: `src/hooks/useNeedsLinkingQueue.ts`
- Test: `src/hooks/useNeedsLinkingQueue.test.tsx`

- [ ] **Step 1: Write the failing test** — loads page 1; `loadMore` appends; `evictUnit(unitKey)` removes ALL loaded items with that unitKey (no persistence); `relink*` actions call the service then evict on success. Exports the item type. Mirror `useOrganizationTimeline` structure; mock the service.

```tsx
it('evictUnit removes every loaded row with the same unitKey', async () => {
  vi.mocked(svc.getNeedsLinkingQueue).mockResolvedValueOnce({ items: [{ unitKey: 'u1' }, { unitKey: 'u2' }], nextToken: null } as never);
  const { result } = renderHook(() => useNeedsLinkingQueue());
  await waitFor(() => expect(result.current.items).toHaveLength(2));
  act(() => result.current.evictUnit('u1'));
  expect(result.current.items.map((i: { unitKey: string }) => i.unitKey)).toEqual(['u2']);
});
```

- [ ] **Step 2–5:** fail → implement (state items/nextToken/loading/error; `loadMore`, `evictUnit(unitKey)` = `setItems(prev => prev.filter(i => i.unitKey !== unitKey))`) → pass → commit `feat(admin): useNeedsLinkingQueue hook (3B)`.

---

## Task 12: `UnitDetail` (type-adaptive) + org search + impact preview

**Files:**
- Create: `src/components/admin/needslinking/UnitDetail.tsx`
- Test: `src/components/admin/needslinking/UnitDetail.test.tsx`

- [ ] **Step 1: Write the failing test** — for a structured unit: renders email/domain signal, an org search that calls `listOrganizations({search})`, the link button is **disabled until a target org is selected**, and the impact-preview text does not claim an authoritative count ("currently loaded"/"will re-query"). For an analytics unit: renders IP-org/geo/session signal and the visitor impact copy. Selecting an org + clicking Link calls the injected `onLink(targetOrgId)`.

- [ ] **Step 2–5:** fail → implement (props: `unit`, `onLink`, and an injected `searchOrgs` fn; local state `selectedOrg`; `disabled={!selectedOrg}`) → pass → commit `feat(admin): needs-linking UnitDetail + org picker + impact preview (3B)`.

---

## Task 13: `NeedsLinkingPage` two-pane + wiring

**Files:**
- Create: `src/pages/admin/NeedsLinkingPage.tsx`, `src/components/admin/needslinking/UnitList.tsx`
- Test: `src/pages/admin/NeedsLinkingPage.test.tsx`

- [ ] **Step 1: Write the failing test** — renders the two-pane layout: `UnitList` groups rows under `Structured` / `Site visitors`; selecting a unit shows its `UnitDetail`; a successful link calls the hook's `evictUnit(unitKey)` and auto-advances selection to the next unit; on empty list shows the empty state. Mock `useNeedsLinkingQueue` + the service.

- [ ] **Step 2–5:** fail → implement (wire `useNeedsLinkingQueue`; left `UnitList`; right `UnitDetail` for the selected unit; `handleLink` calls `svc.linkStructuredUnit`/`linkVisitor` by `linkUnitType`, then `evictUnit` + advance; loading/error/empty per 3A conventions) → pass → commit `feat(admin): NeedsLinkingPage two-pane triage (3B)`.

---

## Task 14: Route + nav entry

**Files:**
- Modify: the admin router (where `OrganizationDetailPage` etc. are routed) + the admin nav (`AdminLayout.tsx`).

- [ ] **Step 1** Add a route `/admin/needs-linking` → `NeedsLinkingPage`, and a nav item (Material Symbols icon, e.g. `link`) in `AdminLayout`. Follow the existing route/nav registration pattern.
- [ ] **Step 2** `npx tsc --noEmit` clean; manually confirm the route renders the page (no test required for wiring, but ensure the app builds).
- [ ] **Step 3: Commit** `feat(admin): needs-linking route + nav entry (3B)`.

---

## Task 15: Green-bar checkpoint

- [ ] **Step 1** `npx vitest run --exclude '**/.claude/**' amplify/functions/crm-api amplify/lib/crm src/hooks/useNeedsLinkingQueue.test.tsx 'src/components/admin/needslinking/**' src/pages/admin/NeedsLinkingPage.test.tsx` → all pass.
- [ ] **Step 2** `npx tsc --noEmit && npx tsc --noEmit -p amplify/tsconfig.json` → clean.
- [ ] **Step 3** `npx eslint amplify/functions/crm-api/lib/link amplify/functions/crm-api/lib/read/needsLinkingQueue.ts amplify/lib/crm/visitor-bridge.ts 'src/**/needslinking/**' src/hooks/useNeedsLinkingQueue.ts src/pages/admin/NeedsLinkingPage.tsx --ext ts,tsx` → clean.
- [ ] **Step 4** `git add -A && git commit -m "chore(3B): green-bar — needs-linking complete" || echo "nothing to commit"`.

---

## Self-Review (against the spec)

**Spec coverage:** §1 queue read+enrichment → Task 7; §1.4 asymmetric enrichment + isolation → Task 7; §2.1 linkStructuredUnit (validate/query/move/backfill/audit) → Tasks 3,4,5; §2.1.3 conditional move + rollup durability → Task 4; §2.1.4 contact completion → Task 4; §2.1.5 backfill first-writer-wins + quote/logistics→order → Task 5; §2.2 linkVisitor + no-op guards → Task 6; §2.2.3 manual provenance → Task 2; §2.3 audit details → Task 1 (+ used in 5,6); §3 UI (two-pane/org-picker/impact/disabled/evict-no-persist) → Tasks 11,12,13; §4.1 idempotency/first-writer-wins → Tasks 4,5,6; §4.2 target validation → Task 3 (used 5,6); §4.3 manual tier → Task 2; §4.4 change surface → all; §4.5 testing → each task's tests; operator server-derived → Task 8.

**Mandated assertions mapped:** (a) not-via-emit → Task 4 test asserts the conditional Put shape, no emit import; (b) stale→skipped → Task 4 test 2; (c) dirty→recompute→mark order → Task 4 test 1 (invocationCallOrder); (d) email→contact+GSI4 / no-email moves → Task 4 tests 1,3; (e) backfill first-writer-wins + quote/logistics→order → Task 5 test 4 + backfillSource; (f) audit details stored → Task 1; (g) operator server-derived → Task 8 test 1; (h) linkVisitor manual-only-when-no-real-bridge + no-op guards → Task 6 tests; (i) UI evict-by-unitKey, no persist → Task 11 + Task 13 tests.

**Placeholder scan:** Tasks 7/11/12/13 describe the implementation in prose after giving the exact failing test with concrete assertions — the test pins the contract; the implementer writes minimal code to satisfy it (acceptable for UI/glue tasks where the test is the spec). Backend logic tasks (1–6,8) have complete code.

**Type consistency:** `manualMoveTimelineEvent`/`ContactStatus` (Task 4) used by Task 5; `orgExists` (Task 3) by 5,6; `upsertManualVisitorBridge`/`orgSource:'manual'` (Task 2) by 6; `readSourceEmailForUnit`/`sourceDomain` (Task 7 step 0) by 5,7; `writeLinkAuditLog(details)` (Task 1) by 5,6; service fns (Task 10) by 11,13; `useNeedsLinkingQueue` return incl. `evictUnit` (Task 11) by 13.

## Open items resolved
- Enrichment helper: **extracted** to `lib/link/sourceEmail.ts` and imported (Task 7 step 0).
- Representative kind: **newest `occurredAt`** in the unit (Task 7).
