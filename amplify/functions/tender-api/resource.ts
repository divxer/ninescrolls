import { defineFunction, secret } from '@aws-amplify/backend';

export const tenderApi = defineFunction({
    name: 'tender-api',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    // Pin to its own nested stack so backend.ts can attach IAM grants without
    // creating circular deps with Phase 1's tender-watch-stack.
    resourceGroupName: 'tender-api-stack',
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
    },
});
