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
