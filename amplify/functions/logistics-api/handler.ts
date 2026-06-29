import { createLogisticsCase } from './resolvers/createLogisticsCase.js';
import { getLogisticsCase } from './resolvers/getLogisticsCase.js';
import { listLogisticsCases } from './resolvers/listLogisticsCases.js';
import { advanceLogisticsStage } from './resolvers/advanceLogisticsStage.js';
import { updateLogisticsCase } from './resolvers/updateLogisticsCase.js';
import { addLeg, updateLeg, removeLeg } from './resolvers/legMutations.js';
import { logisticsStats } from './resolvers/logisticsStats.js';
import type { AppSyncEvent } from './lib/types.js';

const resolvers: Record<string, (event: AppSyncEvent) => Promise<unknown>> = {
  listLogisticsCases,
  getLogisticsCase,
  logisticsStats,
  createLogisticsCase,
  updateLogisticsCase,
  advanceLogisticsStage,
  addLeg,
  updateLeg,
  removeLeg,
};

export const handler = async (event: Record<string, unknown>) => {
  const evt = event as {
    info?: { fieldName?: string };
    fieldName?: string;
    typeName?: string;
    arguments?: unknown;
  };
  const fieldName = evt.info?.fieldName ?? evt.fieldName;
  if (!fieldName) {
    console.error('logistics-api: full event:', JSON.stringify(event));
    throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
  }

  const resolver = resolvers[fieldName];
  if (!resolver) throw new Error(`No resolver for field: ${fieldName}`);

  const normalizedEvent = evt.info
    ? event
    : { ...event, info: { fieldName, parentTypeName: evt.typeName }, arguments: evt.arguments };

  return resolver(normalizedEvent as unknown as AppSyncEvent);
};
