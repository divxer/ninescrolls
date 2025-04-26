import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactFormModalProps } from '../../types';

export function ContactFormModal({ 
  isOpen, 
  onClose, 
  productName, 
  formData, 
  onFormDataChange, 
  onSuccess 
}: ContactFormModalProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onFormDataChange({ ...formData, [name]: value });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formDataToSubmit = {
      productName,
      ...formData
    };

    if (!formDataToSubmit.message.trim()) {
      console.log('Validation failed: Message is empty');
      setError('Please provide a message');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('Starting form submission...');
      console.log('Form data:', JSON.stringify(formDataToSubmit, null, 2));
      
      const response = await fetch('https://api.ninescrolls.us/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataToSubmit)
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        console.error('Request failed:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        throw new Error(`Failed to submit form: ${response.status} ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed response:', result);
      } catch (e) {
        console.warn('Failed to parse response as JSON:', responseText);
        result = { message: 'Form submitted successfully' };
      }

      console.log('Form submission successful');
      setIsSuccess(true);
      setIsSubmitting(false);
      onFormDataChange({
        name: '',
        email: '',
        phone: '',
        organization: '',
        message: ''
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error in form submission:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      setError(error instanceof Error ? error.message : 'Failed to submit form. Please try again later.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal" data-open={isOpen}>
      <div className="modal-content" role="dialog" aria-labelledby="modalTitle">
        {!isSuccess ? (
          <>
            <span className="close-button" aria-label="Close" onClick={onClose}>&times;</span>
            <h2 id="modalTitle">Request Product Information</h2>
            <p className="modal-subtitle">Please fill out the form below and we'll get back to you shortly.</p>
            {error && <div className="error-message">{error}</div>}
            <form id="contactForm" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="productName">Product:</label>
                <input type="text" id="productName" name="productName" value={productName} readOnly className="form-control-readonly" />
              </div>
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
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone:</label>
                <input 
                  type="tel" 
                  id="phone" 
                  name="phone" 
                  pattern="[0-9+\-\s()]*" 
                  placeholder="Optional: Enter your phone number" 
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="organization">Organization:</label>
                <input 
                  type="text" 
                  id="organization" 
                  name="organization" 
                  placeholder="Optional: Enter your organization name" 
                  autoComplete="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea 
                  id="message" 
                  name="message" 
                  rows={4} 
                  required 
                  placeholder="Please let us know your specific requirements or questions"
                  value={formData.message}
                  onChange={handleInputChange}
                ></textarea>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="form-success" data-success={isSuccess}>
            <span className="close-button" aria-label="Close" onClick={onClose}>&times;</span>
            <div className="success-content">
              <span className="success-icon">✓</span>
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
              <div className="success-actions">
                <p>Meanwhile, you might be interested in:</p>
                <div className="action-buttons">
                  <a href={`/docs/${productName.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-').replace(/-series$/, '').replace(/--+/g, '-').trim()}-datasheet.pdf`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
                    <span className="icon-download"></span> Download Product Datasheet
                  </a>
                  <Link to="/products" className="btn btn-secondary">
                    <span className="icon-browse"></span> Browse Other Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 