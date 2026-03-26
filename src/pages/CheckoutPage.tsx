import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useCart } from '../contexts/useCart';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { SEO } from '../components/common/SEO';
import { createCheckoutSession, calculateTax } from '../services/stripeService';

/**
 * Convert country name to ISO 3166-1 alpha-2 country code
 */
function getCountryCode(countryName: string): string {
  const countryMap: Record<string, string> = {
    'United States': 'US',
    'Canada': 'CA',
    'United Kingdom': 'GB',
    'Australia': 'AU',
    'Germany': 'DE',
    'France': 'FR',
    'Japan': 'JP',
    'South Korea': 'KR',
    'Singapore': 'SG',
    'Netherlands': 'NL',
    'Switzerland': 'CH',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Belgium': 'BE',
    'Austria': 'AT',
    'Italy': 'IT',
    'Spain': 'ES',
    'Ireland': 'IE',
    'New Zealand': 'NZ',
    'Israel': 'IL',
    'Taiwan': 'TW',
    'Hong Kong': 'HK',
    'China': 'CN',
    'India': 'IN',
    'Brazil': 'BR',
    'Mexico': 'MX',
  };

  return countryMap[countryName] || 'US'; // Default to US if not found
}

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
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  // Calculate tax when address fields are complete
  useEffect(() => {
    const performTaxCalculation = async () => {
      if (items.length === 0) {
        setTaxInfo(null);
        return;
      }
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
          country: getCountryCode(formData.country),
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
      } catch (err: unknown) {
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

  if (items.length === 0) {
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
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'begin_checkout', {
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
          country: getCountryCode(formData.country),
        },
        notes: formData.notes,
      });

      // Redirect to Stripe Checkout using session URL
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Failed to get checkout URL from session');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize checkout. Please try again or contact us directly.';
      setError(message);
      console.error('Checkout initialization error:', err);
      setIsSubmitting(false);
    }
  };

  const total = getTotalPrice();

  const inputClasses = "w-full border-0 border-b border-outline-variant focus:ring-0 focus:border-primary p-3 bg-transparent font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors";
  const selectClasses = "w-full border-0 border-b border-outline-variant focus:ring-0 focus:border-primary p-3 bg-transparent font-body text-on-surface outline-none transition-colors";
  const labelClasses = "block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1";

  return (
    <>
      <SEO
        title="Checkout | NineScrolls"
        description="Complete your order for HY Series plasma systems."
        url="/checkout"
      />
      <main className="py-24 px-8 max-w-5xl mx-auto">
        <h1 className="text-5xl font-headline font-bold mb-12">Secure Checkout</h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7 space-y-12">
            <form onSubmit={handleSubmit}>
              {/* Contact Information */}
              <section className="mb-12">
                <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">1. Contact &amp; Shipping</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className={labelClasses}>First Name *</label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className={labelClasses}>Last Name *</label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        required
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="email" className={labelClasses}>Email *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="you@company.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className={labelClasses}>Phone *</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="organization" className={labelClasses}>Organization</label>
                    <input
                      type="text"
                      id="organization"
                      name="organization"
                      value={formData.organization}
                      onChange={handleInputChange}
                      className={inputClasses}
                      placeholder="Company or university"
                    />
                  </div>
                </div>
              </section>

              {/* Shipping Address */}
              <section className="mb-12">
                <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">2. Shipping Address</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="address" className={labelClasses}>Address *</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      className={inputClasses}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="city" className={labelClasses}>City *</label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        required
                        value={formData.city}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className={labelClasses}>State/Province *</label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        required
                        value={formData.state}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="State"
                      />
                    </div>
                    <div>
                      <label htmlFor="zipCode" className={labelClasses}>ZIP/Postal Code *</label>
                      <input
                        type="text"
                        id="zipCode"
                        name="zipCode"
                        required
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder="ZIP code"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="country" className={labelClasses}>Country *</label>
                    <select
                      id="country"
                      name="country"
                      required
                      value={formData.country}
                      onChange={handleInputChange}
                      className={selectClasses}
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Japan">Japan</option>
                      <option value="South Korea">South Korea</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Netherlands">Netherlands</option>
                      <option value="Switzerland">Switzerland</option>
                      <option value="Sweden">Sweden</option>
                      <option value="Norway">Norway</option>
                      <option value="Denmark">Denmark</option>
                      <option value="Finland">Finland</option>
                      <option value="Belgium">Belgium</option>
                      <option value="Austria">Austria</option>
                      <option value="Italy">Italy</option>
                      <option value="Spain">Spain</option>
                      <option value="Ireland">Ireland</option>
                      <option value="New Zealand">New Zealand</option>
                      <option value="Israel">Israel</option>
                      <option value="Taiwan">Taiwan</option>
                      <option value="Hong Kong">Hong Kong</option>
                      <option value="China">China</option>
                      <option value="India">India</option>
                      <option value="Brazil">Brazil</option>
                      <option value="Mexico">Mexico</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Order Notes */}
              <section className="mb-12">
                <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">3. Order Notes</h2>
                <div>
                  <label htmlFor="notes" className={labelClasses}>Additional Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any special instructions or requirements..."
                    className="w-full border border-outline-variant/20 focus:ring-0 focus:border-primary p-3 bg-transparent rounded-lg font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors resize-y"
                  />
                </div>
              </section>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              {/* Checkout notes */}
              <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 mb-8 space-y-3 text-sm text-on-surface-variant">
                <p>
                  <span className="font-bold text-on-surface">Payment:</span> You will be redirected to Stripe Checkout to complete your payment securely.
                </p>
                <p>
                  Your address has been saved and will be used for automatic tax calculation.
                  You may be asked to confirm your billing address in Stripe Checkout if it differs from your shipping address.
                </p>
                <p>
                  <span className="font-bold text-on-surface">Distributor:</span> HY Series plasma systems are manufactured by Shenzhen Huiyi Zhikong Technology Co., Ltd. NineScrolls LLC is the authorized US distributor.
                  Configuration details and support are managed directly by us.
                </p>
                <p>
                  Formal invoice available upon request. All sales final. No returns for capital equipment.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-5 rounded-sm font-bold uppercase tracking-widest shadow-lg hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Place Secure Order'}
              </button>
            </form>
          </div>

          {/* Order Summary Sidebar */}
          <aside className="lg:col-span-5">
            <div className="bg-white p-8 rounded-xl border border-outline-variant/10 shadow-sm sticky top-8">
              <h3 className="text-xl font-bold mb-6">Order Manifest</h3>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 items-start">
                    {item.image && (
                      <div className="w-16 h-16 bg-slate-200 rounded-lg shrink-0 overflow-hidden">
                        <OptimizedImage
                          src={item.image}
                          alt={item.name}
                          width={80}
                          height={80}
                        />
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-on-surface-variant">Qty: {item.quantity} x ${item.price.toLocaleString()}</p>
                    </div>
                    <p className="font-headline font-bold text-sm shrink-0">
                      ${(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-outline-variant/20 pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span className="font-bold">
                    {taxInfo && !isCalculatingTax
                      ? `$${taxInfo.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `$${total.toLocaleString()} USD`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Shipping</span>
                  <span className="font-bold">Free</span>
                </div>
                {isCalculatingTax && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Tax</span>
                    <span className="text-on-surface-variant animate-pulse">Calculating...</span>
                  </div>
                )}
                {taxInfo && !isCalculatingTax && taxInfo.taxAmount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Tax</span>
                      <span className="font-bold">${taxInfo.taxAmount.toFixed(2)} USD</span>
                    </div>
                    {taxInfo.taxBreakdown && taxInfo.taxBreakdown.length > 0 && (
                      <div className="pl-4 space-y-1">
                        {taxInfo.taxBreakdown.map((breakdown, index) => (
                          <div key={index} className="flex justify-between text-xs text-on-surface-variant">
                            <span>{breakdown.jurisdiction || 'Tax'}</span>
                            <span>${breakdown.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {taxInfo && !isCalculatingTax && taxInfo.taxAmount === 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Tax</span>
                    <span className="text-on-surface-variant">No tax applicable</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-outline-variant/20 pt-3 text-lg">
                  <span className="font-headline font-bold">Total</span>
                  <span className="font-headline font-bold">
                    {taxInfo && !isCalculatingTax
                      ? `$${taxInfo.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                      : `$${total.toLocaleString()} USD`}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
