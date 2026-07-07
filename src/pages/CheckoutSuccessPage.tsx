import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { useCart } from '../contexts/useCart';
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';

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

  // Track purchase + clear cart exactly once per valid session id.
  // The cart context functions/items are intentionally read at fire time, not
  // depended upon: clearCart() mutates cart state, so listing items/getTotalPrice/
  // clearCart in the dep array re-triggers this effect after the clear and loops
  // (CartContext does not memoize these). The ref guard fires the side effect once.
  const trackedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId || sessionId === 'N/A') return;
    if (trackedSessionRef.current === sessionId) return;
    trackedSessionRef.current = sessionId;

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
  }, [sessionId, clearCart, items, getTotalPrice]);

  return (
    <>
      <SEO
        title="Order Confirmed"
        description="Your order has been successfully placed."
        url="/checkout/success"
        robots="noindex, nofollow"
      />
      <div className="bg-[#FAFAFA]">
        <ConversionHero
          eyebrow="Checkout Complete"
          title="Order confirmed"
          copy="Thank you for your order. Our team will review your order details and follow up with confirmation, documentation, and shipping coordination."
          primaryAction={{ label: 'Continue Shopping', href: '/products' }}
          secondaryAction={{ label: 'Contact Support', href: '/contact?topic=support' }}
          trustItems={['Payment received', 'Order review next', 'Formal invoice available']}
        />

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-8 py-12 lg:grid-cols-[1fr_0.8fr]">
          <ConversionCard>
            <h2 className="font-headline text-2xl font-bold text-slate-950">Payment details</h2>
            {sessionId !== 'N/A' ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                <span className="font-bold text-slate-950">Payment Session ID:</span> {sessionId}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                <span className="font-bold text-slate-950">Note:</span> Session ID not available. If you completed payment, you will receive an email confirmation shortly.
              </p>
            )}
            <p className="mt-4 text-sm leading-6 text-slate-600">
              You will receive an email confirmation shortly with order details. NineScrolls will coordinate documentation, order review, and shipping information after payment confirmation.
            </p>
          </ConversionCard>

          <ConversionCard>
            <h2 className="font-headline text-2xl font-bold text-slate-950">Next steps</h2>
            <div className="mt-6">
              <TrustSignalList
                items={[
                  { title: 'Order review', copy: 'We verify order details and contact information.' },
                  { title: 'Documentation', copy: 'Formal invoice and shipping information are coordinated after review.' },
                  { title: 'Support', copy: 'Contact us if your procurement process needs additional documentation.' },
                ]}
              />
            </div>
          </ConversionCard>
        </section>
      </div>
    </>
  );
}
