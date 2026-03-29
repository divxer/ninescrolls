import { useState, FormEvent } from 'react';
import { ContactFormContent } from './common/ContactFormContent';
import { submitLead } from '../services/leadsService';

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
    message: '',
    website: '',
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await submitLead({
        type: 'contact',
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        organization: formData.organization || undefined,
        message: formData.message,
        productName: product?.name,
      });

      setIsSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        organization: '',
        message: '',
        website: '',
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
        <div className="text-center py-8">
          <h3 className="text-green-600 font-headline text-xl font-bold mb-4">Thank You for Your Message!</h3>
          <p className="text-on-surface-variant mb-6">We have received your inquiry and will get back to you shortly.</p>
          <button
            className="w-full bg-primary text-white py-4 rounded-sm font-bold uppercase tracking-widest hover:bg-primary-container transition-colors"
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
      <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-[600px] relative max-h-[90vh] overflow-y-auto mx-4 md:mx-0">
          {onClose && (
            <button
              className="absolute top-4 right-4 bg-transparent border-none text-2xl cursor-pointer text-on-surface-variant leading-none px-2 py-1 hover:text-on-surface transition-colors"
              onClick={onClose}
            >
              &times;
            </button>
          )}
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-6">
            {product ? `Request Information: ${product.name}` : 'Contact Us'}
          </h2>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white p-8 md:p-6 rounded-lg shadow-sm w-full ${className}`}>
      {content}
    </div>
  );
}
