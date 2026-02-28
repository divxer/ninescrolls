import { defineFunction } from '@aws-amplify/backend';

export const ipLookup = defineFunction({
    name: 'ip-lookup',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 10,
});
