import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { useCart } from '../contexts/CartContext';
import { analytics } from '../services/analytics';
import '../styles/CheckoutSuccessPage.css';

export function CheckoutSuccessPage() {
  useScrollToTop();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || 'N/A';
  const { clearCart, items, getTotalPrice } = useCart();

  // Clear cart and track purchase on successful payment
  useEffect(() => {
    if (sessionId && sessionId !== 'N/A') {
      const total = getTotalPrice();
      
      // Track purchase event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'purchase', {
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
      <section className="checkout-success-page">
        <div className="container">
          <div className="success-content">
            <div className="success-icon">✓</div>
            <h1>Order Confirmed!</h1>
            <p className="success-message">
              Thank you for your order. We have received your order and will process it shortly.
            </p>
            <div className="order-info">
              <p><strong>Payment Session ID:</strong> {sessionId}</p>
              <p>
                Your payment was successful! You will receive an email confirmation shortly with order details and shipping information.
              </p>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                <strong>Note:</strong> Formal invoice available upon request. Standard delivery: 3–4 weeks after order confirmation.
              </p>
            </div>
            <div className="success-actions">
              <Link to="/products" className="btn btn-primary">
                Continue Shopping
              </Link>
              <Link to="/contact" className="btn btn-secondary">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
