import { FormEvent, useState } from 'react';

interface FormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
  website: string; // honeypot field
}

interface ContactFormContentProps {
  formData: FormData;
  onFormDataChange: (data: FormData) => void;
  onSubmit: (e: FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
  productName?: string;
}

export function ContactFormContent({
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
  error,
  productName
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

      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
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
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
        />
        <span style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem', display: 'block' }}>
          Optional. Only if you prefer a call.
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="organization">Organization</label>
        <input
          type="text"
          id="organization"
          value={formData.organization}
          onChange={(e) => handleChange('organization', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
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
