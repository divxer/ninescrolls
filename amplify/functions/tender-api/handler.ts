import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

const ADMIN_GROUP = 'admin';

export async function handler(event: AppSyncResolverEvent<any> & { fieldName?: string }): Promise<unknown> {
    requireAdmin(event);
    const identity = (event.identity as any)?.username ?? 'unknown';
    // Amplify Gen 2's `a.handler.function()` path sends fieldName at the event root.
    // Standard AppSync wraps it under event.info. Support both.
    const fieldName = ((event.info as any)?.fieldName) ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event, identity);
}

/**
 * AppSync admin gate. Expects Cognito-authenticated callers with a `groups` claim
 * containing 'admin'. Other auth modes (IAM, API key) leave `event.identity.groups`
 * undefined and are rejected here.
 */
function requireAdmin(event: AppSyncResolverEvent<any>): void {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchFieldName(
    fieldName: string,
    _event: AppSyncResolverEvent<any>,
    _identity: string,
): Promise<unknown> {
    // Operations land in Tasks 6–13.
    throw new Error(`Unknown fieldName: ${fieldName}`);
}

// Export internals for unit tests
export { dispatchFieldName, requireAdmin, ddb, TABLE };
