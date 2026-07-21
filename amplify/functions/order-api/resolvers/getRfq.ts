import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import type { AppSyncEvent } from '../lib/types.js';

function mapAttribution(a: any) {
  if (!a) return null;
  return {
    source: a.source || null,
    medium: a.medium || null,
    campaign: a.campaign || null,
    term: a.term || null,
    content: a.content || null,
    gclid: a.gclid || null,
    gbraid: a.gbraid || null,
    wbraid: a.wbraid || null,
    msclkid: a.msclkid || null,
    capturedAt: a.capturedAt || null,
    landingPath: a.landingPath || null,
  };
}

export async function getRfq(event: AppSyncEvent) {
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

    const item = result.Item;
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
        visitorId: item.visitorId || null,
        attribution: mapAttribution(item.attribution),
    };
}
