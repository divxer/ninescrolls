import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function getLead(event: AppSyncEvent) {
    const { leadId } = event.arguments as { leadId: string };

    if (!leadId) {
        throw new Error('leadId is required');
    }

    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `LEAD#${leadId}`, SK: 'META' },
    }));

    if (!result.Item) {
        throw new Error(`Lead not found: ${leadId}`);
    }

    const item = result.Item;
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
