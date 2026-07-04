import { defineFunction } from '@aws-amplify/backend';

export const crmApi = defineFunction({
  name: 'crm-api',
  // Pinned to the data stack alongside order-api / logistics-api. crm-api
  // grants that PR #230 added — analyticsEventTable.grantReadData plus
  // intelligenceTable.grantReadWriteData (P1 foundation, PR #223) — were
  // named by PR #232's write-up as the edges that tipped the CFN graph
  // into a hard cycle. Note the stack topology: analyticsEventTable lives
  // in the data stack, while intelligenceTable lives in feedback-system-
  // stack. Moving crm-api into data therefore (a) collapses the
  // analyticsEventTable grant into an intra-data reference and
  // (b) converts the intelligenceTable grant into a clean one-way
  // data -> feedback-system-stack edge (nothing there refers back).
  // crm-api is not itself an AppSync resolver, but order-api /
  // logistics-api (now in data) invoke it by ARN via addToRolePolicy;
  // keeping crm-api in the same stack keeps that hop intra-data too.
  resourceGroupName: 'data',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 120,
  memoryMB: 512,
});
