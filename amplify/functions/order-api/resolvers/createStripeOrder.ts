import { TransactWriteCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { generateOrderId, generateContactId, generateLogId } from '../lib/idGenerators.js';
import { buildOrderResponse, sendSlackNotification } from '../lib/orderHelper.js';
import type { AppSyncEvent, OrderItem, ContactItem } from '../lib/types.js';
import { invokeOrganizationApi } from '../../../lib/organization/invoke-org-api.js';
import { computeOrderScore } from '../../../lib/organization/lead-score.js';
import { emitTimelineEventToCrm, invokeCrmAction } from '../../../lib/crm/invoke-crm-api.js';
import { buildOrderCreatedEmitArgs } from '../../../lib/crm/emit-builders.js';
import { toSend, upsertVisitorBridge } from '../../../lib/crm/visitor-bridge.js';
import { sanitizeVisitorId } from '../../../lib/analytics/visitor-id.js';

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
 *
 * The marker, ORDER META, CONTACT, and LOG rows are written in ONE
 * TransactWriteItems — the marker can never exist without its order (a
 * marker-first partial write would make retries report success for a
 * missing order).
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
    visitorId?: string;
}

/** Derive a product model from the checkout line description, e.g. "HY-4L - RF …" → "HY-4L" */
function deriveModel(productName: string): string {
    return productName.split(/\s+-\s+|\s+–\s+/)[0].trim() || productName;
}

/**
 * VISITOR# identity bridge + retro-resolve — the deterministic link from the
 * anonymous analytics visitor to the paying customer; IP-org attribution
 * (e.g. a Cloudflare relay egress) can never provide it.
 *
 * THROWS on failure (unlike the rfq/lead callers, which must return 200 to a
 * user-facing form): the webhook's 500-→-Stripe-retry loop is this link's
 * persistent retry mechanism, and the duplicate path self-heals on each
 * retry. Idempotent — the bridge upsert no-ops when nothing changes.
 *
 * `alwaysReResolve` (duplicate path): fire reResolveVisitorSessions even when
 * the bridge is unchanged. Covers the bridge-written-but-reResolve-failed
 * crash window, where a retry sees no bridge delta yet the sessions were
 * never resolved. reResolve is an idempotent recompute, and duplicates only
 * occur on Stripe retries/replays, so the extra call is bounded.
 *
 * Deliberately does NOT touch the org score upsert — that is non-idempotent
 * and create-only.
 */
async function linkVisitorToOrder(args: {
    visitorId: string; orderId: string; matchedOrgId: string | null; email: string; now: string;
    alwaysReResolve?: boolean;
}): Promise<void> {
    const bridge = await upsertVisitorBridge(
        toSend(docClient), TABLE_NAME(),
        {
            visitorId: args.visitorId, matchedOrgId: args.matchedOrgId, email: args.email,
            sourceEntityType: 'order', sourceEntityId: args.orderId, now: args.now,
        },
    );
    if (args.alwaysReResolve || bridge.created || bridge.orgUpgraded || bridge.orgChanged) {
        // sync: the default Event invoke swallows dispatch failures AND hides
        // FunctionErrors — either would silently close this link's retry
        // window. Sync + throw keeps the webhook's 500→retry loop honest.
        await invokeCrmAction({ action: 'reResolveVisitorSessions', visitorId: args.visitorId }, { sync: true });
    }
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
    const visitorId = sanitizeVisitorId(input.visitorId);

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
        ...(visitorId ? { visitorId } : {}),
        inquiryDate: paidDate,
        quoteSentDate: paidDate,
        poDate: paidDate,
        feedbackScheduleCreated: false,
        TTL: 0,
    };

    const contactItem = {
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
    };

    const logItem = {
        PK: `ORDER#${orderId}`,
        SK: `LOG#${now}`,
        id: generateLogId(),
        action: 'ORDER_CREATED',
        fromStatus: null,
        toStatus: 'PO_RECEIVED',
        operator: 'stripe-webhook',
        timestamp: now,
        detail: `Paid Stripe checkout order — ${input.productName} ($${amountUsd.toFixed(2)} ${currency})`,
    };

    // 3. Atomic write: idempotency marker + ORDER META + CONTACT + LOG in one
    // transaction. Either the session marker and the complete order exist
    // together, or nothing was written — a retry after any failure re-runs the
    // whole transaction.
    try {
        await docClient.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: TABLE_NAME(),
                        Item: {
                            PK: `STRIPE_SESSION#${input.stripeSessionId}`,
                            SK: 'META',
                            orderId,
                            createdAt: now,
                        },
                        ConditionExpression: 'attribute_not_exists(PK)',
                    },
                },
                { Put: { TableName: TABLE_NAME(), Item: orderItem } },
                { Put: { TableName: TABLE_NAME(), Item: contactItem } },
                { Put: { TableName: TABLE_NAME(), Item: logItem } },
            ],
        }));
    } catch (err: unknown) {
        const name = err instanceof Error ? err.name : '';
        if (name !== 'TransactionCanceledException') {
            throw err;
        }
        // Inspect why the transaction was cancelled. The marker Put is item 0
        // and carries the only ConditionExpression — ConditionalCheckFailed
        // there means another invocation already created this session's order.
        // Any other cancellation (TransactionConflict with an in-flight winner,
        // throttling, …) wrote nothing: rethrow so the webhook 500s and Stripe
        // retries — by then the winner's commit is visible.
        const reasons = (err as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons;
        const markerAlreadyExists = reasons?.[0]?.Code === 'ConditionalCheckFailed';
        if (reasons && !markerAlreadyExists) {
            throw err;
        }
        // Duplicate path — use strongly consistent base-table reads so a
        // concurrent loser can't miss the winner's just-committed records.
        const existing = await docClient.send(new GetCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `STRIPE_SESSION#${input.stripeSessionId}`, SK: 'META' },
            ConsistentRead: true,
        }));
        const existingOrderId = existing.Item?.orderId as string | undefined;
        if (!existingOrderId) {
            // No marker even on a consistent read — the cancellation wasn't a
            // duplicate after all (SDK gave no usable reasons); retry.
            throw err;
        }
        const metaRes = await docClient.send(new GetCommand({
            TableName: TABLE_NAME(),
            Key: { PK: `ORDER#${existingOrderId}`, SK: 'META' },
            ConsistentRead: true,
        }));
        if (!metaRes.Item) {
            // Impossible under the atomic transaction (marker and order commit
            // together) — never report silent success for a missing order.
            throw new Error(`Stripe session marker points to missing order ${existingOrderId} (session ${input.stripeSessionId})`);
        }
        const contactsRes = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `ORDER#${existingOrderId}`,
                ':sk': 'CONTACT#',
            },
            ConsistentRead: true,
        }));
        if (!(metaRes.Item as OrderItem).matchedOrgId) {
            // The original invocation may have died between its transaction
            // commit and the org upsert / CRM emit. Those are deliberately
            // non-fatal (same contract as createOrder) — surface it for
            // reconciliation (scripts/backfill-organizations.ts) instead of
            // re-running here: upsertFromSubmission applies a scoreDelta and
            // is NOT idempotent, so a blind rerun would double-count.
            console.warn(JSON.stringify({
                event: 'createStripeOrder.duplicate_without_org',
                stripeSessionId: input.stripeSessionId,
                orderId: existingOrderId,
            }));
        }
        console.log(JSON.stringify({
            event: 'createStripeOrder.duplicate',
            stripeSessionId: input.stripeSessionId,
            orderId: existingOrderId,
        }));
        // Self-heal the visitor link from the STORED order's identity: if the
        // original invocation died between its transaction commit and the
        // bridge write (or between bridge and reResolve), this retry repairs
        // it — throwing on failure so Stripe keeps retrying. Never re-runs
        // the non-idempotent org score upsert.
        const storedMeta = metaRes.Item as OrderItem;
        const storedContacts = (contactsRes.Items ?? []) as ContactItem[];
        // Identity comes from the stored order, not the retry request. The
        // input visitorId is a fallback ONLY for legacy rows created before
        // META captured visitorId (same Stripe session, so same visitor).
        const healVisitorId = sanitizeVisitorId(storedMeta.visitorId) ?? visitorId;
        const storedEmail = storedContacts.find((c) => c.isPrimary)?.contactEmail
            || storedContacts[0]?.contactEmail
            || normalizedEmail;
        if (healVisitorId) {
            await linkVisitorToOrder({
                visitorId: healVisitorId,
                orderId: existingOrderId,
                matchedOrgId: storedMeta.matchedOrgId || null,
                email: storedEmail,
                now,
                alwaysReResolve: true,
            });
        }
        return buildOrderResponse(storedMeta, storedContacts);
    }

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
            orderItem.matchedOrgId = matchedOrgId;
        }
    } catch (err) {
        console.error(JSON.stringify({
            event: 'order.org_upsert_failed',
            orderId,
            error: err instanceof Error ? err.message : String(err),
        }));
    }

    // 7. CRM timeline emit BEFORE the visitor link: the link below may throw
    // (that's its retry mechanism), and the emit — idempotent via its idInput —
    // must not be starved by it. The helper swallows its own dispatch failures.
    await emitTimelineEventToCrm(buildOrderCreatedEmitArgs(
        { orderId, createdAt: now, productModel: deriveModel(input.productName) },
        { matchedOrgId, email: normalizedEmail },
    ));

    // 8. Deterministic visitor→order link. THROWS on failure → webhook 500 →
    // Stripe retry → duplicate path self-heal (see linkVisitorToOrder).
    if (visitorId) {
        await linkVisitorToOrder({ visitorId, orderId, matchedOrgId: matchedOrgId ?? null, email: normalizedEmail, now });
    }

    // Build the response from the items just written — no re-read, so an
    // eventually consistent GET can never hide our own transaction.
    return buildOrderResponse(orderItem as OrderItem, [contactItem as ContactItem]);
}
