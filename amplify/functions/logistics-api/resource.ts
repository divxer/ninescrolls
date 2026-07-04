import { defineFunction } from '@aws-amplify/backend';

export const logisticsApi = defineFunction({
  name: 'logistics-api',
  // Pinned to the data stack for the same reason as order-api: this Lambda
  // is an AppSync GraphQL data resolver (amplify/data/resource.ts:
  // a.handler.function(logisticsApi)). Left in the generic function stack
  // that resolver reference is a data->function edge which — together with
  // the crm-api grants PR #230 added — closed a CloudFormation cycle across
  // the api, data, and function stacks. Moving logistics-api into the data
  // stack collapses the resolver edge into an intra-data reference. Its
  // intelligenceTable grant lives in feedback-system-stack, which is a
  // one-way data -> feedback-system-stack ref (no cycle).
  resourceGroupName: 'data',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
