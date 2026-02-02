import { useState, useEffect } from 'react';
import { ContactFormContent } from './ContactFormContent';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface ContactFormInlineProps {
  className?: string;
  topic?: string;
  inquiryType?: 'budgetary' | 'feasibility' | 'engineer' | null;
}

function getPrefillMessage(topic?: string, inquiryType?: 'budgetary' | 'feasibility' | 'engineer' | null): string {
  // Priority: inquiryType > topic
  if (inquiryType === 'budgetary') {
    return '[Budgetary Quote Request]\n\n';
  }
  if (inquiryType === 'feasibility') {
    return '[Technical Feasibility Check]\n\n';
  }
  if (inquiryType === 'engineer') {
    return '[Talk to an Engineer]\n\n';
  }
  
  // Fallback to topic-based messages
  switch (topic) {
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

export function ContactFormInline({ className = '', topic, inquiryType }: ContactFormInlineProps) {
  const analytics = useCombinedAnalytics();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: getPrefillMessage(topic, inquiryType)
  });
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
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
          productName: 'General Inquiry',
          topic: topic || 'general'
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
      
      // Send form_submit event to Google Analytics and Segment
      const inquiryTypeLabel = inquiryType === 'budgetary' ? 'Budgetary Quote Request' :
                               inquiryType === 'feasibility' ? 'Technical Feasibility Check' :
                               inquiryType === 'engineer' ? 'Talk to an Engineer' :
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