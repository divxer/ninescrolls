import { defineFunction } from '@aws-amplify/backend';

export const logisticsApi = defineFunction({
  name: 'logistics-api',
  // Pinned to the data stack for the same reason as order-api: this Lambda
  // is both an AppSync GraphQL data resolver (amplify/data/resource.ts:
  // a.handler.function(logisticsApi)) AND a data-stack table consumer
  // (intelligenceTable grant). Left in the generic function stack it forms
  // the same data<->function cycle that broke deploys after 2C-analytics
  // added crm-api's grant. Moving it into the data stack collapses both
  // edges into intra-stack refs.
  resourceGroupName: 'data',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
