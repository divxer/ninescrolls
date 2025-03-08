import { useState } from 'react';
import { ContactFormContent } from './ContactFormContent';

interface ContactFormInlineProps {
  className?: string;
}

export function ContactFormInline({ className = '' }: ContactFormInlineProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('https://api.ninescrolls.us/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          productName: 'General Inquiry'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setIsSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        organization: '',
        message: ''
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again or contact us directly at info@ninescrolls.com');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`contact-form ${className}`}>
      {isSuccess ? (
        <div className="success-message">
          <h3>Thank You for Your Message!</h3>
          <p>We have received your inquiry and will get back to you shortly.</p>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsSuccess(false)}
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <ContactFormContent
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </div>
  );
} 