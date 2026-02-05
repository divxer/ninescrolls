import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { env } from '$amplify/env/calculate-tax';

type LineItemInput = {
  id?: string;
  quantity: number;
};

type ShippingAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

type TaxRequestBody = {
  items: LineItemInput[];
  shippingAddress: ShippingAddressInput;
};

const taxRateLimitTable = process.env.TAX_RATE_LIMIT_TABLE;
const ddbClient = taxRateLimitTable
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}))
  : null;

const getClientIp = (event: Parameters<APIGatewayProxyHandlerV2>[0]): string => {
  const forwarded = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return event.requestContext?.http?.sourceIp || 'unknown';
};

const rateLimit = async (key: string, limit: number, windowSeconds: number): Promise<boolean> => {
  if (!ddbClient || !taxRateLimitTable) {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds);
  const partitionKey = `${key}:${windowStart}`;
  const ttl = now + windowSeconds * 2;

  const result = await ddbClient.send(new UpdateCommand({
    TableName: taxRateLimitTable,
    Key: { key: partitionKey },
    UpdateExpression: 'ADD #count :incr SET #ttl = :ttl',
    ExpressionAttributeNames: {
      '#count': 'count',
      '#ttl': 'ttl',
    },
    ExpressionAttributeValues: {
      ':incr': 1,
      ':ttl': ttl,
    },
    ReturnValues: 'UPDATED_NEW',
  }));

  const count = (result.Attributes?.count as number | undefined) ?? 0;
  return count <= limit;
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
    'https://ninescrolls.us',
    'https://www.ninescrolls.us',
  ];

  const productCatalog: Record<string, { name: string; price: number; taxCode?: string }> = {
    'ns-plasma-4r-rf': {
      name: 'NS-Plasma 4R - RF (13.56 MHz) Plasma Cleaner',
      price: 7999,
      taxCode: 'txcd_99999999',
    },
    'ns-plasma-4r-mf': {
      name: 'NS-Plasma 4R - Mid-Frequency (40 kHz) Plasma Cleaner',
      price: 6499,
      taxCode: 'txcd_99999999',
    },
  };

  const getCorsHeaders = (origin: string): Record<string, string> => {
    const isAllowedOrigin = allowedOrigins.includes(origin);
    return {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'false',
    };
  };

  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const corsHeaders = getCorsHeaders(requestOrigin);

  // Handle OPTIONS preflight
  const method = event.requestContext?.http?.method;
  const isOptionsRequest = method === 'OPTIONS' || 
    event.headers?.['access-control-request-method'] !== undefined ||
    event.headers?.['Access-Control-Request-Method'] !== undefined;

  if (isOptionsRequest) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight successful' }),
    };
  }

  const isAllowedOrigin = allowedOrigins.includes(requestOrigin);
  if (!isAllowedOrigin) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Origin not allowed' }),
    };
  }

  try {
    const clientIp = getClientIp(event);
    const allowed = await rateLimit(clientIp, 60, 60);
    if (!allowed) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      };
    }

    if (!env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured' }),
      };
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' });

    const body = event.body ? (JSON.parse(event.body) as Partial<TaxRequestBody>) : {};
    const { items, shippingAddress } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Items are required' }),
      };
    }

    if (!shippingAddress || !shippingAddress.line1 || !shippingAddress.city || 
        !shippingAddress.state || !shippingAddress.postal_code || !shippingAddress.country) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Shipping address is required for tax calculation' }),
      };
    }

    // Prepare line items for tax calculation from server-side catalog
    const lineItems: Stripe.Tax.CalculationCreateParams.LineItem[] = [];
    for (const item of items) {
      if (!item.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Item id is required' }),
        };
      }
      const catalogItem = productCatalog[item.id];
      if (!catalogItem) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Unknown product id: ${item.id}` }),
        };
      }
      const quantity = Math.min(Math.max(item.quantity || 1, 1), 10);
      lineItems.push({
        amount: Math.round(catalogItem.price * 100 * quantity), // Total amount in cents
        reference: item.id,
        tax_code: catalogItem.taxCode || 'txcd_99999999', // General Tangible Goods
      });
    }

    // Calculate tax using Stripe Tax Calculations API
    const taxCalculation = await stripe.tax.calculations.create({
      currency: 'usd',
      line_items: lineItems,
      customer_details: {
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country,
        },
        address_source: 'shipping',
      },
    });

    // Extract tax breakdown
    const taxAmount = taxCalculation.tax_amount_exclusive || 0;
    const totalAmount = taxCalculation.amount_total || 0;
    const subtotal = totalAmount - taxAmount;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        taxAmount: taxAmount / 100, // Convert from cents to dollars
        subtotal: subtotal / 100,
        total: totalAmount / 100,
        taxBreakdown: taxCalculation.tax_breakdown?.map((breakdown: Stripe.Tax.Calculation.TaxBreakdown) => {
          const jurisdiction = (breakdown as unknown as { jurisdiction?: { display_name?: string; country?: string } })
            .jurisdiction;
          const taxRateDetails = (breakdown as unknown as { tax_rate_details?: { display_name?: string; percentage_decimal?: string } })
            .tax_rate_details;

          return {
            amount: breakdown.amount / 100,
            jurisdiction: jurisdiction?.display_name || jurisdiction?.country || 'Tax',
            taxRateDetails: taxRateDetails ? {
              display_name: taxRateDetails.display_name,
              percentage_decimal: taxRateDetails.percentage_decimal,
            } : undefined,
          };
        }) || [],
      }),
    };
  } catch (e: unknown) {
    console.error('Error calculating tax:', e);
    const message = e instanceof Error ? e.message : 'Internal server error';
    const stack = e instanceof Error ? e.stack : undefined;
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: message,
        details: process.env.NODE_ENV === 'development' ? stack : undefined,
      }),
    };
  }
};
