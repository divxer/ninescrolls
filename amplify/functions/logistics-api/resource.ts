import { defineFunction } from '@aws-amplify/backend';

export const logisticsApi = defineFunction({
  name: 'logistics-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
});
