import { useState, useEffect, useRef } from 'react';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadBrochure?: () => void;
  productName?: string;
  downloadLabel?: string;
  turnstileSiteKey?: string;
  defaultIsQuote?: boolean;
}

declare global { interface Window { turnstile?: Turnstile } }

type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => void;
};

export function QuoteModal({ isOpen, onClose, onDownloadBrochure, productName, downloadLabel = 'Download Brochure', turnstileSiteKey, defaultIsQuote = false }: QuoteModalProps) {
  const analytics = useCombinedAnalytics();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [isQuote, setIsQuote] = useState(defaultIsQuote);
  const [form, setForm] = useState({
    product: productName || '',
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States'
  });
  const [token, setToken] = useState<string>('');
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!isOpen) { setIsSuccess(false); setError(null); setReferenceNumber(null); } }, [isOpen]);
  useEffect(() => { setIsQuote(defaultIsQuote); }, [defaultIsQuote]);

  // Load Cloudflare Turnstile if a site key is provided
  useEffect(() => {
    if (!isOpen || !turnstileSiteKey || !widgetRef.current) return;
    const ensureScript = () => new Promise<void>((resolve) => {
      if (window.turnstile) return resolve();
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
    ensureScript().then(() => {
      try {
        const widget = widgetRef.current;
        const turnstile = window.turnstile;
        if (!widget || !turnstile) {
          return;
        }
        turnstile.render(widget, {
          sitekey: turnstileSiteKey,
          callback: (t: string) => setToken(t)
        });
      } catch (error: unknown) {
        console.warn('Turnstile render failed:', error);
      }
    });
  }, [isOpen, turnstileSiteKey]);

  if (!isOpen) return null;

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.name || !form.email || !form.message) {
      setError('Please complete required fields.');
      return;
    }
    if (turnstileSiteKey && !token) {
      setError('Please complete the verification.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { address, city, state, zipCode, country, ...rest } = form;
      const productLabel = rest.product || productName || 'Products Inquiry';
      const rfqPayload = {
        name: rest.name,
        email: rest.email,
        phone: rest.phone || undefined,
        institution: rest.organization || 'Not specified',
        role: 'Other' as const,
        equipmentCategory: 'Other' as const,
        specificModel: productLabel,
        applicationDescription: rest.message.length >= 10
          ? rest.message
          : `${rest.message} — Quick inquiry via product page (${productLabel})`.padEnd(10, '.'),
        turnstileToken: token,
        additionalComments: [
          `Source: Quote Modal`,
          `Product: ${productLabel}`,
          isQuote ? 'Type: Budgetary Quote' : 'Type: General Inquiry',
          isQuote ? `Shipping: ${address}, ${city}, ${state} ${zipCode}, ${country}` : '',
        ].filter(Boolean).join('\n'),
      };
      const res = await fetch('https://api.ninescrolls.com/api/rfq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rfqPayload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setReferenceNumber(data?.referenceNumber || null);
      setIsSuccess(true); setIsSubmitting(false);
      // Send to both Google Analytics and Segment
      const inquiryProduct = form.product || productName || 'Products Inquiry';
      analytics.trackRFQSubmission(inquiryProduct, inquiryProduct);
      analytics.segment.trackRFQSubmissionWithAnalysis(inquiryProduct, inquiryProduct);
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to submit form.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 overflow-auto flex items-start justify-center">
      <div className="bg-white my-[10vh] p-8 rounded-lg w-[90%] max-w-[600px] relative animate-in slide-in-from-bottom-4" role="dialog" aria-labelledby="quoteModalTitle">
        {!isSuccess ? (
          <>
            <span className="absolute top-4 right-4 text-2xl cursor-pointer text-gray-400 hover:text-on-surface bg-transparent border-none p-2 leading-none transition-colors" aria-label="Close" onClick={onClose}>×</span>
            <h2 id="quoteModalTitle">Request Product Information</h2>
            <p className="text-on-surface-variant text-sm mb-4">Please fill out the form below and we'll get back to you shortly.</p>
            {error && <div className="bg-red-50 text-red-800 p-3 rounded border border-red-200 mb-4 text-sm">{error}</div>}
            <form onSubmit={submit}>
              {productName ? (
                <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Product</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" value={productName} readOnly aria-readonly="true" /></div>
              ) : (
                <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Product (optional)</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="product" placeholder="e.g., RIE Etcher Series" value={form.product} onChange={update} /></div>
              )}
              <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Name</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="name" placeholder="Enter your full name" value={form.name} onChange={update} required /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Email</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" type="email" name="email" placeholder="Enter your email address" value={form.email} onChange={update} required /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Phone:</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="phone" placeholder="Optional: Enter your phone number" value={form.phone} onChange={update} /></div>
              <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Organization:</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="organization" placeholder="Optional: Enter your organization name" value={form.organization} onChange={update} /></div>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isQuote} onChange={(e) => setIsQuote(e.target.checked)} className="w-auto m-0" />
                  I need a budgetary quote (requires shipping address for tax calculation)
                </label>
              </div>
              {isQuote && (
                <div className="bg-gray-50 p-4 rounded-lg mb-2">
                  <p className="text-[13px] text-gray-600 mb-3">Shipping address is required to calculate applicable taxes.</p>
                  <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Address *</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="address" placeholder="Street address" value={form.address} onChange={update} required={isQuote} autoComplete="street-address" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">City *</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="city" placeholder="City" value={form.city} onChange={update} required={isQuote} autoComplete="address-level2" /></div>
                    <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">State/Province *</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="state" placeholder="State" value={form.state} onChange={update} required={isQuote} autoComplete="address-level1" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">ZIP/Postal Code *</label><input className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="zipCode" placeholder="ZIP Code" value={form.zipCode} onChange={update} required={isQuote} autoComplete="postal-code" /></div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">Country *</label>
                      <select className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="country" value={form.country} onChange={update} required={isQuote} autoComplete="country-name">
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
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-4"><label className="block text-sm font-medium text-on-surface-variant mb-1">Message</label><textarea className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" name="message" rows={4} placeholder="Please let us know your specific requirements or questions" value={form.message} onChange={update} required /></div>
              {turnstileSiteKey && (<div className="mb-4"><div ref={widgetRef} /></div>)}
              <div className="flex gap-4 justify-end mt-6">
                <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-primary text-white border border-primary hover:bg-primary-container hover:-translate-y-0.5 transition-all cursor-pointer text-base" disabled={isSubmitting || (!!turnstileSiteKey && !token)}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center p-8">
            <span className="absolute top-4 right-4 text-2xl cursor-pointer text-gray-400 hover:text-on-surface bg-transparent border-none p-2 leading-none transition-colors" aria-label="Close" onClick={onClose}>×</span>
            <div className="relative">
              <span className="block text-5xl text-green-500 mb-4">✓</span>
              <h3>Thank You for Your Interest!</h3>
              {productName ? (
                <p>Your request about the {productName} has been submitted successfully.</p>
              ) : (
                <p>Your request has been submitted successfully.</p>
              )}
              {referenceNumber && (
                <p className="text-sm text-gray-600 my-2">
                  Reference: <strong>{referenceNumber}</strong>
                </p>
              )}
              <div className="text-left my-6 p-6 bg-gray-100 rounded-lg">
                <p>What happens next:</p>
                <ul>
                  <li>You'll receive a confirmation email within the next few minutes</li>
                  <li>Our sales team will review your request</li>
                  <li>We'll respond with detailed information within 1–2 business days</li>
                </ul>
              </div>
              <div className="mt-6 flex gap-4 justify-center flex-wrap">
                {onDownloadBrochure && (
                  <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer text-base" onClick={onDownloadBrochure}>{downloadLabel}</button>
                )}
                <a href="/products" className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer text-base">Browse Other Products</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuoteModal;
