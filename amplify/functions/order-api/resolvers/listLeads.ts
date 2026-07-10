import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

// Every lead lives in exactly one of these type partitions on GSI1
// (LEAD_TYPE#<type>). Kept in sync with the submit-lead handler's writes and
// the LeadType union in src/types/admin.ts (backend can't import from src/).
const LEAD_TYPES = ['contact', 'download_gate', 'newsletter'] as const;

export async function listLeads(event: AppSyncEvent) {
    const { type, limit = 50, nextToken } = event.arguments as {
        type?: string;
        limit?: number;
        nextToken?: string;
    };

    const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);

    let items: Record<string, unknown>[];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    if (type) {
        const exclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;
        // Query GSI1 for specific lead type
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': `LEAD_TYPE#${type}` },
            ScanIndexForward: false,
            Limit: effectiveLimit,
            ExclusiveStartKey: exclusiveStartKey,
        }));
        items = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;
    } else {
        // Unfiltered view: every lead lives in exactly one of three type
        // partitions on GSI1 (LEAD_TYPE#<type>), each already ordered by
        // submittedAt via GSI1SK. Query all three in parallel, then merge/sort/
        // slice — bounded to 3×limit lead rows regardless of table size. A raw
        // Scan here returns an arbitrary physical subset (the single-table is
        // dominated by non-lead analytics items), so newly-created leads that
        // fall outside the scanned pages silently vanish from the admin list.
        // allSettled (not all): a transient failure on one partition degrades to
        // the others rather than blanking the whole admin list. nextToken /
        // exclusiveStartKey pagination is intentionally unsupported here — no
        // single cursor spans three independently-paginated partitions.
        const settled = await Promise.allSettled(LEAD_TYPES.map((leadType) => (
            docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `LEAD_TYPE#${leadType}` },
                ScanIndexForward: false,
                Limit: effectiveLimit,
            }))
        )));

        const merged: Record<string, unknown>[] = [];
        let anyFulfilled = false;
        settled.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                anyFulfilled = true;
                merged.push(...((result.value.Items as Record<string, unknown>[]) ?? []));
            } else {
                console.error(JSON.stringify({
                    event: 'listLeads.partition-query-failed',
                    type: LEAD_TYPES[i],
                    error: String(result.reason),
                }));
            }
        });
        // Every partition failed → surface an error instead of a false "no leads".
        if (!anyFulfilled) {
            throw new Error('listLeads: all lead type partition queries failed');
        }

        items = merged;
        items.sort((a, b) => {
            const byDate = ((b.submittedAt as string) || '').localeCompare((a.submittedAt as string) || '');
            if (byDate !== 0) return byDate;
            // Tie-break on leadId desc so the merged order is total and deterministic,
            // matching the GSI1SK (submittedAt#leadId) ordering of the filtered path.
            return ((b.leadId as string) || '').localeCompare((a.leadId as string) || '');
        });
        items = items.slice(0, effectiveLimit);
    }

    return {
        items: items.map(buildLeadResponse),
        nextToken: lastEvaluatedKey
            ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
            : null,
    };
}

function buildLeadResponse(item: Record<string, unknown>) {
    return {
        leadId: item.leadId,
        type: item.type,
        email: item.email,
        submittedAt: item.submittedAt,
        name: item.name || null,
        phone: item.phone || null,
        organization: item.organization || null,
        message: item.message || null,
        productName: item.productName || null,
        inquiryType: item.inquiryType || null,
        topic: item.topic || null,
        researchAreas: item.researchAreas || null,
        jobTitle: item.jobTitle || null,
        intent: item.intent || null,
        fileName: item.fileName || null,
        fileUrl: item.fileUrl || null,
        marketingOptIn: item.marketingOptIn || false,
        source: item.source || null,
        ipHash: item.ipHash || null,
    };
}
