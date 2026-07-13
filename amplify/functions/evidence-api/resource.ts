import { defineFunction } from '@aws-amplify/backend';

export const evidenceApi = defineFunction({
  name: 'evidence-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  // Data resolver: this Lambda backs the listPublishedEvidence query AND reads
  // the data stack's Evidence table, so it MUST live in the 'data' stack — a
  // custom stack creates a CloudFormation circular dependency (data ⇄ function).
  // Same pattern as order-api / logistics-api / crm-api.
  resourceGroupName: 'data',
});
