import { FormEvent, useState } from 'react';

interface FormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
  website: string; // honeypot field
}

type InquiryType = 'feasibility' | 'engineer' | null;

interface ContactFormContentProps {
  formData: FormData;
  onFormDataChange: (data: FormData) => void;
  onSubmit: (e: FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
  productName?: string;
  inquiryType?: InquiryType;
  onInquiryTypeChange?: (type: InquiryType) => void;
}

const INQUIRY_TYPE_LABELS: Record<string, string> = {
  feasibility: 'Technical Feasibility Check',
  engineer: 'Talk to an Engineer',
};

export function ContactFormContent({
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
  error,
  productName,
  inquiryType,
  onInquiryTypeChange,
}: ContactFormContentProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (name: string, value: string) => {
    const errors = { ...fieldErrors };

    switch (name) {
      case 'name':
        if (value && value.trim().length < 2) {
          errors.name = 'Please enter at least 2 characters.';
        } else {
          delete errors.name;
        }
        break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.email = 'Please enter a valid email address.';
        } else {
          delete errors.email;
        }
        break;
      case 'message':
        if (value && value.trim().length < 10) {
          errors.message = 'Please provide a bit more detail (at least 10 characters).';
        } else {
          delete errors.message;
        }
        break;
      default:
        break;
    }

    setFieldErrors(errors);
  };

  const handleChange = (name: string, value: string) => {
    onFormDataChange({ ...formData, [name]: value });
  };

  const handleBlur = (name: string, value: string) => {
    validateField(name, value);
  };

  return (
    <form onSubmit={onSubmit} className="contact-form-content">
      {/* Honeypot field - hidden from real users, bots will fill it */}
      <div className="honeypot-field" aria-hidden="true" tabIndex={-1}>
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          name="website"
          value={formData.website}
          onChange={(e) => handleChange('website', e.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      {onInquiryTypeChange && (
        <div className="form-group">
          <label htmlFor="inquiryType">Inquiry Type</label>
          <select
            id="inquiryType"
            name="inquiryType"
            value={inquiryType || ''}
            onChange={(e) => onInquiryTypeChange((e.target.value || null) as InquiryType)}
          >
            <option value="">General Inquiry</option>
            {Object.entries(INQUIRY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          name="name"
          autoComplete="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={(e) => handleBlur('name', e.target.value)}
          required
          placeholder=" "
        />
        {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={(e) => handleBlur('email', e.target.value)}
          required
          placeholder=" "
        />
        {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="phone">Phone</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          autoComplete="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
        />
        <span className="field-hint">
          Optional. Only if you prefer a call.
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="organization">Organization</label>
        <input
          type="text"
          id="organization"
          name="organization"
          autoComplete="organization"
          value={formData.organization}
          onChange={(e) => handleChange('organization', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={(e) => handleChange('message', e.target.value)}
          onBlur={(e) => handleBlur('message', e.target.value)}
          required
          rows={5}
          placeholder={
            productName
              ? `I would like to learn more about ${productName}...`
              : 'Briefly describe your material, process goal, or evaluation stage (early discussion is perfectly fine)'
          }
        />
        {fieldErrors.message && <span className="field-error">{fieldErrors.message}</span>}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || Object.keys(fieldErrors).length > 0}
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </form>
  );
}
