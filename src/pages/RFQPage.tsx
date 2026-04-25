import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import { behaviorAnalytics } from '../services/behaviorAnalytics';

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
  { value: 'E-Beam', label: 'E-Beam Evaporation System' },
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
  { value: '$10k - $30k', label: '$10k \u2013 $30k' },
  { value: '$30k - $80k', label: '$30k \u2013 $80k' },
  { value: '$80k - $150k', label: '$80k \u2013 $150k' },
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
  'E-Beam': 'E-Beam', 'E-Beam Evaporator': 'E-Beam', 'E-Beam Evaporation': 'E-Beam', 'MEB-600': 'E-Beam', 'Evaporator': 'E-Beam', 'Evaporation': 'E-Beam',
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
// Tailwind class constants
// ---------------------------------------------------------------------------
const inputClasses = "w-full border-0 border-b border-outline-variant focus:ring-0 focus:border-primary p-3 bg-transparent font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors";
const selectClasses = "w-full border-0 border-b border-outline-variant focus:ring-0 focus:border-primary p-3 bg-transparent font-body text-on-surface outline-none transition-colors";
const textareaClasses = "w-full border border-outline-variant/20 focus:ring-0 focus:border-primary p-3 bg-surface-container-low rounded-lg font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors resize-y";
const labelClasses = "block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1";

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

  // ─── Form interaction tracking for behavior scoring ───────────────────────
  const formInteractionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formStartedRef = useRef(false);
  const lastFilledRef = useRef(0);
  useEffect(() => {
    if (formInteractionTimer.current) clearTimeout(formInteractionTimer.current);
    formInteractionTimer.current = setTimeout(() => {
      // Count non-empty, non-default fields
      const filledFields = Object.entries(formData).filter(([key, val]) => {
        if (key === 'needsBudgetaryQuote') return val === true;
        if (key === 'quantity') return val !== 1;
        if (key === 'shippingCountry') return val !== 'United States';
        return typeof val === 'string' && val.trim().length > 0;
      }).length;
      const totalFields = Object.keys(initialFormData).length;
      if (filledFields > 0) {
        if (!formStartedRef.current) {
          behaviorAnalytics.trackFormStarted('rfq');
          formStartedRef.current = true;
        }
        lastFilledRef.current = filledFields;
        behaviorAnalytics.trackFormInteraction('rfq', filledFields, totalFields);
      }
    }, 5000);
    return () => {
      // On cleanup (page leave/unmount), flush immediately if timer pending
      if (formInteractionTimer.current) {
        clearTimeout(formInteractionTimer.current);
        const filledFields = Object.entries(formData).filter(([key, val]) => {
          if (key === 'needsBudgetaryQuote') return val === true;
          if (key === 'quantity') return val !== 1;
          if (key === 'shippingCountry') return val !== 'United States';
          return typeof val === 'string' && val.trim().length > 0;
        }).length;
        const totalFields = Object.keys(initialFormData).length;
        if (filledFields > 0) {
          if (!formStartedRef.current) {
            behaviorAnalytics.trackFormStarted('rfq');
            formStartedRef.current = true;
          }
          lastFilledRef.current = filledFields;
          behaviorAnalytics.trackFormInteraction('rfq', filledFields, totalFields);
        }
      }
    };
  }, [formData]);

  // ─── Form abandonment tracking on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (formStartedRef.current) {
        const totalFields = Object.keys(initialFormData).length;
        behaviorAnalytics.trackFormAbandoned('rfq', lastFilledRef.current, totalFields);
      }
    };
  }, []);

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
      // Scroll to step indicator instead of page top -- user already saw the hero
      requestAnimationFrame(() => {
        stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      analytics.trackCustomEvent('RFQ Step 2: Project Details', {
        step: 2,
        equipmentCategory: formData.equipmentCategory,
      });
    } else {
      const firstError = formRef.current?.querySelector('[data-field-error]');
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
      const firstError = formRef.current?.querySelector('[data-field-error]');
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
      behaviorAnalytics.trackFormCompleted('rfq');
      setFormData(initialFormData);
      setFiles([]);
      setCurrentStep(1);
      setTurnstileToken(null);
      analytics.trackRFQSubmission(formData.equipmentCategory, formData.specificModel || formData.equipmentCategory);
      analytics.segment.trackRFQSubmissionWithAnalysis(formData.equipmentCategory, formData.specificModel || formData.equipmentCategory, result.rfqId, formData.institution);
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
        {/* Hero */}
        <section className="bg-primary py-20 px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-headline font-bold text-on-primary mb-4">Request a Technical Proposal or Quote</h1>
            <p className="text-lg text-on-primary/80 max-w-2xl mx-auto">
              Share your process requirements and application goals. Our engineering team will review your inquiry and recommend a suitable equipment configuration.
            </p>
          </div>
        </section>

        {/* Success Card */}
        <section className="py-16 px-8" ref={successRef}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-10 text-center">
              <span
                className="material-symbols-outlined text-7xl text-green-500 mb-6 block"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <h2 className="text-3xl font-headline font-bold mb-4">Thank You for Your Inquiry!</h2>
              <p className="text-on-surface-variant text-lg mb-8">
                We've received your request and our engineering team will review your requirements.
              </p>
              {referenceNumber && (
                <div className="bg-surface-container-low rounded-lg p-4 mb-8 inline-block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Reference Number</span>
                  <span className="text-xl font-headline font-bold text-primary">{referenceNumber}</span>
                </div>
              )}
              <div className="bg-surface-container-low rounded-xl p-6 text-left mb-8">
                <h3 className="text-lg font-headline font-bold mb-4">What Happens Next</h3>
                <ol className="space-y-3 text-sm text-on-surface-variant list-decimal list-inside">
                  <li><span className="font-bold text-on-surface">Engineering Review</span> &mdash; Our technical team evaluates your process requirements and constraints</li>
                  <li><span className="font-bold text-on-surface">Equipment Recommendation</span> &mdash; We prepare a suitable configuration or budgetary quotation</li>
                  <li><span className="font-bold text-on-surface">Follow-Up Discussion</span> &mdash; Expect a response within 1 business day</li>
                </ol>
              </div>
              <p className="text-sm text-on-surface-variant mb-8">A confirmation email has been sent to your email address.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <button
                  className="bg-primary text-white py-3 px-8 rounded-sm font-bold uppercase hover:bg-primary-container transition-colors"
                  onClick={() => { setIsSuccess(false); setReferenceNumber(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Submit Another Request
                </button>
                <a href="/products" className="border border-outline-variant py-3 px-8 rounded-sm font-bold uppercase text-on-surface hover:bg-surface-container-low transition-colors">
                  Browse Equipment
                </a>
              </div>
              <p className="text-xs text-on-surface-variant">
                For urgent inquiries, contact us directly at <a href="mailto:sales@ninescrolls.com" className="text-primary hover:underline">sales@ninescrolls.com</a>
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
      <section className="bg-primary py-20 px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-on-primary mb-4">
            Request a Technical Proposal or Budgetary Quote
          </h1>
          <p className="text-lg text-on-primary/80 max-w-3xl mx-auto mb-8">
            Share your process requirements, application goals, and technical constraints.
            Our engineering team will review your inquiry and recommend a suitable equipment configuration
            or preliminary quotation.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            <span className="bg-on-primary/10 text-on-primary text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Custom Configurations</span>
            <span className="bg-on-primary/10 text-on-primary text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Engineering Review</span>
            <span className="bg-on-primary/10 text-on-primary text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Response Within 1 Business Day</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-center items-center">
            <span className="text-on-primary/60 text-sm">Typical applications:</span>
            {['Plasma Cleaning', 'Surface Activation', 'RIE Etching', 'Thin Film Deposition', 'Materials Research'].map(app => (
              <span key={app} className="text-on-primary/80 text-xs bg-on-primary/5 px-3 py-1 rounded-full">{app}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-surface-container-low py-12 px-8 border-b border-outline-variant/10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex gap-4 items-start">
            <span className="material-symbols-outlined text-3xl text-primary shrink-0">groups</span>
            <div>
              <p className="font-bold text-sm mb-1">Who We Serve</p>
              <p className="text-xs text-on-surface-variant">Universities, national labs, R&amp;D centers, and semiconductor pilot-line programs</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="material-symbols-outlined text-3xl text-primary shrink-0">description</span>
            <div>
              <p className="font-bold text-sm mb-1">What You Can Request</p>
              <p className="text-xs text-on-surface-variant">Budgetary quote, technical consultation, custom configuration, or platform comparison</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="material-symbols-outlined text-3xl text-primary shrink-0">trending_up</span>
            <div>
              <p className="font-bold text-sm mb-1">What Happens Next</p>
              <ol className="text-xs text-on-surface-variant list-decimal list-inside space-y-0.5">
                <li>Submit your requirements</li>
                <li>Engineering review by our team</li>
                <li>Proposal or technical consultation</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16 px-8">
        <div className="max-w-3xl mx-auto">

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4 mb-12" ref={stepsRef}>
            <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-primary' : 'text-on-surface-variant/40'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-outline-variant/20 text-on-surface-variant'}`}>1</span>
              <span className="text-sm font-bold hidden sm:inline">Your Information</span>
            </div>
            <div className={`h-px flex-grow max-w-16 ${currentStep >= 2 ? 'bg-primary' : 'bg-outline-variant/20'}`} />
            <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-primary' : 'text-on-surface-variant/40'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-outline-variant/20 text-on-surface-variant'}`}>2</span>
              <span className="text-sm font-bold hidden sm:inline">Project Details</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} ref={formRef} noValidate>

            {/* Honeypot */}
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="rfq-website">Website</label>
              <input type="text" id="rfq-website" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            {/* ============================================================ */}
            {/* STEP 1: Your Information & Requirements                      */}
            {/* ============================================================ */}
            {currentStep === 1 && (
              <>
                {/* Contact Information */}
                <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-8 mb-6">
                  <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">Contact Information</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rfq-name" className={labelClasses}>Full Name <span className="text-red-500">*</span></label>
                        <input type="text" id="rfq-name" name="name" value={formData.name} onChange={handleChange} onBlur={handleBlur} placeholder="Full name" required className={inputClasses} />
                        {fieldErrors.name && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.name}</span>}
                      </div>
                      <div>
                        <label htmlFor="rfq-email" className={labelClasses}>Email <span className="text-red-500">*</span></label>
                        <input type="email" id="rfq-email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="you@university.edu" required className={inputClasses} />
                        {fieldErrors.email && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.email}</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rfq-phone" className={labelClasses}>Phone <span className="text-on-surface-variant/50 text-[10px]">(optional)</span></label>
                        <input type="tel" id="rfq-phone" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="+1 (650) xxx-xxxx" className={inputClasses} />
                        {fieldErrors.phone && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.phone}</span>}
                      </div>
                      <div>
                        <label htmlFor="rfq-role" className={labelClasses}>Role <span className="text-on-surface-variant/50 text-[10px]">(optional)</span></label>
                        <select id="rfq-role" name="role" value={formData.role} onChange={handleChange} className={selectClasses}>
                          <option value="">Select your role...</option>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rfq-institution" className={labelClasses}>Institution / Organization <span className="text-red-500">*</span></label>
                        <input type="text" id="rfq-institution" name="institution" value={formData.institution} onChange={handleChange} onBlur={handleBlur} placeholder="University or company name" required className={inputClasses} />
                        {fieldErrors.institution && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.institution}</span>}
                      </div>
                      <div>
                        <label htmlFor="rfq-department" className={labelClasses}>Department <span className="text-on-surface-variant/50 text-[10px]">(optional)</span></label>
                        <input type="text" id="rfq-department" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Materials Science & Engineering" className={inputClasses} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipment & Application */}
                <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-8 mb-6">
                  <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">Equipment &amp; Application</h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="rfq-equipmentCategory" className={labelClasses}>Equipment Category <span className="text-red-500">*</span></label>
                      <select id="rfq-equipmentCategory" name="equipmentCategory" value={formData.equipmentCategory} onChange={handleChange} onBlur={handleBlur} required className={selectClasses}>
                        <option value="">Select equipment type...</option>
                        {EQUIPMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      {fieldErrors.equipmentCategory && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.equipmentCategory}</span>}
                    </div>
                    <div>
                      <label htmlFor="rfq-applicationDescription" className={labelClasses}>
                        Application / Research Goal <span className="text-red-500">*</span>
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
                        className={textareaClasses}
                      />
                      <span className="text-xs text-on-surface-variant/60 mt-1 block">
                        {formData.applicationDescription.length}/3000 &mdash; Examples: plasma cleaning before bonding, SiO&#x2082; etching at &lt;100nm features, low-temperature PECVD for a-Si:H, RF sputtering of metal films, surface activation for polymers
                      </span>
                      {fieldErrors.applicationDescription && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.applicationDescription}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="bg-primary text-white py-4 px-8 rounded-sm font-bold uppercase hover:bg-primary-container transition-colors flex items-center gap-2"
                    onClick={handleNext}
                  >
                    Continue to Project Details
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </div>
              </>
            )}

            {/* ============================================================ */}
            {/* STEP 2: Project & Technical Details                          */}
            {/* ============================================================ */}
            {currentStep === 2 && (
              <>
                {/* Technical Details */}
                <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-8 mb-6">
                  <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">
                    Technical Details <span className="text-on-surface-variant/50 text-sm font-normal">(optional)</span>
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="rfq-keySpecifications" className={labelClasses}>Technical Requirements</label>
                      <textarea
                        id="rfq-keySpecifications"
                        name="keySpecifications"
                        value={formData.keySpecifications}
                        onChange={handleChange}
                        placeholder="Chamber size, wafer/substrate dimensions, gas lines needed, temperature range, RF power, vacuum level, throughput, automation requirements, etc."
                        rows={4}
                        className={textareaClasses}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rfq-specificModel" className={labelClasses}>Preferred Model <span className="text-on-surface-variant/50 text-[10px]">(optional)</span></label>
                        <input type="text" id="rfq-specificModel" name="specificModel" value={formData.specificModel} onChange={handleChange} placeholder='e.g. "ICP-100A" or "Need recommendation"' className={inputClasses} />
                      </div>
                      <div>
                        <label htmlFor="rfq-quantity" className={labelClasses}>Quantity</label>
                        <input type="number" id="rfq-quantity" name="quantity" value={formData.quantity} onChange={handleChange} onBlur={handleBlur} min={1} step={1} className={inputClasses} />
                        {fieldErrors.quantity && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.quantity}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Planning */}
                <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-8 mb-6">
                  <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">
                    Project Planning <span className="text-on-surface-variant/50 text-sm font-normal">(optional)</span>
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rfq-budgetRange" className={labelClasses}>Budget Range</label>
                        <select id="rfq-budgetRange" name="budgetRange" value={formData.budgetRange} onChange={handleChange} className={selectClasses}>
                          {BUDGET_RANGES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="rfq-timeline" className={labelClasses}>Timeline</label>
                        <select id="rfq-timeline" name="timeline" value={formData.timeline} onChange={handleChange} className={selectClasses}>
                          {TIMELINES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rfq-fundingStatus" className={labelClasses}>Funding Status</label>
                        <select id="rfq-fundingStatus" name="fundingStatus" value={formData.fundingStatus} onChange={handleChange} className={selectClasses}>
                          {FUNDING_STATUSES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="rfq-referralSource" className={labelClasses}>How did you hear about us?</label>
                        <select id="rfq-referralSource" name="referralSource" value={formData.referralSource} onChange={handleChange} className={selectClasses}>
                          {REFERRAL_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Budgetary Quote */}
                <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-8 mb-6">
                  <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">
                    Budgetary Quote <span className="text-on-surface-variant/50 text-sm font-normal">(optional)</span>
                  </h2>
                  <label className="flex items-start gap-3 cursor-pointer mb-4">
                    <input type="checkbox" name="needsBudgetaryQuote" checked={formData.needsBudgetaryQuote} onChange={handleChange} className="mt-1 w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary" />
                    <span className="text-sm text-on-surface">I need a budgetary quote (for budgeting or grant planning) &mdash; requires shipping address</span>
                  </label>
                  {formData.needsBudgetaryQuote && (
                    <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                      <p className="text-xs text-on-surface-variant">Shipping address is required to calculate applicable taxes for your budgetary quote.</p>
                      <div>
                        <label htmlFor="rfq-shippingAddress" className={labelClasses}>Street Address <span className="text-red-500">*</span></label>
                        <input type="text" id="rfq-shippingAddress" name="shippingAddress" value={formData.shippingAddress} onChange={handleChange} onBlur={handleBlur} placeholder="Street address" autoComplete="street-address" required className={inputClasses} />
                        {fieldErrors.shippingAddress && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.shippingAddress}</span>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="rfq-shippingCity" className={labelClasses}>City <span className="text-red-500">*</span></label>
                          <input type="text" id="rfq-shippingCity" name="shippingCity" value={formData.shippingCity} onChange={handleChange} onBlur={handleBlur} placeholder="City" autoComplete="address-level2" required className={inputClasses} />
                          {fieldErrors.shippingCity && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.shippingCity}</span>}
                        </div>
                        <div>
                          <label htmlFor="rfq-shippingState" className={labelClasses}>State / Province <span className="text-red-500">*</span></label>
                          <input type="text" id="rfq-shippingState" name="shippingState" value={formData.shippingState} onChange={handleChange} onBlur={handleBlur} placeholder="State or province" autoComplete="address-level1" required className={inputClasses} />
                          {fieldErrors.shippingState && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.shippingState}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="rfq-shippingZipCode" className={labelClasses}>ZIP / Postal Code <span className="text-red-500">*</span></label>
                          <input type="text" id="rfq-shippingZipCode" name="shippingZipCode" value={formData.shippingZipCode} onChange={handleChange} onBlur={handleBlur} placeholder="ZIP or postal code" autoComplete="postal-code" required className={inputClasses} />
                          {fieldErrors.shippingZipCode && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.shippingZipCode}</span>}
                        </div>
                        <div>
                          <label htmlFor="rfq-shippingCountry" className={labelClasses}>Country <span className="text-red-500">*</span></label>
                          <select id="rfq-shippingCountry" name="shippingCountry" value={formData.shippingCountry} onChange={handleChange} autoComplete="country-name" required className={selectClasses}>
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Supporting Materials */}
                <div className="bg-white rounded-xl border border-outline-variant/10 shadow-sm p-8 mb-6">
                  <h2 className="text-xl font-headline font-bold border-b pb-2 mb-6">
                    Supporting Materials <span className="text-on-surface-variant/50 text-sm font-normal">(optional)</span>
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="rfq-existingEquipment" className={labelClasses}>Existing Equipment</label>
                      <textarea
                        id="rfq-existingEquipment"
                        name="existingEquipment"
                        value={formData.existingEquipment}
                        onChange={handleChange}
                        placeholder="List any existing tools relevant to this project (e.g., plasma cleaner, RIE, PECVD, spin coater, vacuum pumps, gas cabinets, substrate sizes supported, or legacy systems)."
                        rows={3}
                        className={textareaClasses}
                      />
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className={labelClasses}>Upload Specifications, Drawings, Process Notes, or RFQ Documents <span className="text-on-surface-variant/50 text-[10px]">(max 3 files, 10MB each)</span></label>
                      <div className="mt-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" multiple className="hidden" id="rfq-file-upload" />
                        <label
                          htmlFor="rfq-file-upload"
                          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-outline-variant/30 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-2">upload_file</span>
                          <span className="text-sm text-on-surface-variant">Click to upload or drag and drop</span>
                          <span className="text-xs text-on-surface-variant/50 mt-1">PDF, DOCX, XLSX, JPG, PNG</span>
                        </label>
                      </div>
                      {files.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {files.map((file, index) => (
                            <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-surface-container-low rounded-lg p-3 text-sm">
                              <span className="font-medium truncate mr-4">{file.name}</span>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-on-surface-variant">{formatFileSize(file.size)}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  aria-label={`Remove ${file.name}`}
                                  className="text-on-surface-variant hover:text-red-500 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {fieldErrors.files && <span data-field-error className="text-red-500 text-xs mt-1 block">{fieldErrors.files}</span>}
                    </div>

                    <div>
                      <label htmlFor="rfq-additionalComments" className={labelClasses}>Special Requirements / Additional Notes</label>
                      <textarea
                        id="rfq-additionalComments"
                        name="additionalComments"
                        value={formData.additionalComments}
                        onChange={handleChange}
                        placeholder="Any additional details, constraints, timeline considerations, or questions for our engineering team."
                        rows={3}
                        className={textareaClasses}
                      />
                    </div>
                  </div>
                </div>

                {/* Privacy Consent */}
                <p className="text-xs text-on-surface-variant text-center mb-4">
                  By submitting, you agree that NineScrolls may use this information to prepare a quotation and contact you regarding this inquiry.
                </p>

                {/* Turnstile */}
                {turnstileSiteKey && <div className="flex justify-center mb-4" ref={turnstileRef} />}

                {/* Submit note */}
                <div className="bg-surface-container-low rounded-lg p-4 mb-6 text-center">
                  <p className="text-xs text-on-surface-variant">All inquiries are reviewed by our technical team. Typical response time: within 1 business day.</p>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm">
                    {submitError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center gap-4">
                  <button
                    type="button"
                    className="border border-outline-variant py-3 px-6 rounded-sm font-bold uppercase text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2"
                    onClick={() => { setCurrentStep(1); requestAnimationFrame(() => { stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }}
                  >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bg-primary text-white py-4 px-8 rounded-sm font-bold uppercase hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || (!!turnstileSiteKey && !turnstileToken)}
                  >
                    {isSubmitting ? 'Submitting...' : 'Request Proposal'}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Need Help + Trust Signal */}
          <div className="mt-12 space-y-4">
            <div className="flex gap-4 items-start bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
              <span className="material-symbols-outlined text-2xl text-primary shrink-0">help</span>
              <div>
                <p className="font-bold text-sm">Need help defining your requirements?</p>
                <p className="text-xs text-on-surface-variant">Our team can recommend suitable equipment configurations. <a href="mailto:sales@ninescrolls.com" className="text-primary hover:underline">sales@ninescrolls.com</a></p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-base">shield</span>
              <span>Serving U.S. universities and research labs &bull; San Diego, California</span>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-on-surface-variant/60">
              Your information is kept confidential and will only be used to prepare your quotation.
              We do not share your data with third parties. See our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
