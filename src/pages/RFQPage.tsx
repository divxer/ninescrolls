import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import '../styles/RFQPage.css';

// ---------------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------------
interface TurnstileExtended {
  render: (element: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    'error-callback'?: () => void;
    'expired-callback'?: () => void;
  }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

function getTurnstile(): TurnstileExtended | undefined {
  return (window as unknown as { turnstile?: TurnstileExtended }).turnstile;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EQUIPMENT_CATEGORIES = [
  { value: 'ICP', label: 'ICP Etching System' },
  { value: 'PECVD', label: 'PECVD System' },
  { value: 'Sputter', label: 'Sputter Deposition System' },
  { value: 'ALD', label: 'ALD System' },
  { value: 'RIE', label: 'RIE / Reactive Ion Etching' },
  { value: 'IBE', label: 'Ion Beam Etching (IBE)' },
  { value: 'HDP-CVD', label: 'HDP-CVD System' },
  { value: 'Plasma-Cleaner', label: 'Plasma Cleaner / Surface Treatment' },
  { value: 'Other', label: 'Not Sure / Need Recommendation' },
];

const ROLES = [
  { value: 'PI', label: 'Professor / PI' },
  { value: 'Research Scientist', label: 'Research Scientist' },
  { value: 'Postdoc', label: 'Postdoc' },
  { value: 'Graduate Student', label: 'Graduate Student' },
  { value: 'Engineer', label: 'Engineer' },
  { value: 'Lab Manager', label: 'Lab Manager' },
  { value: 'Procurement', label: 'Procurement / Purchasing' },
  { value: 'Business Development', label: 'Business Development' },
  { value: 'Other', label: 'Other' },
];

const BUDGET_RANGES = [
  { value: '', label: 'Select budget range...' },
  { value: 'Under $10k', label: 'Under $10k' },
  { value: '$10k - $30k', label: '$10k – $30k' },
  { value: '$30k - $80k', label: '$30k – $80k' },
  { value: '$80k - $150k', label: '$80k – $150k' },
  { value: 'Over $150k', label: '$150k+' },
  { value: 'Not yet defined', label: 'Budget not yet defined' },
];

const TIMELINES = [
  { value: '', label: 'Select timeline...' },
  { value: 'immediate', label: 'Immediate / Active project' },
  { value: 'within-3-months', label: 'Within 1\u20133 months' },
  { value: 'within-6-months', label: 'Within 3\u20136 months' },
  { value: '6-plus-months', label: '6+ months' },
  { value: 'budgetary-planning', label: 'Budgetary planning only' },
];

const FUNDING_STATUSES = [
  { value: '', label: 'Select funding status...' },
  { value: 'funded', label: 'Funding secured' },
  { value: 'budget-under-review', label: 'Budget under review' },
  { value: 'grant-pending', label: 'Grant pending' },
  { value: 'exploring', label: 'Exploring options' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const REFERRAL_SOURCES = [
  { value: '', label: 'Select...' },
  { value: 'web-search', label: 'Google Search' },
  { value: 'google-ads', label: 'Google Ads' },
  { value: 'referral', label: 'Referral from colleague' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'conference', label: 'Conference / Exhibition' },
  { value: 'publication', label: 'Publication / Journal' },
  { value: 'existing-customer', label: 'Existing customer' },
  { value: 'direct-outreach', label: 'Direct outreach' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France',
  'Japan', 'South Korea', 'Singapore', 'Netherlands', 'Switzerland', 'Sweden',
  'Norway', 'Denmark', 'Finland', 'Belgium', 'Austria', 'Italy', 'Spain',
  'Ireland', 'New Zealand', 'Israel', 'Taiwan', 'Hong Kong', 'China', 'India',
  'Brazil', 'Mexico',
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RFQFormData {
  name: string;
  email: string;
  phone: string;
  institution: string;
  department: string;
  role: string;
  equipmentCategory: string;
  specificModel: string;
  applicationDescription: string;
  keySpecifications: string;
  quantity: number;
  budgetRange: string;
  timeline: string;
  fundingStatus: string;
  referralSource: string;
  existingEquipment: string;
  additionalComments: string;
  needsBudgetaryQuote: boolean;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZipCode: string;
  shippingCountry: string;
}

interface FieldErrors {
  [key: string]: string;
}

const initialFormData: RFQFormData = {
  name: '',
  email: '',
  phone: '',
  institution: '',
  department: '',
  role: '',
  equipmentCategory: '',
  specificModel: '',
  applicationDescription: '',
  keySpecifications: '',
  quantity: 1,
  budgetRange: '',
  timeline: '',
  fundingStatus: '',
  referralSource: '',
  existingEquipment: '',
  additionalComments: '',
  needsBudgetaryQuote: false,
  shippingAddress: '',
  shippingCity: '',
  shippingState: '',
  shippingZipCode: '',
  shippingCountry: 'United States',
};

// ---------------------------------------------------------------------------
// Category pre-fill from URL params
// ---------------------------------------------------------------------------
const PRODUCT_CATEGORY_MAP: Record<string, string> = {
  'ICP Etcher': 'ICP', 'ICP-RIE': 'ICP', 'ICP Etching': 'ICP',
  'RIE Etcher': 'RIE', 'RIE': 'RIE', 'Compact RIE': 'RIE',
  'PECVD': 'PECVD', 'PECVD System': 'PECVD',
  'ALD': 'ALD', 'ALD System': 'ALD',
  'Sputter': 'Sputter', 'Sputter System': 'Sputter', 'Sputtering': 'Sputter',
  'IBE': 'IBE', 'IBE System': 'IBE', 'RIBE': 'IBE',
  'HDP-CVD': 'HDP-CVD', 'HDP-CVD System': 'HDP-CVD',
  'Plasma Cleaner': 'Plasma-Cleaner', 'Plasma Treatment': 'Plasma-Cleaner', 'Surface Treatment': 'Plasma-Cleaner',
};

function inferCategory(product: string, explicitCategory?: string): string {
  if (explicitCategory) {
    const match = EQUIPMENT_CATEGORIES.find(c => c.value === explicitCategory.toUpperCase() || c.value === explicitCategory);
    if (match) return match.value;
  }
  const normalized = product.trim();
  for (const [key, value] of Object.entries(PRODUCT_CATEGORY_MAP)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function RFQPage() {
  const analytics = useCombinedAnalytics();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const urlProduct = params.get('product') || '';
  const urlCategory = params.get('category') || '';

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RFQFormData>(() => ({
    ...initialFormData,
    specificModel: urlProduct,
    equipmentCategory: inferCategory(urlProduct, urlCategory),
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const [honeypot, setHoneypot] = useState('');

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Effects
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    analytics.trackCustomEvent('RFQ Step 1: Your Information', { step: 1 });
  }, []);

  useEffect(() => {
    if (isSuccess && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isSuccess]);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    const loadTurnstile = () => {
      const t = getTurnstile();
      if (t && turnstileRef.current && !turnstileWidgetId.current) {
        turnstileWidgetId.current = t.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          'error-callback': () => setTurnstileToken(null),
          'expired-callback': () => setTurnstileToken(null),
        });
      }
    };
    if (getTurnstile()) { loadTurnstile(); return; }
    const existing = document.querySelector('script[src*="turnstile"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.onload = () => setTimeout(loadTurnstile, 100);
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (getTurnstile()) { clearInterval(checkInterval); loadTurnstile(); }
      }, 100);
      return () => clearInterval(checkInterval);
    }
    return () => {
      const t = getTurnstile();
      if (turnstileWidgetId.current && t) { t.remove(turnstileWidgetId.current); turnstileWidgetId.current = null; }
    };
  }, [turnstileSiteKey, isSuccess, currentStep]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (parseInt(value) || 1) : value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  }, [fieldErrors]);

  const validateField = useCallback((name: string, value: string | number | boolean): string => {
    switch (name) {
      case 'name':
        if (!value || (typeof value === 'string' && value.trim().length < 2)) return 'Name must be at least 2 characters';
        if (typeof value === 'string' && value.trim().length > 100) return 'Name must be under 100 characters';
        return '';
      case 'email':
        if (!value) return 'Email is required';
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      case 'phone':
        if (value && typeof value === 'string' && value.trim() && !/^[+\d\s\-().]{7,20}$/.test(value.trim())) return 'Please enter a valid phone number';
        return '';
      case 'institution':
        if (!value || (typeof value === 'string' && value.trim().length < 2)) return 'Institution is required (at least 2 characters)';
        if (typeof value === 'string' && value.trim().length > 200) return 'Institution must be under 200 characters';
        return '';
      case 'equipmentCategory':
        if (!value) return 'Please select an equipment category';
        return '';
      case 'applicationDescription':
        if (!value || (typeof value === 'string' && value.trim().length < 10)) return 'Please describe your application (at least 10 characters)';
        if (typeof value === 'string' && value.trim().length > 3000) return 'Description must be under 3000 characters';
        return '';
      case 'quantity':
        if (typeof value === 'number' && (value < 1 || !Number.isInteger(value))) return 'Quantity must be a positive integer';
        return '';
      case 'shippingAddress':
        if (formData.needsBudgetaryQuote && (!value || (typeof value === 'string' && !value.trim()))) return 'Street address is required for budgetary quote';
        return '';
      case 'shippingCity':
        if (formData.needsBudgetaryQuote && (!value || (typeof value === 'string' && !value.trim()))) return 'City is required for budgetary quote';
        return '';
      case 'shippingState':
        if (formData.needsBudgetaryQuote && (!value || (typeof value === 'string' && !value.trim()))) return 'State/Province is required for budgetary quote';
        return '';
      case 'shippingZipCode':
        if (formData.needsBudgetaryQuote && (!value || (typeof value === 'string' && !value.trim()))) return 'ZIP/Postal code is required for budgetary quote';
        return '';
      default:
        return '';
    }
  }, [formData.needsBudgetaryQuote]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    const fieldValue = type === 'checkbox' ? checked! : type === 'number' ? parseInt(value) || 1 : value;
    const error = validateField(name, fieldValue);
    if (error) { setFieldErrors(prev => ({ ...prev, [name]: error })); }
  }, [validateField]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const errors: string[] = [];
    if (files.length + selectedFiles.length > MAX_FILES) { errors.push(`Maximum ${MAX_FILES} files allowed`); }
    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) { errors.push(`${file.name} exceeds 10MB limit`); continue; }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) { errors.push(`${file.name}: unsupported format. Use PDF, DOCX, XLSX, JPG, or PNG`); continue; }
      validFiles.push(file);
    }
    if (errors.length > 0) { setFieldErrors(prev => ({ ...prev, files: errors.join('. ') })); }
    else { setFieldErrors(prev => { const next = { ...prev }; delete next.files; return next; }); }
    setFiles(prev => [...prev, ...validFiles].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [files.length]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFieldErrors(prev => { const next = { ...prev }; delete next.files; return next; });
  }, []);

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------
  const handleNext = () => {
    const step1Fields: (keyof RFQFormData)[] = ['name', 'email', 'institution', 'equipmentCategory', 'applicationDescription'];
    const errors: FieldErrors = {};
    for (const field of step1Fields) {
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    }
    if (formData.phone) {
      const phoneError = validateField('phone', formData.phone);
      if (phoneError) errors.phone = phoneError;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      setCurrentStep(2);
      // Scroll to step indicator instead of page top — user already saw the hero
      requestAnimationFrame(() => {
        stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      analytics.trackCustomEvent('RFQ Step 2: Project Details', {
        step: 2,
        equipmentCategory: formData.equipmentCategory,
      });
    } else {
      const firstError = formRef.current?.querySelector('.field-error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // ---------------------------------------------------------------------------
  // Validate & submit
  // ---------------------------------------------------------------------------
  const validateAll = (): boolean => {
    const errors: FieldErrors = {};
    const requiredFields: (keyof RFQFormData)[] = [
      'name', 'email', 'institution', 'equipmentCategory', 'applicationDescription', 'quantity',
    ];
    for (const field of requiredFields) {
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    }
    if (formData.phone) {
      const phoneError = validateField('phone', formData.phone);
      if (phoneError) errors.phone = phoneError;
    }
    if (formData.needsBudgetaryQuote) {
      const addressFields: (keyof RFQFormData)[] = ['shippingAddress', 'shippingCity', 'shippingState', 'shippingZipCode'];
      for (const field of addressFields) {
        const error = validateField(field, formData[field]);
        if (error) errors[field] = error;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) { setIsSuccess(true); setReferenceNumber('RFQ-000000-XXXX'); return; }
    if (!validateAll()) {
      const firstError = formRef.current?.querySelector('.field-error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (turnstileSiteKey && !turnstileToken) { setSubmitError('Please complete the verification.'); return; }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        institution: formData.institution.trim(),
        equipmentCategory: formData.equipmentCategory,
        applicationDescription: formData.applicationDescription.trim(),
        quantity: formData.quantity,
      };
      // Optional fields
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.role) payload.role = formData.role;
      if (formData.department.trim()) payload.department = formData.department.trim();
      if (formData.specificModel.trim()) payload.specificModel = formData.specificModel.trim();
      if (formData.keySpecifications.trim()) payload.keySpecifications = formData.keySpecifications.trim();
      if (formData.budgetRange) payload.budgetRange = formData.budgetRange;
      if (formData.timeline) payload.timeline = formData.timeline;
      if (formData.fundingStatus) payload.fundingStatus = formData.fundingStatus;
      if (formData.referralSource) payload.referralSource = formData.referralSource;
      if (formData.existingEquipment.trim()) payload.existingEquipment = formData.existingEquipment.trim();
      if (formData.additionalComments.trim()) payload.additionalComments = formData.additionalComments.trim();
      if (formData.needsBudgetaryQuote) {
        payload.needsBudgetaryQuote = true;
        payload.shippingAddress = formData.shippingAddress.trim();
        payload.shippingCity = formData.shippingCity.trim();
        payload.shippingState = formData.shippingState.trim();
        payload.shippingZipCode = formData.shippingZipCode.trim();
        payload.shippingCountry = formData.shippingCountry;
      }
      if (turnstileToken) payload.turnstileToken = turnstileToken;

      let response: Response;
      if (files.length > 0) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(payload));
        files.forEach(file => fd.append('attachments', file));
        response = await fetch('https://api.ninescrolls.com/api/rfq', { method: 'POST', body: fd });
      } else {
        response = await fetch('https://api.ninescrolls.com/api/rfq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to submit request. Please try again.');
      }

      const result = await response.json();
      setReferenceNumber(result.referenceNumber || '');
      setIsSuccess(true);
      setFormData(initialFormData);
      setFiles([]);
      setCurrentStep(1);
      setTurnstileToken(null);
      analytics.trackContactFormSubmit('RFQ Submission', formData.equipmentCategory);
    } catch (err) {
      console.error('RFQ submission error:', err);
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again or contact us at sales@ninescrolls.com');
      const t = getTurnstile();
      if (turnstileWidgetId.current && t) { t.reset(turnstileWidgetId.current); setTurnstileToken(null); }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // =========================================================================
  // RENDER: Success page
  // =========================================================================
  if (isSuccess) {
    return (
      <>
        <SEO
          title="Request a Quote"
          description="Request a customized quote for semiconductor processing equipment from NineScrolls LLC."
          keywords="request quote, RFQ, semiconductor equipment quote, ICP etcher quote, PECVD quote, ALD quote"
          url="/request-quote"
        />
        <section className="rfq-hero">
          <div className="container">
            <h1>Request a Technical Proposal or Quote</h1>
            <p>Share your process requirements and application goals. Our engineering team will review your inquiry and recommend a suitable equipment configuration.</p>
          </div>
        </section>
        <section className="rfq-success-section" ref={successRef}>
          <div className="container">
            <div className="rfq-success-card">
              <div className="rfq-success-icon">&#10003;</div>
              <h2>Thank You for Your Inquiry!</h2>
              <p>We've received your request and our engineering team will review your requirements.</p>
              {referenceNumber && (
                <div className="rfq-reference">
                  <span className="rfq-reference-label">Reference Number</span>
                  <span className="rfq-reference-number">{referenceNumber}</span>
                </div>
              )}
              <div className="rfq-next-steps">
                <h3>What Happens Next</h3>
                <ol>
                  <li><strong>Engineering Review</strong> &mdash; Our technical team evaluates your process requirements and constraints</li>
                  <li><strong>Equipment Recommendation</strong> &mdash; We prepare a suitable configuration or budgetary quotation</li>
                  <li><strong>Follow-Up Discussion</strong> &mdash; Expect a response within 1 business day</li>
                </ol>
              </div>
              <p className="rfq-confirmation-email">A confirmation email has been sent to your email address.</p>
              <div className="rfq-success-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => { setIsSuccess(false); setReferenceNumber(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Submit Another Request
                </button>
                <a href="/products" className="btn btn-outline">Browse Equipment</a>
              </div>
              <p className="rfq-urgent-note">
                For urgent inquiries, contact us directly at <a href="mailto:sales@ninescrolls.com">sales@ninescrolls.com</a>
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  // =========================================================================
  // RENDER: Form page
  // =========================================================================
  return (
    <>
      <SEO
        title="Request a Quote"
        description="Request a customized quote for semiconductor processing equipment from NineScrolls LLC. ICP, PECVD, ALD, RIE, sputtering, and more."
        keywords="request quote, RFQ, semiconductor equipment quote, ICP etcher quote, PECVD quote, ALD quote, RIE quote"
        url="/request-quote"
      />

      {/* Hero */}
      <section className="rfq-hero">
        <div className="container">
          <h1>Request a Technical Proposal or Budgetary Quote</h1>
          <p>
            Share your process requirements, application goals, and technical constraints.
            Our engineering team will review your inquiry and recommend a suitable equipment configuration
            or preliminary quotation.
          </p>
          <div className="rfq-hero-badges">
            <span className="rfq-badge">Custom Configurations</span>
            <span className="rfq-badge">Engineering Review</span>
            <span className="rfq-badge">Response Within 1 Business Day</span>
          </div>
          <div className="rfq-hero-apps">
            <span className="rfq-hero-apps-label">Typical applications:</span>
            <span className="rfq-app-tag">Plasma Cleaning</span>
            <span className="rfq-app-tag">Surface Activation</span>
            <span className="rfq-app-tag">RIE Etching</span>
            <span className="rfq-app-tag">Thin Film Deposition</span>
            <span className="rfq-app-tag">Materials Research</span>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="rfq-trust-bar">
        <div className="container">
          <div className="rfq-trust-grid">
            <div className="rfq-trust-item">
              <div className="rfq-trust-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <strong>Who We Serve</strong>
              <p>Universities, national labs, R&amp;D centers, and semiconductor pilot-line programs</p>
            </div>
            <div className="rfq-trust-item">
              <div className="rfq-trust-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <strong>What You Can Request</strong>
              <p>Budgetary quote, technical consultation, custom configuration, or platform comparison</p>
            </div>
            <div className="rfq-trust-item">
              <div className="rfq-trust-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <strong>What Happens Next</strong>
              <ol>
                <li>Submit your requirements</li>
                <li>Engineering review by our team</li>
                <li>Proposal or technical consultation</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="rfq-form-section">
        <div className="container">
          <div className="rfq-form-inner">

            {/* Step Indicator */}
            <div className="rfq-steps" ref={stepsRef}>
              <div className={`rfq-step ${currentStep >= 1 ? 'active' : ''}`}>
                <span className="rfq-step-number">1</span>
                <span className="rfq-step-label">Step 1 <span className="rfq-step-title">Your Information</span></span>
              </div>
              <div className={`rfq-step-line ${currentStep >= 2 ? 'active' : ''}`} />
              <div className={`rfq-step ${currentStep >= 2 ? 'active' : ''}`}>
                <span className="rfq-step-number">2</span>
                <span className="rfq-step-label">Step 2 <span className="rfq-step-title">Project Details</span></span>
              </div>
            </div>

            <form onSubmit={handleSubmit} ref={formRef} noValidate>

              {/* Honeypot */}
              <div className="honeypot-field" aria-hidden="true">
                <label htmlFor="rfq-website">Website</label>
                <input type="text" id="rfq-website" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
              </div>

              {/* ============================================================ */}
              {/* STEP 1: Your Information & Requirements                      */}
              {/* ============================================================ */}
              {currentStep === 1 && (
                <>
                  <fieldset className="rfq-fieldset rfq-card">
                    <legend>Contact Information</legend>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="rfq-name">Full Name <span className="required">*</span></label>
                        <input type="text" id="rfq-name" name="name" value={formData.name} onChange={handleChange} onBlur={handleBlur} placeholder="Full name" required />
                        {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                      </div>
                      <div className="form-group">
                        <label htmlFor="rfq-email">Email <span className="required">*</span></label>
                        <input type="email" id="rfq-email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="you@university.edu" required />
                        {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="rfq-phone">Phone <span className="optional">(optional)</span></label>
                        <input type="tel" id="rfq-phone" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="+1 (650) xxx-xxxx" />
                        {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
                      </div>
                      <div className="form-group">
                        <label htmlFor="rfq-role">Role <span className="optional">(optional)</span></label>
                        <select id="rfq-role" name="role" value={formData.role} onChange={handleChange}>
                          <option value="">Select your role...</option>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="rfq-institution">Institution / Organization <span className="required">*</span></label>
                        <input type="text" id="rfq-institution" name="institution" value={formData.institution} onChange={handleChange} onBlur={handleBlur} placeholder="University or company name" required />
                        {fieldErrors.institution && <span className="field-error">{fieldErrors.institution}</span>}
                      </div>
                      <div className="form-group">
                        <label htmlFor="rfq-department">Department <span className="optional">(optional)</span></label>
                        <input type="text" id="rfq-department" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Materials Science & Engineering" />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="rfq-fieldset rfq-card">
                    <legend>Equipment &amp; Application</legend>
                    <div className="form-group">
                      <label htmlFor="rfq-equipmentCategory">Equipment Category <span className="required">*</span></label>
                      <select id="rfq-equipmentCategory" name="equipmentCategory" value={formData.equipmentCategory} onChange={handleChange} onBlur={handleBlur} required>
                        <option value="">Select equipment type...</option>
                        {EQUIPMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      {fieldErrors.equipmentCategory && <span className="field-error">{fieldErrors.equipmentCategory}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="rfq-applicationDescription">
                        Application / Research Goal <span className="required">*</span>
                      </label>
                      <textarea
                        id="rfq-applicationDescription"
                        name="applicationDescription"
                        value={formData.applicationDescription}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Describe your intended process, target materials, substrate size, temperature limits, gases, throughput expectations, and any existing process challenges."
                        rows={5}
                        required
                      />
                      <span className="field-hint">
                        {formData.applicationDescription.length}/3000 &mdash; Examples: plasma cleaning before bonding, SiO&#x2082; etching at &lt;100nm features, low-temperature PECVD for a-Si:H, RF sputtering of metal films, surface activation for polymers
                      </span>
                      {fieldErrors.applicationDescription && <span className="field-error">{fieldErrors.applicationDescription}</span>}
                    </div>
                  </fieldset>

                  <div className="form-actions">
                    <button type="button" className="btn btn-primary rfq-next-btn" onClick={handleNext}>
                      Continue to Project Details
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </>
              )}

              {/* ============================================================ */}
              {/* STEP 2: Project & Technical Details                          */}
              {/* ============================================================ */}
              {currentStep === 2 && (
                <>
                  <fieldset className="rfq-fieldset rfq-card">
                    <legend>Technical Details <span className="optional">(optional)</span></legend>
                    <div className="form-group">
                      <label htmlFor="rfq-keySpecifications">Technical Requirements</label>
                      <textarea
                        id="rfq-keySpecifications"
                        name="keySpecifications"
                        value={formData.keySpecifications}
                        onChange={handleChange}
                        placeholder="Chamber size, wafer/substrate dimensions, gas lines needed, temperature range, RF power, vacuum level, throughput, automation requirements, etc."
                        rows={4}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="rfq-specificModel">Preferred Model <span className="optional">(optional)</span></label>
                        <input type="text" id="rfq-specificModel" name="specificModel" value={formData.specificModel} onChange={handleChange} placeholder='e.g. "ICP-100A" or "Need recommendation"' />
                      </div>
                      <div className="form-group form-group-narrow">
                        <label htmlFor="rfq-quantity">Quantity</label>
                        <input type="number" id="rfq-quantity" name="quantity" value={formData.quantity} onChange={handleChange} onBlur={handleBlur} min={1} step={1} />
                        {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="rfq-fieldset rfq-card">
                    <legend>Project Planning <span className="optional">(optional)</span></legend>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="rfq-budgetRange">Budget Range</label>
                        <select id="rfq-budgetRange" name="budgetRange" value={formData.budgetRange} onChange={handleChange}>
                          {BUDGET_RANGES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="rfq-timeline">Timeline</label>
                        <select id="rfq-timeline" name="timeline" value={formData.timeline} onChange={handleChange}>
                          {TIMELINES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="rfq-fundingStatus">Funding Status</label>
                        <select id="rfq-fundingStatus" name="fundingStatus" value={formData.fundingStatus} onChange={handleChange}>
                          {FUNDING_STATUSES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="rfq-referralSource">How did you hear about us?</label>
                        <select id="rfq-referralSource" name="referralSource" value={formData.referralSource} onChange={handleChange}>
                          {REFERRAL_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </fieldset>

                  {/* Budgetary Quote */}
                  <fieldset className="rfq-fieldset rfq-card">
                    <legend>Budgetary Quote <span className="optional">(optional)</span></legend>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input type="checkbox" name="needsBudgetaryQuote" checked={formData.needsBudgetaryQuote} onChange={handleChange} />
                        <span>I need a budgetary quote (for budgeting or grant planning) &mdash; requires shipping address</span>
                      </label>
                    </div>
                    {formData.needsBudgetaryQuote && (
                      <div className="rfq-shipping-fields">
                        <p className="rfq-shipping-hint">Shipping address is required to calculate applicable taxes for your budgetary quote.</p>
                        <div className="form-group">
                          <label htmlFor="rfq-shippingAddress">Street Address <span className="required">*</span></label>
                          <input type="text" id="rfq-shippingAddress" name="shippingAddress" value={formData.shippingAddress} onChange={handleChange} onBlur={handleBlur} placeholder="Street address" autoComplete="street-address" required />
                          {fieldErrors.shippingAddress && <span className="field-error">{fieldErrors.shippingAddress}</span>}
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="rfq-shippingCity">City <span className="required">*</span></label>
                            <input type="text" id="rfq-shippingCity" name="shippingCity" value={formData.shippingCity} onChange={handleChange} onBlur={handleBlur} placeholder="City" autoComplete="address-level2" required />
                            {fieldErrors.shippingCity && <span className="field-error">{fieldErrors.shippingCity}</span>}
                          </div>
                          <div className="form-group">
                            <label htmlFor="rfq-shippingState">State / Province <span className="required">*</span></label>
                            <input type="text" id="rfq-shippingState" name="shippingState" value={formData.shippingState} onChange={handleChange} onBlur={handleBlur} placeholder="State or province" autoComplete="address-level1" required />
                            {fieldErrors.shippingState && <span className="field-error">{fieldErrors.shippingState}</span>}
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="rfq-shippingZipCode">ZIP / Postal Code <span className="required">*</span></label>
                            <input type="text" id="rfq-shippingZipCode" name="shippingZipCode" value={formData.shippingZipCode} onChange={handleChange} onBlur={handleBlur} placeholder="ZIP or postal code" autoComplete="postal-code" required />
                            {fieldErrors.shippingZipCode && <span className="field-error">{fieldErrors.shippingZipCode}</span>}
                          </div>
                          <div className="form-group">
                            <label htmlFor="rfq-shippingCountry">Country <span className="required">*</span></label>
                            <select id="rfq-shippingCountry" name="shippingCountry" value={formData.shippingCountry} onChange={handleChange} autoComplete="country-name" required>
                              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </fieldset>

                  {/* Supporting Materials */}
                  <fieldset className="rfq-fieldset rfq-card">
                    <legend>Supporting Materials <span className="optional">(optional)</span></legend>

                    <div className="form-group">
                      <label htmlFor="rfq-existingEquipment">Existing Equipment</label>
                      <textarea
                        id="rfq-existingEquipment"
                        name="existingEquipment"
                        value={formData.existingEquipment}
                        onChange={handleChange}
                        placeholder="List any existing tools relevant to this project (e.g., plasma cleaner, RIE, PECVD, spin coater, vacuum pumps, gas cabinets, substrate sizes supported, or legacy systems)."
                        rows={3}
                      />
                    </div>

                    {/* File Upload */}
                    <div className="form-group">
                      <label>Upload Specifications, Drawings, Process Notes, or RFQ Documents <span className="optional">(max 3 files, 10MB each)</span></label>
                      <div className="file-upload-area">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" multiple className="file-input-hidden" id="rfq-file-upload" />
                        <label htmlFor="rfq-file-upload" className="file-upload-label">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>Click to upload or drag and drop</span>
                          <span className="file-upload-hint">PDF, DOCX, XLSX, JPG, PNG</span>
                        </label>
                      </div>
                      {files.length > 0 && (
                        <ul className="file-list">
                          {files.map((file, index) => (
                            <li key={`${file.name}-${index}`} className="file-item">
                              <span className="file-name">{file.name}</span>
                              <span className="file-size">{formatFileSize(file.size)}</span>
                              <button type="button" className="file-remove" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>&times;</button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {fieldErrors.files && <span className="field-error">{fieldErrors.files}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="rfq-additionalComments">Special Requirements / Additional Notes</label>
                      <textarea
                        id="rfq-additionalComments"
                        name="additionalComments"
                        value={formData.additionalComments}
                        onChange={handleChange}
                        placeholder="Any additional details, constraints, timeline considerations, or questions for our engineering team."
                        rows={3}
                      />
                    </div>
                  </fieldset>

                  {/* Privacy Consent */}
                  <p className="rfq-consent-text">
                    By submitting, you agree that NineScrolls may use this information to prepare a quotation and contact you regarding this inquiry.
                  </p>

                  {/* Turnstile */}
                  {turnstileSiteKey && <div className="rfq-turnstile" ref={turnstileRef} />}

                  {/* Submit note */}
                  <div className="rfq-submit-note">
                    <p>All inquiries are reviewed by our technical team. Typical response time: within 1 business day.</p>
                  </div>

                  {submitError && <div className="form-message error">{submitError}</div>}

                  {/* Actions */}
                  <div className="form-actions form-actions-split">
                    <button type="button" className="btn btn-outline rfq-back-btn" onClick={() => { setCurrentStep(1); requestAnimationFrame(() => { stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary rfq-submit-btn"
                      disabled={isSubmitting || (!!turnstileSiteKey && !turnstileToken)}
                    >
                      {isSubmitting ? 'Submitting...' : 'Request Proposal'}
                    </button>
                  </div>
                </>
              )}
            </form>

            {/* Need Help + Trust Signal */}
            <div className="rfq-bottom-bar">
              <div className="rfq-need-help">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <strong>Need help defining your requirements?</strong>
                  <p>Our team can recommend suitable equipment configurations. <a href="mailto:sales@ninescrolls.com">sales@ninescrolls.com</a></p>
                </div>
              </div>
              <div className="rfq-trust-signal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Serving U.S. universities and research labs &bull; San Diego, California</span>
              </div>
            </div>

            {/* Privacy Note */}
            <div className="rfq-privacy-note">
              <p>
                Your information is kept confidential and will only be used to prepare your quotation.
                We do not share your data with third parties. See our <a href="/privacy">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
