import { defineFunction, secret } from '@aws-amplify/backend';

export const classifyOrg = defineFunction({
    name: 'classify-org',
    // Pinned to the data stack alongside serverTrack. After PR #235 collapsed
    // most data<->function edges into intra-data references, one edge
    // remained: serverTrack (data stack) invokes classifyOrg by ARN
    // (backend.ts: lambda:InvokeFunction + CLASSIFY_ORG_FUNCTION_NAME env),
    // which is a data->function cross-stack ref. Combined with the still-live
    // function->data edges from submitRfq/submitLead/convertRfqToOrder
    // invoking crmApi (now in data stack), the two form a data<->function
    // 2-cycle — reported as a 3-stack cycle by CloudFormation because the
    // api<->data schema wiring is always present. Moving classifyOrg into
    // data collapses the serverTrack invoke into an intra-data reference and
    // breaks the last dangerous edge. orgClassificationTable
    // (Stack.of(classifyOrg.lambda), backend.ts:300) follows the Lambda into
    // data; nothing else in the graph references classifyOrg's ARN. Bedrock
    // and aws-marketplace policies use hardcoded ARNs — no cross-stack
    // impact.
    resourceGroupName: 'data',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        ADMIN_API_SECRET: secret('ADMIN_API_SECRET'),
    },
});
