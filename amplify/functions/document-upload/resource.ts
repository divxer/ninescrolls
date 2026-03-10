import { defineFunction } from '@aws-amplify/backend';

export const documentUpload = defineFunction({
    name: 'document-upload',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 15,
    memoryMB: 256,
});
