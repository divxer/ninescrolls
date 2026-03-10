import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import '../styles/RFQPage.css';

// Extended turnstile interface for this page (reset/remove/error callbacks)
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

// Equipment categories from §12.10.2
const EQUIPMENT_CATEGORIES = [
  { value: 'ICP', label: 'ICP Etching System' },
  { value: 'PECVD', label: 'PECVD System' },
  { value: 'SPUTTER', label: 'Sputter Deposition System' },
  { value: 'ALD', label: 'ALD System' },
  { value: 'RIE', label: 'RIE System' },
  { value: 'IBE', label: 'IBE System' },
  { value: 'HDP-CVD', label: 'HDP-CVD System' },
  { value: 'OTHER', label: 'Other / Not Sure' },
];

const ROLES = [
  { value: 'PI', label: 'Principal Investigator (PI)' },
  { value: 'Researcher', label: 'Researcher' },
  { value: 'Procurement', label: 'Procurement' },
  { value: 'Lab Manager', label: 'Lab Manager' },
  { value: 'Other', label: 'Other' },
];

const BUDGET_RANGES = [
  { value: '', label: 'Prefer not to say' },
  { value: 'under-100k', label: 'Under $100,000' },
  { value: '100k-200k', label: '$100,000 - $200,000' },
  { value: '200k-500k', label: '$200,000 - $500,000' },
  { value: 'over-500k', label: 'Over $500,000' },
];

const TIMELINES = [
  { value: '', label: 'Select timeline...' },
  { value: 'exploring', label: 'Exploring options (no rush)' },
  { value: 'within-3-months', label: 'Within 3 months' },
  { value: 'within-6-months', label: 'Within 6 months' },
  { value: 'within-12-months', label: 'Within 12 months' },
  { value: 'urgent', label: 'Urgent (ASAP)' },
];

const FUNDING_STATUSES = [
  { value: '', label: 'Select funding status...' },
  { value: 'funded', label: 'Funded / Budget approved' },
  { value: 'pending-approval', label: 'Pending approval' },
  { value: 'grant-in-progress', label: 'Grant application in progress' },
  { value: 'early-research', label: 'Early research / planning' },
];

const REFERRAL_SOURCES = [
  { value: '', label: 'Select...' },
  { value: 'web-search', label: 'Web search' },
  { value: 'referral', label: 'Referral from colleague' },
  { value: 'conference', label: 'Conference / Exhibition' },
  { value: 'publication', label: 'Publication / Journal' },
  { value: 'other', label: 'Other' },
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
};

// Map product names to equipment categories for pre-fill
const PRODUCT_CATEGORY_MAP: Record<string, string> = {
  'ICP Etcher': 'ICP', 'ICP-RIE': 'ICP', 'ICP Etching': 'ICP',
  'RIE Etcher': 'RIE', 'RIE': 'RIE', 'Compact RIE': 'RIE',
  'PECVD': 'PECVD', 'PECVD System': 'PECVD',
  'ALD': 'ALD', 'ALD System': 'ALD',
  'Sputter': 'SPUTTER', 'Sputter System': 'SPUTTER', 'Sputtering': 'SPUTTER',
  'IBE': 'IBE', 'IBE System': 'IBE', 'RIBE': 'IBE',
  'HDP-CVD': 'HDP-CVD', 'HDP-CVD System': 'HDP-CVD',
};

function inferCategory(product: string, explicitCategory?: string): string {
  if (explicitCategory) {
    const match = EQUIPMENT_CATEGORIES.find(c => c.value === explicitCategory.toUpperCase());
    if (match) return match.value;
  }
  const normalized = product.trim();
  for (const [key, value] of Object.entries(PRODUCT_CATEGORY_MAP)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return '';
}

export function RFQPage() {
  const analytics = useCombinedAnalytics();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const urlProduct = params.get('product') || '';
  const urlCategory = params.get('category') || '';

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
  // honeypot
  const [honeypot, setHoneypot] = useState('');

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll to success
  useEffect(() => {
    if (isSuccess && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isSuccess]);

  // Initialize Turnstile
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

    // If turnstile is already loaded
    if (getTurnstile()) {
      loadTurnstile();
      return;
    }

    // Load the script
    const existing = document.querySelector('script[src*="turnstile"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.onload = () => setTimeout(loadTurnstile, 100);
      document.head.appendChild(script);
    } else {
      // Script exists but might not be loaded yet
      const checkInterval = setInterval(() => {
        if (getTurnstile()) {
          clearInterval(checkInterval);
          loadTurnstile();
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    return () => {
      const t = getTurnstile();
      if (turnstileWidgetId.current && t) {
        t.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [turnstileSiteKey, isSuccess]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (parseInt(value) || 1) : value,
    }));
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
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
      case 'role':
        if (!value) return 'Please select your role';
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
      default:
        return '';
    }
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    const fieldValue = type === 'checkbox' ? checked! : type === 'number' ? parseInt(value) || 1 : value;
    const error = validateField(name, fieldValue);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [validateField]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const errors: string[] = [];

    // Check total count
    if (files.length + selectedFiles.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files allowed`);
    }

    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 10MB limit`);
        continue;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported format. Use PDF, DOCX, XLSX, JPG, or PNG`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setFieldErrors(prev => ({ ...prev, files: errors.join('. ') }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.files;
        return next;
      });
    }

    setFiles(prev => [...prev, ...validFiles].slice(0, MAX_FILES));
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [files.length]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next.files;
      return next;
    });
  }, []);

  const validateAll = (): boolean => {
    const errors: FieldErrors = {};
    const requiredFields: (keyof RFQFormData)[] = [
      'name', 'email', 'institution', 'role', 'equipmentCategory', 'applicationDescription', 'quantity',
    ];

    for (const field of requiredFields) {
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    }

    // Validate optional fields with format rules
    if (formData.phone) {
      const phoneError = validateField('phone', formData.phone);
      if (phoneError) errors.phone = phoneError;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (honeypot) {
      setIsSuccess(true);
      setReferenceNumber('RFQ-000000-XXXX');
      return;
    }

    if (!validateAll()) {
      // Scroll to first error
      const firstErrorField = formRef.current?.querySelector('.field-error');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setSubmitError('Please complete the verification.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        institution: formData.institution.trim(),
        role: formData.role,
        equipmentCategory: formData.equipmentCategory,
        applicationDescription: formData.applicationDescription.trim(),
        quantity: formData.quantity,
      };

      // Optional fields
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.department.trim()) payload.department = formData.department.trim();
      if (formData.specificModel.trim()) payload.specificModel = formData.specificModel.trim();
      if (formData.keySpecifications.trim()) payload.keySpecifications = formData.keySpecifications.trim();
      if (formData.budgetRange) payload.budgetRange = formData.budgetRange;
      if (formData.timeline) payload.timeline = formData.timeline;
      if (formData.fundingStatus) payload.fundingStatus = formData.fundingStatus;
      if (formData.referralSource) payload.referralSource = formData.referralSource;
      if (formData.existingEquipment.trim()) payload.existingEquipment = formData.existingEquipment.trim();
      if (formData.additionalComments.trim()) payload.additionalComments = formData.additionalComments.trim();

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      // If files are attached, use multipart/form-data
      let response: Response;

      if (files.length > 0) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(payload));
        files.forEach(file => fd.append('attachments', file));
        response = await fetch('https://api.ninescrolls.com/api/rfq', {
          method: 'POST',
          body: fd,
        });
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
      setTurnstileToken(null);

      // Analytics
      analytics.trackContactFormSubmit('RFQ Submission', formData.equipmentCategory);
    } catch (err) {
      console.error('RFQ submission error:', err);
      setSubmitError(
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again or contact us at sales@ninescrolls.com'
      );
      // Reset Turnstile on error
      const t = getTurnstile();
      if (turnstileWidgetId.current && t) {
        t.reset(turnstileWidgetId.current);
        setTurnstileToken(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
            <h1>Request a Quote</h1>
            <p>Tell us about your equipment needs and we'll prepare a customized proposal.</p>
          </div>
        </section>
        <section className="rfq-success-section" ref={successRef}>
          <div className="container">
            <div className="rfq-success-card">
              <div className="rfq-success-icon">&#10003;</div>
              <h2>Thank You for Your Inquiry!</h2>
              <p>We've received your request and will respond within 1-2 business days.</p>
              {referenceNumber && (
                <div className="rfq-reference">
                  <span className="rfq-reference-label">Reference Number</span>
                  <span className="rfq-reference-number">{referenceNumber}</span>
                </div>
              )}
              <p className="rfq-confirmation-email">A confirmation email has been sent to your email address.</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsSuccess(false);
                  setReferenceNumber('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Submit Another Request
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Request a Quote"
        description="Request a customized quote for semiconductor processing equipment from NineScrolls LLC. ICP, PECVD, ALD, RIE, sputtering, and more."
        keywords="request quote, RFQ, semiconductor equipment quote, ICP etcher quote, PECVD quote, ALD quote, RIE quote"
        url="/request-quote"
      />

      <section className="rfq-hero">
        <div className="container">
          <h1>Request a Quote</h1>
          <p>Tell us about your equipment needs and we'll prepare a customized proposal.</p>
        </div>
      </section>

      <section className="rfq-form-section">
        <div className="container">
          <div className="rfq-form-inner">
            <form onSubmit={handleSubmit} ref={formRef} noValidate>

              {/* Honeypot */}
              <div className="honeypot-field" aria-hidden="true">
                <label htmlFor="rfq-website">Website</label>
                <input
                  type="text"
                  id="rfq-website"
                  name="website"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Section 1: Contact Information */}
              <fieldset className="rfq-fieldset">
                <legend>Contact Information</legend>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rfq-name">Full Name <span className="required">*</span></label>
                    <input
                      type="text"
                      id="rfq-name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Full name"
                      required
                    />
                    {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="rfq-email">Email <span className="required">*</span></label>
                    <input
                      type="email"
                      id="rfq-email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="you@example.com"
                      required
                    />
                    {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rfq-phone">Phone <span className="optional">(optional)</span></label>
                    <input
                      type="tel"
                      id="rfq-phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="+1-650-xxx-xxxx"
                    />
                    {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="rfq-role">Role <span className="required">*</span></label>
                    <select
                      id="rfq-role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    >
                      <option value="">Select your role...</option>
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {fieldErrors.role && <span className="field-error">{fieldErrors.role}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rfq-institution">Institution / Organization <span className="required">*</span></label>
                    <input
                      type="text"
                      id="rfq-institution"
                      name="institution"
                      value={formData.institution}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="University or company name"
                      required
                    />
                    {fieldErrors.institution && <span className="field-error">{fieldErrors.institution}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="rfq-department">Department <span className="optional">(optional)</span></label>
                    <input
                      type="text"
                      id="rfq-department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="Materials Science & Engineering"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Section 2: Equipment Requirements */}
              <fieldset className="rfq-fieldset">
                <legend>Equipment Requirements</legend>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rfq-equipmentCategory">Equipment Category <span className="required">*</span></label>
                    <select
                      id="rfq-equipmentCategory"
                      name="equipmentCategory"
                      value={formData.equipmentCategory}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    >
                      <option value="">Select equipment type...</option>
                      {EQUIPMENT_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    {fieldErrors.equipmentCategory && <span className="field-error">{fieldErrors.equipmentCategory}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="rfq-specificModel">Specific Model <span className="optional">(optional)</span></label>
                    <input
                      type="text"
                      id="rfq-specificModel"
                      name="specificModel"
                      value={formData.specificModel}
                      onChange={handleChange}
                      placeholder='e.g. "TL-ICP-300"'
                    />
                    <span className="field-hint">If you have a specific model in mind</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="rfq-applicationDescription">
                    Application / Process Description <span className="required">*</span>
                  </label>
                  <textarea
                    id="rfq-applicationDescription"
                    name="applicationDescription"
                    value={formData.applicationDescription}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Please describe your intended application, materials, substrate size, and any specific process requirements..."
                    rows={4}
                    required
                  />
                  <span className="field-hint">
                    {formData.applicationDescription.length}/3000 characters (minimum 10)
                  </span>
                  {fieldErrors.applicationDescription && <span className="field-error">{fieldErrors.applicationDescription}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="rfq-keySpecifications">Key Specifications <span className="optional">(optional)</span></label>
                  <textarea
                    id="rfq-keySpecifications"
                    name="keySpecifications"
                    value={formData.keySpecifications}
                    onChange={handleChange}
                    placeholder="Chamber size, power requirements, gas system needs, throughput expectations, etc."
                    rows={3}
                  />
                </div>

                <div className="form-group form-group-narrow">
                  <label htmlFor="rfq-quantity">Quantity</label>
                  <input
                    type="number"
                    id="rfq-quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    min={1}
                    step={1}
                  />
                  {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
                </div>
              </fieldset>

              {/* Section 3: Project Context */}
              <fieldset className="rfq-fieldset">
                <legend>Project Context <span className="optional">(all optional)</span></legend>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rfq-budgetRange">Budget Range</label>
                    <select
                      id="rfq-budgetRange"
                      name="budgetRange"
                      value={formData.budgetRange}
                      onChange={handleChange}
                    >
                      {BUDGET_RANGES.map(b => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="rfq-timeline">Timeline</label>
                    <select
                      id="rfq-timeline"
                      name="timeline"
                      value={formData.timeline}
                      onChange={handleChange}
                    >
                      {TIMELINES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rfq-fundingStatus">Funding Status</label>
                    <select
                      id="rfq-fundingStatus"
                      name="fundingStatus"
                      value={formData.fundingStatus}
                      onChange={handleChange}
                    >
                      {FUNDING_STATUSES.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="rfq-referralSource">How did you hear about us?</label>
                    <select
                      id="rfq-referralSource"
                      name="referralSource"
                      value={formData.referralSource}
                      onChange={handleChange}
                    >
                      {REFERRAL_SOURCES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Section 4: Additional Information */}
              <fieldset className="rfq-fieldset">
                <legend>Additional Information <span className="optional">(optional)</span></legend>

                <div className="form-group">
                  <label htmlFor="rfq-existingEquipment">Existing Equipment</label>
                  <textarea
                    id="rfq-existingEquipment"
                    name="existingEquipment"
                    value={formData.existingEquipment}
                    onChange={handleChange}
                    placeholder="List any related equipment currently in your lab..."
                    rows={3}
                  />
                </div>

                {/* File Upload */}
                <div className="form-group">
                  <label>File Upload <span className="optional">(max 3 files, 10MB each)</span></label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                      multiple
                      className="file-input-hidden"
                      id="rfq-file-upload"
                    />
                    <label htmlFor="rfq-file-upload" className="file-upload-label">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
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
                          <button
                            type="button"
                            className="file-remove"
                            onClick={() => removeFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {fieldErrors.files && <span className="field-error">{fieldErrors.files}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="rfq-additionalComments">Additional Comments</label>
                  <textarea
                    id="rfq-additionalComments"
                    name="additionalComments"
                    value={formData.additionalComments}
                    onChange={handleChange}
                    placeholder="Any other details, questions, or preferences..."
                    rows={3}
                  />
                </div>
              </fieldset>

              {/* Privacy Consent */}
              <p className="rfq-consent-text">
                By submitting, you agree that NineScrolls may use this information to prepare a quotation and contact you regarding this inquiry.
              </p>

              {/* Turnstile */}
              {turnstileSiteKey && (
                <div className="rfq-turnstile" ref={turnstileRef} />
              )}

              {/* Submit Error */}
              {submitError && (
                <div className="form-message error">{submitError}</div>
              )}

              {/* Submit Button */}
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary rfq-submit-btn"
                  disabled={isSubmitting || (!!turnstileSiteKey && !turnstileToken)}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>

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
