import { defineFunction, secret } from '@aws-amplify/backend';

export const matchWithLlm = defineFunction({
    name: 'match-with-llm',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 1024,
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
        // INTELLIGENCE_TABLE is injected at deploy time by amplify/backend.ts (Task 14)
    },
});
