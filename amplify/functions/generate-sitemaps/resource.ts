import { defineFunction } from '@aws-amplify/backend';

export const generateSitemaps = defineFunction({
  name: 'generate-sitemaps',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 256,
});
