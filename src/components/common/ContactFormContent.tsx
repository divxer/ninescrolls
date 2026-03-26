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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Honeypot field - hidden from real users, bots will fill it */}
      <div className="absolute opacity-0 -z-10 h-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
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
        <div className="flex flex-col gap-2">
          <label htmlFor="inquiryType" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Inquiry Type
          </label>
          <select
            id="inquiryType"
            name="inquiryType"
            value={inquiryType || ''}
            onChange={(e) => onInquiryTypeChange((e.target.value || null) as InquiryType)}
            className="bg-surface-container-low border-none p-4 rounded-sm font-body text-on-surface focus:ring-0"
          >
            <option value="">General Inquiry</option>
            {Object.entries(INQUIRY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Name
        </label>
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
          className="bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-3 font-body text-on-surface transition-colors"
        />
        {fieldErrors.name && <span className="text-red-500 text-xs mt-1 block">{fieldErrors.name}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Email
        </label>
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
          className="bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-3 font-body text-on-surface transition-colors"
        />
        {fieldErrors.email && <span className="text-red-500 text-xs mt-1 block">{fieldErrors.email}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          autoComplete="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-3 font-body text-on-surface transition-colors"
        />
        <span className="text-xs text-on-surface-variant">
          Optional. Only if you prefer a call.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="organization" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Organization
        </label>
        <input
          type="text"
          id="organization"
          name="organization"
          autoComplete="organization"
          value={formData.organization}
          onChange={(e) => handleChange('organization', e.target.value)}
          className="bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-3 font-body text-on-surface transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Message
        </label>
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
          className="bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-3 font-body text-on-surface transition-colors resize-y min-h-[120px]"
        />
        {fieldErrors.message && <span className="text-red-500 text-xs mt-1 block">{fieldErrors.message}</span>}
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-sm text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          type="submit"
          className="w-full bg-primary text-white py-4 rounded-sm font-bold uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting || Object.keys(fieldErrors).length > 0}
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </form>
  );
}
