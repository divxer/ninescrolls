import { defineFunction, secret } from '@aws-amplify/backend';

export const classifyOrg = defineFunction({
    name: 'classify-org',
    // Pinned to the data stack alongside serverTrack. After PR #235 collapsed
    // most data<->function edges into intra-data references, one edge
    // remained: serverTrack (data stack) invokes classifyOrg by ARN
    // (backend.ts: lambda:InvokeFunction + CLASSIFY_ORG_FUNCTION_NAME env),
    // which was a data->function cross-stack ref. Combined with the still-
    // live function->data edges from submitRfq/submitLead/convertRfqToOrder
    // invoking crmApi (now in data stack), the two form a data<->function
    // 2-cycle — reported as a 3-stack cycle by CloudFormation because the
    // api<->data schema wiring is always present. Moving classifyOrg into
    // data collapses the serverTrack invoke into an intra-data reference and
    // breaks the last dangerous edge.
    //
    // Other references to classifyOrg's ARN in the graph:
    // - amplify/backend.ts:288 wires classifyOrg as a REST API integration for
    //   /resolve. That is an api-stack -> classifyOrg ref (used to be
    //   api -> function; becomes api -> data after this change). It stays
    //   one-way and joins the existing benign api -> data schema edges, so
    //   it does not close a new cycle. No other generic function-stack code
    //   references classifyOrg's ARN.
    //
    // Table + IAM notes:
    // - orgClassificationTable (backend.ts:300) is created via
    //   Stack.of(classifyOrg.lambda), so it follows the Lambda into the data
    //   stack; the subsequent grantReadWriteData + env-var wiring stays
    //   intra-stack.
    // - classifyOrg's other role policies (Bedrock InvokeModel + aws-
    //   marketplace subscription) use hardcoded ARNs, so there is no
    //   additional cross-stack impact.
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
