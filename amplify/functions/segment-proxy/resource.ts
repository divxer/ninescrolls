import { defineFunction } from '@aws-amplify/backend';

export const segmentProxy = defineFunction({
    name: 'segment-proxy',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
});
