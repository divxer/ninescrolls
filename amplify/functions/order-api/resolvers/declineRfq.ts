import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function declineRfq(event: AppSyncEvent) {
    const { rfqId, reason } = event.arguments as {
        rfqId: string;
        reason?: string;
    };

    if (!rfqId) {
        throw new Error('rfqId is required');
    }

    // Fetch RFQ
    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
    }));

    if (!result.Item) {
        throw new Error(`RFQ not found: ${rfqId}`);
    }

    if (result.Item.status !== 'pending') {
        throw new Error(`RFQ is already ${result.Item.status}. Only pending RFQs can be declined.`);
    }

    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
        UpdateExpression: 'SET #s = :declined, GSI1PK = :gsi1, updatedAt = :now, declineReason = :reason',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
            ':declined': 'declined',
            ':gsi1': 'RFQ_STATUS#declined',
            ':now': now,
            ':reason': reason || '',
        },
    }));

    const item = result.Item;
    return {
        rfqId: item.rfqId,
        referenceNumber: item.referenceNumber || null,
        status: 'declined',
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
        linkedOrderId: item.linkedOrderId || null,
        attachmentKeys: item.attachmentKeys || null,
    };
}
