import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { classifyEmailDomain } from '../../lib/organization/etld';
import {
    ALIAS_DOMAINS_CAP,
    LEAD_SCORE_THRESHOLD,
} from '../../lib/organization/constants';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const SELF_FUNCTION_NAME = () => process.env.AWS_LAMBDA_FUNCTION_NAME!;

const ADMIN_GROUP = 'admin';

interface DirectInvokePayload {
    action: string;
    [key: string]: unknown;
}

interface UpsertPayload {
    action: 'upsertFromSubmission';
    source: 'rfq' | 'lead' | 'order';
    email: string;
    institution?: string;
    submittedAt: string;
    scoreDelta: number;
    orderValueUSD?: number;
}

interface UpsertResult {
    matchedOrgId: string | null;
}

const SOURCE_DATE_FIELD = {
    rfq: 'latestRFQDate',
    lead: 'latestLeadDate',
    order: 'latestOrderDate',
} as const;

function invertedActivityToken(iso: string): string {
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) {
        throw new Error(`invertedActivityToken: invalid ISO timestamp "${iso}"`);
    }
    const inverted = (8_640_000_000_000_000 - ms).toString().padStart(16, '0');
    return inverted;
}

function invertedScoreToken(score: number): string {
    const clamped = Math.max(0, Math.min(10_000, score));
    return (10_000 - clamped).toString().padStart(5, '0');
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
    const fieldName = ((event as any).info?.fieldName) ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event as AppSyncResolverEvent<any>);
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

async function dispatchAction(event: DirectInvokePayload): Promise<unknown> {
    switch (event.action) {
        case 'upsertFromSubmission':
            return upsertFromSubmission(event as unknown as UpsertPayload);
        default:
            throw new Error(`Unknown action: ${event.action}`);
    }
}

async function dispatchFieldName(
    fieldName: string,
    _event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    // Will be expanded in Tasks 7 and 8.
    throw new Error(`Unknown fieldName: ${fieldName}`);
}

async function upsertFromSubmission(payload: UpsertPayload): Promise<UpsertResult> {
    const { orgId, domain, isFreeMailDomain } = classifyEmailDomain(payload.email);
    if (!orgId) {
        console.log(JSON.stringify({
            event: 'org.upsert.skipped',
            reason: isFreeMailDomain ? 'free-mail' : 'invalid-email',
            domain,
        }));
        return { matchedOrgId: null };
    }

    // Step 3: alias lookup — find canonical orgId if this domain is an existing alias
    let canonicalOrgId = orgId;
    if (domain !== orgId) {
        const aliasHit = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: { ':pk': `ORG_DOMAIN#${domain}` },
            Limit: 1,
        }));
        const items = aliasHit.Items ?? [];
        const lookup = items.find((i) => i.entityType === 'ORG_DOMAIN_LOOKUP');
        if (lookup?.orgId) {
            canonicalOrgId = lookup.orgId as string;
        }
    }

    const nowIso = new Date().toISOString();
    const sourceCountField = `${payload.source}Count`;
    const sourceDateField = SOURCE_DATE_FIELD[payload.source];

    // Try PutItem with attribute_not_exists (new Org path)
    try {
        const newOrg: Record<string, unknown> = {
            PK: `ORG#${canonicalOrgId}`,
            SK: 'META',
            entityType: 'ORGANIZATION',
            orgId: canonicalOrgId,
            primaryDomain: domain,
            aliasDomains: domain !== canonicalOrgId ? [domain] : [],
            displayName: canonicalOrgId,
            type: 'unknown',
            leadScore: payload.scoreDelta,
            hasActiveInquiry: payload.source !== 'order',
            rfqCount: payload.source === 'rfq' ? 1 : 0,
            orderCount: payload.source === 'order' ? 1 : 0,
            leadCount: payload.source === 'lead' ? 1 : 0,
            totalOrderValueUSD: payload.orderValueUSD ?? 0,
            firstSeenAt: nowIso,
            lastActivityAt: nowIso,
            [sourceDateField]: payload.submittedAt,
            status: 'active',
            contactCount: payload.source === 'order' ? 0 : 1,
            primaryContactEmail: payload.email,
            createdAt: nowIso,
            updatedAt: nowIso,
            GSI1PK: 'ORG_TYPE#unknown',
            GSI1SK: `${invertedActivityToken(nowIso)}#${canonicalOrgId}`,
            GSI2PK: `ORG_DOMAIN#${canonicalOrgId}`,
            GSI2SK: 'ORG',
        };

        if (payload.scoreDelta >= LEAD_SCORE_THRESHOLD) {
            newOrg.GSI3PK = 'ORG_LEAD_SCORE';
            newOrg.GSI3SK = `${invertedScoreToken(payload.scoreDelta)}#${canonicalOrgId}`;
        }

        await ddb.send(new PutCommand({
            TableName: TABLE(),
            Item: newOrg,
            ConditionExpression: 'attribute_not_exists(PK)',
        }));

        // Alias lookup write (only if domain differs from canonical orgId).
        // Note: If META PutItem succeeded but this alias PutItem throws a non-CCFE
        // error (network, throttle), META exists without an alias lookup. The next
        // submission from the same alias domain may create a duplicate Org. The
        // backfill script (Task 13) reconciles this drift; we accept the eventual
        // consistency rather than wrap both writes in a TransactWriteItems.
        if (domain !== canonicalOrgId) {
            await ddb.send(new PutCommand({
                TableName: TABLE(),
                Item: {
                    PK: 'ORG_DOMAIN_LOOKUP',
                    SK: `DOMAIN#${domain}`,
                    entityType: 'ORG_DOMAIN_LOOKUP',
                    orgId: canonicalOrgId,
                    createdAt: nowIso,
                    GSI2PK: `ORG_DOMAIN#${domain}`,
                    GSI2SK: 'ORG',
                },
                ConditionExpression: 'attribute_not_exists(PK)',
            })).catch((err) => {
                if (err?.name !== 'ConditionalCheckFailedException') throw err;
            });
        }

        // Fire-and-forget AI classify
        await invokeSelfClassify(canonicalOrgId, payload.institution);

        console.log(JSON.stringify({
            event: 'org.upsert.created',
            orgId: canonicalOrgId,
            source: payload.source,
        }));
        return { matchedOrgId: canonicalOrgId };
    } catch (err: any) {
        if (err?.name !== 'ConditionalCheckFailedException') throw err;
        // Existing Org — proceed to UpdateItem path
    }

    // Update path
    const newGsi1Sk = `${invertedActivityToken(nowIso)}#${canonicalOrgId}`;
    let updateExpr = 'SET hasActiveInquiry = :hasInquiry, lastActivityAt = :now, updatedAt = :now, GSI1SK = :gsi1Sk, '
        + `${sourceDateField} = :submittedAt, contactCount = if_not_exists(contactCount, :zero) + :countDelta`;
    let addExpr = ` ADD leadScore :delta, ${sourceCountField} :one`;
    if (payload.source === 'order' && payload.orderValueUSD) {
        addExpr += ', totalOrderValueUSD :orderVal';
    }

    const exprValues: Record<string, unknown> = {
        ':hasInquiry': payload.source !== 'order',
        ':now': nowIso,
        ':gsi1Sk': newGsi1Sk,
        ':submittedAt': payload.submittedAt,
        ':zero': 0,
        ':countDelta': payload.source === 'order' ? 0 : 1,
        ':delta': payload.scoreDelta,
        ':one': 1,
    };
    if (payload.source === 'order' && payload.orderValueUSD) {
        exprValues[':orderVal'] = payload.orderValueUSD;
    }

    const updateRes = await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
        UpdateExpression: updateExpr + addExpr,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'UPDATED_NEW',
    }));

    const newLeadScore = (updateRes.Attributes as any)?.leadScore as number | undefined;
    if (typeof newLeadScore === 'number') {
        const previousLeadScore = newLeadScore - payload.scoreDelta;
        if (newLeadScore >= LEAD_SCORE_THRESHOLD && previousLeadScore < LEAD_SCORE_THRESHOLD) {
            await ddb.send(new UpdateCommand({
                TableName: TABLE(),
                Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                UpdateExpression: 'SET GSI3PK = :pk, GSI3SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': 'ORG_LEAD_SCORE',
                    ':sk': `${invertedScoreToken(newLeadScore)}#${canonicalOrgId}`,
                },
            }));
        } else if (newLeadScore < LEAD_SCORE_THRESHOLD && previousLeadScore >= LEAD_SCORE_THRESHOLD) {
            await ddb.send(new UpdateCommand({
                TableName: TABLE(),
                Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                UpdateExpression: 'REMOVE GSI3PK, GSI3SK',
            }));
        }
    }

    // Alias handling — try PutItem alias lookup; on success append to array (if under cap)
    if (domain !== canonicalOrgId) {
        try {
            await ddb.send(new PutCommand({
                TableName: TABLE(),
                Item: {
                    PK: 'ORG_DOMAIN_LOOKUP',
                    SK: `DOMAIN#${domain}`,
                    entityType: 'ORG_DOMAIN_LOOKUP',
                    orgId: canonicalOrgId,
                    createdAt: nowIso,
                    GSI2PK: `ORG_DOMAIN#${domain}`,
                    GSI2SK: 'ORG',
                },
                ConditionExpression: 'attribute_not_exists(PK)',
            }));
            // Lookup write succeeded — this is a brand-new alias for this Org. Append to array if under cap.
            const meta = await ddb.send(new GetCommand({
                TableName: TABLE(),
                Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                ProjectionExpression: 'aliasDomains',
            }));
            const currentAliases = ((meta.Item as any)?.aliasDomains ?? []) as string[];
            if (currentAliases.length < ALIAS_DOMAINS_CAP) {
                await ddb.send(new UpdateCommand({
                    TableName: TABLE(),
                    Key: { PK: `ORG#${canonicalOrgId}`, SK: 'META' },
                    UpdateExpression: 'SET aliasDomains = list_append(if_not_exists(aliasDomains, :empty), :newAlias)',
                    ExpressionAttributeValues: { ':empty': [], ':newAlias': [domain] },
                }));
            } else {
                console.warn(JSON.stringify({
                    event: 'org.alias.cap-exceeded',
                    orgId: canonicalOrgId,
                    droppedDomain: domain,
                    cap: ALIAS_DOMAINS_CAP,
                }));
            }
        } catch (err: any) {
            if (err?.name !== 'ConditionalCheckFailedException') throw err;
            // Alias already exists — no append needed.
        }
    }

    console.log(JSON.stringify({
        event: 'org.upsert.updated',
        orgId: canonicalOrgId,
        source: payload.source,
        newLeadScore,
    }));
    return { matchedOrgId: canonicalOrgId };
}

async function invokeSelfClassify(orgId: string, institution?: string): Promise<void> {
    try {
        await lambda.send(new InvokeCommand({
            FunctionName: SELF_FUNCTION_NAME(),
            InvocationType: 'Event',
            Payload: new TextEncoder().encode(JSON.stringify({
                action: 'classifyOrg',
                orgId,
                institution,
            })),
        }));
    } catch (err) {
        console.error(JSON.stringify({
            event: 'org.classify.invoke-failed',
            orgId,
            error: String(err),
        }));
    }
}

// Export internals for unit tests
export { dispatchAction, dispatchFieldName, requireAdmin, ddb, TABLE, upsertFromSubmission };
