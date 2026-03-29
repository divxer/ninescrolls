import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function listLeads(event: AppSyncEvent) {
    const { type, limit = 50, nextToken } = event.arguments as {
        type?: string;
        limit?: number;
        nextToken?: string;
    };

    const effectiveLimit = Math.min(Math.max(limit || 50, 1), 200);
    const exclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined;

    let items: Record<string, unknown>[];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    if (type) {
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
        // Scan for all leads
        const result = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME(),
            FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
            ExpressionAttributeValues: {
                ':pk': 'LEAD#',
                ':sk': 'META',
            },
            Limit: effectiveLimit * 3,
            ExclusiveStartKey: exclusiveStartKey,
        }));
        items = result.Items || [];
        lastEvaluatedKey = result.LastEvaluatedKey;
        items.sort((a, b) => ((b.submittedAt as string) || '').localeCompare((a.submittedAt as string) || ''));
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
