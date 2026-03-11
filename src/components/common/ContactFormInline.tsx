import { useState, useEffect, useRef } from 'react';
import { ContactFormContent } from './ContactFormContent';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface ContactFormInlineProps {
  className?: string;
  topic?: string;
  inquiryType?: 'feasibility' | 'engineer' | null;
  onInquiryTypeChange?: (type: 'feasibility' | 'engineer' | null) => void;
  prefillEmail?: string;
  onSuccess?: () => void;
}

function getPrefillMessage(topic?: string, inquiryType?: 'feasibility' | 'engineer' | null): string {
  // Priority: inquiryType > topic
  if (inquiryType === 'feasibility') {
    return '[Technical Feasibility Check]\n\n';
  }
  if (inquiryType === 'engineer') {
    return '[Talk to an Engineer]\n\n';
  }

  // Fallback to topic-based messages
  switch (topic) {
    case 'newsletter':
      return 'I would like to subscribe to your newsletter to stay updated with your latest insights, product updates, and technical resources.';
    case 'service':
      return 'I would like to start service planning for my equipment.';
    case 'amc':
      return 'Please provide AMC pricing and available service options.';
    case 'tco':
      return 'Please send a 5-year TCO report and assumptions.';
    case 'expert':
      return 'I would like to talk to an expert about my application.';
    case 'compare':
      return 'Please send the detailed comparison versus major manufacturers.';
    default:
      return '';
  }
}

export function ContactFormInline({ className = '', topic, inquiryType, onInquiryTypeChange, prefillEmail, onSuccess }: ContactFormInlineProps) {
  const analytics = useCombinedAnalytics();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: prefillEmail || '',
    phone: '',
    organization: '',
    message: getPrefillMessage(topic, inquiryType),
    website: '', // honeypot
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);

  // Update message when inquiryType changes
  useEffect(() => {
    if (inquiryType) {
      const prefix = getPrefillMessage(topic, inquiryType);
      setFormData(prev => {
        // Only update if message is empty or starts with a prefix
        if (!prev.message || prev.message.startsWith('[')) {
          return { ...prev, message: prefix };
        }
        return prev;
      });
    }
  }, [inquiryType, topic]);

  // Scroll to success message when it appears
  useEffect(() => {
    if (isSuccess && successRef.current) {
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check - if the hidden field is filled, silently "succeed"
    if (formData.website) {
      setIsSuccess(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { website: _honeypot, ...submitData } = formData;
      const response = await fetch('https://api.ninescrolls.com/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...submitData,
          productName: 'General Inquiry',
          topic: topic || 'general',
          inquiryType: inquiryType || 'general',
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
        message: '',
        website: '',
      });

      // Notify parent of success (e.g., to reset inquiry type)
      onSuccess?.();

      // Send form_submit event to Google Analytics and Segment
      const inquiryTypeLabel = inquiryType === 'feasibility' ? 'Technical Feasibility Check' :
                               inquiryType === 'engineer' ? 'Talk to an Engineer' :
                               topic === 'newsletter' ? 'Newsletter Subscription' :
                               topic === 'service' ? 'Service Planning' :
                               topic === 'amc' ? 'AMC Inquiry' :
                               topic === 'tco' ? 'TCO Report Request' :
                               topic === 'expert' ? 'Expert Consultation' :
                               topic === 'compare' ? 'Product Comparison' :
                               'General Inquiry';
      analytics.trackContactFormSubmit(inquiryTypeLabel, inquiryTypeLabel);
      analytics.segment.trackContactFormSubmitWithAnalysis(inquiryTypeLabel, inquiryTypeLabel);
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
        <div className="success-message" ref={successRef}>
          <h3>
            {topic === 'newsletter' ? 'Successfully Subscribed!' : 'Thank You for Your Message!'}
          </h3>
          <p>
            {topic === 'newsletter'
              ? 'Thank you for subscribing to our newsletter! You\'ll receive our latest insights, product updates, and technical resources (1–2 emails per month). We respect your privacy and you can unsubscribe at any time.'
              : 'We have received your inquiry and will get back to you within 1–2 business days.'
            }
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setIsSuccess(false)}
          >
            {topic === 'newsletter' ? 'Subscribe Another Email' : 'Send Another Message'}
          </button>
        </div>
      ) : (
        <ContactFormContent
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={error}
          inquiryType={inquiryType}
          onInquiryTypeChange={onInquiryTypeChange}
        />
      )}
    </div>
  );
}
