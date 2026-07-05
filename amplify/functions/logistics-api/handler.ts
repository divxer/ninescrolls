import { createLogisticsCase } from './resolvers/createLogisticsCase.js';
import { getLogisticsCase } from './resolvers/getLogisticsCase.js';
import { listLogisticsCases } from './resolvers/listLogisticsCases.js';
import { advanceLogisticsStage } from './resolvers/advanceLogisticsStage.js';
import { updateLogisticsCase } from './resolvers/updateLogisticsCase.js';
import { addLeg, updateLeg, removeLeg } from './resolvers/legMutations.js';
import { logisticsStats } from './resolvers/logisticsStats.js';

// AppSync invocation shape: `info` is present on direct resolver events;
// Amplify Gen 2 a.handler.function() sends fieldName/typeName at the top level.
interface LogisticsApiEvent {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  typeName?: string;
  arguments?: unknown;
  [key: string]: unknown;
}

// Each resolver declares its own concrete event type; `never` keeps the map
// assignable from all of them (function params are contravariant).
const resolvers: Record<string, (event: never) => Promise<unknown>> = {
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

export const handler = async (event: LogisticsApiEvent) => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName) {
    console.error('logistics-api: full event:', JSON.stringify(event));
    throw new Error(`Cannot determine fieldName. Event keys: ${Object.keys(event).join(', ')}`);
  }

  const resolver = resolvers[fieldName];
  if (!resolver) throw new Error(`No resolver for field: ${fieldName}`);

  const normalizedEvent = event.info
    ? event
    : { ...event, info: { fieldName, parentTypeName: event.typeName }, arguments: event.arguments };

  return resolver(normalizedEvent as never);
};
