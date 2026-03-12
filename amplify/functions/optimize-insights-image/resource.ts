import { defineFunction } from '@aws-amplify/backend';

export const optimizeInsightsImage = defineFunction({
    name: 'optimize-insights-image',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 1024,
    layers: {
        // Key 'sharp' externalizes the module from esbuild bundling.
        // The placeholder ARN is overridden in backend.ts with the real layer.
        'sharp': 'arn:aws:lambda:us-east-2:000000000000:layer:sharp-placeholder:1',
    },
});
