import { defineFunction } from '@aws-amplify/backend';

export const optimizeInsightsImage = defineFunction({
    name: 'optimize-insights-image',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 1024,
});
