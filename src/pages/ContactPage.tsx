import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/common/SEO';
import { ContactFormInline } from '../components/common/ContactFormInline';
import '../styles/ContactPage.css';

type InquiryType = 'budgetary' | 'feasibility' | 'engineer' | null;

export function ContactPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const topic = params.get('topic') || undefined;
  const prefillEmail = params.get('email') || undefined;
  const [selectedInquiryType, setSelectedInquiryType] = useState<InquiryType>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // Scroll to top when component mounts (unless it's newsletter subscription)
  // For newsletter, scroll to form section instead
  useEffect(() => {
    if (topic === 'newsletter' && formSectionRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        formSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    } else {
      // Default behavior: scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [topic]);

  const handleFormSuccess = () => {
    setSelectedInquiryType(null);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact Nine Scrolls Technology",
    "description": "Get in touch with Nine Scrolls Technology for inquiries about our semiconductor manufacturing equipment and solutions.",
    "mainEntity": {
      "@type": "Organization",
      "name": "Nine Scrolls Technology",
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
        description="Get in touch with Nine Scrolls Technology. Contact our team for inquiries about our semiconductor manufacturing equipment and solutions."
        keywords="contact Nine Scrolls, semiconductor equipment inquiry, technical support, sales contact, customer service"
        url="/contact"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <section className="contact-hero">
        <div className="container">
          <h1>Request a Budgetary Quote or Technical Consultation</h1>
          <p>No obligation · No PO required · 1–2 business day response</p>

          {/* Cost-Efficiency Hero Card */}
          <div className="hero-card">
            <h3>Cost-efficient, research-grade configurations</h3>
            <p>
              We specialize in cost-efficient configurations for research labs that need to balance performance and budget.
              Our systems are designed to deliver essential performance without unnecessary industrial features,
              making them a practical and cost-efficient choice for university and research laboratories.
            </p>
          </div>
        </div>
      </section>

      <section className="contact-info">
        <div className="container">
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
              <h2 className="form-section-title">Choose Your Inquiry Type</h2>
            )}

            {/* Three Entry Points - Interactive (hidden for newsletter subscription) */}
            {topic !== 'newsletter' && (
            <div className="inquiry-type-grid">
              <button
                type="button"
                onClick={() => setSelectedInquiryType('budgetary')}
                className={`inquiry-type-btn${selectedInquiryType === 'budgetary' ? ' selected' : ''}`}
              >
                <h3>Request a Budgetary Quote</h3>
                <p>
                  Used for internal evaluation, budgeting, or proposal planning.
                </p>
                <p className="ideal-for">
                  Ideal for: PI, Lab manager, Proposal / grant stage
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedInquiryType('feasibility')}
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
                onClick={() => setSelectedInquiryType('engineer')}
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
              {topic !== 'newsletter' && selectedInquiryType === 'budgetary' && 'Request a Budgetary Quote'}
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
            <ContactFormInline topic={topic} inquiryType={selectedInquiryType} prefillEmail={prefillEmail} onSuccess={handleFormSuccess} />

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
