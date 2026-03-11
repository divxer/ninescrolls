import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useRef } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { ContactFormInline } from '../components/common/ContactFormInline';
import '../styles/ContactPage.css';

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
      <section className="contact-hero">
        <div className="container">
          <h1>Technical Support & Expert Consultation</h1>
          <p>Talk with our engineers about technical feasibility, application fit, or service support</p>
          <p className="hero-subline">1–2 business day response · NDA available upon request</p>

          {/* Cross-link to RFQ page */}
          <div className="hero-card">
            <p>
              Looking for a budgetary quote?{' '}
              <Link to="/request-quote">Use our Request for Quote form</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="contact-info">
        <div className="container">
          <h2 className="section-heading sr-only">Contact Information</h2>
          <div className="contact-grid">
            <div className="contact-card">
              <h3>Office Location</h3>
              <p><span className="location-icon"></span> 12546 Cabezon Pl</p>
              <p>San Diego, CA 92129</p>
              <p>United States</p>
              <p className="note">UEI: C4BFCTH5L5D1</p>

              <div className="contact-hours">
                <h4>Business Hours</h4>
                <p>Monday - Friday: 9:00 AM - 5:00 PM PST</p>
              </div>
            </div>

            <div className="contact-card">
              <h3>Contact Information</h3>
              <p className="contact-label">Primary Contact:</p>
              <p>
                <a href="mailto:info@ninescrolls.com">info@ninescrolls.com</a>
              </p>

              <p className="contact-label">Sales Inquiries:</p>
              <p>
                <a href="mailto:sales@ninescrolls.com">sales@ninescrolls.com</a>
              </p>

              <p className="note">
                <strong>Phone:</strong> +1 (858) 879-8898<br />
                <span className="phone-note">
                  Calls are routed through our automated support system. Voicemail messages are transcribed and responded to promptly.
                </span>
              </p>
            </div>

            <div className="contact-card">
              <h3>Technical Support</h3>
              <p>For equipment maintenance and technical assistance:</p>
              <p>
                <a href="mailto:support@ninescrolls.com">support@ninescrolls.com</a>
              </p>

              <div className="support-hours">
                <p className="contact-label">Support Hours</p>
                <p>Monday - Friday: 9:00 AM - 6:00 PM PST</p>
                <p className="note">Voicemail available 24/7 for critical issues</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-form-section" ref={formSectionRef}>
        <div className="container">
          <div className="form-section-inner">
            {topic === 'newsletter' ? (
              <div className="newsletter-banner">
                <h2>Subscribe to Our Newsletter</h2>
                <p>
                  Stay updated with our latest insights, product updates, and technical resources.
                  We send 1–2 emails per month with valuable content for research professionals.
                </p>
              </div>
            ) : (
              <h2 className="form-section-title">How Can We Help?</h2>
            )}

            {/* Context hint for topics that don't map to an inquiry type */}
            {topic && TOPIC_CONTEXT_LABELS[topic] && (
              <div className="context-hint">
                We've prepared your message for: <strong>{TOPIC_CONTEXT_LABELS[topic]}</strong>
              </div>
            )}

            {/* Two Entry Points - Interactive (hidden for newsletter subscription) */}
            {topic !== 'newsletter' && (
            <div className="inquiry-type-grid">
              <button
                type="button"
                onClick={() => handleInquiryTypeClick('feasibility')}
                className={`inquiry-type-btn${selectedInquiryType === 'feasibility' ? ' selected' : ''}`}
              >
                <h3>Technical Feasibility Check</h3>
                <p>
                  Share your material or process goals. We'll confirm feasibility.
                </p>
                <p className="ideal-for">
                  Ideal for: Process engineers, PhD / Post-doc researchers
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleInquiryTypeClick('engineer')}
                className={`inquiry-type-btn${selectedInquiryType === 'engineer' ? ' selected' : ''}`}
              >
                <h3>Talk to an Engineer</h3>
                <p>
                  Direct technical discussion without sales pressure.
                </p>
                <p className="ideal-for">
                  Ideal for: Researchers who prefer technical dialogue
                </p>
              </button>
            </div>
            )}

            <h2 className="form-section-title">
              {topic === 'newsletter' && 'Newsletter Subscription Form'}
              {topic !== 'newsletter' && selectedInquiryType === 'feasibility' && 'Technical Feasibility Check'}
              {topic !== 'newsletter' && selectedInquiryType === 'engineer' && 'Talk to an Engineer (No Sales)'}
              {topic !== 'newsletter' && !selectedInquiryType && 'Send Us a Message'}
            </h2>
            <p className="form-section-subtitle">
              {topic === 'newsletter'
                ? 'Please provide your information below to subscribe to our newsletter. We respect your privacy and will never spam you.'
                : "Fill out the form below and we'll get back to you within 1–2 business days."
              }
            </p>
            <ContactFormInline topic={topic} inquiryType={selectedInquiryType} onInquiryTypeChange={topic !== 'newsletter' ? (type) => {
              userHasManuallySelected.current = true;
              setSelectedInquiryType(type);
            } : undefined} prefillEmail={prefillEmail} onSuccess={handleFormSuccess} />

            {/* What Happens After You Submit - Trust Block */}
            <div className="trust-block">
              <h3>What Happens After You Submit</h3>
              <ul className="trust-block-list">
                <li>
                  <span className="check">✓</span>
                  <span>Your message is reviewed by a technical team member</span>
                </li>
                <li>
                  <span className="check">✓</span>
                  <span>We typically respond within 1–2 business days</span>
                </li>
                <li>
                  <span className="check">✓</span>
                  <span>No automated sales sequences or mailing lists</span>
                </li>
                <li>
                  <span className="check">✓</span>
                  <span>NDA available upon request</span>
                </li>
              </ul>
            </div>

            {/* Safety Commitment */}
            <div className="safety-commitment">
              <p>
                <strong>We respect your time and privacy.</strong><br />
                No spam. No mailing lists. Technical discussions only.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
