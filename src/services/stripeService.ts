/**
 * Stripe Checkout Service
 * 
 * This service handles Stripe Checkout Session creation.
 * For production, you'll need a backend API endpoint to create the session securely.
 */

import outputs from '../../amplify_outputs.json';

export interface StripeCheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface ShippingAddress {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface CreateCheckoutSessionParams {
  items: StripeCheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  customerName?: string;
  shippingAddress?: ShippingAddress;
  notes?: string;
}

/**
 * Get API Gateway endpoint from Amplify outputs
 */
function getApiEndpoint(): string {
  // Try to get from amplify_outputs.json first
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    // Remove trailing slash if present
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  
  // Fallback to environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Last resort: use the hardcoded URL (should not happen in production)
  console.warn('Using fallback API URL. Please configure VITE_API_URL or ensure amplify_outputs.json is available.');
  return 'https://api.ninescrolls.us';
}

/**
 * Create a Stripe Checkout Session
 * 
 * This calls your Amplify backend API which:
 * 1. Creates a Stripe Checkout Session using Stripe Secret Key
 * 2. Returns the session ID and URL
 * 3. Webhook handles payment confirmation
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ sessionId: string; url: string }> {
  try {
    // Get API endpoint from Amplify outputs or environment
    const apiUrl = getApiEndpoint();
    
    const response = await fetch(`${apiUrl}/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: params.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          // If you have priceId configured in Stripe Dashboard, use it instead:
          // priceId: item.priceId,
        })),
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        shippingAddress: params.shippingAddress,
        notes: params.notes,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create checkout session' }));
      throw new Error(error.error || error.message || 'Failed to create checkout session');
    }

    const data = await response.json();
    return {
      sessionId: data.sessionId,
      url: data.url,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * For development/testing: Create a mock checkout session
 * This redirects to a success page directly (bypassing Stripe)
 */
export async function createMockCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ sessionId: string; url: string }> {
  // In development, you can use this to test without Stripe
  const sessionId = `mock_session_${Date.now()}`;
  const total = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  // Store mock session data in localStorage for testing
  if (typeof window !== 'undefined') {
    localStorage.setItem('mock_checkout_session', JSON.stringify({
      sessionId,
      items: params.items,
      total,
      timestamp: Date.now(),
    }));
  }

  return {
    sessionId,
    url: `${params.successUrl}?session_id=${sessionId}`,
  };
}
