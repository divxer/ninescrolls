import { defineFunction } from '@aws-amplify/backend';

export const crmApi = defineFunction({
  name: 'crm-api',
  // Pinned to the data stack because this Lambda is a data-stack table
  // consumer on two axes — analyticsEventTable.grantReadData(2C-analytics,
  // PR #230) and intelligenceTable.grantReadWriteData(P1 foundation, PR
  // #223) — both of which create a function->data edge from the generic
  // function stack, and both of which are named as the tipping-point cycle
  // by PR #232's write-up. crm-api is not itself an AppSync resolver, but
  // order-api / logistics-api (both now in the data stack) invoke it by
  // ARN; keeping crm-api in the same stack keeps that hop intra-stack too.
  resourceGroupName: 'data',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 120,
  memoryMB: 512,
});
