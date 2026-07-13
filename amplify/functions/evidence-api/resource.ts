import { defineFunction } from '@aws-amplify/backend';

export const evidenceApi = defineFunction({
  name: 'evidence-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  resourceGroupName: 'evidence-api-stack',
});
