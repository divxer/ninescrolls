# Customer 360 Timeline — Plan 2A: Channel Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the merged P1 `emitTimelineEvent` into the 5 source Lambdas (8 emit sites) so new RFQ / Lead / Order / Quote / Logistics interactions flow into the Customer 360 timeline in real time, via an async fire-and-forget invoke that never blocks or fails a business mutation.

**Architecture:** A new shared `amplify/lib/crm/` module owns the wire contract (`CrmEmitPayload`), an async `invokeCrmApi` helper (mirrors `amplify/lib/organization/invoke-org-api.ts`), and pure `EmitArgs` builders. `crm-api/handler.ts` gains a direct-invoke branch routing `{action:'emitTimelineEvent'}` to the existing `emitTimelineEvent`. Each business Lambda, after its source write commits, builds an `EmitArgs` and fires `emitTimelineEventToCrm(...)` (`InvocationType:'Event'`). Org identity reuses the existing `invokeOrganizationApi` (`matchedOrgId`); `occurredAt` is always the source record's business timestamp so live-emit and future 2B-backfill dedupe via P1's deterministic ids.

**Tech Stack:** TypeScript (Node 22), AWS SDK v3 (`@aws-sdk/client-lambda`, `@aws-sdk/lib-dynamodb`), Amplify Gen 2, vitest. Spec: `docs/superpowers/specs/2026-06-30-customer-360-timeline-p2a-channel-wiring-design.md`. Builds on merged P1 (`amplify/functions/crm-api/`).

**Conventions confirmed from the codebase:**
- `invoke-org-api.ts` precedent: `new LambdaClient({})`, `InvokeCommand`, `FunctionName` from an env var, `Payload` via `TextEncoder`, parse `res.Payload`, throw on `res.FunctionError`.
- `crm-api/handler.ts` is currently AppSync-only (`event.info?.fieldName ?? event.fieldName`).
- `organization-api` detects direct Lambda invokes by the presence of an `action` key + absence of AppSync markers.
- Tests: vitest, `vi.mock`, `*.test.ts` next to source. Run from repo root: `npx vitest run <path>`.
- Relative imports in `amplify/lib/*` use **no** `.js` extension (see `invoke-org-api.ts`); `crm-api/lib` likewise uses no extension; the order-api/logistics-api resolvers use `.js`. Match the file you are editing.

**EmitArgs (P1, the contract — `crm-api/lib/emitTimelineEvent.ts`):**
```
EmitArgs = {
  source: 'analytics'|'lead'|'rfq'|'quote'|'order'|'logistics'|'manual'|'gmail'|'twilio'|'support';
  kind: string; sourceEntityType: string; sourceEntityId: string;
  occurredAt: string; summary: string;
  idInput: TimelineIdInput;            // discriminated union by `kind`, from timelineId.ts
  resolveInput: ResolveInput;          // { sourceEntityType, sourceEntityId, channel, matchedOrgId?, email?, lockedOrgId?, lockedContactId?, priorVisitorOrgId? }
  isInternalOnly?: boolean; voided?: boolean; createdBy?: string | null;
  payload?: Record<string, unknown> | null;
}
```

---

## File Structure

**New — `amplify/lib/crm/`:**
- `types.ts` — `CrmEmitPayload` wire contract; type-only re-export of `EmitArgs` from crm-api. This is intentional for 2A: P1's `crm-api/lib/emitTimelineEvent.ts` remains the source of truth for the internal emit shape, while `amplify/lib/crm/types.ts` is the public wire facade business Lambdas import. The type-only import is erased at build time, so there is no runtime coupling.
- `invoke-crm-api.ts` — `invokeCrmApi(payload, opts?)` + `emitTimelineEventToCrm(args, opts?)`.
- `emit-builders.ts` — pure `EmitArgs` builders (rfq, lead, orderCreated, orderStageChanged, quoteSent, logisticsMilestone).
- `*.test.ts` for each.

**Modified:**
- `amplify/functions/crm-api/handler.ts` — direct-invoke branch.
- `amplify/backend.ts` — grants + env (5× `crmApi` invoke; `orderApi→organizationApi`).
- Source sites: `submit-rfq/handler.ts`, `submit-lead/handler.ts`, `convert-rfq-to-order/handler.ts`, `order-api/resolvers/{createOrder,updateOrderStatus,confirmDocumentUpload}.ts`, `logistics-api/resolvers/{advanceLogisticsStage,createLogisticsCase}.ts`.

---

## Task 1: Shared wire contract + async `invokeCrmApi` helper

**Files:**
- Create: `amplify/lib/crm/types.ts`
- Create: `amplify/lib/crm/invoke-crm-api.ts`
- Test: `amplify/lib/crm/invoke-crm-api.test.ts`

- [ ] **Step 1: Write the failing test**

`amplify/lib/crm/invoke-crm-api.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const send = vi.fn();
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: class { send = (...a: unknown[]) => send(...a); },
  InvokeCommand: class { constructor(public input: Record<string, unknown>) {} },
}));
import { invokeCrmApi, emitTimelineEventToCrm } from './invoke-crm-api';

const args = {
  source: 'rfq', kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1',
  occurredAt: '2026-06-19T10:00:00Z', summary: 'x',
  idInput: { kind: 'rfq_submitted', rfqId: 'rfq-1' },
  resolveInput: { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' },
} as never;

beforeEach(() => { send.mockReset(); process.env.CRM_API_FUNCTION_NAME = 'crm-fn'; });

describe('invokeCrmApi', () => {
  it('default is async Event invoke with the emitTimelineEvent action payload', async () => {
    send.mockResolvedValueOnce({ StatusCode: 202 });
    await emitTimelineEventToCrm(args);
    const input = send.mock.calls[0][0].input;
    expect(input.FunctionName).toBe('crm-fn');
    expect(input.InvocationType).toBe('Event'); // accepted-for-delivery, NOT projection-confirmed
    const payload = JSON.parse(new TextDecoder().decode(input.Payload));
    expect(payload.action).toBe('emitTimelineEvent');
    expect(payload.args.kind).toBe('rfq_submitted');
  });
  it('async path swallows + logs a dispatch failure (never throws into the business path)', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(emitTimelineEventToCrm(args)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
  it('sync mode uses RequestResponse and THROWS on invoke error (tests/backfill only)', async () => {
    send.mockRejectedValueOnce(new Error('boom'));
    await expect(emitTimelineEventToCrm(args, { sync: true })).rejects.toThrow(/boom/);
    expect(send.mock.calls[0][0].input.InvocationType).toBe('RequestResponse');
  });
  it('sync mode throws on a FunctionError result', async () => {
    send.mockResolvedValueOnce({ FunctionError: 'Unhandled', Payload: new TextEncoder().encode('{"errorMessage":"bad"}') });
    await expect(emitTimelineEventToCrm(args, { sync: true })).rejects.toThrow(/bad/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/crm/invoke-crm-api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the contract + helper**

`amplify/lib/crm/types.ts`:
```typescript
import type { EmitArgs } from '../../functions/crm-api/lib/emitTimelineEvent';

// Single source of truth for the timeline-emit shape is crm-api; re-export it as the wire
// contract so business Lambdas never import crm-api runtime internals (type-only = erased at build).
export type { EmitArgs };

export interface CrmEmitPayload {
  action: 'emitTimelineEvent';
  args: EmitArgs;
}
```

`amplify/lib/crm/invoke-crm-api.ts`:
```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { CrmEmitPayload, EmitArgs } from './types';

const lambda = new LambdaClient({});
const FUNCTION_NAME = () => process.env.CRM_API_FUNCTION_NAME!;

/**
 * Invoke crm-api. Default is async `Event` (fire-and-forget): a 202 means Lambda ACCEPTED the
 * event for delivery — NOT that the CRM projection succeeded. Projection failures are observed via
 * crm-api logs / AWS async retries / the 2C reconciliation sweep, never by the caller. Dispatch
 * failures on the async path are logged and swallowed so a business mutation is never blocked.
 *
 * `{ sync: true }` (tests / backfill-debug ONLY, never on the business path) uses RequestResponse
 * and throws on invoke or FunctionError so the caller can observe failure.
 */
export async function invokeCrmApi(payload: CrmEmitPayload, opts?: { sync?: boolean }): Promise<void> {
  const sync = opts?.sync ?? false;
  try {
    const res = await lambda.send(new InvokeCommand({
      FunctionName: FUNCTION_NAME(),
      InvocationType: sync ? 'RequestResponse' : 'Event',
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }));
    if (sync && res.FunctionError) {
      const text = res.Payload ? new TextDecoder().decode(res.Payload) : '';
      const parsed = text ? JSON.parse(text) : null;
      throw new Error(`crm-api error: ${parsed?.errorMessage ?? res.FunctionError}`);
    }
  } catch (err) {
    if (sync) throw err;
    // async business path: log + swallow — the source write already committed; the sweep heals.
    console.error(JSON.stringify({
      event: 'crm.emit.dispatch_failed',
      kind: payload.args.kind,
      sourceEntityType: payload.args.sourceEntityType,
      sourceEntityId: payload.args.sourceEntityId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

export async function emitTimelineEventToCrm(args: EmitArgs, opts?: { sync?: boolean }): Promise<void> {
  return invokeCrmApi({ action: 'emitTimelineEvent', args }, opts);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/crm/invoke-crm-api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/crm/types.ts amplify/lib/crm/invoke-crm-api.ts amplify/lib/crm/invoke-crm-api.test.ts
git commit -m "feat(crm): async invoke-crm-api helper + wire contract (Plan 2A)"
```

---

## Task 2: `crm-api` direct-invoke dispatch

**Files:**
- Modify: `amplify/functions/crm-api/handler.ts`
- Test: `amplify/functions/crm-api/handler.test.ts`

- [ ] **Step 1: Write the failing test**

Replace `amplify/functions/crm-api/handler.test.ts` with a hoisted mock before importing `handler`:
```typescript
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ emitTimelineEvent: vi.fn() }));
vi.mock('./lib/emitTimelineEvent', () => ({
  emitTimelineEvent: (a: unknown) => mocks.emitTimelineEvent(a),
}));

import { handler } from './handler';

describe('crm-api direct-invoke dispatch', () => {
  it('routes {action:emitTimelineEvent} to emitTimelineEvent and ignores AppSync markers', async () => {
    mocks.emitTimelineEvent.mockResolvedValueOnce(undefined);
    const args = { source: 'rfq', kind: 'rfq_submitted' };
    await handler({ action: 'emitTimelineEvent', args } as never);
    expect(mocks.emitTimelineEvent).toHaveBeenCalledWith(args);
  });
  it('throws on an unknown action', async () => {
    await expect(handler({ action: 'nope' } as never)).rejects.toThrow(/unknown action.*nope/i);
  });
  it('preserves the AppSync field dispatch error path', async () => {
    const event = { info: { fieldName: 'nope', parentTypeName: 'Query' }, arguments: {} };
    await expect(handler(event as never)).rejects.toThrow(/unknown.*nope/i);
  });
});
```
> Reason: the current test imports `handler` at top-level. `vi.hoisted` avoids Vitest mock-hoisting/TDZ traps and guarantees the mock is registered before `handler` imports `./lib/emitTimelineEvent`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: FAIL — direct-invoke path not handled (`unknown fieldName "undefined"`).

- [ ] **Step 3: Implement the dispatch branch**

Replace `amplify/functions/crm-api/handler.ts` with:
```typescript
import { emitTimelineEvent } from './lib/emitTimelineEvent';

type AppSyncEvent = {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; claims?: { email?: string } };
};

// Direct Lambda invoke payloads (from amplify/lib/crm/invoke-crm-api) carry an `action`.
type DirectInvokeEvent = { action: string; args?: unknown };

const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {};

const actions: Record<string, (e: DirectInvokeEvent) => Promise<unknown>> = {
  emitTimelineEvent: async (e) => { await emitTimelineEvent(e.args as Parameters<typeof emitTimelineEvent>[0]); },
};

export const handler = async (event: AppSyncEvent | DirectInvokeEvent): Promise<unknown> => {
  // Direct invoke (has `action`, no AppSync markers) → action dispatch.
  if (typeof (event as DirectInvokeEvent).action === 'string' && !(event as AppSyncEvent).info && !(event as AppSyncEvent).fieldName) {
    const action = (event as DirectInvokeEvent).action;
    if (!actions[action]) throw new Error(`crm-api: unknown action "${action}"`);
    return actions[action](event as DirectInvokeEvent);
  }
  // AppSync field resolver (Plan 3 queries).
  const appsync = event as AppSyncEvent;
  const fieldName = appsync.info?.fieldName ?? appsync.fieldName;
  if (!fieldName || !resolvers[fieldName]) {
    throw new Error(`crm-api: unknown fieldName "${fieldName}"`);
  }
  return resolvers[fieldName](appsync);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/functions/crm-api/handler.test.ts`
Expected: PASS (existing AppSync test + 2 new direct-invoke tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts
git commit -m "feat(crm-api): direct-invoke dispatch for emitTimelineEvent action (Plan 2A)"
```

---

## Task 3: Pure `EmitArgs` builders

**Files:**
- Create: `amplify/lib/crm/emit-builders.ts`
- Test: `amplify/lib/crm/emit-builders.test.ts`

- [ ] **Step 1: Write the failing test**

`amplify/lib/crm/emit-builders.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  buildRfqEmitArgs, buildLeadEmitArgs, buildOrderCreatedEmitArgs,
  buildOrderStageChangedEmitArgs, buildQuoteSentEmitArgs, buildLogisticsMilestoneEmitArgs,
} from './emit-builders';

describe('emit-builders (pure)', () => {
  it('buildRfqEmitArgs: stable occurredAt, deterministic id, matchedOrgId+email in resolveInput', () => {
    const a = buildRfqEmitArgs({ rfqId: 'rfq-1', submittedAt: '2026-06-19T10:00:00Z', email: 'T@DiamondFoundry.com', specificModel: 'ICP-1000W' }, 'diamondfoundry.com');
    expect(a).toMatchObject({ source: 'rfq', kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', occurredAt: '2026-06-19T10:00:00Z' });
    expect(a.idInput).toEqual({ kind: 'rfq_submitted', rfqId: 'rfq-1' });
    expect(a.resolveInput).toMatchObject({ channel: 'rfq', matchedOrgId: 'diamondfoundry.com', email: 'T@DiamondFoundry.com' });
    expect(a.summary).toContain('ICP-1000W');
  });
  it('buildLeadEmitArgs: summary varies by lead type', () => {
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'download_gate', productName: 'ICP brochure' }, null).summary).toMatch(/Downloaded/i);
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'contact', inquiryType: 'pricing' }, null).summary).toMatch(/Contact/i);
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'newsletter' }, null).summary).toMatch(/Newsletter/i);
    expect(buildLeadEmitArgs({ leadId: 'l1', submittedAt: '2026-01-01T00:00:00Z', type: 'contact' }, 'acme.com').resolveInput.matchedOrgId).toBe('acme.com');
  });
  it('buildOrderCreatedEmitArgs: order_created, optional rfqId in payload', () => {
    const a = buildOrderCreatedEmitArgs({ orderId: 'ord-1', createdAt: '2026-03-01T00:00:00Z', productModel: 'XPS-9' }, { matchedOrgId: 'acme.com', email: 'p@acme.com', rfqId: 'rfq-9' });
    expect(a).toMatchObject({ source: 'order', kind: 'order_created', sourceEntityId: 'ord-1', occurredAt: '2026-03-01T00:00:00Z' });
    expect(a.idInput).toEqual({ kind: 'order_created', orderId: 'ord-1' });
    expect(a.resolveInput.matchedOrgId).toBe('acme.com');
    expect(a.payload).toMatchObject({ rfqId: 'rfq-9' });
  });
  it('buildOrderStageChangedEmitArgs: keyed by stable orderLogId, summary shows status', () => {
    const a = buildOrderStageChangedEmitArgs({ orderId: 'ord-1', matchedOrgId: 'acme.com' }, { id: 'olog-abc', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' });
    expect(a.kind).toBe('order_stage_changed');
    expect(a.idInput).toEqual({ kind: 'order_stage_changed', orderId: 'ord-1', orderLogId: 'olog-abc', toStatus: 'SHIPPED', occurredAt: '2026-04-01T00:00:00Z' });
    expect(a.occurredAt).toBe('2026-04-01T00:00:00Z');
    expect(a.summary).toContain('SHIPPED');
    expect(a.resolveInput.matchedOrgId).toBe('acme.com');
  });
  it('buildQuoteSentEmitArgs: quote_sent keyed by doc id', () => {
    const a = buildQuoteSentEmitArgs({ orderId: 'ord-1', matchedOrgId: 'acme.com' }, { id: 'doc-1', fileName: 'Quote-014.pdf', uploadedAt: '2026-03-05T00:00:00Z' });
    expect(a).toMatchObject({ source: 'quote', kind: 'quote_sent', sourceEntityType: 'quote', sourceEntityId: 'doc-1', occurredAt: '2026-03-05T00:00:00Z' });
    expect(a.idInput).toEqual({ kind: 'quote_sent', quoteDocId: 'doc-1' });
    expect(a.summary).toContain('Quote-014.pdf');
  });
  it('buildLogisticsMilestoneEmitArgs: isInternalOnly passthrough + matchedOrgId from related order', () => {
    const internal = buildLogisticsMilestoneEmitArgs({ caseId: 'lc-1', caseType: 'SAMPLE' }, { id: 'mlog-x', toStage: 'US_CUSTOMS_CLEARED', timestamp: '2026-06-28T00:00:00Z', internalOnly: true, action: 'STAGE_ADVANCED' }, 'acme.com');
    expect(internal).toMatchObject({ source: 'logistics', kind: 'logistics_milestone', sourceEntityId: 'lc-1', isInternalOnly: true });
    expect(internal.idInput).toEqual({ kind: 'logistics_milestone', caseId: 'lc-1', milestoneId: 'mlog-x', stage: 'US_CUSTOMS_CLEARED', occurredAt: '2026-06-28T00:00:00Z' });
    expect(internal.resolveInput.matchedOrgId).toBe('acme.com');
    expect(internal.summary).toContain('US_CUSTOMS_CLEARED');
    const created = buildLogisticsMilestoneEmitArgs({ caseId: 'lc-2', caseType: 'EQUIPMENT' }, { id: 'mlog-y', toStage: 'DRAFT', timestamp: '2026-06-01T00:00:00Z', internalOnly: false, action: 'CASE_CREATED' }, null);
    expect(created.summary).toMatch(/created/i);
    expect(created.isInternalOnly).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run amplify/lib/crm/emit-builders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builders**

`amplify/lib/crm/emit-builders.ts`:
```typescript
import type { EmitArgs } from './types';

const orgEmail = (matchedOrgId: string | null, email?: string | null) => ({
  matchedOrgId: matchedOrgId ?? undefined,
  email: email ?? undefined,
});

export function buildRfqEmitArgs(
  rfq: { rfqId: string; submittedAt: string; email?: string | null; equipmentCategory?: string | null; specificModel?: string | null },
  matchedOrgId: string | null,
): EmitArgs {
  const label = rfq.specificModel || rfq.equipmentCategory || 'equipment';
  return {
    source: 'rfq', kind: 'rfq_submitted', sourceEntityType: 'rfq', sourceEntityId: rfq.rfqId,
    occurredAt: rfq.submittedAt, summary: `Submitted RFQ — ${label}`,
    idInput: { kind: 'rfq_submitted', rfqId: rfq.rfqId },
    resolveInput: { sourceEntityType: 'rfq', sourceEntityId: rfq.rfqId, channel: 'rfq', ...orgEmail(matchedOrgId, rfq.email) },
    payload: { equipmentCategory: rfq.equipmentCategory ?? null, specificModel: rfq.specificModel ?? null },
  };
}

export function buildLeadEmitArgs(
  lead: { leadId: string; submittedAt: string; type: string; email?: string | null; productName?: string | null; inquiryType?: string | null },
  matchedOrgId: string | null,
): EmitArgs {
  let summary: string;
  if (lead.type === 'download_gate') summary = `Downloaded ${lead.productName ?? 'a resource'}`;
  else if (lead.type === 'newsletter') summary = 'Newsletter signup';
  else summary = `Contact form${lead.inquiryType ? `: ${lead.inquiryType}` : ''}`;
  return {
    source: 'lead', kind: 'lead_captured', sourceEntityType: 'lead', sourceEntityId: lead.leadId,
    occurredAt: lead.submittedAt, summary,
    idInput: { kind: 'lead_captured', leadId: lead.leadId },
    resolveInput: { sourceEntityType: 'lead', sourceEntityId: lead.leadId, channel: 'lead', ...orgEmail(matchedOrgId, lead.email) },
    payload: { type: lead.type, productName: lead.productName ?? null },
  };
}

export function buildOrderCreatedEmitArgs(
  order: { orderId: string; createdAt: string; productModel?: string | null },
  opts: { matchedOrgId: string | null; email?: string | null; rfqId?: string | null },
): EmitArgs {
  const label = order.productModel || 'equipment';
  return {
    source: 'order', kind: 'order_created', sourceEntityType: 'order', sourceEntityId: order.orderId,
    occurredAt: order.createdAt, summary: opts.rfqId ? `Order created from RFQ — ${label}` : `Order created — ${label}`,
    idInput: { kind: 'order_created', orderId: order.orderId },
    resolveInput: { sourceEntityType: 'order', sourceEntityId: order.orderId, channel: 'order', ...orgEmail(opts.matchedOrgId, opts.email) },
    payload: { rfqId: opts.rfqId ?? null, productModel: order.productModel ?? null },
  };
}

export function buildOrderStageChangedEmitArgs(
  order: { orderId: string; matchedOrgId?: string | null },
  log: { id: string; toStatus: string; fromStatus?: string | null; timestamp: string },
  email?: string | null,
): EmitArgs {
  return {
    source: 'order', kind: 'order_stage_changed', sourceEntityType: 'order', sourceEntityId: order.orderId,
    occurredAt: log.timestamp, summary: `Order → ${log.toStatus}`,
    idInput: { kind: 'order_stage_changed', orderId: order.orderId, orderLogId: log.id, toStatus: log.toStatus, occurredAt: log.timestamp },
    resolveInput: { sourceEntityType: 'order', sourceEntityId: order.orderId, channel: 'order', ...orgEmail(order.matchedOrgId ?? null, email) },
    payload: { fromStatus: log.fromStatus ?? null, toStatus: log.toStatus },
  };
}

export function buildQuoteSentEmitArgs(
  order: { orderId: string; matchedOrgId?: string | null },
  doc: { id: string; fileName: string; uploadedAt: string },
  email?: string | null,
): EmitArgs {
  return {
    source: 'quote', kind: 'quote_sent', sourceEntityType: 'quote', sourceEntityId: doc.id,
    occurredAt: doc.uploadedAt, summary: `Quote sent — ${doc.fileName}`,
    idInput: { kind: 'quote_sent', quoteDocId: doc.id },
    resolveInput: { sourceEntityType: 'quote', sourceEntityId: doc.id, channel: 'quote', ...orgEmail(order.matchedOrgId ?? null, email) },
    payload: { orderId: order.orderId, fileName: doc.fileName },
  };
}

export function buildLogisticsMilestoneEmitArgs(
  c: { caseId: string; caseType?: string | null },
  entry: { id: string; toStage: string; fromStage?: string | null; timestamp: string; internalOnly: boolean; action: string },
  matchedOrgId: string | null,
): EmitArgs {
  const summary = entry.action === 'CASE_CREATED'
    ? `Logistics case created — ${c.caseType ?? 'case'}`
    : `Logistics: ${entry.toStage}`;
  return {
    source: 'logistics', kind: 'logistics_milestone', sourceEntityType: 'logistics', sourceEntityId: c.caseId,
    occurredAt: entry.timestamp, summary, isInternalOnly: entry.internalOnly,
    idInput: { kind: 'logistics_milestone', caseId: c.caseId, milestoneId: entry.id, stage: entry.toStage, occurredAt: entry.timestamp },
    resolveInput: { sourceEntityType: 'logistics', sourceEntityId: c.caseId, channel: 'logistics', matchedOrgId: matchedOrgId ?? undefined },
    payload: { fromStage: entry.fromStage ?? null, toStage: entry.toStage },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run amplify/lib/crm/emit-builders.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/crm/emit-builders.ts amplify/lib/crm/emit-builders.test.ts
git commit -m "feat(crm): pure EmitArgs builders for the 6 channel kinds (Plan 2A)"
```

---

## Task 4: Backend wiring (grants + env)

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Add grants + env (mirror the org-api grant block)**

In `amplify/backend.ts`, near the existing org-api grant block (~`:1028`, where `submitRfq`/`submitLead`/`convertRfqToOrder` get `ORGANIZATION_API_FUNCTION_NAME`), add a CRM block:
```typescript
// Cross-Lambda invoke from the 5 source Lambdas → crm-api (8 Plan-2A emit sites).
// Match the existing organization-api grant style rather than grantInvoke(), to keep
// dependencies explicit and avoid surprising synthesized circular references.
[backend.submitRfq, backend.submitLead, backend.convertRfqToOrder, backend.orderApi, backend.logisticsApi].forEach((fn) => {
  fn.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [backend.crmApi.resources.lambda.functionArn],
  }));
  fn.addEnvironment('CRM_API_FUNCTION_NAME', backend.crmApi.resources.lambda.functionName);
});

// Manual createOrder (order-api) needs to upsert/get the canonical Organization → matchedOrgId.
backend.orderApi.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['lambda:InvokeFunction'],
  resources: [backend.organizationApi.resources.lambda.functionArn],
}));
backend.orderApi.addEnvironment('ORGANIZATION_API_FUNCTION_NAME', backend.organizationApi.resources.lambda.functionName);
```
> `PolicyStatement` / `Effect` are already imported in `backend.ts`; reuse them.

- [ ] **Step 2: Typecheck the backend**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add amplify/backend.ts
git commit -m "feat(backend): grant crm-api invoke to source Lambdas + order-api→org-api (Plan 2A)"
```

---

## Tasks 5–12: Per-channel emit wiring

Each task follows the same shape: after the source write commits, build the `EmitArgs` and fire `emitTimelineEventToCrm(...)`. The integration test mocks `emitTimelineEventToCrm` (and, where relevant, `invokeOrganizationApi`), drives the resolver/handler, and asserts emit is called once with the expected `source`/`kind`/ids/`matchedOrgId`. **Failure ownership is helper-level:** the default async `emitTimelineEventToCrm` wrapper logs/swallows dispatch failure, so channel tests should not mock the wrapper to reject and then expect the business response to succeed. That non-fatal dispatch behavior is covered in Task 1's `invokeCrmApi` tests. Use `.js`-suffixed imports inside order-api/logistics-api resolvers; no suffix inside submit-* handlers if that's their convention (match the file).

### Task 5: `submit-rfq` (site #1)

**Files:** Modify `amplify/functions/submit-rfq/handler.ts` (after the RFQ `PutCommand`, ~`:597`); Test `amplify/functions/submit-rfq/handler.test.ts`.

- [ ] **Step 1: Failing test** — mock `../../lib/crm/invoke-crm-api` (`emitTimelineEventToCrm`), submit an RFQ with a corporate email, assert `emitTimelineEventToCrm` called once with `{ source:'rfq', kind:'rfq_submitted', sourceEntityId: <rfqId> }` and `resolveInput.matchedOrgId` = the value returned by the org-api upsert.
- [ ] **Step 2:** Run `npx vitest run amplify/functions/submit-rfq/handler.test.ts` → FAIL.
- [ ] **Step 3: Implement** — import `{ emitTimelineEventToCrm }` from `../../lib/crm/invoke-crm-api` and `{ buildRfqEmitArgs }` from `../../lib/crm/emit-builders`. After the RFQ `PutCommand` and the existing org-api upsert (which yields `matchedOrgId`), add:
```typescript
await emitTimelineEventToCrm(buildRfqEmitArgs(
  { rfqId, submittedAt, email, equipmentCategory, specificModel },
  matchedOrgId ?? null,
));
```
(Use the variables already in scope for the RFQ record + the `matchedOrgId` from the existing `invokeOrganizationApi` result.)
- [ ] **Step 4:** Run the test → PASS; run `npx vitest run amplify/functions/submit-rfq` → no regressions.
- [ ] **Step 5: Commit** — `git commit -m "feat(submit-rfq): emit rfq_submitted timeline event (Plan 2A)"`

### Task 6: `submit-lead` (site #2)

**Files:** Modify `amplify/functions/submit-lead/handler.ts` (after the lead `PutCommand` + `matchedOrgId` backfill, ~`:681`); Test `submit-lead/handler.test.ts`.

- [ ] **Step 1: Failing test** — for each lead `type` (`contact`/`download_gate`/`newsletter`), assert `emitTimelineEventToCrm` called with `kind:'lead_captured'`, the type-specific summary, and `resolveInput.matchedOrgId` from the backfill.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import helper + `buildLeadEmitArgs`. After the lead commit + `matchedOrgId` backfill:
```typescript
await emitTimelineEventToCrm(buildLeadEmitArgs(
  { leadId, submittedAt, type, email, productName, inquiryType },
  matchedOrgId ?? null,
));
```
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/submit-lead` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(submit-lead): emit lead_captured timeline event (Plan 2A)"`

### Task 7: `convert-rfq-to-order` (site #3)

**Files:** Modify `amplify/functions/convert-rfq-to-order/handler.ts` (after the order `PutCommand` + org backfill, ~`:216`); Test `convert-rfq-to-order/handler.test.ts`.

- [ ] **Step 1: Failing test** — assert `emitTimelineEventToCrm` called with `kind:'order_created'`, `payload.rfqId` set, and `resolveInput.matchedOrgId === finalMatchedOrgId` where `finalMatchedOrgId = orgResult.matchedOrgId ?? rfq.matchedOrgId`. Add a case where the RFQ already had a `matchedOrgId` and the org-api result is null → emit uses the RFQ's existing value.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import helper + `buildOrderCreatedEmitArgs`. After the order commit + org backfill, compute and emit:
```typescript
const finalMatchedOrgId = orgResult?.matchedOrgId ?? rfq.matchedOrgId ?? null;
await emitTimelineEventToCrm(buildOrderCreatedEmitArgs(
  { orderId, createdAt, productModel },
  { matchedOrgId: finalMatchedOrgId, email: primaryContactEmail, rfqId },
));
```
(Use the actual in-scope names for the org-api result + RFQ object + order fields.)
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/convert-rfq-to-order` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(convert-rfq): emit order_created with finalMatchedOrgId (Plan 2A)"`

### Task 8: `order-api/createOrder` (site #4 — manual order, org upsert)

**Files:** Modify `amplify/functions/order-api/resolvers/createOrder.ts` (after response built, ~`:139`); Test `order-api/handler.test.ts` (createOrder cases).

- [ ] **Step 1: Failing test** — mock `../../../lib/organization/invoke-org-api` (`invokeOrganizationApi`) and `../../../lib/crm/invoke-crm-api`. Create an order with a primary contact email → assert `invokeOrganizationApi` called with `{ source:'order', email }`, the returned `matchedOrgId` written back to `Order.matchedOrgId` (assert the UpdateCommand), and `emitTimelineEventToCrm` called with that same `matchedOrgId`. Add a no-email case → no org-api invoke, emit with `matchedOrgId` null. Assert org-api invoke failure is non-fatal (order still created + returned).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import `invokeOrganizationApi`, `emitTimelineEventToCrm`, `buildOrderCreatedEmitArgs` (`.js` suffix per resolver convention). After the order is created, if a primary contact email exists:
```typescript
let matchedOrgId: string | null = null;
if (primaryContactEmail) {
  try {
    const orgResult = await invokeOrganizationApi({ action: 'upsertFromSubmission', source: 'order', email: primaryContactEmail, institution, submittedAt: createdAt, scoreDelta: ORDER_SCORE_DELTA });
    matchedOrgId = orgResult?.matchedOrgId ?? null;
    if (matchedOrgId) {
      await docClient.send(new UpdateCommand({ TableName: TABLE_NAME(), Key: { PK: `ORDER#${orderId}`, SK: 'META' }, UpdateExpression: 'SET matchedOrgId = :m', ExpressionAttributeValues: { ':m': matchedOrgId } }));
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'order.org_upsert_failed', orderId, error: err instanceof Error ? err.message : String(err) }));
  }
}
await emitTimelineEventToCrm(buildOrderCreatedEmitArgs({ orderId, createdAt, productModel }, { matchedOrgId, email: primaryContactEmail }));
```
(Reuse the order's SK convention — confirm it's `META` like other order rows. Pick a sensible `ORDER_SCORE_DELTA` consistent with the existing order source scoring, or reuse the constant the submission flows use.)
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/order-api` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(order-api): manual createOrder org upsert + order_created emit (Plan 2A)"`

### Task 9: `order-api/updateOrderStatus` (site #5)

**Files:** Modify `amplify/functions/order-api/resolvers/updateOrderStatus.ts` (after response built, ~`:178`); Test `order-api/handler.test.ts`.

- [ ] **Step 1: Failing test** — change an order's status; assert `emitTimelineEventToCrm` called with `kind:'order_stage_changed'`, `idInput.orderLogId` = the `olog-` id stamped on the new status-log entry, `idInput.toStatus` = the new status, `occurredAt` = the log timestamp, `resolveInput.matchedOrgId` = the order's `matchedOrgId`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import helper + `buildOrderStageChangedEmitArgs`. The resolver already builds the status-log item with a stable `id` (P1) and has the order in scope. After the response is built:
```typescript
await emitTimelineEventToCrm(buildOrderStageChangedEmitArgs(
  { orderId, matchedOrgId: order.matchedOrgId },
  { id: logId, toStatus: newStatus, fromStatus: currentStatus, timestamp: now },
  primaryContactEmail, // only if already loaded for feedback scheduling; else omit
));
```
(Use the `logId`/`now` already created for the `LOG#` entry; pass the contact email only if the resolver already loaded it.)
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/order-api` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(order-api): emit order_stage_changed on status transition (Plan 2A)"`

### Task 10: `order-api/confirmDocumentUpload` (site #6 — QUOTATION only)

**Files:** Modify `amplify/functions/order-api/resolvers/confirmDocumentUpload.ts` (after response built, ~`:104`); Test `order-api/handler.test.ts`.

- [ ] **Step 1: Failing test** — confirm a `QUOTATION` document → assert `emitTimelineEventToCrm` called with `{ source:'quote', kind:'quote_sent', sourceEntityId: <docId> }`, `occurredAt` = the doc upload time, `matchedOrgId` from the order. Confirm a non-QUOTATION docType → `emitTimelineEventToCrm` NOT called.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import helper + `buildQuoteSentEmitArgs`. After the response is built, guard on docType:
```typescript
if (docType === 'QUOTATION') {
  await emitTimelineEventToCrm(buildQuoteSentEmitArgs(
    { orderId, matchedOrgId: order.matchedOrgId },
    { id: docId, fileName, uploadedAt: now },
    primaryContactEmail, // only if already loaded
  ));
}
```
(Use the document's actual id/fileName/timestamp variables in scope; load the order's `matchedOrgId` if not already present — a single `GetCommand` on `ORDER#<orderId>/META` is acceptable here since a quote event is low-frequency.)
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/order-api` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(order-api): emit quote_sent on QUOTATION upload (Plan 2A)"`

### Task 11: `logistics-api/advanceLogisticsStage` (site #7)

**Files:** Modify `amplify/functions/logistics-api/resolvers/advanceLogisticsStage.ts` (after response built, ~`:65`); Test `logistics-api/resolvers/advanceLogisticsStage.test.ts`.

- [ ] **Step 1: Failing test** — advance a case that has a `relatedOrderId` → assert `emitTimelineEventToCrm` called with `kind:'logistics_milestone'`, `idInput.milestoneId` = the new `mlog-` entry id, `idInput.stage` = the target stage, `isInternalOnly` = the milestone entry's `internalOnly`, and `resolveInput.matchedOrgId` = the related order's `matchedOrgId`. Add a case with no `relatedOrderId` → `matchedOrgId` undefined. Add an `internalOnly:true` case → `isInternalOnly:true`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import helper + `buildLogisticsMilestoneEmitArgs`. After the response is built: resolve the related order's org (if `relatedOrderId`, `GetCommand` `ORDER#<relatedOrderId>/META` → `matchedOrgId`, else null), then:
```typescript
await emitTimelineEventToCrm(buildLogisticsMilestoneEmitArgs(
  { caseId, caseType },
  { id: milestoneId, toStage: stage, fromStage: current.currentStage, timestamp: now, internalOnly, action: 'STAGE_ADVANCED' },
  relatedOrgId,
));
```
(Use the `milestoneId`/`now`/`internalOnly` from the milestone entry the resolver appended.)
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/logistics-api` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(logistics-api): emit logistics_milestone on stage advance (Plan 2A)"`

### Task 12: `logistics-api/createLogisticsCase` (site #8)

**Files:** Modify `amplify/functions/logistics-api/resolvers/createLogisticsCase.ts` (after the case `PutCommand`, ~`:96`); Test `logistics-api/resolvers/createLogisticsCase.test.ts`.

- [ ] **Step 1: Failing test** — create a case (with + without `relatedOrderId`) → assert `emitTimelineEventToCrm` called with `kind:'logistics_milestone'`, `idInput.milestoneId` = the `CASE_CREATED` entry id, `stage:'DRAFT'`, summary mentions the case type, `isInternalOnly` from the initial entry, `matchedOrgId` from the related order (or undefined).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — import helper + `buildLogisticsMilestoneEmitArgs`. After the case commit: resolve related-order org as in Task 11, then:
```typescript
await emitTimelineEventToCrm(buildLogisticsMilestoneEmitArgs(
  { caseId, caseType },
  { id: initialMilestone.id, toStage: 'DRAFT', fromStage: null, timestamp: now, internalOnly: initialMilestone.internalOnly, action: 'CASE_CREATED' },
  relatedOrgId,
));
```
(Use the `id`/`internalOnly` of the `CASE_CREATED` `milestoneLog[0]` entry the resolver built.)
- [ ] **Step 4:** test PASS; `npx vitest run amplify/functions/logistics-api` green.
- [ ] **Step 5: Commit** — `git commit -m "feat(logistics-api): emit logistics_milestone on case create (Plan 2A)"`

---

## Task 13: Green-bar + checkpoint

- [ ] **Step 1: Run all affected suites**

Run: `npx vitest run amplify/lib/crm amplify/functions/crm-api amplify/functions/order-api amplify/functions/logistics-api amplify/functions/submit-rfq amplify/functions/submit-lead amplify/functions/convert-rfq-to-order`
Expected: PASS — all new + existing tests green.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Lint the new + touched files**

Run: `npx eslint amplify/lib/crm amplify/functions/crm-api amplify/functions/submit-rfq amplify/functions/submit-lead amplify/functions/convert-rfq-to-order amplify/functions/order-api amplify/functions/logistics-api`
Expected: exit 0 (pre-existing warnings elsewhere are acceptable; no new errors in the Plan 2A touched paths). If repo lint is noisy because of unrelated pre-existing issues, record the exact output and rely on the targeted vitest suites + TypeScript check as the blocking gate.

- [ ] **Step 4: Checkpoint commit (if anything remains)**

```bash
git status --short
git add \
  amplify/lib/crm \
  amplify/functions/crm-api/handler.ts amplify/functions/crm-api/handler.test.ts \
  amplify/backend.ts \
  amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts \
  amplify/functions/submit-lead/handler.ts amplify/functions/submit-lead/handler.test.ts \
  amplify/functions/convert-rfq-to-order/handler.ts amplify/functions/convert-rfq-to-order/handler.test.ts \
  amplify/functions/order-api \
  amplify/functions/logistics-api
git commit -m "chore(crm): Plan 2A channel wiring complete — 8 emit sites live" || echo "nothing to commit"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- §2 invoke contract (async Event default, sync-throws, never-throw async, `CRM_API_FUNCTION_NAME`) → Task 1. ✓
- §2 `crm-api` direct-invoke dispatch (action branch, no GraphQL surface) → Task 2. ✓
- §2 backend grants (5 source Lambdas + `orderApi→organizationApi`) → Task 4. ✓
- §3 all 8 emit sites with correct source/kind/idInput/resolveInput → Tasks 5–12. ✓
- §3 `finalMatchedOrgId` (#3) → Task 7; manual `createOrder` org upsert + backfill (#4) → Task 8; `isInternalOnly` passthrough (#7/#8) → Tasks 11/12; QUOTATION gate (#6) → Task 10; `order_stage_changed` keyed by `olog-` id (#5) → Task 9. ✓
- §3 #5/#6 email fallback "only if already loaded" → Tasks 9/10 notes. ✓
- §4 emit-after-commit, never-block, stable `occurredAt`, idempotency → builders use source timestamps (Task 3); call sites are post-commit (Tasks 5–12); helper never throws async (Task 1). ✓
- §5 testing (pure builders, invoke helper, dispatch, per-channel integration, regression) → Tasks 1–13. ✓

**Deferred (per spec, not in this plan):** `rfq_status_changed`, analytics `site_visit_session` (2C), manual notes (Plan 3), the reconciliation sweep (2C), backfill (2B).

**Placeholder scan:** none — every step has runnable code/commands. Where a site's exact in-scope variable names must be confirmed by reading the file, the step names the precise values to pass and the builder signature is fully specified in Task 3.

**Type consistency:** `EmitArgs` is single-sourced from `crm-api/lib/emitTimelineEvent` and re-exported via `amplify/lib/crm/types`; builders (Task 3) return it; `emitTimelineEventToCrm` (Task 1) consumes it; `idInput` shapes match P1's `TimelineIdInput` (`order_stage_changed` carries `orderLogId`+`toStatus`+`occurredAt`; `logistics_milestone` carries `milestoneId`+`stage`+`occurredAt`; `quote_sent` carries `quoteDocId`).
