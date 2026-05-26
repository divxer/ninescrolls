import { defineFunction } from '@aws-amplify/backend';

export const notifyPipelineHealth = defineFunction({
    name: 'notify-pipeline-health',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 60,
    memoryMB: 256,
});
