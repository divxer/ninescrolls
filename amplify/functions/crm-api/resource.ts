import { defineFunction } from '@aws-amplify/backend';

export const crmApi = defineFunction({
  name: 'crm-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 120,
  memoryMB: 512,
});
