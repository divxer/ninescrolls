import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

const RFQ_STATUSES = ['pending', 'declined', 'converted'] as const;

export async function listRfqs(event: AppSyncEvent) {
    const { status, limit = 20, nextToken } = event.arguments as {
        status?: string;
        limit?: number;
        nextToken?: string;
    };

    const effectiveLimit = Math.min(Math.max(limit || 20, 1), 100);
    const exclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;

    let items: Record<string, unknown>[];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    if (status) {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': `RFQ_STATUS#${status}` },
            ScanIndexForward: false,
            Limit: effectiveLimit,
            ExclusiveStartKey: exclusiveStartKey,
        }));
        items = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;
    } else {
        // Unfiltered view: every RFQ lives in exactly one of three status
        // partitions on GSI1 (RFQ_STATUS#<status>), each already ordered by
        // submittedAt via GSI1SK. Query all three in parallel, then merge/sort/
        // slice — bounded to 3×limit RFQ rows regardless of table size.
        // allSettled (not all): a transient failure on one partition degrades to
        // the others rather than blanking the whole admin list. nextToken /
        // exclusiveStartKey pagination is intentionally unsupported here — no
        // single cursor spans three independently-paginated partitions.
        const settled = await Promise.allSettled(RFQ_STATUSES.map((rfqStatus) => (
            docClient.send(new QueryCommand({
                TableName: TABLE_NAME(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `RFQ_STATUS#${rfqStatus}` },
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
                    event: 'listRfqs.partition-query-failed',
                    status: RFQ_STATUSES[i],
                    error: String(result.reason),
                }));
            }
        });
        // Every partition failed → surface an error instead of a false "no RFQs".
        if (!anyFulfilled) {
            throw new Error('listRfqs: all RFQ status partition queries failed');
        }

        items = merged;
        items.sort((a, b) => {
            const byDate = ((b.submittedAt as string) || '').localeCompare((a.submittedAt as string) || '');
            if (byDate !== 0) return byDate;
            // Tie-break on rfqId desc so the merged order is total and deterministic,
            // matching the GSI1SK (submittedAt#rfqId) ordering of the filtered path.
            return ((b.rfqId as string) || '').localeCompare((a.rfqId as string) || '');
        });
        items = items.slice(0, effectiveLimit);
    }

    return {
        items: items.map(buildRfqResponse),
        nextToken: lastEvaluatedKey
            ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
            : null,
    };
}

function buildRfqResponse(item: Record<string, unknown>) {
    return {
        rfqId: item.rfqId,
        referenceNumber: item.referenceNumber || null,
        status: item.status,
        submittedAt: item.submittedAt,
        name: item.name || null,
        email: item.email || null,
        phone: item.phone || null,
        institution: item.institution || null,
        department: item.department || null,
        role: item.role || null,
        equipmentCategory: item.equipmentCategory || null,
        specificModel: item.specificModel || null,
        applicationDescription: item.applicationDescription || null,
        keySpecifications: item.keySpecifications || null,
        quantity: item.quantity || null,
        budgetRange: item.budgetRange || null,
        timeline: item.timeline || null,
        fundingStatus: item.fundingStatus || null,
        referralSource: item.referralSource || null,
        existingEquipment: item.existingEquipment || null,
        additionalComments: item.additionalComments || null,
        needsBudgetaryQuote: item.needsBudgetaryQuote || false,
        shippingAddress: item.shippingAddress || null,
        shippingCity: item.shippingCity || null,
        shippingState: item.shippingState || null,
        shippingZipCode: item.shippingZipCode || null,
        shippingCountry: item.shippingCountry || null,
        linkedOrderId: item.linkedOrderId || null,
        attachmentKeys: item.attachmentKeys || null,
    };
}
