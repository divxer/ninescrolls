import { emitTimelineEvent } from './lib/emitTimelineEvent';
import { reconcileSweep } from './lib/sweep/reconcileSweep';
import { rollupAnalyticsSessions } from './lib/analytics/rollupAnalyticsSessions';
import { reResolveVisitorSessions } from './lib/analytics/reResolveVisitorSessions';
import { backfillVisitorBridge } from './lib/analytics/backfillVisitorBridge';
import { timelineByOrg } from './lib/read/timelineByOrg';
import { toOrganizationTimelineItem } from './lib/read/organizationTimelineItem';

type AppSyncEvent = {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; claims?: { email?: string } };
};

// Direct Lambda invoke payloads (from amplify/lib/crm/invoke-crm-api) carry an `action`.
type DirectInvokeEvent = { action: string; args?: unknown; mode?: 'hot' | 'cold'; cursor?: Record<string, unknown>; limit?: number; maxSessions?: number; visitorId?: string; startSessionSk?: string };

const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {
  timelineByOrg: async (e) => {
    const a = (e.arguments ?? {}) as { orgId?: string; limit?: number; nextToken?: string; includeInternalOnly?: boolean };
    const { items, nextToken } = await timelineByOrg({
      orgId: a.orgId ?? '', limit: a.limit, nextToken: a.nextToken, includeInternalOnly: a.includeInternalOnly ?? false,
    });
    return { items: items.map(toOrganizationTimelineItem), nextToken: nextToken ?? null };
  },
};

const actions: Record<string, (e: DirectInvokeEvent) => Promise<unknown>> = {
  emitTimelineEvent: async (e) => { await emitTimelineEvent(e.args as Parameters<typeof emitTimelineEvent>[0]); },
  reconcileSweep: async (e) => reconcileSweep({ mode: e.mode ?? 'hot', limit: e.limit, cursor: e.cursor }),
  rollupAnalyticsSessions: async (e) => rollupAnalyticsSessions({ limit: e.limit, cursor: e.cursor, maxSessions: e.maxSessions }),
  reResolveVisitorSessions: async (e) => reResolveVisitorSessions({ visitorId: e.visitorId ?? '', startSessionSk: e.startSessionSk, maxSessions: e.maxSessions }),
  backfillVisitorBridge: async (e) => backfillVisitorBridge({ cursor: e.cursor, limit: e.limit }),
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
