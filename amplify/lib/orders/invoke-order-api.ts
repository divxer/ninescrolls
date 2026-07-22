import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({});

const FUNCTION_NAME = () => process.env.ORDER_API_FUNCTION_NAME!;

export interface CreateStripeOrderPayload {
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

/**
 * Synchronously invoke the order-api Lambda's internal `createStripeOrder`
 * resolver via direct Lambda invoke (not AppSync — the field is deliberately
 * absent from the GraphQL schema). Used by stripe-webhook to bridge a PAID
 * checkout session into the admin order system.
 *
 * Throws on FunctionError / invoke failure. The caller (stripe-webhook)
 * SHOULD let that propagate to a 500 so Stripe retries the webhook — the
 * resolver is idempotent per session, so retries are safe.
 */
export async function invokeCreateStripeOrder(payload: CreateStripeOrderPayload): Promise<unknown> {
    const event = {
        fieldName: 'createStripeOrder',
        arguments: { input: payload },
    };
    const res = await lambda.send(new InvokeCommand({
        FunctionName: FUNCTION_NAME(),
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(JSON.stringify(event)),
    }));
    const text = res.Payload ? new TextDecoder().decode(res.Payload) : '';
    const parsed = text ? JSON.parse(text) : null;
    if (res.FunctionError) {
        const message = parsed?.errorMessage ?? res.FunctionError;
        throw new Error(`order-api createStripeOrder error: ${message}`);
    }
    return parsed;
}
