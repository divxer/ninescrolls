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
    if ('action' in event) {
        return dispatchAction(event);
    }
    // Path 2: AppSync resolver — admin-only.
    requireAdmin(event);
    const fieldName = (event.info as any)?.fieldName ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event);
}

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
