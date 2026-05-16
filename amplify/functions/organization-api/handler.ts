import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
    ScanCommand,
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
        case 'classifyOrg':
            return classifyOrg(event as unknown as ClassifyOrgPayload);
        default:
            throw new Error(`Unknown action: ${event.action}`);
    }
}

async function dispatchFieldName(
    fieldName: string,
    event: AppSyncResolverEvent<any>,
): Promise<unknown> {
    const identity = (event.identity as any)?.username ?? 'unknown';
    switch (fieldName) {
        case 'listOrganizations':
            return listOrganizations(event.arguments);
        case 'getOrganization':
            return getOrganization(event.arguments);
        case 'updateOrganizationStatus':
            return updateOrganizationStatus(event.arguments, identity);
        case 'updateOrganizationOwner':
            return updateOrganizationOwner(event.arguments, identity);
        case 'reclassifyOrganization':
            return reclassifyOrganization(event.arguments);
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
        const text = await (res.body as any).transformToString('utf-8');
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
    const block = res.content[0] as any;
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
    const oldType = (existing.Item as any).type ?? 'unknown';

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

async function listOrganizations(args: ListOrgArgs) {
    const sortBy = args.sortBy ?? 'activity';
    const limit = args.limit ?? 25;
    const types = args.types ?? ORG_TYPES.filter((t) => t !== 'unknown');

    let items: any[] = [];

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
        items = queries.flatMap((q) => q.Items ?? []);
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
        items = r.Items ?? [];
    } else {
        // firstSeen — Scan with filter
        const r = await ddb.send(new ScanCommand({
            TableName: TABLE(),
            FilterExpression: 'entityType = :et',
            ExpressionAttributeValues: { ':et': 'ORGANIZATION' },
        }));
        items = r.Items ?? [];
        items.sort((a, b) => (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? ''));
    }

    // In-memory filters
    if (args.statuses?.length) {
        items = items.filter((i) => args.statuses!.includes(i.status ?? 'active'));
    } else {
        items = items.filter((i) => (i.status ?? 'active') === 'active');
    }
    if (args.countries?.length) {
        items = items.filter((i) => args.countries!.includes(i.country));
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

    const recentRfqs: any[] = [];
    const recentOrders: any[] = [];
    const recentLeads: any[] = [];
    for (const item of (linked.Items ?? [])) {
        const t = item.entityType;
        if (t === 'RFQ_SUBMISSION' && recentRfqs.length < 20) recentRfqs.push(item);
        else if (t === 'ORDER' && recentOrders.length < 20) recentOrders.push(item);
        else if (t === 'LEAD_SUBMISSION' && recentLeads.length < 20) recentLeads.push(item);
    }
    recentRfqs.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
    recentOrders.sort((a, b) => (b.quoteDate ?? '').localeCompare(a.quoteDate ?? ''));
    recentLeads.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

    return {
        organization: meta.Item,
        recentRfqs,
        recentOrders,
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

// Export internals for unit tests
export { dispatchAction, dispatchFieldName, requireAdmin, ddb, TABLE, upsertFromSubmission, classifyOrg, listOrganizations, getOrganization, updateOrganizationStatus, updateOrganizationOwner, reclassifyOrganization };
