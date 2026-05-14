import { defineFunction } from '@aws-amplify/backend';

export const notifyDailyDigest = defineFunction({
    name: 'notify-daily-digest',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 60,
    memoryMB: 256,
    environment: {
        NOTIFICATION_FROM: 'info@ninescrolls.com',
        NOTIFICATION_TO: 'info@ninescrolls.com',
        // INTELLIGENCE_TABLE is injected at deploy time by amplify/backend.ts (Task 14)
    },
});
