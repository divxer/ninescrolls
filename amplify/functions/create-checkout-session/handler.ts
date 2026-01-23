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

  // Get HTTP method - try multiple ways
  const method = event.requestContext?.http?.method || 
                 (event as any).httpMethod || 
                 (event.requestContext as any)?.httpMethod;
  
  const isAllowedOrigin = allowedOrigins.includes(requestOrigin);
  
  // Check if this is an OPTIONS preflight request
  // OPTIONS requests have access-control-request-method header
  const hasAccessControlRequestMethod = 
    event.headers?.['access-control-request-method'] !== undefined ||
    event.headers?.['Access-Control-Request-Method'] !== undefined;
  
  // Detect OPTIONS request: method is OPTIONS OR has access-control-request-method header
  const isOptionsRequest = 
    method === 'OPTIONS' || 
    hasAccessControlRequestMethod ||
    (!event.body && !method && requestOrigin); // Fallback: no body, no method, but has origin = likely OPTIONS

  console.log('Event received:', {
    method: method,
    path: event.requestContext?.http?.path,
    hasBody: !!event.body,
    origin: requestOrigin,
    isAllowedOrigin: isAllowedOrigin,
    isOptionsRequest: isOptionsRequest,
    hasAccessControlRequestMethod: hasAccessControlRequestMethod,
    requestContextKeys: Object.keys(event.requestContext || {}),
  });

  // Handle CORS preflight (OPTIONS request) - MUST return 200
  if (isOptionsRequest) {
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
    const { items, customerEmail, customerName, shippingAddress, notes, successUrl, cancelUrl } = body;

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

    // Use successUrl and cancelUrl from request, or fallback to env.APP_URL
    const finalSuccessUrl = successUrl || `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${env.APP_URL}/checkout/cancel`;

    // Prepare customer details
    // Note: customer_details can be set to pre-fill customer information in Stripe Checkout
    const customerDetails: any = {};
    if (customerName) {
      customerDetails.name = customerName;
    }
    if (customerEmail) {
      customerDetails.email = customerEmail;
    }

    // Prepare session parameters
    const sessionParams: any = {
      mode: 'payment',
      line_items: lineItems,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      customer_email: customerEmail,
      metadata: {
        items: JSON.stringify(items.map((i: any) => ({ id: i.id, name: i.name }))),
        notes: notes || '',
        customerName: customerName || '',
      },
    };

    // Add customer details if provided
    // This will pre-fill customer information in Stripe Checkout
    if (customerName || customerEmail) {
      sessionParams.customer_details = customerDetails;
    }

    // Always collect shipping address in Stripe Checkout
    // This ensures shipping address appears in Stripe Dashboard
    sessionParams.shipping_address_collection = {
      allowed_countries: ['US', 'CA'],
    };

    // Store shipping address in metadata if provided
    // This allows us to use it in webhook even if user changes it in Stripe Checkout
    if (shippingAddress) {
      sessionParams.metadata.shippingAddress = JSON.stringify(shippingAddress);
      // Also store individual fields for easier access
      sessionParams.metadata.shippingLine1 = shippingAddress.line1;
      sessionParams.metadata.shippingCity = shippingAddress.city;
      sessionParams.metadata.shippingState = shippingAddress.state;
      sessionParams.metadata.shippingPostalCode = shippingAddress.postal_code;
      sessionParams.metadata.shippingCountry = shippingAddress.country;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

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
