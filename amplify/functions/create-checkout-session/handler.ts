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
    const { items, customerEmail, customerName, contactInformation, shippingAddress, notes, successUrl, cancelUrl } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Items are required' }),
      };
    }

    // Convert items to Stripe line items format
    // If items have priceId, use it; otherwise create price_data
    // Add tax_code for Stripe Tax calculation (txcd_99999999 = General Tangible Goods)
    const lineItems = items.map((item: any) => {
      if (item.priceId) {
        return {
          price: item.priceId,
          quantity: item.quantity || 1,
          tax_code: item.taxCode || 'txcd_99999999', // General Tangible Goods tax code
        };
      } else {
        // Create price_data for one-time payment
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: item.image ? [item.image] : undefined,
              tax_code: item.taxCode || 'txcd_99999999', // General Tangible Goods tax code
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

    // Prepare session parameters
    const sessionParams: any = {
      mode: 'payment',
      line_items: lineItems,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      // Enable Stripe Tax automatic calculation
      automatic_tax: {
        enabled: true,
      },
      metadata: {
        items: JSON.stringify(items.map((i: any) => ({ id: i.id, name: i.name }))),
        notes: notes || '',
        customerName: customerName || '', // Store customer name in metadata
      },
    };

    // Pre-fill billing address, email, name, and phone from form data
    // This allows customer to use shipping address as default billing address
    // Customer can still modify it in Stripe Checkout if needed
    const contactPhone = contactInformation?.phone;
    
    if (shippingAddress && customerEmail) {
      // Use customer_details to pre-fill address, email, name, and phone
      // This will default billing address to shipping address
      sessionParams.customer_details = {
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country,
        },
        email: customerEmail,
        name: customerName || undefined,
        phone: contactPhone || undefined,
      };
    } else if (customerEmail) {
      // If no shipping address, at least pre-fill email, name, and phone
      sessionParams.customer_email = customerEmail;
      if (customerName || contactPhone) {
        sessionParams.customer_details = {
          email: customerEmail,
          name: customerName || undefined,
          phone: contactPhone || undefined,
        };
      }
    }

    // Store complete contact information in metadata
    // This is important because the contact person may differ from the payment person
    if (contactInformation) {
      sessionParams.metadata.contactFirstName = contactInformation.firstName || '';
      sessionParams.metadata.contactLastName = contactInformation.lastName || '';
      sessionParams.metadata.contactEmail = contactInformation.email || '';
      sessionParams.metadata.contactPhone = contactInformation.phone || '';
      if (contactInformation.organization) {
        sessionParams.metadata.contactOrganization = contactInformation.organization;
      }
    }

    // Store shipping address in metadata (user already provided it in the form)
    // For Stripe Tax, we need to collect billing/shipping address
    // Stripe will use this to calculate taxes automatically
    if (shippingAddress) {
      sessionParams.metadata.shippingAddress = JSON.stringify(shippingAddress);
      // Also store individual fields for easier access
      sessionParams.metadata.shippingLine1 = shippingAddress.line1;
      sessionParams.metadata.shippingCity = shippingAddress.city;
      sessionParams.metadata.shippingState = shippingAddress.state;
      sessionParams.metadata.shippingPostalCode = shippingAddress.postal_code;
      sessionParams.metadata.shippingCountry = shippingAddress.country;
    }

    // Stripe Tax requires address collection to calculate taxes
    // Use 'auto' mode: if customer_details.address is provided, it will be pre-filled
    // Customer can still modify the address in Stripe Checkout if needed
    // This provides the best user experience: default to shipping address, but allow modification
    sessionParams.billing_address_collection = 'auto';
    
    // Don't collect shipping address - it's already in metadata
    // Billing address is pre-filled from shipping address via customer_details
    // Stripe Tax will use billing address for tax calculation

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
