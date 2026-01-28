import { FormEvent } from 'react';

interface FormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
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
  return (
    <form onSubmit={onSubmit} className="contact-form-content">
      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="phone">Phone</label>
        <input
          type="tel"
          id="phone"
          value={formData.phone}
          onChange={(e) => onFormDataChange({ ...formData, phone: e.target.value })}
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
          onChange={(e) => onFormDataChange({ ...formData, organization: e.target.value })}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => onFormDataChange({ ...formData, message: e.target.value })}
          required
          rows={5}
          placeholder={
            productName 
              ? `I would like to learn more about ${productName}...` 
              : 'Briefly describe your material, process goal, or evaluation stage (early discussion is perfectly fine)'
          }
        />
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
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </form>
  );
} 