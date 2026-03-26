import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useRef } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { ContactFormInline } from '../components/common/ContactFormInline';

type InquiryType = 'feasibility' | 'engineer' | null;

// Known topics that are valid entry points
const KNOWN_TOPICS = ['expert', 'application', 'service', 'amc', 'tco', 'compare', 'newsletter', 'quote'];

// Map URL topic param to inquiry type for auto-selection
function topicToInquiryType(topic?: string): InquiryType {
  switch (topic) {
    case 'expert':
      return 'engineer';
    case 'application':
      return 'feasibility';
    default:
      return null;
  }
}

// Display labels for context hints (topics that don't map to inquiry types)
const TOPIC_CONTEXT_LABELS: Record<string, string> = {
  service: 'Service Support',
  amc: 'Annual Maintenance Inquiry',
  tco: 'TCO Report',
  compare: 'Product Comparison',
};

export function ContactPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const topic = params.get('topic') || undefined;
  const prefillEmail = params.get('email') || undefined;
  const [selectedInquiryType, setSelectedInquiryType] = useState<InquiryType>(
    topicToInquiryType(topic)
  );
  const formSectionRef = useRef<HTMLDivElement>(null);
  const userHasManuallySelected = useRef(false);
  const lastSyncedTopic = useRef(topic);

  // Redirect quote requests to the dedicated RFQ page
  if (topic === 'quote') {
    return <Navigate to="/request-quote" replace />;
  }

  // Sync inquiry type when topic URL actually changes (browser back/forward)
  useEffect(() => {
    if (topic !== lastSyncedTopic.current) {
      lastSyncedTopic.current = topic;
      userHasManuallySelected.current = false;
      setSelectedInquiryType(topicToInquiryType(topic));
    }
  }, [topic]);

  // Auto-scroll to form section for known topics, otherwise scroll to top
  useEffect(() => {
    const isKnownTopic = topic && KNOWN_TOPICS.includes(topic);
    if (isKnownTopic && formSectionRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        formSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    } else {
      // Default behavior: scroll to top (including unknown topics)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [topic]);

  const handleFormSuccess = () => {
    setSelectedInquiryType(null);
    userHasManuallySelected.current = false;
  };

  const handleInquiryTypeClick = (type: InquiryType) => {
    userHasManuallySelected.current = true;
    setSelectedInquiryType(type);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact NineScrolls LLC",
    "description": "Contact NineScrolls LLC for technical support, feasibility checks, or to consult directly with an engineer.",
    "mainEntity": {
      "@type": "Organization",
      "name": "NineScrolls LLC",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "12546 Cabezon Pl",
        "addressLocality": "San Diego",
        "addressRegion": "CA",
        "postalCode": "92129",
        "addressCountry": "US"
      },
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "contactType": "sales",
          "email": "sales@ninescrolls.com",
          "telephone": "+1-858-879-8898",
          "availableLanguage": ["English", "Chinese"],
          "hoursAvailable": "Mo-Fr 09:00-17:00 PST"
        },
        {
          "@type": "ContactPoint",
          "contactType": "technical support",
          "email": "support@ninescrolls.com",
          "availableLanguage": ["English", "Chinese"],
          "hoursAvailable": "Mo-Fr 09:00-18:00 PST"
        }
      ]
    }
  };

  return (
    <>
      <SEO
        title="Contact Us"
        description="Contact NineScrolls LLC for technical support, feasibility checks, or to consult directly with an engineer. We respond within 1–2 business days."
        keywords="contact Nine Scrolls, semiconductor equipment inquiry, technical support, engineering consultation, customer service, application feasibility, service support"
        url="/contact"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <main className="py-24 px-8">
        {/* Hero + Contact Info */}
        <div className="max-w-7xl mx-auto mb-24">
          <h1 className="text-6xl font-headline font-bold mb-4">Technical Support & Expert Consultation</h1>
          <p className="text-xl text-on-surface-variant mb-2">Talk with our engineers about technical feasibility, application fit, or service support</p>
          <p className="text-sm text-on-surface-variant mb-8">1-2 business day response -- NDA available upon request</p>

          {/* Cross-link to RFQ page */}
          <div className="bg-primary-container rounded-lg px-6 py-4 inline-block mb-16">
            <p className="text-on-primary-container">
              Looking for a budgetary quote?{' '}
              <Link to="/request-quote" className="text-on-primary-container font-bold underline hover:no-underline">Use our Request for Quote form</Link>
            </p>
          </div>

          {/* Contact Info Grid */}
          <h2 className="sr-only">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant">
              <div className="flex items-start gap-4 mb-6">
                <span className="material-symbols-outlined text-primary text-3xl">location_on</span>
                <h3 className="text-xl font-headline font-bold">Office Location</h3>
              </div>
              <div className="space-y-1 text-on-surface-variant">
                <p>12546 Cabezon Pl</p>
                <p>San Diego, CA 92129</p>
                <p>United States</p>
                <p className="text-xs mt-3 text-on-surface-variant">UEI: C4BFCTH5L5D1</p>
              </div>
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <h4 className="font-bold text-sm mb-1">Business Hours</h4>
                <p className="text-on-surface-variant text-sm">Monday - Friday: 9:00 AM - 5:00 PM PST</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant">
              <div className="flex items-start gap-4 mb-6">
                <span className="material-symbols-outlined text-primary text-3xl">mail</span>
                <h3 className="text-xl font-headline font-bold">Contact Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Primary Contact</p>
                  <a href="mailto:info@ninescrolls.com" className="text-primary hover:underline">info@ninescrolls.com</a>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Sales Inquiries</p>
                  <a href="mailto:sales@ninescrolls.com" className="text-primary hover:underline">sales@ninescrolls.com</a>
                </div>
                <div className="pt-2">
                  <p className="text-sm text-on-surface-variant">
                    <strong>Phone:</strong> +1 (858) 879-8898
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Calls are routed through our automated support system. Voicemail messages are transcribed and responded to promptly.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant">
              <div className="flex items-start gap-4 mb-6">
                <span className="material-symbols-outlined text-primary text-3xl">support_agent</span>
                <h3 className="text-xl font-headline font-bold">Technical Support</h3>
              </div>
              <p className="text-on-surface-variant mb-3">For equipment maintenance and technical assistance:</p>
              <a href="mailto:support@ninescrolls.com" className="text-primary hover:underline">support@ninescrolls.com</a>
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Support Hours</p>
                <p className="text-on-surface-variant text-sm">Monday - Friday: 9:00 AM - 6:00 PM PST</p>
                <p className="text-xs text-on-surface-variant mt-1">Voicemail available 24/7 for critical issues</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24" ref={formSectionRef}>
          {/* Left Column: Inquiry Type Selection + Trust Block */}
          <div>
            {topic === 'newsletter' ? (
              <div className="bg-primary-container rounded-xl p-8 mb-10">
                <h2 className="text-3xl font-headline font-bold mb-4 text-on-primary-container">Subscribe to Our Newsletter</h2>
                <p className="text-on-primary-container/80 leading-relaxed">
                  Stay updated with our latest insights, product updates, and technical resources.
                  We send 1-2 emails per month with valuable content for research professionals.
                </p>
              </div>
            ) : (
              <h2 className="text-3xl font-headline font-bold mb-8">How Can We Help?</h2>
            )}

            {/* Context hint for topics that don't map to an inquiry type */}
            {topic && TOPIC_CONTEXT_LABELS[topic] && (
              <div className="bg-tertiary/10 border border-tertiary/30 rounded-lg px-6 py-4 mb-8">
                <p className="text-on-surface">We've prepared your message for: <strong>{TOPIC_CONTEXT_LABELS[topic]}</strong></p>
              </div>
            )}

            {/* Two Entry Points - Interactive (hidden for newsletter subscription) */}
            {topic !== 'newsletter' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                <button
                  type="button"
                  onClick={() => handleInquiryTypeClick('feasibility')}
                  className={`text-left p-6 rounded-xl border-2 transition-all ${
                    selectedInquiryType === 'feasibility'
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-3xl mb-3 block ${selectedInquiryType === 'feasibility' ? '' : 'text-primary'}`}>science</span>
                  <h3 className="text-lg font-headline font-bold mb-2">Technical Feasibility Check</h3>
                  <p className={`text-sm mb-3 ${selectedInquiryType === 'feasibility' ? 'text-on-primary-container/80' : 'text-on-surface-variant'}`}>
                    Share your material or process goals. We'll confirm feasibility.
                  </p>
                  <p className={`text-xs italic ${selectedInquiryType === 'feasibility' ? 'text-on-primary-container/60' : 'text-on-surface-variant'}`}>
                    Ideal for: Process engineers, PhD / Post-doc researchers
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleInquiryTypeClick('engineer')}
                  className={`text-left p-6 rounded-xl border-2 transition-all ${
                    selectedInquiryType === 'engineer'
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-3xl mb-3 block ${selectedInquiryType === 'engineer' ? '' : 'text-primary'}`}>engineering</span>
                  <h3 className="text-lg font-headline font-bold mb-2">Talk to an Engineer</h3>
                  <p className={`text-sm mb-3 ${selectedInquiryType === 'engineer' ? 'text-on-primary-container/80' : 'text-on-surface-variant'}`}>
                    Direct technical discussion without sales pressure.
                  </p>
                  <p className={`text-xs italic ${selectedInquiryType === 'engineer' ? 'text-on-primary-container/60' : 'text-on-surface-variant'}`}>
                    Ideal for: Researchers who prefer technical dialogue
                  </p>
                </button>
              </div>
            )}

            {/* What Happens After You Submit - Trust Block */}
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="text-xl font-headline font-bold mb-6">What Happens After You Submit</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">check_circle</span>
                  <span className="text-on-surface-variant">Your message is reviewed by a technical team member</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">check_circle</span>
                  <span className="text-on-surface-variant">We typically respond within 1-2 business days</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">check_circle</span>
                  <span className="text-on-surface-variant">No automated sales sequences or mailing lists</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl flex-shrink-0 mt-0.5">check_circle</span>
                  <span className="text-on-surface-variant">NDA available upon request</span>
                </li>
              </ul>
            </div>

            {/* Safety Commitment */}
            <div className="mt-8 border-t border-outline-variant pt-8">
              <p className="text-sm text-on-surface-variant">
                <strong>We respect your time and privacy.</strong><br />
                No spam. No mailing lists. Technical discussions only.
              </p>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="bg-surface-container-low p-10 rounded-xl">
            <h2 className="text-2xl font-headline font-bold mb-2">
              {topic === 'newsletter' && 'Newsletter Subscription Form'}
              {topic !== 'newsletter' && selectedInquiryType === 'feasibility' && 'Technical Feasibility Check'}
              {topic !== 'newsletter' && selectedInquiryType === 'engineer' && 'Talk to an Engineer (No Sales)'}
              {topic !== 'newsletter' && !selectedInquiryType && 'Send Us a Message'}
            </h2>
            <p className="text-sm text-on-surface-variant mb-8">
              {topic === 'newsletter'
                ? 'Please provide your information below to subscribe to our newsletter. We respect your privacy and will never spam you.'
                : "Fill out the form below and we'll get back to you within 1-2 business days."
              }
            </p>
            <ContactFormInline topic={topic} inquiryType={selectedInquiryType} onInquiryTypeChange={topic !== 'newsletter' ? (type) => {
              userHasManuallySelected.current = true;
              setSelectedInquiryType(type);
            } : undefined} prefillEmail={prefillEmail} onSuccess={handleFormSuccess} />
          </div>
        </div>
      </main>
    </>
  );
}
