import { defineFunction, secret } from '@aws-amplify/backend';

export const classifyOrg = defineFunction({
    name: 'classify-org',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
        ADMIN_API_SECRET: secret('ADMIN_API_SECRET'),
    },
});
