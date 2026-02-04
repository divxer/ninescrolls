import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { env } from '$amplify/env/calculate-tax';

type LineItemInput = {
  id?: string;
  name?: string;
  price: number;
  quantity: number;
  taxCode?: string;
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

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
    'https://ninescrolls.us',
    'https://www.ninescrolls.us',
  ];

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

  try {
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

    // Prepare line items for tax calculation
    const lineItems = items.map((item) => ({
      amount: Math.round(item.price * 100 * item.quantity), // Total amount in cents
      reference: item.id || item.name,
      tax_code: item.taxCode || 'txcd_99999999', // General Tangible Goods
    }));

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
        taxBreakdown: taxCalculation.tax_breakdown?.map((breakdown: Stripe.Tax.Calculation.TaxBreakdown) => ({
          amount: breakdown.amount / 100,
          jurisdiction: breakdown.jurisdiction?.display_name || breakdown.jurisdiction?.country || 'Tax',
          taxRateDetails: breakdown.tax_rate_details ? {
            display_name: breakdown.tax_rate_details.display_name,
            percentage_decimal: breakdown.tax_rate_details.percentage_decimal,
          } : undefined,
        })) || [],
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
