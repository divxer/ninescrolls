import { useState, FormEvent } from 'react';
import { ContactFormContent } from './common/ContactFormContent';
import '../styles/ContactForm.css';

interface Product {
  id: string;
  name: string;
}

interface ContactFormProps {
  onClose?: () => void;
  product?: Product;
  className?: string;
  isModal?: boolean;
}

export function ContactForm({ onClose, product, className = '', isModal = false }: ContactFormProps) {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('https://api.ninescrolls.com/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          productName: product?.name
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
      onClose?.();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again or contact us directly at info@ninescrolls.com');
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <>
      {isSuccess && !isModal ? (
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
          productName={product?.name}
        />
      )}
    </>
  );

  if (isModal) {
    return (
      <div className="contact-form-overlay">
        <div className="contact-form-container">
          {onClose && <button className="close-button" onClick={onClose}>×</button>}
          <h2>{product ? `Request Information: ${product.name}` : 'Contact Us'}</h2>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={`contact-form ${className}`}>
      {content}
    </div>
  );
} 