import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useCart } from '../contexts/CartContext';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { SEO } from '../components/common/SEO';
import { createCheckoutSession, calculateTax } from '../services/stripeService';
import '../styles/CheckoutPage.css';

export function CheckoutPage() {
  useScrollToTop();
  const navigate = useNavigate();
  const { items, getTotalPrice } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxInfo, setTaxInfo] = useState<{
    taxAmount: number;
    subtotal: number;
    total: number;
    taxBreakdown: Array<{ amount: number; jurisdiction: string }>;
  } | null>(null);
  const [isCalculatingTax, setIsCalculatingTax] = useState(false);

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

  // Calculate tax when address fields are complete
  useEffect(() => {
    const performTaxCalculation = async () => {
      // Check if we have enough address information
      if (!formData.address || !formData.city || !formData.state || !formData.zipCode || !formData.country) {
        setTaxInfo(null);
        return;
      }

      setIsCalculatingTax(true);
      try {
        const shippingAddress = {
          line1: formData.address,
          city: formData.city,
          state: formData.state,
          postal_code: formData.zipCode,
          country: formData.country === 'United States' ? 'US' : formData.country === 'Canada' ? 'CA' : 'US',
        };

        const stripeItems = items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image ? `${window.location.origin}${item.image}` : undefined,
        }));

        const taxResult = await calculateTax(stripeItems, shippingAddress);
        setTaxInfo(taxResult);
      } catch (err: any) {
        console.error('Error calculating tax:', err);
        // Don't show error to user, just don't display tax
        setTaxInfo(null);
      } finally {
        setIsCalculatingTax(false);
      }
    };

    // Debounce tax calculation to avoid too many API calls
    const timeoutId = setTimeout(() => {
      performTaxCalculation();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.address, formData.city, formData.state, formData.zipCode, formData.country, items]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate form before proceeding to Stripe Checkout
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setError('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Use tax-inclusive total if available, otherwise use subtotal
      const total = taxInfo && !isCalculatingTax ? taxInfo.total : getTotalPrice();

      // Track begin_checkout event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'begin_checkout', {
          currency: 'USD',
          value: total,
          items: items.map((item) => ({
            item_id: item.id,
            item_name: item.name,
            item_category: 'Plasma Systems',
            price: item.price,
            quantity: item.quantity,
          })),
        });
      }

      // Prepare items for Stripe (include full image URLs)
      const stripeItems = items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image ? `${window.location.origin}${item.image}` : undefined,
      }));

      // Create Stripe Checkout Session
      const successUrl = `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/checkout/cancel`;

      const session = await createCheckoutSession({
        items: stripeItems,
        successUrl,
        cancelUrl,
        customerEmail: formData.email, // Email for Stripe Checkout
        customerName: `${formData.firstName} ${formData.lastName}`, // Name for Stripe Checkout
        contactInformation: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          organization: formData.organization || undefined,
        },
        shippingAddress: {
          line1: formData.address,
          city: formData.city,
          state: formData.state,
          postal_code: formData.zipCode,
          country: formData.country === 'United States' ? 'US' : formData.country === 'Canada' ? 'CA' : 'US',
        },
        notes: formData.notes,
      });

      // Redirect to Stripe Checkout using session URL
      // Stripe Checkout Session provides a URL that we can redirect to directly
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Failed to get checkout URL from session');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize checkout. Please try again or contact us directly.');
      console.error('Checkout initialization error:', err);
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
                  Your address has been saved and will be used for automatic tax calculation. 
                  You may be asked to confirm your billing address in Stripe Checkout if it differs from your shipping address.
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
                  <span>
                    {taxInfo && !isCalculatingTax
                      ? `$${taxInfo.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `$${total.toLocaleString()} USD`}
                  </span>
                </div>
                <div className="total-row">
                  <span>Shipping:</span>
                  <span>Free</span>
                </div>
                {isCalculatingTax && (
                  <div className="total-row">
                    <span>Tax:</span>
                    <span>Calculating...</span>
                  </div>
                )}
                {taxInfo && !isCalculatingTax && taxInfo.taxAmount > 0 && (
                  <>
                    <div className="total-row">
                      <span>Tax:</span>
                      <span>${taxInfo.taxAmount.toFixed(2)} USD</span>
                    </div>
                    {taxInfo.taxBreakdown && taxInfo.taxBreakdown.length > 0 && (
                      <div className="tax-breakdown">
                        {taxInfo.taxBreakdown.map((breakdown, index) => (
                          <div key={index} className="tax-breakdown-item">
                            <span>{breakdown.jurisdiction || 'Tax'}:</span>
                            <span>${breakdown.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {taxInfo && !isCalculatingTax && taxInfo.taxAmount === 0 && (
                  <div className="total-row">
                    <span>Tax:</span>
                    <span>No tax applicable</span>
                  </div>
                )}
                <div className="total-row total-final">
                  <span>Total:</span>
                  <span>
                    {taxInfo && !isCalculatingTax
                      ? `$${taxInfo.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `$${total.toLocaleString()} USD`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
