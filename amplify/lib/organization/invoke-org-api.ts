import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({});

const FUNCTION_NAME = () => process.env.ORGANIZATION_API_FUNCTION_NAME!;

export interface UpsertFromSubmissionPayload {
    action: 'upsertFromSubmission';
    source: 'rfq' | 'lead' | 'order';
    email: string;
    institution?: string;
    submittedAt: string;
    scoreDelta: number;
    orderValueUSD?: number;
}

export interface ClassifyOrgPayload {
    action: 'classifyOrg';
    orgId: string;
    institution?: string;
    force?: boolean;
}

export type OrgApiPayload = UpsertFromSubmissionPayload | ClassifyOrgPayload;

export interface UpsertFromSubmissionResult {
    matchedOrgId: string | null;
}

/**
 * Synchronously invoke organization-api Lambda via AWS SDK (not AppSync).
 * Used by submit-rfq / submit-lead / convert-rfq-to-order to upsert the
 * customer Organization and receive a `matchedOrgId` to backfill on the
 * source item.
 *
 * On any error (FunctionError, timeout, network), the caller should catch
 * and proceed without matchedOrgId. Failing the user-facing submission
 * because of an Org-upsert glitch is not acceptable.
 */
export async function invokeOrganizationApi(
    payload: UpsertFromSubmissionPayload,
): Promise<UpsertFromSubmissionResult>;
export async function invokeOrganizationApi(payload: OrgApiPayload): Promise<unknown>;
export async function invokeOrganizationApi(payload: OrgApiPayload): Promise<unknown> {
    const res = await lambda.send(new InvokeCommand({
        FunctionName: FUNCTION_NAME(),
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }));
    const text = res.Payload ? new TextDecoder().decode(res.Payload) : '';
    const parsed = text ? JSON.parse(text) : null;
    if (res.FunctionError) {
        const message = parsed?.errorMessage ?? res.FunctionError;
        throw new Error(`organization-api error: ${message}`);
    }
    return parsed;
}
