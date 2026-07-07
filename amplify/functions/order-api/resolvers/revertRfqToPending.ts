import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

export async function revertRfqToPending(event: AppSyncEvent) {
    const { rfqId } = event.arguments as { rfqId: string };

    if (!rfqId) {
        throw new Error('rfqId is required');
    }

    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
    }));

    if (!result.Item) {
        throw new Error(`RFQ not found: ${rfqId}`);
    }

    if (result.Item.status === 'pending') {
        throw new Error('RFQ is already pending.');
    }

    if (result.Item.status === 'converted') {
        throw new Error('Cannot revert a converted RFQ. It already has a linked order.');
    }

    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME(),
        Key: { PK: `RFQ#${rfqId}`, SK: 'META' },
        UpdateExpression: 'SET #s = :pending, GSI1PK = :gsi1, updatedAt = :now REMOVE declineReason',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
            ':pending': 'pending',
            ':gsi1': 'RFQ_STATUS#pending',
            ':now': now,
        },
    }));

    const item = result.Item;
    return {
        rfqId: item.rfqId,
        referenceNumber: item.referenceNumber || null,
        status: 'pending',
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
