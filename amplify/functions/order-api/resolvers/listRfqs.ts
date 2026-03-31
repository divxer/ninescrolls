import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

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
        // Scan for all RFQs — paginate because Limit caps scanned rows,
        // not filtered results, and the single-table has many non-RFQ items.
        items = [];
        let scanKey = exclusiveStartKey;
        const MAX_SCAN_PAGES = 10; // safety cap
        for (let page = 0; page < MAX_SCAN_PAGES; page++) {
            const result = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME(),
                FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': 'RFQ#',
                    ':sk': 'META',
                },
                ExclusiveStartKey: scanKey,
            }));
            items.push(...(result.Items || []));
            scanKey = result.LastEvaluatedKey;
            if (!scanKey || items.length >= effectiveLimit) break;
        }
        lastEvaluatedKey = scanKey;
        items.sort((a, b) => ((b.submittedAt as string) || '').localeCompare((a.submittedAt as string) || ''));
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
