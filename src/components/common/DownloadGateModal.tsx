import { useEffect, useRef, useState } from 'react';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface DownloadGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
  title?: string;
  turnstileSiteKey?: string; // Optional Cloudflare Turnstile site key
}

declare global {
  interface Window { turnstile?: Turnstile }
}

type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => void;
};

const intents = [
  'Actively looking to buy',
  'Looking to buy within 1 year',
  'Investigating technologies for my application',
  'Expanding my knowledge'
];


export const DownloadGateModal: React.FC<DownloadGateModalProps> = ({ isOpen, onClose, fileUrl, fileName = '', title = 'Get the Brochure', turnstileSiteKey }) => {
  const analytics = useCombinedAnalytics();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    organization: '',
    researchAreas: '',
    jobTitle: '',
    intent: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [emailHint, setEmailHint] = useState<string>('');
  const [marketingOptIn, setMarketingOptIn] = useState<boolean>(false);

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      const free = /(gmail|yahoo|outlook|hotmail|icloud|proton|qq|163|126)\./i.test(value);
      const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      setEmailHint(!looksValid ? 'Please enter a valid email.' : free ? 'Please use a work email if possible.' : '');
    }
  };


  // Load Cloudflare Turnstile if site key provided
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName || !form.email || !form.organization || !form.researchAreas || !form.intent) {
      setError('Please complete all required fields.');
      return;
    }
    if (turnstileSiteKey && !token) {
      setError('Please complete the verification.');
      return;
    }
    setSubmitting(true);

    analytics.segment.track('Lead Captured', {
      source: 'Download Gate',
      fileUrl,
      fileName,
      ...form,
      turnstile: token ? 'verified' : 'n/a',
      marketingOptIn,
      privacyAccepted: true
    });

    // Trigger the download
    const a = document.createElement('a');
    a.href = fileUrl;
    if (fileName) a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    analytics.segment.track('Document Downloaded', { fileUrl, fileName, origin: 'Download Gate', intent: form.intent });

    setSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal" data-open={isOpen}>
      <div className="modal-content" role="dialog" aria-labelledby="downloadGateTitle">
        <span className="close-button" aria-label="Close" onClick={onClose}>×</span>
        <h2 id="downloadGateTitle">{title}</h2>
        <form onSubmit={submit}>
          <div className="form-group"><label className="label-strong">Full Name<span className="req">*</span></label><input name="fullName" placeholder="Your full name" value={form.fullName} onChange={update} required /></div>
          <div className="form-group"><label className="label-strong">Work Email<span className="req">*</span></label><input type="email" name="email" placeholder="name@company.com" value={form.email} onChange={update} required />{emailHint && <div className="input-hint">{emailHint}</div>}</div>
          <div className="form-group"><label>Company/Organization*</label><input name="organization" value={form.organization} onChange={update} required /></div>
          <div className="form-group"><label className="label-strong">Research Area(s)<span className="req">*</span></label><input name="researchAreas" placeholder="e.g., MEMS, Photonics, TSV" value={form.researchAreas} onChange={update} required /></div>
          <div className="form-group"><label>Job Title</label><input name="jobTitle" placeholder="Optional" value={form.jobTitle} onChange={update} /></div>
          <div className="form-group"><label className="label-strong">How can we help you?<span className="req">*</span></label>
            <select name="intent" value={form.intent} onChange={update} required>
              <option value="">Select an option</option>
              {intents.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          {turnstileSiteKey && (<div className="form-group"><div ref={widgetRef} /></div>)}
          <div className="optin-row">
            <label className="optin">
              <input id="subscribe_updates" name="subscribe_updates" type="checkbox" value="yes" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
              <span>Send me updates about new products, events, and application insights (1–2 emails/month).</span>
            </label>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="download-actions">
            <button className="btn btn-primary btn-full" disabled={submitting || (!!turnstileSiteKey && !token)}>{submitting ? 'Submitting...' : 'Get My Guide Now'}</button>
            <div className="privacy">By submitting this form, you agree to our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. We respect your privacy. No spam, ever.</div>
          </div>
        </form>
      </div>
    </div>
  );
};
