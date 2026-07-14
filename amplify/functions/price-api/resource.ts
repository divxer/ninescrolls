import { defineFunction } from '@aws-amplify/backend';

export const priceApi = defineFunction({
  name: 'price-api',
  // Pinned to the data stack for the same reason as order-api/logistics-api:
  // this Lambda is an AppSync data resolver; leaving it in the generic function
  // stack creates a data->function edge that has produced CloudFormation cycles
  // before (see logistics-api/resource.ts).
  resourceGroupName: 'data',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
