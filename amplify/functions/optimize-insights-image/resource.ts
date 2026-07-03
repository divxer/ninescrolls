import { defineFunction } from '@aws-amplify/backend';

export const optimizeInsightsImage = defineFunction({
    name: 'optimize-insights-image',
    // This Lambda is a GraphQL data resolver (amplify/data/resource.ts). Left in the default
    // `function` stack it creates a data->function edge; once ANY other function-stack Lambda gains a
    // data-stack table grant (crm-api's AnalyticsEvent read, 2C-analytics), that closes a
    // CloudFormation circular dependency [apistack, data, function] and the deploy fails. Isolating
    // this resolver in its own stack removes the data->function edge (the Amplify-recommended fix for a
    // data resolver: assign it out of the generic function stack). It only touches insights-assets S3 +
    // the sharp layer, so the new stack has clean one-way edges.
    resourceGroupName: 'optimize-insights-image-stack',
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
