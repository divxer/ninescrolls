import { useState, useEffect, useRef } from 'react';
import { ContactFormContent } from './ContactFormContent';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';
import { behaviorAnalytics } from '../../services/behaviorAnalytics';
import { submitLead } from '../../services/leadsService';

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

  // ─── Form interaction tracking for behavior scoring ───────────────────────
  const formInteractionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formStartedRef = useRef(false);
  const lastFilledRef = useRef(0);
  useEffect(() => {
    if (formInteractionTimer.current) clearTimeout(formInteractionTimer.current);
    formInteractionTimer.current = setTimeout(() => {
      const filled = [formData.name, formData.email, formData.phone, formData.organization, formData.message]
        .filter(v => v.trim().length > 0).length;
      if (filled > 0) {
        if (!formStartedRef.current) {
          behaviorAnalytics.trackFormStarted('contact');
          formStartedRef.current = true;
        }
        lastFilledRef.current = filled;
        behaviorAnalytics.trackFormInteraction('contact', filled, 5);
      }
    }, 3000);
    return () => {
      if (formInteractionTimer.current) {
        clearTimeout(formInteractionTimer.current);
        const filled = [formData.name, formData.email, formData.phone, formData.organization, formData.message]
          .filter(v => v.trim().length > 0).length;
        if (filled > 0) {
          if (!formStartedRef.current) {
            behaviorAnalytics.trackFormStarted('contact');
            formStartedRef.current = true;
          }
          lastFilledRef.current = filled;
          behaviorAnalytics.trackFormInteraction('contact', filled, 5);
        }
      }
    };
  }, [formData.name, formData.email, formData.phone, formData.organization, formData.message]);

  // ─── Form abandonment tracking on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (formStartedRef.current) {
        behaviorAnalytics.trackFormAbandoned('contact', lastFilledRef.current, 5);
      }
    };
  }, []);

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
      behaviorAnalytics.trackFormCompleted('contact');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { website: _honeypot, ...submitData } = formData;
      await submitLead({
        type: 'contact',
        name: submitData.name,
        email: submitData.email,
        phone: submitData.phone || undefined,
        organization: submitData.organization || undefined,
        message: submitData.message,
        productName: 'General Inquiry',
        topic: topic || 'general',
        inquiryType: inquiryType || 'general',
      });

      setIsSuccess(true);
      behaviorAnalytics.trackFormCompleted('contact');
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
    <div className={className}>
      {isSuccess ? (
        <div className="text-center p-8 bg-green-50 rounded-lg border border-green-200" ref={successRef}>
          <h3 className="text-xl font-bold text-on-surface mb-3">
            {topic === 'newsletter' ? 'Successfully Subscribed!' : 'Thank You for Your Message!'}
          </h3>
          <p className="text-on-surface-variant mb-6">
            {topic === 'newsletter'
              ? 'Thank you for subscribing to our newsletter! You\'ll receive our latest insights, product updates, and technical resources (1–2 emails per month). We respect your privacy and you can unsubscribe at any time.'
              : 'We have received your inquiry and will get back to you within 1–2 business days.'
            }
          </p>
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold bg-primary text-white hover:bg-primary-container transition-all cursor-pointer"
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
