import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildOrderResponse } from '../lib/orderHelper.js';
import { ORDER_STATUSES } from '../lib/types.js';
import type { AppSyncEvent, OrderItem, ContactItem } from '../lib/types.js';

const SEARCH_FIELDS = ['quoteNumber', 'poNumber', 'institution', 'productModel', 'productName'] as const;
const MAX_PAGES = 20;

function matchesSearch(item: Record<string, unknown>, needle: string): boolean {
    const q = needle.toLowerCase();
    for (const f of SEARCH_FIELDS) {
        const v = item[f];
        if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
    }
    return false;
}

// Compare GSI1SK (createdAt#orderId) descending using plain string order — NOT
// localeCompare. GSI1SK is ASCII, so JS `<`/`>` matches DynamoDB's binary string
// ordering, which is what the `GSI1SK < :w` watermark condition uses. Keeping the
// in-memory merge sort byte-consistent with DynamoDB is what makes the composite
// cursor skip- and duplicate-free.
function byGsi1skDesc(a: Record<string, unknown>, b: Record<string, unknown>): number {
    const av = (a.GSI1SK as string) || '';
    const bv = (b.GSI1SK as string) || '';
    return av < bv ? 1 : av > bv ? -1 : 0;
}

/**
 * Unfiltered, no search — merge all status partitions on GSI1 below a global
 * watermark. Every order lives in exactly one ORDER_STATUS#<status> partition,
 * each ordered by GSI1SK (createdAt#orderId). Because GSI1SK is globally unique
 * and totally ordered, the merged stream paginates on a single watermark (the
 * GSI1SK of the last row returned), not on per-partition LastEvaluatedKeys:
 * query each partition for `GSI1SK < :w` (newest-first, Limit=pageLimit), merge,
 * sort, slice. Rows fetched but sliced off are all < the watermark, so they are
 * simply re-fetched and returned on the next page — no overflow buffer needed.
 */
async function mergeStatusPartitions(watermark: string | undefined, pageLimit: number) {
    const settled = await Promise.allSettled(ORDER_STATUSES.map((status) => {
        const values: Record<string, string> = { ':pk': `ORDER_STATUS#${status}` };
        let keyCondition = 'GSI1PK = :pk';
        if (watermark) {
            keyCondition += ' AND GSI1SK < :w';
            values[':w'] = watermark;
        }
        return docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI1',
            KeyConditionExpression: keyCondition,
            ExpressionAttributeValues: values,
            ScanIndexForward: false,
            Limit: pageLimit,
        }));
    }));

    const merged: Record<string, unknown>[] = [];
    let truncated = false;
    settled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            merged.push(...((result.value.Items as Record<string, unknown>[]) ?? []));
            if (result.value.LastEvaluatedKey) truncated = true;
        } else {
            console.error(JSON.stringify({
                event: 'listOrders.partition-query-failed',
                status: ORDER_STATUSES[i],
                error: String(result.reason),
            }));
            throw new Error(`listOrders: order status partition query failed (${ORDER_STATUSES[i]})`);
        }
    });
    return { merged, truncated };
}

/**
 * Unfiltered, with search (B1) — exhaust every status partition (paginate each
 * to its end), filter in memory, so an older matching order can never
 * be hidden behind a newest-N window. Bounded by order count, not table size.
 * Returns the newest `limit` matches; deeper matches require a narrower term.
 */
async function searchAllStatusPartitions(searchTerm: string) {
    const settled = await Promise.allSettled(ORDER_STATUSES.map(async (status) => {
        const out: Record<string, unknown>[] = [];
        let startKey: Record<string, unknown> | undefined;
        do {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
                ScanIndexForward: false,
                ExclusiveStartKey: startKey,
            }));
            out.push(...((result.Items as Record<string, unknown>[]) ?? []).filter((it) => matchesSearch(it, searchTerm)));
            startKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
        } while (startKey);
        return out;
    }));

    const merged: Record<string, unknown>[] = [];
    settled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            merged.push(...result.value);
        } else {
            console.error(JSON.stringify({
                event: 'listOrders.search-partition-query-failed',
                status: ORDER_STATUSES[i],
                error: String(result.reason),
            }));
            throw new Error(`listOrders: order status partition search query failed (${ORDER_STATUSES[i]})`);
        }
    });
    return merged;
}

export async function listOrders(event: AppSyncEvent) {
    const { status, search, limit = 50, nextToken } = event.arguments as {
        status?: string;
        search?: string;
        limit?: number;
        nextToken?: string;
    };

    const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
    const searchTerm = search?.trim() || undefined;

    let items: Record<string, unknown>[] = [];
    let nextTokenOut: string | null = null;

    if (status) {
        // Typed path: GSI1 query for one status, paginate until we fill the page or
        // exhaust the bucket. nextToken is the DynamoDB LastEvaluatedKey. Unchanged.
        const exclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
        let queryKey = exclusiveStartKey;
        for (let page = 0; page < MAX_PAGES; page++) {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `ORDER_STATUS#${status}` },
                ScanIndexForward: false,
                ExclusiveStartKey: queryKey,
            }));
            const pageItems: Record<string, unknown>[] = result.Items || [];
            const filtered = searchTerm ? pageItems.filter((it) => matchesSearch(it, searchTerm)) : pageItems;
            items.push(...filtered);
            queryKey = result.LastEvaluatedKey;
            if (!queryKey || items.length >= effectiveLimit) break;
        }
        items = items.slice(0, effectiveLimit);
        nextTokenOut = queryKey ? Buffer.from(JSON.stringify(queryKey)).toString('base64') : null;
    } else if (searchTerm) {
        // Unfiltered search (B1): examine every order, filter, newest-first.
        items = (await searchAllStatusPartitions(searchTerm)).sort(byGsi1skDesc).slice(0, effectiveLimit);
        nextTokenOut = null;
    } else {
        // Unfiltered, no search (A1): watermark merge across status partitions.
        const watermark = nextToken
            ? (JSON.parse(Buffer.from(nextToken, 'base64').toString()) as { w?: string }).w
            : undefined;
        const { merged, truncated } = await mergeStatusPartitions(watermark, effectiveLimit);
        const sorted = merged.sort(byGsi1skDesc);
        items = sorted.slice(0, effectiveLimit);
        const hasMore = sorted.length > effectiveLimit || truncated;
        nextTokenOut = hasMore && items.length > 0
            ? Buffer.from(JSON.stringify({ w: items[items.length - 1].GSI1SK })).toString('base64')
            : null;
    }

    // Fetch contacts for each order
    const orders = await Promise.all(
        items.map(async (item) => {
            const orderId = item.orderId as string;
            const contactResult = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `ORDER#${orderId}`,
                    ':sk': 'CONTACT#',
                },
            }));
            return buildOrderResponse(item as OrderItem, (contactResult.Items || []) as ContactItem[]);
        }),
    );

    return {
        items: orders,
        nextToken: nextTokenOut,
    };
}
