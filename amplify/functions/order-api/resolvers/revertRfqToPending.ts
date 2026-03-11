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

    const updated = { ...result.Item, status: 'pending', updatedAt: now, declineReason: undefined };
    return {
        rfqId: updated.rfqId,
        referenceNumber: updated.referenceNumber || null,
        status: updated.status,
        submittedAt: updated.submittedAt,
        name: updated.name || null,
        email: updated.email || null,
        phone: updated.phone || null,
        institution: updated.institution || null,
        department: updated.department || null,
        role: updated.role || null,
        equipmentCategory: updated.equipmentCategory || null,
        specificModel: updated.specificModel || null,
        applicationDescription: updated.applicationDescription || null,
        keySpecifications: updated.keySpecifications || null,
        quantity: updated.quantity || null,
        budgetRange: updated.budgetRange || null,
        timeline: updated.timeline || null,
        fundingStatus: updated.fundingStatus || null,
        referralSource: updated.referralSource || null,
        existingEquipment: updated.existingEquipment || null,
        additionalComments: updated.additionalComments || null,
        linkedOrderId: updated.linkedOrderId || null,
        attachmentKeys: updated.attachmentKeys || null,
    };
}
