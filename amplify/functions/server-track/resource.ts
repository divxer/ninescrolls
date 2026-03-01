import { defineFunction } from '@aws-amplify/backend';

export const serverTrack = defineFunction({
    name: 'server-track',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 10,
});
