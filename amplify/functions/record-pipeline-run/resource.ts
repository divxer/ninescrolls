import { defineFunction } from '@aws-amplify/backend';

export const recordPipelineRun = defineFunction({
    name: 'record-pipeline-run',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 60,
    memoryMB: 256,
});
