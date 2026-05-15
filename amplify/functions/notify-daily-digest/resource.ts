import { defineFunction, secret } from '@aws-amplify/backend';

export const notifyDailyDigest = defineFunction({
    name: 'notify-daily-digest',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 60,
    memoryMB: 256,
    resourceGroupName: 'tender-watch-stack',
    environment: {
        SENDGRID_API_KEY: secret('SENDGRID_API_KEY'),
    },
});
