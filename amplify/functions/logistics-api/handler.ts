import { createLogisticsCase } from './resolvers/createLogisticsCase.js';
import { getLogisticsCase } from './resolvers/getLogisticsCase.js';
import { listLogisticsCases } from './resolvers/listLogisticsCases.js';
import { advanceLogisticsStage } from './resolvers/advanceLogisticsStage.js';
import { updateLogisticsCase } from './resolvers/updateLogisticsCase.js';
import { addLeg, updateLeg, removeLeg } from './resolvers/legMutations.js';
import { logisticsStats } from './resolvers/logisticsStats.js';

const resolvers: Record<string, (event: any) => Promise<any>> = {
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

export const handler = async (event: any) => {
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

  return resolver(normalizedEvent);
};
