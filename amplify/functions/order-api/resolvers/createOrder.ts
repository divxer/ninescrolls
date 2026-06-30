import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateOrderId, generateContactId, generateLogId } from '../lib/idGenerators.js';
import { buildFullOrderResponse, sendSlackNotification } from '../lib/orderHelper.js';
import { getOperatorInfo } from '../lib/types.js';
import type { AppSyncEvent } from '../lib/types.js';
import { invokeOrganizationApi } from '../../../lib/organization/invoke-org-api.js';
import { computeOrderScore } from '../../../lib/organization/lead-score.js';
import { emitTimelineEventToCrm } from '../../../lib/crm/invoke-crm-api.js';
import { buildOrderCreatedEmitArgs } from '../../../lib/crm/emit-builders.js';

interface CreateOrderInput {
    quoteNumber?: string;
    institution: string;
    department?: string;
    productModel: string;
    productName?: string;
    configuration?: string;
    quoteAmount?: number;
    quoteDate?: string;
    quoteValidUntil?: string;
    estimatedDelivery?: string;
    notes?: string;
    primaryContact: {
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        role: string;
        department?: string;
        isPrimary?: boolean;
        feedbackInvite?: boolean;
        notes?: string;
    };
}

export async function createOrder(event: AppSyncEvent) {
    const { input: rawInput } = event.arguments as { input: string | CreateOrderInput };

    const input: CreateOrderInput = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;

    if (!input.institution || !input.productModel || !input.primaryContact) {
        throw new Error('institution, productModel, and primaryContact are required');
    }

    if (!input.primaryContact.contactName || !input.primaryContact.contactEmail || !input.primaryContact.role) {
        throw new Error('primaryContact must have contactName, contactEmail, and role');
    }

    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (input.quoteValidUntil && !ISO_DATE_RE.test(input.quoteValidUntil)) {
        throw new Error('quoteValidUntil must be a YYYY-MM-DD date');
    }
    if (input.quoteDate && !ISO_DATE_RE.test(input.quoteDate)) {
        throw new Error('quoteDate must be a YYYY-MM-DD date');
    }
    if (input.quoteValidUntil && input.quoteDate && input.quoteValidUntil < input.quoteDate) {
        throw new Error('quoteValidUntil cannot be before quoteDate');
    }

    const now = new Date().toISOString();
    const orderId = generateOrderId();
    const contactId = generateContactId();
    const { sub: operatorId, email: operator } = getOperatorInfo(event);

    // Create ORDER entity
    const normalizedEmail = input.primaryContact.contactEmail.trim().toLowerCase();
    const orderItem: Record<string, unknown> = {
        PK: `ORDER#${orderId}`,
        SK: 'META',
        GSI1PK: 'ORDER_STATUS#INQUIRY',
        GSI1SK: `${now}#${orderId}`,
        GSI4PK: `EMAIL#${normalizedEmail}`,
        GSI4SK: `ORDER#${now}`,
        orderId,
        status: 'INQUIRY',
        institution: input.institution,
        department: input.department || '',
        productModel: input.productModel,
        productName: input.productName || '',
        configuration: input.configuration || '',
        quoteNumber: input.quoteNumber || '',
        quoteAmount: input.quoteAmount,
        quoteDate: input.quoteDate || undefined,
        quoteValidUntil: input.quoteValidUntil || undefined,
        estimatedDelivery: input.estimatedDelivery,
        notes: input.notes || '',
        matchedOrgId: '',
        createdAt: now,
        updatedAt: now,
        createdBy: operatorId,
        createdByEmail: operator,
        source: 'MANUAL',
        inquiryDate: now.slice(0, 10),
        feedbackScheduleCreated: false,
        TTL: 0,
    };

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: orderItem,
    }));

    // Create primary contact
    const pc = input.primaryContact;
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `CONTACT#${contactId}`,
            contactId,
            contactName: pc.contactName,
            contactEmail: pc.contactEmail,
            contactPhone: pc.contactPhone || '',
            role: pc.role,
            department: pc.department || '',
            isPrimary: pc.isPrimary !== false,
            feedbackInvite: pc.feedbackInvite !== false,
            notes: pc.notes || '',
        },
    }));

    // Write ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            id: generateLogId(),
            action: 'ORDER_CREATED',
            fromStatus: null,
            toStatus: 'INQUIRY',
            operator,
            timestamp: now,
            detail: `Order created for ${input.institution} — ${input.productModel}`,
        },
    }));

    // Slack notification
    await sendSlackNotification(
        `:new: New Order: [${input.productModel}] ${input.institution} — created by ${operator}`,
    );

    // Upsert customer Organization + backfill matchedOrgId on the order META row.
    // Non-fatal: the manual order is already committed; org-api failures must not
    // fail the create. Emit the order_created timeline event afterwards (fire-and-forget).
    const primaryContactEmail = normalizedEmail || undefined;
    let matchedOrgId: string | null = null;
    if (primaryContactEmail) {
        try {
            const orgResult = await invokeOrganizationApi({
                action: 'upsertFromSubmission',
                source: 'order',
                email: primaryContactEmail,
                institution: input.institution,
                submittedAt: now,
                scoreDelta: computeOrderScore(input.quoteAmount),
                orderValueUSD: input.quoteAmount,
            });
            matchedOrgId = orgResult?.matchedOrgId ?? null;
            if (matchedOrgId) {
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME(),
                    Key: { PK: `ORDER#${orderId}`, SK: 'META' },
                    UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2, GSI2SK = :gsi2sk',
                    ExpressionAttributeValues: {
                        ':id': matchedOrgId,
                        ':gsi2': `ORG#${matchedOrgId}`,
                        ':gsi2sk': `ORDER#${now}`,
                    },
                }));
            }
        } catch (err) {
            console.error(JSON.stringify({
                event: 'order.org_upsert_failed',
                orderId,
                error: err instanceof Error ? err.message : String(err),
            }));
        }
    }

    await emitTimelineEventToCrm(buildOrderCreatedEmitArgs(
        { orderId, createdAt: now, productModel: input.productModel },
        { matchedOrgId, email: primaryContactEmail },
    ));

    return buildFullOrderResponse(orderId);
}
