import { defineFunction, secret } from '@aws-amplify/backend';

export const rfqDraftApi = defineFunction({
    name: 'rfq-draft-api',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 10,
    memoryMB: 256,
    environment: {
        RFQ_DRAFT_PEPPER: secret('RFQ_DRAFT_PEPPER'),
    },
});
