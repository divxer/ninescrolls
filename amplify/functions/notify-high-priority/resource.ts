import { defineFunction, secret } from '@aws-amplify/backend';

export const notifyHighPriority = defineFunction({
    name: 'notify-high-priority',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 256,
    resourceGroupName: 'tender-watch-stack',
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
        // INTELLIGENCE_TABLE is injected at deploy time by amplify/backend.ts
    },
});
