import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { env } from '$amplify/env/create-checkout-session';

type CheckoutItemInput = {
  id?: string;
  name: string;
  price: number;
  quantity?: number;
  image?: string;
  priceId?: string;
  taxCode?: string;
};

type ContactInformation = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organization?: string;
};

type ShippingAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

type CheckoutRequestBody = {
  items: CheckoutItemInput[];
  customerEmail?: string;
  customerName?: string;
  contactInformation?: ContactInformation;
  shippingAddress?: ShippingAddressInput;
  notes?: string;
  successUrl?: string;
  cancelUrl?: string;
};

type LegacyHttpEvent = { httpMethod?: string };

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
  const legacyEvent = event as LegacyHttpEvent;
  const method = event.requestContext?.http?.method || legacyEvent.httpMethod;
  
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

    const body = event.body ? (JSON.parse(event.body) as Partial<CheckoutRequestBody>) : {};
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
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => {
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

    // Create or update Stripe Customer with address information
    // This allows Stripe Tax to use the address for automatic tax calculation
    // without requiring the customer to enter it again in Checkout
    let customerId: string | undefined;
    
    if (customerEmail) {
      try {
        // Search for existing customer by email
        const existingCustomers = await stripe.customers.list({
          email: customerEmail,
          limit: 1,
        });

        if (existingCustomers.data.length > 0) {
          // Update existing customer with address
          const customer = existingCustomers.data[0];
          const updateData: Stripe.CustomerUpdateParams = {
            email: customerEmail,
            name: customerName || undefined,
            phone: contactInformation?.phone || undefined,
          };

          const shippingName = customerName || contactInformation?.firstName || 'Customer';

          // Add billing address if shipping address is provided
          if (shippingAddress) {
            updateData.address = {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2 || undefined,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postal_code,
              country: shippingAddress.country,
            };
            // Also set shipping address
            updateData.shipping = {
              address: {
                line1: shippingAddress.line1,
                line2: shippingAddress.line2 || undefined,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postal_code: shippingAddress.postal_code,
                country: shippingAddress.country,
              },
              name: shippingName,
              phone: contactInformation?.phone || undefined,
            };
          }

          const updatedCustomer = await stripe.customers.update(customer.id, updateData);
          customerId = updatedCustomer.id;
        } else {
          // Create new customer with address
          const createData: Stripe.CustomerCreateParams = {
            email: customerEmail,
            name: customerName || undefined,
            phone: contactInformation?.phone || undefined,
          };

          const shippingName = customerName || contactInformation?.firstName || 'Customer';

          // Add billing address if shipping address is provided
          if (shippingAddress) {
            createData.address = {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2 || undefined,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postal_code,
              country: shippingAddress.country,
            };
            // Also set shipping address
            createData.shipping = {
              address: {
                line1: shippingAddress.line1,
                line2: shippingAddress.line2 || undefined,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postal_code: shippingAddress.postal_code,
                country: shippingAddress.country,
              },
              name: shippingName,
              phone: contactInformation?.phone || undefined,
            };
          }

          const newCustomer = await stripe.customers.create(createData);
          customerId = newCustomer.id;
        }
      } catch (customerError: unknown) {
        console.error('Error creating/updating customer:', customerError);
        // Continue without customer - Checkout will still work, just won't pre-fill address
      }
    }

    // Prepare session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      // Enable Stripe Tax automatic calculation
      automatic_tax: {
        enabled: true,
      },
      metadata: {
        items: JSON.stringify(items.map((i) => ({ id: i.id, name: i.name }))),
        notes: notes || '',
        customerName: customerName || '', // Store customer name in metadata
      },
    };

    // Use customer ID if available, otherwise use customer_email
    if (customerId) {
      // Use customer ID - Stripe will use customer's saved address for tax calculation
      sessionParams.customer = customerId;
      // Use 'auto' mode - Stripe will use customer's saved address if available
      sessionParams.billing_address_collection = 'auto';
    } else if (customerEmail) {
      // Fallback to customer_email if customer creation failed
      sessionParams.customer_email = customerEmail;
      // Still require address collection for tax calculation
      sessionParams.billing_address_collection = 'required';
    }

    // Store complete contact information in metadata
    // This is important because the contact person may differ from the payment person
    if (contactInformation) {
      sessionParams.metadata = sessionParams.metadata || {};
      sessionParams.metadata.contactFirstName = contactInformation.firstName || '';
      sessionParams.metadata.contactLastName = contactInformation.lastName || '';
      sessionParams.metadata.contactEmail = contactInformation.email || '';
      sessionParams.metadata.contactPhone = contactInformation.phone || '';
      if (contactInformation.organization) {
        sessionParams.metadata.contactOrganization = contactInformation.organization;
      }
    }

    // Store shipping address in metadata for order processing
    // Note: Address is also saved in Stripe Customer for tax calculation
    if (shippingAddress) {
      sessionParams.metadata = sessionParams.metadata || {};
      sessionParams.metadata.shippingAddress = JSON.stringify(shippingAddress);
      // Also store individual fields for easier access
      sessionParams.metadata.shippingLine1 = shippingAddress.line1;
      sessionParams.metadata.shippingCity = shippingAddress.city;
      sessionParams.metadata.shippingState = shippingAddress.state;
      sessionParams.metadata.shippingPostalCode = shippingAddress.postal_code;
      sessionParams.metadata.shippingCountry = shippingAddress.country;
    }

    // Don't collect shipping address - it's already in Customer and metadata
    // Stripe Tax will use billing address from Customer for tax calculation

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        sessionId: session.id, 
        url: session.url 
      }),
    };
  } catch (e: unknown) {
    console.error('Error creating checkout session:', e);
    if (e instanceof Error) {
      console.error('Error stack:', e.stack);
    }
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: e instanceof Error ? e.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' && e instanceof Error ? e.stack : undefined,
      }),
    };
  }
};
