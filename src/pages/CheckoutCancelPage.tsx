import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import '../styles/CheckoutCancelPage.css';

export function CheckoutCancelPage() {
  useScrollToTop();

  return (
    <>
      <SEO
        title="Payment Cancelled | NineScrolls"
        description="Your payment was cancelled."
        url="/checkout/cancel"
      />
      <section className="checkout-cancel-page">
        <div className="container">
          <div className="cancel-content">
            <div className="cancel-icon">✕</div>
            <h1>Payment Cancelled</h1>
            <p className="cancel-message">
              Your payment was cancelled. No charges were made.
            </p>
            <p className="cancel-submessage">
              If you have any questions or need assistance, please contact our sales team.
            </p>
            <div className="cancel-actions">
              <Link to="/cart" className="btn btn-primary">
                Return to Cart
              </Link>
              <Link to="/contact" className="btn btn-secondary">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
