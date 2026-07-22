import { emitTimelineEvent } from './lib/emitTimelineEvent';
import { reconcileSweep } from './lib/sweep/reconcileSweep';
import { rollupAnalyticsSessions } from './lib/analytics/rollupAnalyticsSessions';
import { reResolveVisitorSessions } from './lib/analytics/reResolveVisitorSessions';
import { backfillVisitorBridge } from './lib/analytics/backfillVisitorBridge';
import { timelineByOrg } from './lib/read/timelineByOrg';
import { toOrganizationTimelineItem } from './lib/read/organizationTimelineItem';
import { needsLinkingQueue } from './lib/read/needsLinkingQueue';
import { linkStructuredUnit, queryUnitEvents } from './lib/link/linkStructuredUnit';
import { linkVisitor } from './lib/link/linkVisitor';
import { reconcileRepair } from './lib/repair/reconcileRepair';
import { crmHealth } from './lib/repair/crmHealth';
import { requireAdmin } from './lib/authz';

type AppSyncEvent = {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; groups?: string[]; claims?: { email?: string; 'cognito:groups'?: string[] | string } };
};

// HARD invariant: operator is ALWAYS derived server-side from the caller's identity, never from
// client-supplied arguments — a client cannot spoof who performed a manual-link/audit action.
const operatorOf = (e: AppSyncEvent): string => e.identity?.claims?.email ?? e.identity?.sub ?? 'unknown';

// Direct Lambda invoke payloads (from amplify/lib/crm/invoke-crm-api) carry an `action`.
type DirectInvokeEvent = { action: string; args?: unknown; mode?: 'hot' | 'cold'; cursor?: Record<string, unknown>; limit?: number; maxSessions?: number; visitorId?: string; startSessionSk?: string };

// TRANSITIONAL (removed in Task 13): serve the deployed legacy arg shape by deriving the
// representative SERVER-SIDE. The derived event still passes linkStructuredUnit's full
// validation (strong read, unresolved, eligibility, ALLOWED source), so this is no weaker
// than the deployed 3B contract it temporarily preserves — and it is admin-gated (Task 6).
async function deriveRepresentativeEventId(sourceType: string, sourceEntityId: string): Promise<string> {
  const ALLOWED = new Set(['rfq', 'lead', 'order', 'quote', 'logistics']);   // legacy shapes only — gmail NEVER via legacy args
  if (!ALLOWED.has(sourceType) || !sourceEntityId) throw new Error('invalid legacy link args');
  const events = await queryUnitEvents(`unresolved-${sourceType}-${sourceEntityId}`);
  if (events.length === 0) throw new Error('no unresolved events for legacy link args');
  return events[0].id;
}

const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {
  timelineByOrg: async (e) => {
    requireAdmin(e);
    const a = (e.arguments ?? {}) as { orgId?: string; limit?: number; nextToken?: string; includeInternalOnly?: boolean };
    const { items, nextToken } = await timelineByOrg({
      orgId: a.orgId ?? '', limit: a.limit, nextToken: a.nextToken, includeInternalOnly: a.includeInternalOnly ?? false,
    });
    return { items: items.map(toOrganizationTimelineItem), nextToken: nextToken ?? null };
  },
  needsLinkingQueue: async (e) => {
    requireAdmin(e);
    const a = (e.arguments ?? {}) as { limit?: number; nextToken?: string };
    return needsLinkingQueue({ limit: a.limit, nextToken: a.nextToken });
  },
  linkStructuredUnit: async (e) => {
    requireAdmin(e);
    const a = (e.arguments ?? {}) as { representativeEventId?: string; sourceType?: string; sourceEntityId?: string; targetOrgId?: string };
    const representativeEventId = a.representativeEventId
      ?? await deriveRepresentativeEventId(a.sourceType ?? '', a.sourceEntityId ?? '');
    return linkStructuredUnit({ representativeEventId, targetOrgId: a.targetOrgId ?? '', operator: operatorOf(e) });
  },
  linkVisitor: async (e) => {
    requireAdmin(e);
    const a = (e.arguments ?? {}) as { visitorId?: string; targetOrgId?: string };
    return linkVisitor({ visitorId: a.visitorId ?? '', targetOrgId: a.targetOrgId ?? '', operator: operatorOf(e) });
  },
  crmHealth: async (e) => {
    requireAdmin(e);
    return crmHealth();
  },
  runCrmRepair: async (e) => {
    requireAdmin(e);
    const a = (e.arguments ?? {}) as { limit?: number };
    return reconcileRepair({ limit: a.limit });
  },
};

const actions: Record<string, (e: DirectInvokeEvent) => Promise<unknown>> = {
  emitTimelineEvent: async (e) => { await emitTimelineEvent(e.args as Parameters<typeof emitTimelineEvent>[0]); },
  reconcileSweep: async (e) => reconcileSweep({ mode: e.mode ?? 'hot', limit: e.limit, cursor: e.cursor }),
  rollupAnalyticsSessions: async (e) => rollupAnalyticsSessions({ limit: e.limit, cursor: e.cursor, maxSessions: e.maxSessions }),
  reResolveVisitorSessions: async (e) => reResolveVisitorSessions({ visitorId: e.visitorId ?? '', startSessionSk: e.startSessionSk, maxSessions: e.maxSessions }),
  backfillVisitorBridge: async (e) => backfillVisitorBridge({ cursor: e.cursor, limit: e.limit }),
  reconcileRepair: async (e) => reconcileRepair({ limit: e.limit }),
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
