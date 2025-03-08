import { FormEvent } from 'react';

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
}

interface ContactFormContentProps {
  formData: ContactFormData;
  onFormDataChange: (data: ContactFormData) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
  productName?: string;
}

export function ContactFormContent({
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting = false,
  error = null,
  productName
}: ContactFormContentProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onFormDataChange({ ...formData, [name]: value });
  };

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="error-message">{error}</div>}
      {productName && (
        <div className="form-group">
          <label htmlFor="productName">Product:</label>
          <input 
            type="text" 
            id="productName" 
            name="productName" 
            value={productName} 
            readOnly 
            className="form-control-readonly" 
          />
        </div>
      )}
      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          name="name"
          required
          placeholder="Enter your full name"
          autoComplete="name"
          value={formData.name}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          placeholder="Enter your email address"
          autoComplete="email"
          value={formData.email}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="phone">Phone</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          pattern="[0-9+\\-\\s()]*"
          placeholder="Optional: Enter your phone number"
          autoComplete="tel"
          value={formData.phone}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="organization">Organization</label>
        <input
          type="text"
          id="organization"
          name="organization"
          placeholder="Optional: Enter your organization name"
          autoComplete="organization"
          value={formData.organization}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Please let us know your specific requirements or questions"
          value={formData.message}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
      </div>
      
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