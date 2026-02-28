import { defineFunction } from '@aws-amplify/backend';

export const segmentProxy = defineFunction({
    name: 'segment-proxy',
    entry: './handler.ts',
    runtime: 20,
    timeoutSeconds: 30,
});
