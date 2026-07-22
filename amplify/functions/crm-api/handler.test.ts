import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ emitTimelineEvent: vi.fn() }));
vi.mock('./lib/emitTimelineEvent', () => ({
  emitTimelineEvent: (a: unknown) => mocks.emitTimelineEvent(a),
}));

const mockReconcile = vi.hoisted(() => ({ reconcileSweep: vi.fn() }));
vi.mock('./lib/sweep/reconcileSweep', () => ({ reconcileSweep: (a: unknown) => mockReconcile.reconcileSweep(a) }));

const mockAnalytics = vi.hoisted(() => ({ rollup: vi.fn(), retro: vi.fn(), backfill: vi.fn() }));
vi.mock('./lib/analytics/rollupAnalyticsSessions', () => ({ rollupAnalyticsSessions: (a: unknown) => mockAnalytics.rollup(a) }));
vi.mock('./lib/analytics/reResolveVisitorSessions', () => ({ reResolveVisitorSessions: (a: unknown) => mockAnalytics.retro(a) }));
vi.mock('./lib/analytics/backfillVisitorBridge', () => ({ backfillVisitorBridge: (a: unknown) => mockAnalytics.backfill(a) }));

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

describe('crm-api reconcileSweep action', () => {
  it('routes {action:reconcileSweep, mode, limit} to reconcileSweep with the right args', async () => {
    mockReconcile.reconcileSweep.mockResolvedValueOnce({ mode: 'hot', summary: {} });
    const { handler } = await import('./handler');
    await handler({ action: 'reconcileSweep', mode: 'hot', limit: 50 } as never);
    expect(mockReconcile.reconcileSweep).toHaveBeenCalledWith({ mode: 'hot', limit: 50, cursor: undefined });
  });
});

describe('crm-api 2C-analytics actions', () => {
  it('routes rollupAnalyticsSessions with limit/cursor', async () => {
    mockAnalytics.rollup.mockResolvedValueOnce({ summary: {} });
    await handler({ action: 'rollupAnalyticsSessions', limit: 50 } as never);
    expect(mockAnalytics.rollup).toHaveBeenCalledWith({ limit: 50, cursor: undefined, maxSessions: undefined });
  });
  it('routes maxSessions to bounded analytics actions for manual/debug invokes', async () => {
    mockAnalytics.rollup.mockResolvedValueOnce({ summary: {} });
    await handler({ action: 'rollupAnalyticsSessions', maxSessions: 3 } as never);
    expect(mockAnalytics.rollup).toHaveBeenCalledWith({ limit: undefined, cursor: undefined, maxSessions: 3 });
    mockAnalytics.retro.mockResolvedValueOnce({ summary: {} });
    await handler({ action: 'reResolveVisitorSessions', visitorId: 'v-1', maxSessions: 4 } as never);
    expect(mockAnalytics.retro).toHaveBeenCalledWith({ visitorId: 'v-1', startSessionSk: undefined, maxSessions: 4 });
  });
  it('routes reResolveVisitorSessions with visitorId/startSessionSk', async () => {
    mockAnalytics.retro.mockResolvedValueOnce({ summary: {} });
    await handler({ action: 'reResolveVisitorSessions', visitorId: 'v-1' } as never);
    expect(mockAnalytics.retro).toHaveBeenCalledWith({ visitorId: 'v-1', startSessionSk: undefined, maxSessions: undefined });
  });
  it('routes backfillVisitorBridge with cursor/limit', async () => {
    mockAnalytics.backfill.mockResolvedValueOnce({ processed: 0, hasMore: false });
    await handler({ action: 'backfillVisitorBridge' } as never);
    expect(mockAnalytics.backfill).toHaveBeenCalledWith({ cursor: undefined, limit: undefined });
  });
});

const timelineByOrgMock = vi.fn();
vi.mock('./lib/read/timelineByOrg', () => ({ timelineByOrg: (a: unknown) => timelineByOrgMock(a) }));

describe('handler — timelineByOrg AppSync resolver', () => {
  beforeEach(() => timelineByOrgMock.mockReset());

  it('routes an AppSync fieldName to the resolver, maps items, returns connection', async () => {
    timelineByOrgMock.mockResolvedValueOnce({
      items: [{ id: 'tev-1', occurredAt: '2026-03-01T00:00:00Z', source: 'order', kind: 'order_created', summary: 'Order created — X', resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1, isInternalOnly: false, sourceEntityType: 'order', sourceEntityId: 'ord-1', payload: { productModel: 'X' } }],
      nextToken: 'TOK',
    });
    const res = await handler({ info: { fieldName: 'timelineByOrg' }, arguments: { orgId: 'acme.com', limit: 10, includeInternalOnly: true }, identity: { claims: { 'cognito:groups': ['admin'] } } } as never) as { items: unknown[]; nextToken?: string };
    expect(timelineByOrgMock).toHaveBeenCalledWith({ orgId: 'acme.com', limit: 10, nextToken: undefined, includeInternalOnly: true });
    expect(res.nextToken).toBe('TOK');
    expect(res.items[0]).toMatchObject({ id: 'tev-1', sourceFilterGroup: 'order', tone: 'confirmed', primaryLabel: 'Order created — X', productModel: 'X' });
  });

  it('still dispatches a direct-invoke action (does not break the action path)', async () => {
    await expect(handler({ action: 'definitely_not_a_real_action' } as never)).rejects.toThrow(/unknown action/);
  });

  it('unknown fieldName throws via the resolver path', async () => {
    await expect(handler({ info: { fieldName: 'nope' } } as never)).rejects.toThrow(/unknown fieldName/);
  });
});

const linkStructuredMock = vi.fn(); const linkVisitorMock = vi.fn(); const queueMock = vi.fn();
const queryUnitEventsMock = vi.fn();
vi.mock('./lib/link/linkStructuredUnit', () => ({ linkStructuredUnit: (a: unknown) => linkStructuredMock(a), queryUnitEvents: (k: string) => queryUnitEventsMock(k) }));
vi.mock('./lib/link/linkVisitor', () => ({ linkVisitor: (a: unknown) => linkVisitorMock(a) }));
vi.mock('./lib/read/needsLinkingQueue', () => ({ needsLinkingQueue: (a: unknown) => queueMock(a) }));

describe('handler — 3B resolvers', () => {
  beforeEach(() => { linkStructuredMock.mockReset(); linkVisitorMock.mockReset(); queueMock.mockReset(); queryUnitEventsMock.mockReset(); });

  it('derives operator server-side from identity, ignores any client operator arg', async () => {
    linkStructuredMock.mockResolvedValueOnce({ moved: 1 });
    await handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: { representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'ATTACKER' }, identity: { claims: { email: 'admin@x.com', 'cognito:groups': ['admin'] } } } as never);
    expect(linkStructuredMock).toHaveBeenCalledWith({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'admin@x.com' });
  });

  // Task 10 Step 4: TRANSITIONAL ADAPTER — the deployed legacy arg shape keeps working until the
  // Task-13 schema migration, by deriving the representative SERVER-SIDE.
  it('new-shape args (representativeEventId) dispatch directly — no unit read', async () => {
    linkStructuredMock.mockResolvedValueOnce({ moved: 1 });
    await handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: { representativeEventId: 'tev-1', targetOrgId: 'acme.com' }, identity: { claims: { email: 'admin@x.com', 'cognito:groups': ['admin'] } } } as never);
    expect(queryUnitEventsMock).not.toHaveBeenCalled();
    expect(linkStructuredMock).toHaveBeenCalledWith({ representativeEventId: 'tev-1', targetOrgId: 'acme.com', operator: 'admin@x.com' });
  });

  it('legacy-shape args derive the representative server-side then dispatch', async () => {
    queryUnitEventsMock.mockResolvedValueOnce([{ id: 'tev-9' }, { id: 'tev-10' }]);
    linkStructuredMock.mockResolvedValueOnce({ moved: 2 });
    await handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: { sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com' }, identity: { claims: { email: 'admin@x.com', 'cognito:groups': ['admin'] } } } as never);
    expect(queryUnitEventsMock).toHaveBeenCalledWith('unresolved-rfq-r1');
    expect(linkStructuredMock).toHaveBeenCalledWith({ representativeEventId: 'tev-9', targetOrgId: 'acme.com', operator: 'admin@x.com' });
  });

  it('legacy shape with sourceType gmail throws (gmail units are never nameable via legacy args)', async () => {
    await expect(handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: { sourceType: 'gmail', sourceEntityId: 'mid-1', targetOrgId: 'acme.com' }, identity: { claims: { email: 'admin@x.com', 'cognito:groups': ['admin'] } } } as never))
      .rejects.toThrow(/invalid legacy link args/i);
    expect(queryUnitEventsMock).not.toHaveBeenCalled();
    expect(linkStructuredMock).not.toHaveBeenCalled();
  });

  it('legacy shape over an empty unit throws (nothing to derive)', async () => {
    queryUnitEventsMock.mockResolvedValueOnce([]);
    await expect(handler({ info: { fieldName: 'linkStructuredUnit' }, arguments: { sourceType: 'rfq', sourceEntityId: 'r1', targetOrgId: 'acme.com' }, identity: { claims: { email: 'admin@x.com', 'cognito:groups': ['admin'] } } } as never))
      .rejects.toThrow(/no unresolved events/i);
    expect(linkStructuredMock).not.toHaveBeenCalled();
  });

  it('falls back to identity.sub then unknown', async () => {
    linkVisitorMock.mockResolvedValueOnce({ sessionsResolved: 2 });
    await handler({ info: { fieldName: 'linkVisitor' }, arguments: { visitorId: 'v1', targetOrgId: 'acme.com' }, identity: { sub: 'sub-1', groups: ['admin'] } } as never);
    expect(linkVisitorMock).toHaveBeenCalledWith({ visitorId: 'v1', targetOrgId: 'acme.com', operator: 'sub-1' });
  });

  it('routes needsLinkingQueue', async () => {
    queueMock.mockResolvedValueOnce({ items: [], nextToken: null });
    const r = await handler({ info: { fieldName: 'needsLinkingQueue' }, arguments: { limit: 25 }, identity: { claims: { 'cognito:groups': ['admin'] } } } as never);
    expect(queueMock).toHaveBeenCalledWith({ limit: 25, nextToken: undefined });
    expect(r).toEqual({ items: [], nextToken: null });
  });
});

const reconcileRepair = vi.fn(); const crmHealthFn = vi.fn();
vi.mock('./lib/repair/reconcileRepair', () => ({ reconcileRepair: (...a: unknown[]) => reconcileRepair(...a) }));
vi.mock('./lib/repair/crmHealth', () => ({ crmHealth: (...a: unknown[]) => crmHealthFn(...a) }));

describe('handler — 3C repair/health', () => {
  beforeEach(() => {
    reconcileRepair.mockReset(); crmHealthFn.mockReset();
    reconcileRepair.mockResolvedValue({ repaired: 0 });
    crmHealthFn.mockResolvedValue({ repairPending: { count: 0 } });
  });

  it('direct action reconcileRepair dispatches with limit', async () => {
    await handler({ action: 'reconcileRepair', limit: 50 } as never);
    expect(reconcileRepair).toHaveBeenCalledWith({ limit: 50 });
  });
  it('runCrmRepair mutation dispatches to reconcileRepair', async () => {
    await handler({ info: { fieldName: 'runCrmRepair' }, arguments: { limit: 10 }, identity: { claims: { email: 'a@x', 'cognito:groups': ['admin'] } } } as never);
    expect(reconcileRepair).toHaveBeenCalledWith({ limit: 10 });
  });
  it('crmHealth query dispatches to crmHealth()', async () => {
    await handler({ info: { fieldName: 'crmHealth' }, arguments: {}, identity: { claims: { 'cognito:groups': ['admin'] } } } as never);
    expect(crmHealthFn).toHaveBeenCalled();
  });
});

// Task 6 (spec R6/blocker-1): admin-group guard must run BEFORE any of these six resolvers touch
// their lib fn. NOTE for Task 13: acknowledgeMergeRecon will become the seventh guarded entry.
function adminArgsFor(fieldName: string): Record<string, unknown> {
  switch (fieldName) {
    case 'timelineByOrg': return { orgId: 'acme.com' };
    case 'needsLinkingQueue': return {};
    case 'linkStructuredUnit': return { representativeEventId: 'tev-1', targetOrgId: 'acme.com' };
    case 'linkVisitor': return { visitorId: 'v1', targetOrgId: 'acme.com' };
    case 'crmHealth': return {};
    case 'runCrmRepair': return { limit: 10 };
    default: return {};
  }
}

const GUARDED: Array<[string, () => ReturnType<typeof vi.fn>]> = [
  ['timelineByOrg', () => timelineByOrgMock], ['needsLinkingQueue', () => queueMock],
  ['linkStructuredUnit', () => linkStructuredMock], ['linkVisitor', () => linkVisitorMock],
  ['crmHealth', () => crmHealthFn], ['runCrmRepair', () => reconcileRepair],
];

describe.each(GUARDED)('authz on %s', (fieldName, target) => {
  beforeEach(() => {
    timelineByOrgMock.mockReset();
    queueMock.mockReset();
    linkStructuredMock.mockReset();
    linkVisitorMock.mockReset();
    crmHealthFn.mockReset();
    reconcileRepair.mockReset();
  });

  it('missing groups → rejected, lib fn NOT called', async () => {
    await expect(handler({ info: { fieldName }, arguments: {}, identity: { claims: {} } } as never)).rejects.toThrow(/admin/i);
    expect(target()).not.toHaveBeenCalled();
  });
  it('wrong group → rejected, lib fn NOT called', async () => {
    await expect(handler({ info: { fieldName }, arguments: {}, identity: { claims: { 'cognito:groups': ['staff'] } } } as never)).rejects.toThrow(/admin/i);
    expect(target()).not.toHaveBeenCalled();
  });
  it('admin group → passes the guard (lib fn called)', async () => {
    await handler({ info: { fieldName }, arguments: adminArgsFor(fieldName), identity: { claims: { 'cognito:groups': ['admin'] } } } as never).catch(() => {});
    expect(target()).toHaveBeenCalled();
  });
});
