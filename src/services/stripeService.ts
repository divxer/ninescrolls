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
 * This calls your Amplify backend API which:
 * 1. Creates a Stripe Checkout Session using Stripe Secret Key
 * 2. Returns the session ID and URL
 * 3. Webhook handles payment confirmation
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{ sessionId: string; url: string }> {
  try {
    // Get API endpoint from environment or use default
    const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ninescrolls.us';
    
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
