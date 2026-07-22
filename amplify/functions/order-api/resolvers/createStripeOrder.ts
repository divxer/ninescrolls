import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateOrderId, generateContactId, generateLogId } from '../lib/idGenerators.js';
import { buildFullOrderResponse, sendSlackNotification } from '../lib/orderHelper.js';
import type { AppSyncEvent } from '../lib/types.js';
import { invokeOrganizationApi } from '../../../lib/organization/invoke-org-api.js';
import { computeOrderScore } from '../../../lib/organization/lead-score.js';
import { emitTimelineEventToCrm } from '../../../lib/crm/invoke-crm-api.js';
import { buildOrderCreatedEmitArgs } from '../../../lib/crm/emit-builders.js';

/**
 * Internal-only resolver: create an admin order from a PAID Stripe checkout
 * session. Deliberately NOT registered in the GraphQL schema — AppSync can
 * never route to it; the only caller is the stripe-webhook Lambda via direct
 * Lambda invoke (IAM).
 *
 * Unlike createOrder (which starts at INQUIRY), a Stripe order is already paid,
 * so it is created directly at PO_RECEIVED with all earlier stage dates set to
 * the payment date. Idempotent per Stripe session: a STRIPE_SESSION#<id> marker
 * item guards against webhook retries; a duplicate call returns the original order.
 */

interface CreateStripeOrderInput {
    stripeSessionId: string;
    paymentIntentId?: string;
    amountTotalCents: number;
    currency?: string;
    customerEmail: string;
    customerName?: string;
    contactFirstName?: string;
    contactLastName?: string;
    contactPhone?: string;
    contactOrganization?: string;
    productName: string;
    quantity?: number;
    shippingAddress?: string;
    notes?: string;
    paidAt?: string;
}

/** Derive a product model from the checkout line description, e.g. "HY-4L - RF …" → "HY-4L" */
function deriveModel(productName: string): string {
    return productName.split(/\s+-\s+|\s+–\s+/)[0].trim() || productName;
}

export async function createStripeOrder(event: AppSyncEvent) {
    const { input: rawInput } = event.arguments as { input: string | CreateStripeOrderInput };
    const input: CreateStripeOrderInput = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;

    if (!input.stripeSessionId || !input.customerEmail || !input.productName || !input.amountTotalCents) {
        throw new Error('stripeSessionId, customerEmail, productName, and amountTotalCents are required');
    }

    const now = new Date().toISOString();
    const paidAt = input.paidAt || now;
    const paidDate = paidAt.slice(0, 10);
    const orderId = generateOrderId();
    const contactId = generateContactId();
    const amountUsd = input.amountTotalCents / 100;
    const currency = (input.currency || 'usd').toUpperCase();
    const normalizedEmail = input.customerEmail.trim().toLowerCase();
    const emailDomain = normalizedEmail.split('@')[1] ?? '';
    const institution = input.contactOrganization?.trim()
        || (emailDomain ? `${emailDomain} (from email domain)` : 'Unknown');
    const contactName = [input.contactFirstName, input.contactLastName].filter(Boolean).join(' ')
        || input.customerName
        || normalizedEmail;

    // 1. Idempotency marker — one admin order per Stripe checkout session.
    try {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME(),
            Item: {
                PK: `STRIPE_SESSION#${input.stripeSessionId}`,
                SK: 'META',
                orderId,
                createdAt: now,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        }));
    } catch (err: unknown) {
        if (err instanceof ConditionalCheckFailedException || (err instanceof Error && err.name === 'ConditionalCheckFailedException')) {
            const existing = await docClient.send(new GetCommand({
                TableName: TABLE_NAME(),
                Key: { PK: `STRIPE_SESSION#${input.stripeSessionId}`, SK: 'META' },
            }));
            const existingOrderId = existing.Item?.orderId as string | undefined;
            if (!existingOrderId) {
                throw new Error(`Stripe session marker exists but has no orderId: ${input.stripeSessionId}`);
            }
            console.log(JSON.stringify({
                event: 'createStripeOrder.duplicate',
                stripeSessionId: input.stripeSessionId,
                orderId: existingOrderId,
            }));
            return buildFullOrderResponse(existingOrderId);
        }
        throw err;
    }

    const notes = [
        `Stripe checkout order — paid in full: $${amountUsd.toFixed(2)} ${currency} on ${paidDate}.`,
        `Stripe session: ${input.stripeSessionId}`,
        input.paymentIntentId ? `Payment intent: ${input.paymentIntentId}` : '',
        input.shippingAddress ? `Shipping address: ${input.shippingAddress}` : '',
        input.notes ? `Customer notes: ${input.notes}` : '',
    ].filter(Boolean).join('\n');

    // 2. ORDER entity — already paid, so it lands directly in PO_RECEIVED with
    // every earlier stage date collapsed onto the payment date.
    const orderItem: Record<string, unknown> = {
        PK: `ORDER#${orderId}`,
        SK: 'META',
        GSI1PK: 'ORDER_STATUS#PO_RECEIVED',
        GSI1SK: `${now}#${orderId}`,
        GSI4PK: `EMAIL#${normalizedEmail}`,
        GSI4SK: `ORDER#${now}`,
        orderId,
        status: 'PO_RECEIVED',
        institution,
        department: '',
        productModel: deriveModel(input.productName),
        productName: input.productName,
        configuration: input.quantity && input.quantity > 1 ? `Qty ${input.quantity}` : '',
        quoteNumber: '',
        quoteAmount: amountUsd,
        quoteDate: paidDate,
        notes,
        matchedOrgId: '',
        createdAt: now,
        updatedAt: now,
        createdBy: 'stripe-webhook',
        createdByEmail: 'stripe-webhook',
        source: 'STRIPE',
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.paymentIntentId || '',
        inquiryDate: paidDate,
        quoteSentDate: paidDate,
        poDate: paidDate,
        feedbackScheduleCreated: false,
        TTL: 0,
    };

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: orderItem,
    }));

    // 3. Primary contact (from the checkout contact form)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `CONTACT#${contactId}`,
            contactId,
            contactName,
            contactEmail: normalizedEmail,
            contactPhone: input.contactPhone || '',
            role: 'OTHER',
            department: '',
            isPrimary: true,
            feedbackInvite: true,
            notes: 'Contact from Stripe checkout form',
        },
    }));

    // 4. ORDER_LOG
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME(),
        Item: {
            PK: `ORDER#${orderId}`,
            SK: `LOG#${now}`,
            id: generateLogId(),
            action: 'ORDER_CREATED',
            fromStatus: null,
            toStatus: 'PO_RECEIVED',
            operator: 'stripe-webhook',
            timestamp: now,
            detail: `Paid Stripe checkout order — ${input.productName} ($${amountUsd.toFixed(2)} ${currency})`,
        },
    }));

    // 5. Slack notification — a paid order deserves a loud ping.
    await sendSlackNotification(
        `:moneybag: PAID Stripe order: [${deriveModel(input.productName)}] $${amountUsd.toFixed(2)} ${currency} — ${contactName} <${normalizedEmail}> (${institution})`,
    );

    // 6. Org upsert + timeline emit — same non-fatal pattern as createOrder.
    let matchedOrgId: string | null = null;
    try {
        const orgResult = await invokeOrganizationApi({
            action: 'upsertFromSubmission',
            source: 'order',
            email: normalizedEmail,
            institution,
            submittedAt: now,
            scoreDelta: computeOrderScore(amountUsd),
            orderValueUSD: amountUsd,
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

    await emitTimelineEventToCrm(buildOrderCreatedEmitArgs(
        { orderId, createdAt: now, productModel: deriveModel(input.productName) },
        { matchedOrgId, email: normalizedEmail },
    ));

    return buildFullOrderResponse(orderId);
}
