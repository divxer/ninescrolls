import { defineFunction, secret } from '@aws-amplify/backend';

export const organizationApi = defineFunction({
    name: 'organization-api',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    // Pin to its own nested stack so cross-Lambda IAM grants from submit-rfq /
    // submit-lead / convert-rfq-to-order don't create a circular policy graph
    // inside Amplify's auto-managed function stack. Same pattern as tender-watch.
    resourceGroupName: 'organization-api-stack',
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
    },
});
