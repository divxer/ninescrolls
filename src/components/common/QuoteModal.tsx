import { useState, useEffect, useRef } from 'react';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadBrochure: () => void;
  productName?: string;
  downloadLabel?: string;
  turnstileSiteKey?: string;
}

declare global { interface Window { turnstile?: any } }

export function QuoteModal({ isOpen, onClose, onDownloadBrochure, productName, downloadLabel = 'Download Brochure', turnstileSiteKey }: QuoteModalProps) {
  const analytics = useCombinedAnalytics();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    product: productName || '',
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });
  const [token, setToken] = useState<string>('');
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!isOpen) { setIsSuccess(false); setError(null); } }, [isOpen]);

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
        window.turnstile.render(widgetRef.current, {
          sitekey: turnstileSiteKey,
          callback: (t: string) => setToken(t)
        });
      } catch {}
    });
  }, [isOpen, turnstileSiteKey]);

  if (!isOpen) return null;

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const payload = { productName: form.product || 'Products Inquiry', ...form, turnstileToken: token };
      const res = await fetch('https://api.ninescrolls.com/sendEmail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || 'Failed');
      setIsSuccess(true); setIsSubmitting(false);
      analytics.segment.trackContactFormSubmitWithAnalysis('Products', 'Products Inquiry');
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to submit form.');
    }
  };

  return (
    <div className="modal" data-open={isOpen}>
      <div className="modal-content" role="dialog" aria-labelledby="quoteModalTitle">
        {!isSuccess ? (
          <>
            <span className="close-button" aria-label="Close" onClick={onClose}>×</span>
            <h2 id="quoteModalTitle">Request Product Information</h2>
            <p className="modal-subtitle">Please fill out the form below and we'll get back to you shortly.</p>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={submit}>
              {productName ? (
                <div className="form-group"><label>Product</label><input value={productName} readOnly aria-readonly="true" /></div>
              ) : (
                <div className="form-group"><label>Product (optional)</label><input name="product" placeholder="e.g., RIE Etcher Series" value={form.product} onChange={update} /></div>
              )}
              <div className="form-group"><label>Name</label><input name="name" placeholder="Enter your full name" value={form.name} onChange={update} required /></div>
              <div className="form-group"><label>Email</label><input type="email" name="email" placeholder="Enter your email address" value={form.email} onChange={update} required /></div>
              <div className="form-group"><label>Phone:</label><input name="phone" placeholder="Optional: Enter your phone number" value={form.phone} onChange={update} /></div>
              <div className="form-group"><label>Organization:</label><input name="organization" placeholder="Optional: Enter your organization name" value={form.organization} onChange={update} /></div>
              <div className="form-group"><label>Message</label><textarea name="message" rows={4} placeholder="Please let us know your specific requirements or questions" value={form.message} onChange={update} required /></div>
              {turnstileSiteKey && (<div className="form-group"><div ref={widgetRef} /></div>)}
              <div className="form-actions">
                <button className="btn btn-primary" disabled={isSubmitting || (!!turnstileSiteKey && !token)}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="form-success" data-success={isSuccess}>
            <span className="close-button" aria-label="Close" onClick={onClose}>×</span>
            <div className="success-content">
              <span className="success-icon">✓</span>
              {productName ? (
                <>
                  <h3>Thank You for Your Interest!</h3>
                  <p>Your request about the {productName} has been submitted successfully.</p>
                  <div className="success-details">
                    <p>What happens next:</p>
                    <ul>
                      <li>You'll receive a confirmation email within the next few minutes</li>
                      <li>Our sales team will review your request</li>
                      <li>We'll respond with detailed information within 1 business day</li>
                    </ul>
                  </div>
                  <div className="success-actions" style={{ marginTop: '12px', display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
                    <button className="btn btn-secondary" onClick={onDownloadBrochure}>{downloadLabel}</button>
                    <a href="/products" className="btn btn-secondary">Browse Other Products</a>
                  </div>
                </>
              ) : (
                <>
                  <h3>Thank You for Your Interest!</h3>
                  <p>Your request has been submitted successfully.</p>
                  <div className="success-details">
                    <p>What happens next:</p>
                    <ul>
                      <li>You'll receive a confirmation email within the next few minutes</li>
                      <li>Our sales team will review your request</li>
                      <li>We'll respond with detailed information within 1 business day</li>
                    </ul>
                  </div>
                  <div className="success-actions" style={{ marginTop: '12px', display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
                    <button className="btn btn-secondary" onClick={onDownloadBrochure}>{downloadLabel}</button>
                    <a href="/products" className="btn btn-secondary">Browse Other Products</a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuoteModal;

