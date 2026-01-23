import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { env } from '$amplify/env/create-checkout-session';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Allowed origins for CORS (production domains)
  // Only allow requests from your official website domains
  const allowedOrigins = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
    'https://ninescrolls.us', // Legacy domain
    'https://www.ninescrolls.us', // Legacy domain
  ];

  // Helper function to get CORS headers
  const getCorsHeaders = (origin: string): Record<string, string> => {
    const isAllowedOrigin = allowedOrigins.includes(origin);
    return {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
      'Access-Control-Allow-Credentials': 'false',
    };
  };

  // Get the origin from the request
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const corsHeaders = getCorsHeaders(requestOrigin);

  // Log event for debugging (remove sensitive data in production)
  const method = event.requestContext?.http?.method;
  const isAllowedOrigin = allowedOrigins.includes(requestOrigin);
  console.log('Event received:', {
    method: method,
    path: event.requestContext?.http?.path,
    hasBody: !!event.body,
    origin: requestOrigin,
    isAllowedOrigin: isAllowedOrigin,
  });

  // Handle CORS preflight (OPTIONS request)
  // API Gateway v2 uses event.requestContext.http.method
  // Also check if it's an OPTIONS request by checking the method directly
  if (method === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight successful' }),
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
