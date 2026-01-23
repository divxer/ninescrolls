import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { env } from '$amplify/env/create-checkout-session';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // CORS headers for all responses
  // Note: When using Lambda Proxy Integration, these headers must be returned by the Lambda function
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  } as Record<string, string>;

  // Log event for debugging (remove sensitive data in production)
  console.log('Event received:', {
    method: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path,
    hasBody: !!event.body,
  });

  // Handle CORS preflight
  const method = event.requestContext?.http?.method || event.requestContext?.httpMethod;
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Validate environment variables
    if (!env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY is not configured');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' });

    const body = event.body ? JSON.parse(event.body) : {};
    const { items, customerEmail } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Items are required' }),
      };
    }

    // Convert items to Stripe line items format
    // If items have priceId, use it; otherwise create price_data
    const lineItems = items.map((item: any) => {
      if (item.priceId) {
        return {
          price: item.priceId,
          quantity: item.quantity || 1,
        };
      } else {
        // Create price_data for one-time payment
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: item.image ? [item.image] : undefined,
            },
            unit_amount: Math.round(item.price * 100), // Convert to cents
          },
          quantity: item.quantity || 1,
        };
      }
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/checkout/cancel`,
      customer_email: customerEmail,
      metadata: {
        items: JSON.stringify(items.map((i: any) => ({ id: i.id, name: i.name }))),
      },
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        sessionId: session.id, 
        url: session.url 
      }),
    };
  } catch (e: any) {
    console.error('Error creating checkout session:', e);
    console.error('Error stack:', e?.stack);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: e?.message ?? 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
      }),
    };
  }
};
