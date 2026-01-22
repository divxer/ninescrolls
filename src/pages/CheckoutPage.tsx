import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useCart } from '../contexts/CartContext';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { SEO } from '../components/common/SEO';
import { analytics } from '../services/analytics';
import { createCheckoutSession, createMockCheckoutSession } from '../services/stripeService';
import '../styles/CheckoutPage.css';

export function CheckoutPage() {
  useScrollToTop();
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    notes: '',
  });

  // Redirect if cart is empty
  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Track purchase event
      const total = getTotalPrice();
      const orderId = `ORDER-${Date.now()}`;
      
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'purchase', {
          transaction_id: orderId,
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

      // Send order to backend
      const response = await fetch('https://api.ninescrolls.us/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName: `Order: ${items.map((i) => i.name).join(', ')}`,
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          phone: formData.phone,
          organization: formData.organization,
          message: `Order ID: ${orderId}\n\nShipping Address:\n${formData.address}\n${formData.city}, ${formData.state} ${formData.zipCode}\n${formData.country}\n\nItems:\n${items.map((i) => `- ${i.name} x${i.quantity} - $${i.price * i.quantity}`).join('\n')}\n\nTotal: $${total}\n\nNotes: ${formData.notes || 'None'}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit order');
      }

      // Clear cart and redirect to success page
      clearCart();
      navigate('/checkout/success', { state: { orderId } });
    } catch (err) {
      setError('Failed to submit order. Please try again or contact us directly.');
      console.error('Order submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = getTotalPrice();

  return (
    <>
      <SEO
        title="Checkout | NineScrolls"
        description="Complete your order for NS-Plasma systems."
        url="/checkout"
      />
      <section className="checkout-page">
        <div className="container">
          <h1>Checkout</h1>
          <div className="checkout-content">
            <form className="checkout-form" onSubmit={handleSubmit}>
              <div className="form-section">
                <h2>Contact Information</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name *</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name *</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="email">Email *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="organization">Organization</label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-section">
                <h2>Shipping Address</h2>
                <div className="form-group">
                  <label htmlFor="address">Address *</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City *</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="state">State/Province *</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      required
                      value={formData.state}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="zipCode">ZIP/Postal Code *</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      required
                      value={formData.zipCode}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="country">Country *</label>
                  <select
                    id="country"
                    name="country"
                    required
                    value={formData.country}
                    onChange={handleInputChange}
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-section">
                <h2>Order Notes</h2>
                <div className="form-group">
                  <label htmlFor="notes">Additional Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any special instructions or requirements..."
                  />
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="checkout-note">
                <p>
                  <strong>Payment:</strong> You will be redirected to Stripe Checkout to complete your payment securely.
                </p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Formal invoice available upon request. All sales final. No returns for capital equipment.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-large"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </form>

            <div className="checkout-summary">
              <h2>Order Summary</h2>
              <div className="order-items">
                {items.map((item) => (
                  <div key={item.id} className="order-item">
                    {item.image && (
                      <div className="order-item-image">
                        <OptimizedImage
                          src={item.image}
                          alt={item.name}
                          width={80}
                          height={80}
                        />
                      </div>
                    )}
                    <div className="order-item-details">
                      <h3>{item.name}</h3>
                      <p>Quantity: {item.quantity}</p>
                      <p className="order-item-price">${item.price.toLocaleString()} each</p>
                    </div>
                    <div className="order-item-total">
                      ${(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="order-totals">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>${total.toLocaleString()} USD</span>
                </div>
                <div className="total-row">
                  <span>Shipping:</span>
                  <span>Free</span>
                </div>
                <div className="total-row total-final">
                  <span>Total:</span>
                  <span>${total.toLocaleString()} USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
