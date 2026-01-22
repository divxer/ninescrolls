/**
 * Stripe Checkout Service
 * 
 * This service handles Stripe Checkout Session creation.
 * For production, you'll need a backend API endpoint to create the session securely.
 */

export interface StripeCheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CreateCheckoutSessionParams {
  items: StripeCheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

/**
 * Create a Stripe Checkout Session
 * 
 * This calls your backend API which should:
 * 1. Create a Stripe Checkout Session
 * 2. Return the session URL
 * 3. Handle webhooks for payment confirmation
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ sessionId: string; url: string }> {
  try {
    // Call your backend API to create Stripe Checkout Session
    // Replace this URL with your actual backend endpoint
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: params.items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: item.image ? [item.image] : undefined,
            },
            unit_amount: item.price * 100, // Convert to cents
          },
          quantity: item.quantity,
        })),
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        mode: 'payment',
        metadata: {
          items: JSON.stringify(params.items.map((i) => ({ id: i.id, name: i.name }))),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create checkout session');
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
