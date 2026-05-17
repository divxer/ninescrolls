import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    ACTIVE_TENDER_STATUSES, type TenderStatus,
} from '../../lib/tender-watch/keys';

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
    event: AppSyncResolverEvent<any>,
    _identity: string,
): Promise<unknown> {
    switch (fieldName) {
        case 'listTenders':
            return listTenders(event.arguments);
        case 'getTender':
            return getTender(event.arguments);
        default:
            throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}

interface ListTendersArgs {
    statuses?: string[];
    includeExpired?: boolean;
    countries?: string[];
    categories?: string[];
    minScore?: number;
    postedDateFrom?: string;
    postedDateTo?: string;
    search?: string;
    sortBy?: 'score' | 'postedDate' | 'deadline';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

async function listTenders(args: ListTendersArgs) {
    const statuses = (args.statuses?.length ? args.statuses : [...ACTIVE_TENDER_STATUSES]) as TenderStatus[];
    const limit = args.limit ?? 25;
    const sortBy = args.sortBy ?? 'score';
    const sortDir = args.sortDir ?? 'desc';

    // Fan-out one Query per requested status on GSI1
    const queries = await Promise.all(
        statuses.map((status) =>
            ddb.send(new QueryCommand({
                TableName: TABLE(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `TENDER_STATUS#${status}` },
                Limit: limit * 2,
            })),
        ),
    );
    let items: any[] = queries.flatMap((q) => q.Items ?? []);

    // In-memory filters
    if (!args.includeExpired) {
        items = items.filter((i) => !i.isExpired);
    }
    if (args.countries?.length) {
        items = items.filter((i) => args.countries!.includes(i.country));
    }
    if (typeof args.minScore === 'number') {
        items = items.filter((i) => (i.overallScore ?? 0) >= args.minScore!);
    }
    if (args.postedDateFrom) {
        items = items.filter((i) => (i.postedDate ?? '') >= args.postedDateFrom!);
    }
    if (args.postedDateTo) {
        items = items.filter((i) => (i.postedDate ?? '') <= args.postedDateTo!);
    }
    if (args.search) {
        const needle = args.search.toLowerCase();
        items = items.filter((i) =>
            (i.title ?? '').toLowerCase().includes(needle) ||
            (i.agency ?? '').toLowerCase().includes(needle),
        );
    }
    if (args.categories?.length) {
        // Match against matchedProductCategories (denormalized array on Tender; written by classify-and-store)
        items = items.filter((i) => {
            const cats = (i.matchedProductCategories ?? []) as string[];
            return args.categories!.some((c) => cats.includes(c));
        });
    }

    // Sort
    const cmp = (a: any, b: any) => {
        let av: any; let bv: any;
        if (sortBy === 'score') { av = a.overallScore ?? 0; bv = b.overallScore ?? 0; }
        else if (sortBy === 'postedDate') { av = a.postedDate ?? ''; bv = b.postedDate ?? ''; }
        else if (sortBy === 'deadline') { av = a.deadline ?? '9999-99-99'; bv = b.deadline ?? '9999-99-99'; }
        else { av = 0; bv = 0; }
        const dir = sortDir === 'asc' ? 1 : -1;
        return av < bv ? -dir : av > bv ? dir : 0;
    };
    items.sort(cmp);

    // totalActiveUnfiltered — fire one COUNT query per active status
    const countQueries = await Promise.all(
        ACTIVE_TENDER_STATUSES.map((s) =>
            ddb.send(new QueryCommand({
                TableName: TABLE(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `TENDER_STATUS#${s}` },
                Select: 'COUNT',
            })),
        ),
    );
    const totalActiveUnfiltered = countQueries.reduce((sum, q) => sum + ((q as any).Count ?? 0), 0);

    return {
        items: items.slice(0, limit),
        nextToken: null,  // TODO(phase-d): true pagination — current pass returns first page only
        totalActiveUnfiltered,
    };
}

async function getTender(args: { tenderId: string }) {
    const [metaRes, matchesRes, logRes] = await Promise.all([
        ddb.send(new GetCommand({
            TableName: TABLE(),
            Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
        })),
        ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
            ExpressionAttributeValues: { ':pk': `TENDER#${args.tenderId}`, ':m': 'MATCH#' },
        })),
        ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :l)',
            ExpressionAttributeValues: { ':pk': `TENDER#${args.tenderId}`, ':l': 'LOG#' },
            ScanIndexForward: false,
            Limit: 100,
        })),
    ]);
    if (!metaRes.Item) throw new Error(`Tender not found: ${args.tenderId}`);
    return {
        tender: metaRes.Item,
        matches: (matchesRes.Items ?? []).sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0)),
        log: logRes.Items ?? [],
    };
}

// Export internals for unit tests
export { dispatchFieldName, requireAdmin, ddb, TABLE, listTenders, getTender };
