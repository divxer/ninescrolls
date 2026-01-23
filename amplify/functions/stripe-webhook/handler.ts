import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { env } from '$amplify/env/stripe-webhook';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' });

  // Get raw body for signature verification
  // API Gateway v2 may base64 encode the body
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf8');

  // Get Stripe signature from headers
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  if (!sig) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing stripe-signature header' }),
    };
  }

  let stripeEvent: Stripe.Event;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Webhook signature verification failed',
        message: err.message 
      }),
    };
  }

  // Handle different event types
  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', {
        sessionId: session.id,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      });

      // TODO: Implement your business logic here:
      // 1. Send order confirmation email
      // 2. Update order status in database
      // 3. Trigger fulfillment process
      // 4. Send notification to sales team
      
      // Example: Send email notification
      // You can use your existing sendEmail function or call an external API
      // await sendOrderConfirmation(session);

    } else if (stripeEvent.type === 'payment_intent.succeeded') {
      const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } else {
      console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error processing webhook', message: err.message }),
    };
  }
};
