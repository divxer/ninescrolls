import { defineFunction } from '@aws-amplify/backend';

export const segmentProxy = defineFunction({
    entry: './handler.ts',
    runtime: 20,
    timeoutSeconds: 30,
});
