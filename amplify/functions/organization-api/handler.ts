import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
    ScanCommand,
    TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';
import { classifyEmailDomain } from '../../lib/organization/etld';
import {
    ALIAS_DOMAINS_CAP,
    ANTHROPIC_TIMEOUT_MS,
    BEDROCK_TIMEOUT_MS,
    LEAD_SCORE_THRESHOLD,
    ORG_STATUSES,
    ORG_TYPES,
    RECLASSIFY_COOLDOWN_DAYS,
} from '../../lib/organization/constants';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});
const bedrock = new BedrockRuntimeClient({});
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const SELF_FUNCTION_NAME = () => process.env.AWS_LAMBDA_FUNCTION_NAME!;

const ADMIN_GROUP = 'admin';

interface DirectInvokePayload {
    action: string;
    [key: string]: unknown;
}

type OrgApiEvent = AppSyncResolverEvent<Record<string, unknown>>;

interface CognitoIdentityShape {
    groups?: string[] | null;
    username?: string;
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
    event: OrgApiEvent | DirectInvokePayload,
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
    const appSyncEvent = event as OrgApiEvent & { fieldName?: string };
    requireAdmin(appSyncEvent);
    const fieldName = appSyncEvent.info?.fieldName ?? appSyncEvent.fieldName;
    return dispatchFieldName(fieldName as string, appSyncEvent);
}

/**
 * AppSync admin gate. Expects Cognito-authenticated callers with a `groups` claim
 * containing 'admin'. Other auth modes (IAM, API key) leave `event.identity.groups`
 * undefined and are rejected here — intentional, since admin operations should never
 * be reachable via IAM passthrough or API-key clients.
 */
function requireAdmin(event: OrgApiEvent): void {
    const groups = (event.identity as CognitoIdentityShape | undefined)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchAction(event: DirectInvokePayload): Promise<unknown> {
    switch (event.action) {
        case 'upsertFromSubmission':
            return upsertFromSubmission(event as unknown as UpsertPayload);
        case 'classifyOrg':
            return classifyOrg(event as unknown as ClassifyOrgPayload);
        default:
            throw new Error(`Unknown action: ${event.action}`);
    }
}

async function dispatchFieldName(
    fieldName: string,
    event: OrgApiEvent,
): Promise<unknown> {
    const identity = (event.identity as CognitoIdentityShape | undefined)?.username ?? 'unknown';
    switch (fieldName) {
        case 'listOrganizations':
            return listOrganizations(event.arguments as ListOrgArgs);
        case 'getOrganization':
            return getOrganization(event.arguments as { orgId: string });
        case 'updateOrganizationStatus':
            return updateOrganizationStatus(event.arguments as { orgId: string; status: string; adminNotes?: string; tags?: string[] }, identity);
        case 'updateOrganizationOwner':
            return updateOrganizationOwner(event.arguments as { orgId: string; ownerSalesRep?: string | null }, identity);
        case 'reclassifyOrganization':
            return reclassifyOrganization(event.arguments as { orgId: string; force?: boolean });
        case 'mergeOrganization':
            return mergeOrganization(event.arguments as { sourceOrgId: string; targetOrgId: string }, identity);
        default:
            throw new Error(`Unknown fieldName: ${fieldName}`);
    }
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
        const lookup = items.find((i: Record<string, unknown>) => i.entityType === 'ORG_DOMAIN_LOOKUP');
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
            })).catch((err: unknown) => {
                if ((err as { name?: string } | undefined)?.name !== 'ConditionalCheckFailedException') throw err;
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
    } catch (err) {
        if ((err as { name?: string } | undefined)?.name !== 'ConditionalCheckFailedException') throw err;
        // Existing Org — proceed to UpdateItem path
    }

    // Update path
    const newGsi1Sk = `${invertedActivityToken(nowIso)}#${canonicalOrgId}`;
    const updateExpr = 'SET hasActiveInquiry = :hasInquiry, lastActivityAt = :now, updatedAt = :now, GSI1SK = :gsi1Sk, '
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

    const newLeadScore = updateRes.Attributes?.leadScore as number | undefined;
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
            const currentAliases = (meta.Item?.aliasDomains ?? []) as string[];
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
        } catch (err) {
            if ((err as { name?: string } | undefined)?.name !== 'ConditionalCheckFailedException') throw err;
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

interface ClassifyOrgPayload {
    action: 'classifyOrg';
    orgId: string;
    institution?: string;
    force?: boolean;
}

interface LlmClassifyOutput {
    displayName?: string;
    type?: string;
    country?: string;
    industry?: string | null;
}

function parseLlmJson(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
    return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

function buildClassifyPrompt(orgId: string, institution?: string): string {
    return [
        'Classify this customer organization. Output JSON only.',
        '',
        'Schema:',
        '{ "displayName": string,',
        '  "type": string,            // one of: university, research-institute, company, government, other',
        '  "country": string,         // ISO 3166-1 alpha-2',
        '  "industry": string | null  // short noun phrase or null',
        '}',
        '',
        `Inputs:`,
        `- Domain: ${orgId}`,
        `- Institution name provided: ${institution ? `"${institution}"` : 'none'}`,
    ].join('\n');
}

async function callBedrock(prompt: string): Promise<LlmClassifyOutput> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BEDROCK_TIMEOUT_MS);
    try {
        const res = await bedrock.send(new InvokeModelCommand({
            modelId: process.env.BEDROCK_MODEL_ID!,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 500,
                messages: [{ role: 'user', content: prompt }],
            }),
        }), { abortSignal: ctrl.signal });
        const text = await res.body.transformToString('utf-8');
        const wrap = JSON.parse(text);
        const inner: string = wrap.content?.[0]?.text ?? '{}';
        return parseLlmJson(inner) as LlmClassifyOutput;
    } finally {
        clearTimeout(t);
    }
}

async function callAnthropic(prompt: string): Promise<LlmClassifyOutput> {
    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        timeout: ANTHROPIC_TIMEOUT_MS,
    });
    const res = await client.messages.create({
        model: process.env.CLAUDE_MODEL!,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = res.content[0] as { text?: string } | undefined;
    const text: string = block?.text ?? '{}';
    return parseLlmJson(text) as LlmClassifyOutput;
}

function isValidOrgType(t: string | undefined): boolean {
    return !!t && (ORG_TYPES as readonly string[]).includes(t);
}

async function classifyOrg(payload: ClassifyOrgPayload): Promise<Record<string, unknown>> {
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${payload.orgId}`, SK: 'META' },
    }));
    if (!existing.Item) {
        console.warn(JSON.stringify({ event: 'org.classify.org-missing', orgId: payload.orgId }));
        return { aiProvider: null };
    }

    const prompt = buildClassifyPrompt(payload.orgId, payload.institution);

    let result: LlmClassifyOutput | null = null;
    let provider: 'bedrock' | 'anthropic' | null = null;

    try {
        result = await callBedrock(prompt);
        provider = 'bedrock';
    } catch (bedrockErr) {
        console.warn(JSON.stringify({
            event: 'org.classify.bedrock-failed',
            orgId: payload.orgId,
            error: String(bedrockErr),
        }));
        try {
            result = await callAnthropic(prompt);
            provider = 'anthropic';
        } catch (anthropicErr) {
            console.error(JSON.stringify({
                event: 'org.classify.both-providers-failed',
                orgId: payload.orgId,
                bedrockError: String(bedrockErr),
                anthropicError: String(anthropicErr),
            }));
            return { aiProvider: null };
        }
    }

    if (!result) return { aiProvider: null };

    const safeType = isValidOrgType(result.type) ? result.type! : 'unknown';
    if (!isValidOrgType(result.type)) {
        console.warn(JSON.stringify({
            event: 'org.classify.type-coerced',
            orgId: payload.orgId,
            aiType: result.type ?? null,
            coercedTo: 'unknown',
        }));
    }
    const safeDisplayName = result.displayName?.trim() || payload.orgId;
    const nowIso = new Date().toISOString();
    const oldType = (existing.Item as { type?: string }).type ?? 'unknown';

    await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${payload.orgId}`, SK: 'META' },
        UpdateExpression: 'SET #disp = :disp, #t = :t, #c = :c, industry = :ind, aiClassifiedAt = :now, aiProvider = :prov, updatedAt = :now, GSI1PK = :newGsi1Pk',
        ExpressionAttributeNames: {
            '#disp': 'displayName',
            '#t': 'type',
            '#c': 'country',
        },
        ExpressionAttributeValues: {
            ':disp': safeDisplayName,
            ':t': safeType,
            ':c': result.country ?? null,
            ':ind': result.industry ?? null,
            ':now': nowIso,
            ':prov': provider,
            ':newGsi1Pk': `ORG_TYPE#${safeType}`,
        },
    }));

    console.log(JSON.stringify({
        event: 'org.classify.success',
        orgId: payload.orgId,
        provider,
        type: safeType,
        oldType,
    }));

    return {
        orgId: payload.orgId,
        displayName: safeDisplayName,
        type: safeType,
        country: result.country ?? null,
        industry: result.industry ?? null,
        aiClassifiedAt: nowIso,
        aiProvider: provider,
    };
}

interface ListOrgArgs {
    statuses?: string[];
    types?: string[];
    countries?: string[];
    ownerSalesRep?: string;
    minLeadScore?: number;
    search?: string;
    sortBy?: 'activity' | 'leadScore' | 'firstSeen';
    limit?: number;
    nextToken?: string;
}

// Minimal view of an ORGANIZATION item — only the fields this handler reads.
type OrgListItem = {
    lastActivityAt?: string;
    firstSeenAt?: string;
    status?: string;
    country?: string;
    ownerSalesRep?: string;
    leadScore?: number;
    displayName?: string;
    primaryDomain?: string;
};

async function listOrganizations(args: ListOrgArgs) {
    const sortBy = args.sortBy ?? 'activity';
    const limit = args.limit ?? 25;
    const types = args.types ?? ORG_TYPES.filter((t) => t !== 'unknown');

    let items: OrgListItem[] = [];

    if (sortBy === 'activity') {
        const queries = await Promise.all(
            types.map((type) =>
                ddb.send(new QueryCommand({
                    TableName: TABLE(),
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :pk',
                    ExpressionAttributeValues: { ':pk': `ORG_TYPE#${type}` },
                    Limit: limit * 2,
                })),
            ),
        );
        items = queries.flatMap((q) => q.Items ?? []) as OrgListItem[];
        // Cross-type merge needs explicit sort: per-type slices are sorted DESC by GSI1SK
        // but flatMap concatenates them in types[] order, leaving cross-type items in
        // the wrong order until we re-sort by lastActivityAt.
        items.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
    } else if (sortBy === 'leadScore') {
        const r = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI3',
            KeyConditionExpression: 'GSI3PK = :pk',
            ExpressionAttributeValues: { ':pk': 'ORG_LEAD_SCORE' },
            Limit: limit * 2,
        }));
        items = (r.Items ?? []) as OrgListItem[];
    } else {
        // firstSeen — Scan with filter
        const r = await ddb.send(new ScanCommand({
            TableName: TABLE(),
            FilterExpression: 'entityType = :et',
            ExpressionAttributeValues: { ':et': 'ORGANIZATION' },
        }));
        items = (r.Items ?? []) as OrgListItem[];
        items.sort((a, b) => (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? ''));
    }

    // In-memory filters
    if (args.statuses?.length) {
        items = items.filter((i) => args.statuses!.includes(i.status ?? 'active'));
    } else {
        items = items.filter((i) => (i.status ?? 'active') === 'active');
    }
    if (args.countries?.length) {
        items = items.filter((i) => args.countries!.includes(i.country as string));
    }
    if (args.ownerSalesRep) {
        items = items.filter((i) => i.ownerSalesRep === args.ownerSalesRep);
    }
    if (typeof args.minLeadScore === 'number') {
        items = items.filter((i) => (i.leadScore ?? 0) >= args.minLeadScore!);
    }
    if (args.search) {
        const needle = args.search.toLowerCase();
        items = items.filter((i) =>
            (i.displayName ?? '').toLowerCase().includes(needle) ||
            (i.primaryDomain ?? '').toLowerCase().includes(needle),
        );
    }

    // Cap to limit
    const totalActiveCount = items.length;
    const sliced = items.slice(0, limit);

    return {
        items: sliced,
        // TODO(phase-d): real pagination. Phase C returns the first page only.
        // Returning a non-null token would mislead clients into looping.
        nextToken: null,
        totalActiveCount,
    };
}

// Minimal view of a GSI2-linked RFQ / ORDER / LEAD item — only the fields read here.
type LinkedActivityItem = {
    PK?: string;
    SK?: string;
    submittedAt?: string;
    quoteDate?: string;
    createdAt?: string;
    updatedAt?: string;
    feedbackCount?: number;
    daysSinceLastUpdate?: number;
    feedbackScheduleCreated?: boolean;
    source?: string;
};

async function getOrganization(args: { orgId: string }) {
    const meta = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
    }));
    if (!meta.Item) {
        throw new Error(`Organization not found: ${args.orgId}`);
    }

    const linked = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `ORG#${args.orgId}` },
        Limit: 80,
    }));

    const recentRfqs: LinkedActivityItem[] = [];
    const recentOrders: LinkedActivityItem[] = [];
    const recentLeads: LinkedActivityItem[] = [];
    // PK prefix is the canonical entity discriminator — submit-rfq /
    // submit-lead / convert-rfq-to-order don't write `entityType`, and
    // historical pre-Phase-C items don't have it either. Filtering by
    // entityType (the original code) silently rejected every linked item.
    for (const item of ((linked.Items ?? []) as LinkedActivityItem[])) {
        const pk = (item.PK as string) ?? '';
        if (pk.startsWith('RFQ#') && recentRfqs.length < 20) recentRfqs.push(item);
        else if (pk.startsWith('ORDER#') && recentOrders.length < 20) recentOrders.push(item);
        else if (pk.startsWith('LEAD#') && recentLeads.length < 20) recentLeads.push(item);
    }
    recentRfqs.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
    recentOrders.sort((a, b) => (b.quoteDate ?? '').localeCompare(a.quoteDate ?? ''));
    recentLeads.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

    // Order schema declares `feedbackCount` and `daysSinceLastUpdate` as
    // non-nullable Int, but the stored DDB Order item doesn't carry them — they
    // are computed by `order-api` at read time via buildOrderResponse. Mirror
    // that here so AppSync serialization doesn't reject the response.
    const nowMs = Date.now();
    const normalizedOrders = recentOrders.map((o) => {
        const updatedAtMs = o.updatedAt ? new Date(o.updatedAt as string).getTime() : nowMs;
        const daysSinceLastUpdate = Number.isFinite(updatedAtMs)
            ? Math.floor((nowMs - updatedAtMs) / (1000 * 60 * 60 * 24))
            : 0;
        return {
            ...o,
            feedbackCount: o.feedbackCount ?? 0,
            daysSinceLastUpdate: o.daysSinceLastUpdate ?? daysSinceLastUpdate,
            feedbackScheduleCreated: o.feedbackScheduleCreated ?? false,
            source: o.source ?? 'MANUAL',
        };
    });

    return {
        organization: meta.Item,
        recentRfqs,
        recentOrders: normalizedOrders,
        recentLeads,
        recentTenders: [],
    };
}

async function updateOrganizationStatus(
    args: { orgId: string; status: string; adminNotes?: string; tags?: string[] },
    identity: string,
) {
    if (!(ORG_STATUSES as readonly string[]).includes(args.status)) {
        throw new Error(`invalid status: ${args.status}`);
    }
    const nowIso = new Date().toISOString();
    const setExpressions: string[] = ['#st = :status', 'updatedAt = :now'];
    const exprValues: Record<string, unknown> = { ':status': args.status, ':now': nowIso };
    const exprNames: Record<string, string> = { '#st': 'status' };
    if (args.adminNotes !== undefined) {
        setExpressions.push('adminNotes = :notes');
        exprValues[':notes'] = args.adminNotes;
    }
    if (args.tags !== undefined) {
        setExpressions.push('tags = :tags');
        exprValues[':tags'] = args.tags;
    }
    const res = await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
    }));
    console.log(JSON.stringify({
        event: 'org.status.updated',
        orgId: args.orgId,
        newStatus: args.status,
        changedBy: identity,
    }));
    return res.Attributes;
}

async function updateOrganizationOwner(
    args: { orgId: string; ownerSalesRep?: string | null },
    identity: string,
) {
    const nowIso = new Date().toISOString();
    let updateExpr: string;
    const exprValues: Record<string, unknown> = { ':now': nowIso };
    if (args.ownerSalesRep) {
        updateExpr = 'SET ownerSalesRep = :owner, updatedAt = :now';
        exprValues[':owner'] = args.ownerSalesRep;
    } else {
        updateExpr = 'SET updatedAt = :now REMOVE ownerSalesRep';
    }
    const res = await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
        UpdateExpression: updateExpr,
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
    }));
    console.log(JSON.stringify({
        event: 'org.owner.updated',
        orgId: args.orgId,
        owner: args.ownerSalesRep ?? null,
        changedBy: identity,
    }));
    return res.Attributes;
}

async function reclassifyOrganization(args: { orgId: string; force?: boolean }) {
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `ORG#${args.orgId}`, SK: 'META' },
    }));
    if (!existing.Item) throw new Error(`Organization not found: ${args.orgId}`);

    if (!args.force && existing.Item.aiClassifiedAt) {
        const lastIso = existing.Item.aiClassifiedAt as string;
        const ageDays = (Date.now() - new Date(lastIso).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays < RECLASSIFY_COOLDOWN_DAYS) {
            console.log(JSON.stringify({
                event: 'org.reclassify.cooldown-active',
                orgId: args.orgId,
                ageDays,
            }));
            return existing.Item;
        }
    }

    const result = await classifyOrg({ action: 'classifyOrg', orgId: args.orgId });
    return result;
}

/**
 * Merge `sourceOrgId` into `targetOrgId`. (Task 8 / spec R10 restructure)
 *
 * ORDER — archive-FIRST is the linearization point:
 *  1. Validate: distinct orgs, both exist (strong reads), target exactly 'active' (R5 — an
 *     archived target would mint merge chains ending in a dead org).
 *  2. ONE atomic archive TransactWriteItems:
 *       [0] ConditionCheck target status='active'   (competing merges linearize here)
 *       [1] archive source: status='archived', mergedInto, mergedAt, mergePhase='archived',
 *           REMOVE GSI1/GSI3 — conditioned on source status='active'
 *       [2] MERGE_RECON visibility-marker UPSERT (full GSI metadata; scrubs stale probe/ack fields)
 *  3. runRemainingMergePhases: re-point GSI2-linked records + domain lookups (each write fenced on
 *     the EFFECTIVE target being active), then aggregate counts/scores/dates onto the effective
 *     target (its own conditional update doubles as the fence).
 *  4. mergePhase='complete' on the source LAST. 'complete' means the interactive flow finished —
 *     it is NOT a convergence claim (the Task 12 probe owns residual visibility).
 *
 * Resume semantics: source archived into the SAME target with mergePhase='archived' ⇒ RESUME the
 * phases (chained merges re-resolve the target's active successor; `mergedInto` keeps the
 * historical target). mergePhase='complete' — or absent, i.e. archived by the legacy flow whose
 * archive was the LAST step — ⇒ idempotent early-return. A DIFFERENT target throws.
 *
 * WHY THIS IS SAFE with crm-api's generational replays: already-applied replays supersede on their
 * own stamp; not-yet-applied replays are fenced at write time and redirected (or blocked, never
 * falsely completed); archive-first makes the fence airtight and the re-drain catches the
 * fenced-in-flight window. Clock skew never decides a merge outcome (no stamp comparison here) —
 * and merge NEVER touches matchedOrgLinkGeneration / lastLinkGeneration (R10 boundary).
 */
// Minimal view of an Org META item as read during a merge — only the fields read here.
type OrgMetaItem = {
    status?: string;
    mergedInto?: string;
    mergePhase?: string;
    mergedSources?: Set<string> | string[];
    aliasDomains?: string[];
    primaryDomain?: string;
    rfqCount?: number;
    orderCount?: number;
    leadCount?: number;
    totalOrderValueUSD?: number;
    contactCount?: number;
    leadScore?: number;
    firstSeenAt?: string;
    lastActivityAt?: string;
    latestRFQDate?: string;
    latestOrderDate?: string;
    latestLeadDate?: string;
    hasActiveInquiry?: boolean;
    GSI3PK?: string;
};

const MERGE_LAG_HORIZON_MS = 15 * 60 * 1000; // Task 12 probe never inspects markers younger than this

function orgKey(orgId: string) {
    return { PK: `ORG#${orgId}`, SK: 'META' };
}
function mergeReconKey(fromOrgId: string, toOrgId: string) {
    return { PK: `MERGE_RECON#${fromOrgId}`, SK: `TO#${toOrgId}` };
}

// R5/R6 write fence: element 0 of every phase TransactWriteItems — the effective target must
// still be active for any re-point to land.
function orgActiveCheck(orgId: string) {
    return {
        ConditionCheck: {
            TableName: TABLE(),
            Key: orgKey(orgId),
            ConditionExpression: '#s = :active',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':active': 'active' },
        },
    };
}

// POSITIONAL cancellation mapping (never `.some(...)`, never guess on a missing array).
type MergeCancellation = 'target_fence' | 'write_condition' | 'other';
function classifyMergeCancellation(err: unknown, writeIndex: number): MergeCancellation {
    const e = err as { name?: string; CancellationReasons?: Array<{ Code?: string }> };
    if (e?.name !== 'TransactionCanceledException' || !Array.isArray(e.CancellationReasons)) return 'other';
    if (e.CancellationReasons[0]?.Code === 'ConditionalCheckFailed') return 'target_fence';
    if (e.CancellationReasons[writeIndex]?.Code === 'ConditionalCheckFailed') return 'write_condition';
    return 'other';
}

class MergeFenceLostError extends Error {
    constructor(orgId: string) {
        super(`effective merge target ${orgId} is no longer active`);
        this.name = 'MergeFenceLostError';
    }
}

// DocumentClient materializes a DynamoDB String Set as a JS Set; be tolerant of arrays too.
function mergedSourcesContains(mergedSources: Set<string> | string[] | undefined, orgId: string): boolean {
    if (mergedSources instanceof Set) return mergedSources.has(orgId);
    if (Array.isArray(mergedSources)) return mergedSources.includes(orgId);
    return false;
}

async function readOrgMeta(orgId: string): Promise<(OrgMetaItem & Record<string, unknown>) | undefined> {
    const res = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: orgKey(orgId),
        ConsistentRead: true,
    }));
    return res.Item as (OrgMetaItem & Record<string, unknown>) | undefined;
}

// Canonical-successor resolution (same semantics as crm-api's resolveEffectiveTarget, spec R10):
// strong reads; ONLY exact 'active' applies; successors followed ONLY from exact 'archived' via
// `mergedInto`; depth ≤5 with a visited-set; anything else is structural unavailability.
type EffectiveTargetOrg = { status: 'active'; orgId: string } | { status: 'unavailable'; reason: string };
async function resolveEffectiveTargetOrg(requestedOrgId: string): Promise<EffectiveTargetOrg> {
    const visited = new Set<string>();
    let cur = requestedOrgId;
    for (let hop = 0; hop <= 5; hop++) {
        if (visited.has(cur)) return { status: 'unavailable', reason: `merge-chain cycle at ${cur}` };
        visited.add(cur);
        const org = await readOrgMeta(cur);
        if (!org) return { status: 'unavailable', reason: `org ${cur} not found` };
        if (org.status === 'active') return { status: 'active', orgId: cur };
        if (org.status !== 'archived') return { status: 'unavailable', reason: `org ${cur} has non-navigable status '${String(org.status)}'` };
        if (!org.mergedInto) return { status: 'unavailable', reason: `org ${cur} archived without successor` };
        cur = org.mergedInto;
    }
    return { status: 'unavailable', reason: 'merge-chain depth limit (5) exceeded' };
}

async function mergeOrganization(
    args: { sourceOrgId: string; targetOrgId: string },
    identity: string,
) {
    const { sourceOrgId, targetOrgId } = args;
    if (sourceOrgId === targetOrgId) {
        throw new Error('Cannot merge an Org into itself');
    }

    const [source, target] = await Promise.all([readOrgMeta(sourceOrgId), readOrgMeta(targetOrgId)]);
    if (!source) throw new Error(`Organization not found: ${sourceOrgId}`);
    if (!target) throw new Error(`Organization not found: ${targetOrgId}`);

    // Idempotency / resume detection (R10-final-gate)
    if (source.status === 'archived' && source.mergedInto) {
        if (source.mergedInto !== targetOrgId) {
            throw new Error(
                `Source Org ${sourceOrgId} is already merged into ${source.mergedInto}, cannot re-merge into ${targetOrgId}`,
            );
        }
        if (source.mergePhase === 'archived') {
            // Crash-after-archive: RESUME the remaining phases (chained merges re-resolve the successor).
            return resumeMerge(sourceOrgId, targetOrgId, identity);
        }
        // mergePhase === 'complete', or absent: the legacy flow archived LAST, so an archived
        // legacy source means every phase already ran — pinned idempotent early-return.
        console.log(JSON.stringify({
            event: 'org.merge.idempotent-noop',
            sourceOrgId,
            targetOrgId,
            changedBy: identity,
        }));
        return target;
    }

    // R5: reject non-active merge TARGETS up front (strong read above) — an archived target would
    // mint chains ending in a dead org; merge into its active successor instead.
    if (target.status !== 'active') {
        throw new Error(`Target Org ${targetOrgId} is not active (status '${String(target.status)}') — merge into its active successor instead`);
    }
    if (source.status !== 'active') {
        throw new Error(`Source Org ${sourceOrgId} is not active (status '${String(source.status)}'), cannot merge`);
    }

    // ONE atomic archive transaction (R7 blockers 1+3 — the linearization point).
    const nowIso = new Date().toISOString();
    const lagHorizonIso = new Date(Date.now() + MERGE_LAG_HORIZON_MS).toISOString();
    try {
        await ddb.send(new TransactWriteCommand({ TransactItems: [
            orgActiveCheck(targetOrgId),
            { Update: {
                TableName: TABLE(),
                Key: orgKey(sourceOrgId),
                // Production archive expression EXTENDED (R8 blocker 2): retains mergedAt/updatedAt
                // and the active/score index REMOVEs; adds mergePhase; now conditioned on the EXACT
                // source state so competing merges linearize here.
                UpdateExpression: 'SET #st = :archived, mergedInto = :target, mergedAt = :now, updatedAt = :now, mergePhase = :ph REMOVE GSI1PK, GSI1SK, GSI3PK, GSI3SK',
                ConditionExpression: '#st = :active',
                ExpressionAttributeNames: { '#st': 'status' },
                ExpressionAttributeValues: {
                    ':archived': 'archived',
                    ':target': targetOrgId,
                    ':now': nowIso,
                    ':ph': 'archived',
                    ':active': 'active',
                },
            } },
            { Update: {
                // UPSERT visibility marker — no Put collision can cancel the transaction; an upsert
                // implicitly supersedes a prior pair's marker. R8 blocker 1: full index metadata so
                // the Task 12 probe can discover it; R9: scrub stale probe/ack metadata on re-merge.
                TableName: TABLE(),
                Key: mergeReconKey(sourceOrgId, targetOrgId),
                UpdateExpression: 'SET #ms = :probe, GSI1PK = :gpk, GSI1SK = :gsk, entityType = :et, fromOrgId = :from, toOrgId = :to2, mergedAt = :now, residualsDetected = :null, residualSamples = :empty, lagHorizonAt = :horizon, updatedAt = :now, createdAt = if_not_exists(createdAt, :now), version = if_not_exists(version, :zero) + :one REMOVE probedAt, acknowledgedBy, acknowledgedAt',
                ExpressionAttributeNames: { '#ms': 'state' },
                ExpressionAttributeValues: {
                    ':probe': 'pending_probe',
                    ':gpk': 'MERGE_RECON#pending_probe',
                    ':gsk': nowIso,
                    ':et': 'MERGE_RECON',
                    ':from': sourceOrgId,
                    ':to2': targetOrgId,
                    ':now': nowIso,
                    ':null': null,
                    ':empty': [],
                    ':horizon': lagHorizonIso,
                    ':zero': 0,
                    ':one': 1,
                },
            } },
        ] }));
    } catch (err) {
        return handleArchiveCancellation(err, sourceOrgId, targetOrgId, identity);
    }

    const targetAttrs = await runPhasesWithFenceRetry(sourceOrgId, targetOrgId, targetOrgId);
    await setMergeComplete(sourceOrgId);
    console.log(JSON.stringify({
        event: 'org.merge',
        sourceOrgId,
        targetOrgId,
        changedBy: identity,
    }));
    return targetAttrs;
}

// Positional cancellation outcomes for the archive transaction (R9 critical — chained merge during
// resume). Index 0 = target fence; index 1 = the source archive's own condition; index 2 (marker
// upsert) is unconditioned and cannot fail conditionally.
async function handleArchiveCancellation(err: unknown, sourceOrgId: string, targetOrgId: string, identity: string) {
    const e = err as { name?: string; CancellationReasons?: Array<{ Code?: string }> };
    if (e?.name !== 'TransactionCanceledException' || !Array.isArray(e.CancellationReasons)) throw err;

    if (e.CancellationReasons[0]?.Code === 'ConditionalCheckFailed') {
        // Target not active — READ THE SOURCE FIRST: if OUR archive already committed on a prior
        // attempt and the target was itself merged away (A→B crashed, then B→C completed), this is
        // a chained RESUME, not a rejection. Only an ACTIVE source makes this a genuine rejection.
        const src = await readOrgMeta(sourceOrgId);
        if (src?.status === 'archived' && src.mergedInto === targetOrgId && src.mergePhase !== 'complete') {
            return resumeMerge(sourceOrgId, targetOrgId, identity);
        }
        if (src?.status === 'archived' && src.mergedInto && src.mergedInto !== targetOrgId) {
            throw new Error(
                `Source Org ${sourceOrgId} is already merged into ${src.mergedInto}, cannot re-merge into ${targetOrgId}`,
            );
        }
        throw new Error(`Target Org ${targetOrgId} is not active — merge into its active successor instead`);
    }

    if (e.CancellationReasons[1]?.Code === 'ConditionalCheckFailed') {
        // Source not active — a competing merge won the linearization race. Read it to decide.
        const src = await readOrgMeta(sourceOrgId);
        if (src?.mergedInto === targetOrgId && src.mergePhase === 'archived') {
            return resumeMerge(sourceOrgId, targetOrgId, identity);   // same-pair competitor archived; finish its phases
        }
        if (src?.mergedInto === targetOrgId) {
            console.log(JSON.stringify({ event: 'org.merge.idempotent-noop', sourceOrgId, targetOrgId, changedBy: identity }));
            return readOrgMeta(targetOrgId);                          // same-pair competitor completed
        }
        throw new Error(
            `Source Org ${sourceOrgId} is already merged into ${String(src?.mergedInto)}, cannot re-merge into ${targetOrgId}`,
        );
    }

    throw err; // malformed/unknown cancellation — propagate, never guessed into an outcome
}

async function resumeMerge(sourceOrgId: string, requestedTargetOrgId: string, identity: string) {
    const eff = await resolveEffectiveTargetOrg(requestedTargetOrgId);
    if (eff.status === 'unavailable') {
        // Source stays incomplete (mergePhase='archived') and visible via its MERGE_RECON marker.
        throw new Error(
            `Cannot resume merge of ${sourceOrgId}: successor of ${requestedTargetOrgId} unavailable (${eff.reason})`,
        );
    }
    const targetAttrs = await runPhasesWithFenceRetry(sourceOrgId, requestedTargetOrgId, eff.orgId);
    await setMergeComplete(sourceOrgId);
    console.log(JSON.stringify({
        event: 'org.merge.resumed',
        sourceOrgId,
        requestedTargetOrgId,
        effectiveTargetOrgId: eff.orgId,   // logs record BOTH when they differ
        changedBy: identity,
    }));
    return targetAttrs;
}

// Fence-loss wrapper: the effective target was itself merged mid-resume (C→D) — re-resolve ONCE
// and re-enter; a SECOND fence loss aborts with a transient error, mergePhase stays 'archived'
// (retryable, visible via the recon marker).
async function runPhasesWithFenceRetry(sourceOrgId: string, requestedTargetOrgId: string, effectiveTargetOrgId: string) {
    try {
        return await runRemainingMergePhases({ sourceOrgId, requestedTargetOrgId, effectiveTargetOrgId });
    } catch (err) {
        if ((err as { name?: string }).name !== 'MergeFenceLostError') throw err;
        const re = await resolveEffectiveTargetOrg(requestedTargetOrgId);
        if (re.status === 'unavailable') {
            throw new Error(
                `Cannot resume merge of ${sourceOrgId}: successor of ${requestedTargetOrgId} unavailable (${re.reason})`,
            );
        }
        try {
            return await runRemainingMergePhases({ sourceOrgId, requestedTargetOrgId, effectiveTargetOrgId: re.orgId });
        } catch (err2) {
            if ((err2 as { name?: string }).name === 'MergeFenceLostError') {
                throw new Error(
                    `Merge of ${sourceOrgId} into ${requestedTargetOrgId}: target fence lost twice (merge storm) — mergePhase stays 'archived', retry later`,
                );
            }
            throw err2;
        }
    }
}

// 'complete' is set on the SOURCE, LAST, only after the phase run finishes.
async function setMergeComplete(sourceOrgId: string) {
    await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: orgKey(sourceOrgId),
        UpdateExpression: 'SET mergePhase = :complete, mergeCompletedAt = :now, updatedAt = :now',
        ConditionExpression: '#st = :archived',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':complete': 'complete', ':now': new Date().toISOString(), ':archived': 'archived' },
    }));
}

// ONE shared resume/phase path (R6 blocker 3, exact contract R10-final-gate). Target usage:
// record re-points + domain re-points + aggregation → effectiveTargetOrgId (fenced); the source
// side needs no dirty-mark (it is legitimately archived; its counts stay as historical truth).
// Positional cancellations: index 0 (fence) ⇒ MergeFenceLostError (caller re-resolves ONCE);
// index 1 (the write's own condition) ⇒ idempotency — already re-pointed — skip and continue.
async function runRemainingMergePhases(
    phaseArgs: { sourceOrgId: string; requestedTargetOrgId: string; effectiveTargetOrgId: string },
): Promise<Record<string, unknown> | undefined> {
    const { sourceOrgId, effectiveTargetOrgId } = phaseArgs;
    // Fresh strong reads: aggregation must land on the org the fenced writes actually target.
    const source = await readOrgMeta(sourceOrgId);
    const target = await readOrgMeta(effectiveTargetOrgId);
    if (!source) throw new Error(`Organization not found: ${sourceOrgId}`);
    if (!target) throw new Error(`Organization not found: ${effectiveTargetOrgId}`);

    // Phase A: re-point all GSI2-linked items (RFQ / ORDER / LEAD) from source to the effective
    // target, rewriting matchedOrgId + GSI2PK + GSI2SK (SK shape depends on PK prefix).
    // R10 boundary: NEVER touches matchedOrgLinkGeneration — stamp semantics live in crm-api.
    const linked = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `ORG#${sourceOrgId}` },
    }));
    const linkedItems = (linked.Items ?? []) as LinkedActivityItem[];

    let itemsMoved = 0;
    for (const item of linkedItems) {
        const pk = (item.PK as string) ?? '';
        // Skip the source META itself (it's keyed by PK=ORG#source, SK=META and uses
        // GSI2PK=`ORG_DOMAIN#${orgId}` not `ORG#${orgId}`, so it won't normally appear
        // here, but guard anyway).
        if (pk === `ORG#${sourceOrgId}` && item.SK === 'META') continue;

        let newGsi2Sk: string;
        if (pk.startsWith('RFQ#')) {
            newGsi2Sk = `RFQ#${item.submittedAt ?? item.createdAt ?? ''}`;
        } else if (pk.startsWith('ORDER#')) {
            newGsi2Sk = `ORDER#${item.quoteDate ?? item.createdAt ?? ''}`;
        } else if (pk.startsWith('LEAD#')) {
            newGsi2Sk = `LEAD#${item.submittedAt ?? item.createdAt ?? ''}`;
        } else {
            // Unknown linked entity — skip rather than corrupt
            console.warn(JSON.stringify({
                event: 'org.merge.unknown-linked-pk',
                sourceOrgId,
                targetOrgId: effectiveTargetOrgId,
                pk,
            }));
            continue;
        }

        try {
            await ddb.send(new TransactWriteCommand({ TransactItems: [
                orgActiveCheck(effectiveTargetOrgId),
                { Update: {
                    TableName: TABLE(),
                    Key: { PK: item.PK, SK: item.SK },
                    UpdateExpression: 'SET matchedOrgId = :target, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                    ConditionExpression: 'GSI2PK = :src',   // still on the source partition ⇒ not yet re-pointed
                    ExpressionAttributeValues: {
                        ':target': effectiveTargetOrgId,
                        ':gsi2pk': `ORG#${effectiveTargetOrgId}`,
                        ':gsi2sk': newGsi2Sk,
                        ':src': `ORG#${sourceOrgId}`,
                    },
                } },
            ] }));
            itemsMoved++;
        } catch (err) {
            const cls = classifyMergeCancellation(err, 1);
            if (cls === 'target_fence') throw new MergeFenceLostError(effectiveTargetOrgId);
            if (cls === 'write_condition') continue;        // already re-pointed on a prior run — idempotent skip
            throw err;
        }
    }

    // Phase B: Re-point ORG_DOMAIN_LOOKUP rows whose orgId == sourceOrgId.
    // ORG_DOMAIN_LOOKUP rows are keyed by PK='ORG_DOMAIN_LOOKUP', SK=`DOMAIN#${domain}`.
    // Their GSI2PK is `ORG_DOMAIN#${domain}` (NOT `ORG#${sourceOrgId}`), so they won't
    // be returned by the GSI2 query above — we need a separate Query on PK.
    const lookupRes = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'orgId = :src',
        ExpressionAttributeValues: {
            ':pk': 'ORG_DOMAIN_LOOKUP',
            ':prefix': 'DOMAIN#',
            ':src': sourceOrgId,
        },
    }));
    for (const lookup of (lookupRes.Items ?? []) as { PK?: string; SK?: string }[]) {
        try {
            await ddb.send(new TransactWriteCommand({ TransactItems: [
                orgActiveCheck(effectiveTargetOrgId),
                { Update: {
                    TableName: TABLE(),
                    Key: { PK: lookup.PK, SK: lookup.SK },
                    UpdateExpression: 'SET orgId = :target',
                    ConditionExpression: 'orgId = :src',
                    ExpressionAttributeValues: { ':target': effectiveTargetOrgId, ':src': sourceOrgId },
                } },
            ] }));
        } catch (err) {
            const cls = classifyMergeCancellation(err, 1);
            if (cls === 'target_fence') throw new MergeFenceLostError(effectiveTargetOrgId);
            if (cls === 'write_condition') continue;        // already re-pointed — idempotent skip
            throw err;
        }
    }

    // Phase C guard (chained resume — review fix): the `mergedSources` idempotency set travels
    // with each target org, NOT with the chain. If the REQUESTED target already absorbed this
    // source (its retained mergedSources contains it), the source's counts already flowed to the
    // successor via the requested target's OWN merge — re-aggregating onto the effective target
    // would double them. Strong-read the archived requested target and skip Phase C in that case.
    if (phaseArgs.requestedTargetOrgId !== effectiveTargetOrgId) {
        const requested = await readOrgMeta(phaseArgs.requestedTargetOrgId);
        if (mergedSourcesContains(requested?.mergedSources, sourceOrgId)) {
            console.log(JSON.stringify({
                event: 'org.merge.aggregation-skipped-already-absorbed',
                sourceOrgId,
                requestedTargetOrgId: phaseArgs.requestedTargetOrgId,
                effectiveTargetOrgId,
                itemsMoved,
            }));
            return target as Record<string, unknown>;
        }
    }

    // Phase C: Aggregate the effective target META.
    // aliasDomains = union(target.aliasDomains, source.aliasDomains, source.primaryDomain)
    const aliasSet = new Set<string>(target.aliasDomains ?? []);
    for (const d of (source.aliasDomains ?? []) as string[]) aliasSet.add(d);
    if (source.primaryDomain) aliasSet.add(source.primaryDomain);
    // Drop the target's own primary domain if it ended up in the union
    if (target.primaryDomain) aliasSet.delete(target.primaryDomain);
    let aliasDomains = Array.from(aliasSet);
    if (aliasDomains.length > ALIAS_DOMAINS_CAP) {
        console.warn(JSON.stringify({
            event: 'org.merge.alias-cap-exceeded',
            sourceOrgId,
            targetOrgId: effectiveTargetOrgId,
            unionSize: aliasDomains.length,
            cap: ALIAS_DOMAINS_CAP,
            dropped: aliasDomains.length - ALIAS_DOMAINS_CAP,
        }));
        aliasDomains = aliasDomains.slice(0, ALIAS_DOMAINS_CAP);
    }

    const newRfqCount = (target.rfqCount ?? 0) + (source.rfqCount ?? 0);
    const newOrderCount = (target.orderCount ?? 0) + (source.orderCount ?? 0);
    const newLeadCount = (target.leadCount ?? 0) + (source.leadCount ?? 0);
    const newTotalOrderValue = (target.totalOrderValueUSD ?? 0) + (source.totalOrderValueUSD ?? 0);
    const newContactCount = (target.contactCount ?? 0) + (source.contactCount ?? 0);
    const oldTargetLeadScore = target.leadScore ?? 0;
    const newLeadScore = oldTargetLeadScore + (source.leadScore ?? 0);

    function minIso(a?: string, b?: string): string | undefined {
        if (!a) return b;
        if (!b) return a;
        return a < b ? a : b;
    }
    function maxIso(a?: string, b?: string): string | undefined {
        if (!a) return b;
        if (!b) return a;
        return a > b ? a : b;
    }
    const newFirstSeenAt = minIso(target.firstSeenAt, source.firstSeenAt) ?? new Date().toISOString();
    const newLastActivityAt = maxIso(target.lastActivityAt, source.lastActivityAt) ?? new Date().toISOString();
    const newLatestRFQDate = maxIso(target.latestRFQDate, source.latestRFQDate);
    const newLatestOrderDate = maxIso(target.latestOrderDate, source.latestOrderDate);
    const newLatestLeadDate = maxIso(target.latestLeadDate, source.latestLeadDate);
    const newHasActiveInquiry = !!(target.hasActiveInquiry || source.hasActiveInquiry);

    const nowIso = new Date().toISOString();
    const setExprs: string[] = [
        'aliasDomains = :aliases',
        'rfqCount = :rfqCount',
        'orderCount = :orderCount',
        'leadCount = :leadCount',
        'totalOrderValueUSD = :totalOrderValue',
        'contactCount = :contactCount',
        'leadScore = :leadScore',
        'firstSeenAt = :firstSeenAt',
        'lastActivityAt = :lastActivityAt',
        'hasActiveInquiry = :hasActiveInquiry',
        'updatedAt = :now',
        // GSI1SK reflects lastActivityAt — rewrite it so the target appears at the right
        // position in admin lists ordered by activity.
        'GSI1SK = :gsi1Sk',
    ];
    const exprValues: Record<string, unknown> = {
        ':aliases': aliasDomains,
        ':rfqCount': newRfqCount,
        ':orderCount': newOrderCount,
        ':leadCount': newLeadCount,
        ':totalOrderValue': newTotalOrderValue,
        ':contactCount': newContactCount,
        ':leadScore': newLeadScore,
        ':firstSeenAt': newFirstSeenAt,
        ':lastActivityAt': newLastActivityAt,
        ':hasActiveInquiry': newHasActiveInquiry,
        ':now': nowIso,
        ':gsi1Sk': `${invertedActivityToken(newLastActivityAt)}#${effectiveTargetOrgId}`,
    };
    if (newLatestRFQDate) { setExprs.push('latestRFQDate = :latestRFQDate'); exprValues[':latestRFQDate'] = newLatestRFQDate; }
    if (newLatestOrderDate) { setExprs.push('latestOrderDate = :latestOrderDate'); exprValues[':latestOrderDate'] = newLatestOrderDate; }
    if (newLatestLeadDate) { setExprs.push('latestLeadDate = :latestLeadDate'); exprValues[':latestLeadDate'] = newLatestLeadDate; }

    // GSI3 (lead score index) threshold re-evaluation.
    // - If now >= threshold: write GSI3PK/SK (overwriting old SK so the position reflects new score).
    // - If now < threshold and target was previously indexed: REMOVE GSI3PK/SK.
    // We always SET if above threshold (idempotent), and REMOVE if below and was indexed.
    let removeGsi3 = false;
    if (newLeadScore >= LEAD_SCORE_THRESHOLD) {
        setExprs.push('GSI3PK = :gsi3pk');
        setExprs.push('GSI3SK = :gsi3sk');
        exprValues[':gsi3pk'] = 'ORG_LEAD_SCORE';
        exprValues[':gsi3sk'] = `${invertedScoreToken(newLeadScore)}#${effectiveTargetOrgId}`;
    } else if (target.GSI3PK) {
        removeGsi3 = true;
    }

    // Retry-safety: re-runs (resume paths) must NOT re-aggregate counts a second time.
    // Strategy: ADD the source orgId to a `mergedSources` String Set on the effective target;
    // condition the whole UpdateItem on the source NOT already being in that set. The same
    // conditional update doubles as this phase's org-active fence (ConditionCheck + Update on the
    // SAME item is not allowed inside one transaction, so the fence lives in the condition).
    exprValues[':srcId'] = sourceOrgId;
    exprValues[':srcSet'] = new Set([sourceOrgId]);
    exprValues[':active'] = 'active';
    const updateExpr = `SET ${setExprs.join(', ')} ADD mergedSources :srcSet${removeGsi3 ? ' REMOVE GSI3PK, GSI3SK' : ''}`;

    let targetAttrs: Record<string, unknown> | undefined;
    try {
        const targetUpdate = await ddb.send(new UpdateCommand({
            TableName: TABLE(),
            Key: orgKey(effectiveTargetOrgId),
            UpdateExpression: updateExpr,
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: exprValues,
            ConditionExpression:
                '#st = :active AND attribute_exists(PK) AND (attribute_not_exists(mergedSources) OR NOT contains(mergedSources, :srcId))',
            ReturnValues: 'ALL_NEW',
        }));
        targetAttrs = targetUpdate.Attributes;
    } catch (err) {
        if ((err as { name?: string } | undefined)?.name !== 'ConditionalCheckFailedException') throw err;
        // Disambiguate: fence loss (target no longer active) vs already-aggregated retry.
        const fresh = await readOrgMeta(effectiveTargetOrgId);
        if (fresh && fresh.status !== 'active') throw new MergeFenceLostError(effectiveTargetOrgId);
        // Target already aggregated this source on a previous (interrupted) run.
        console.warn(JSON.stringify({
            event: 'org.merge.target-already-aggregated',
            sourceOrgId,
            targetOrgId: effectiveTargetOrgId,
        }));
        targetAttrs = fresh;
    }

    console.log(JSON.stringify({
        event: 'org.merge.phases-complete',
        sourceOrgId,
        requestedTargetOrgId: phaseArgs.requestedTargetOrgId,
        effectiveTargetOrgId,
        itemsMoved,
        newLeadScore,
    }));

    return targetAttrs;
}

// Export internals for unit tests
export { dispatchAction, dispatchFieldName, requireAdmin, ddb, TABLE, upsertFromSubmission, classifyOrg, listOrganizations, getOrganization, updateOrganizationStatus, updateOrganizationOwner, reclassifyOrganization, mergeOrganization };
