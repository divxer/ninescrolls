import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { buildOrderResponse } from '../lib/orderHelper.js';
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

export async function listOrders(event: AppSyncEvent) {
    const { status, search, limit = 50, nextToken } = event.arguments as {
        status?: string;
        search?: string;
        limit?: number;
        nextToken?: string;
    };

    const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
    const exclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
    const searchTerm = search?.trim() || undefined;

    let items: Record<string, unknown>[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    if (status) {
        // GSI1 query for specific status, paginate until we fill the page or exhaust the bucket.
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
        lastEvaluatedKey = queryKey;
        items = items.slice(0, effectiveLimit);
    } else {
        // Scan all order metadata rows; FilterExpression caps scanned rows, not filtered results,
        // and the single-table has many non-order items, so paginate.
        let scanKey = exclusiveStartKey;
        const allOrders: Record<string, unknown>[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME(),
                FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': 'ORDER#',
                    ':sk': 'META',
                },
                ExclusiveStartKey: scanKey,
            }));
            const pageItems: Record<string, unknown>[] = result.Items || [];
            const filtered = searchTerm ? pageItems.filter((it) => matchesSearch(it, searchTerm)) : pageItems;
            allOrders.push(...filtered);
            scanKey = result.LastEvaluatedKey;
            if (!scanKey || allOrders.length >= effectiveLimit) break;
        }
        lastEvaluatedKey = scanKey;
        // Sort by updatedAt descending.
        allOrders.sort((a, b) => ((b.updatedAt as string) || '').localeCompare((a.updatedAt as string) || ''));
        items = allOrders.slice(0, effectiveLimit);
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
        nextToken: lastEvaluatedKey
            ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
            : null,
    };
}
