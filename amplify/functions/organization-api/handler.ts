import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

const ADMIN_GROUP = 'admin';

interface DirectInvokePayload {
    action: string;
    [key: string]: unknown;
}

export async function handler(
    event: AppSyncResolverEvent<any> | DirectInvokePayload,
): Promise<unknown> {
    // Path 1: direct Lambda invoke (action-based dispatch). Bypasses requireAdmin
    // because the only callers are other Lambdas in this account that we trust
    // (submit-rfq, submit-lead, convert-rfq-to-order, backfill script).
    // Discriminator: direct-invoke shape has `action` at top level and lacks any AppSync
    // resolver markers. This prevents an AppSync event with a stray top-level `action`
    // key from silently bypassing requireAdmin.
    const isDirectInvoke =
        'action' in event &&
        !('info' in event) &&
        !('fieldName' in event) &&
        !('arguments' in event) &&
        !('identity' in event);
    if (isDirectInvoke) {
        return dispatchAction(event as DirectInvokePayload);
    }
    // Path 2: AppSync resolver — admin-only.
    requireAdmin(event as AppSyncResolverEvent<any>);
    const fieldName = (event.info as any)?.fieldName ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event);
}

/**
 * AppSync admin gate. Expects Cognito-authenticated callers with a `groups` claim
 * containing 'admin'. Other auth modes (IAM, API key) leave `event.identity.groups`
 * undefined and are rejected here — intentional, since admin operations should never
 * be reachable via IAM passthrough or API-key clients.
 */
function requireAdmin(event: AppSyncResolverEvent<any>): void {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchAction(_event: DirectInvokePayload): Promise<unknown> {
    // Will be expanded in Tasks 5 and 6.
    throw new Error(`Unknown action: ${(_event as DirectInvokePayload).action}`);
}

async function dispatchFieldName(
    fieldName: string,
    _event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    // Will be expanded in Tasks 7 and 8.
    throw new Error(`Unknown fieldName: ${fieldName}`);
}

// Export internals for unit tests
export { dispatchAction, dispatchFieldName, requireAdmin, ddb, TABLE };
