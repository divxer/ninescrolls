import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { useCart } from '../contexts/useCart';

export function CheckoutSuccessPage() {
  useScrollToTop();
  const [searchParams] = useSearchParams();
  // Get session_id from URL parameters
  // Stripe replaces {CHECKOUT_SESSION_ID} with the actual session ID in the success_url
  // Handle various possible parameter names (session_id, sessionId, session id)
  const sessionId = searchParams.get('session_id') ||
                    searchParams.get('sessionId') ||
                    searchParams.get('session id') || // Handle space in parameter name (Stripe bug)
                    'N/A';
  const { clearCart, items, getTotalPrice } = useCart();

  // Clear cart and track purchase on successful payment
  useEffect(() => {
    if (sessionId && sessionId !== 'N/A') {
      const total = getTotalPrice();

      // Track purchase event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: sessionId,
          value: total,
          currency: 'USD',
          items: items.map((item) => ({
            item_id: item.id,
            item_name: item.name,
            item_category: 'Plasma Systems',
            price: item.price,
            quantity: item.quantity,
          })),
        });
      }

      // Clear cart after successful payment
      clearCart();
    }
  }, [sessionId, clearCart, items, getTotalPrice]);

  return (
    <>
      <SEO
        title="Order Confirmed | NineScrolls"
        description="Your order has been successfully placed."
        url="/checkout/success"
      />
      <main className="min-h-[819px] flex flex-col items-center justify-center text-center px-8">
        <span
          className="material-symbols-outlined text-8xl text-green-500 mb-8"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
        <h1 className="text-5xl font-headline font-bold mb-4">Transmission Received</h1>
        <p className="text-xl text-on-surface-variant max-w-xl mb-10">
          Thank you for your order. We have received your order and will process it shortly.
        </p>

        <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-8 max-w-lg w-full mb-10">
          {sessionId !== 'N/A' ? (
            <p className="text-sm text-on-surface-variant">
              <span className="font-bold text-on-surface">Payment Session ID:</span> {sessionId}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">
              <span className="font-bold">Note:</span> Session ID not available. If you completed payment, you will receive an email confirmation shortly.
            </p>
          )}
          <p className="text-sm text-on-surface-variant mt-4">
            Your payment was successful! You will receive an email confirmation shortly with order details and shipping information.
          </p>
          <p className="text-sm text-on-surface-variant mt-4">
            <span className="font-bold">Note:</span> Formal invoice available upon request. Standard delivery: 3-4 weeks after order confirmation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link
            to="/products"
            className="bg-primary text-white py-4 px-8 rounded-sm font-bold uppercase hover:bg-primary-container transition-colors"
          >
            Continue Shopping
          </Link>
          <Link
            to="/contact"
            className="border border-outline-variant py-4 px-8 rounded-sm font-bold uppercase text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Contact Us
          </Link>
        </div>

        <Link to="/" className="mt-12 text-primary font-bold hover:underline">
          Return to Main Repository
        </Link>
      </main>
    </>
  );
}
