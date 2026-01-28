import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { ContactFormInline } from '../components/common/ContactFormInline';
import '../styles/ContactPage.css';

type InquiryType = 'budgetary' | 'feasibility' | 'engineer' | null;

export function ContactPage() {
  // Scroll to top when component mounts
  useScrollToTop();

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const topic = params.get('topic') || undefined;
  const [selectedInquiryType, setSelectedInquiryType] = useState<InquiryType>(null);

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
          <p>No obligation · No PO required · 24–48h response</p>
          
          {/* Cost-Efficiency Hero Card */}
          <div style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            backgroundColor: 'rgba(0, 0, 0, 0.65)', 
            borderRadius: '8px',
            backdropFilter: 'blur(4px)',
            maxWidth: '800px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            <h3 style={{ 
              margin: '0 0 0.75rem 0', 
              fontSize: '1.1rem', 
              color: '#EAEAEA', 
              fontWeight: '600',
              textAlign: 'center'
            }}>
              Cost-efficient, research-grade configurations
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.95rem', 
              color: '#EAEAEA', 
              lineHeight: '1.6',
              textAlign: 'center'
            }}>
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
                <span style={{ fontSize: '0.9em', color: '#666' }}>
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

      <section className="contact-form-section">
        <div className="container">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Choose Your Inquiry Type</h2>
            
            {/* Three Entry Points - Interactive */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
              <button
                type="button"
                onClick={() => setSelectedInquiryType('budgetary')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: selectedInquiryType === 'budgetary' ? '#e7f3ff' : '#f8f9fa',
                  borderRadius: '8px',
                  border: selectedInquiryType === 'budgetary' ? '2px solid #2563eb' : '2px solid #e9ecef',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  width: '100%'
                }}
              >
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>🅰️ Request a Budgetary Quote</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
                  Used for internal evaluation, budgeting, or proposal planning.
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
                  Ideal for: PI, Lab manager, Proposal / grant stage
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedInquiryType('feasibility')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: selectedInquiryType === 'feasibility' ? '#e7f3ff' : '#f8f9fa',
                  borderRadius: '8px',
                  border: selectedInquiryType === 'feasibility' ? '2px solid #2563eb' : '2px solid #e9ecef',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  width: '100%'
                }}
              >
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>🅱️ Technical Feasibility Check</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
                  Share your material or process goals. We'll confirm feasibility.
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
                  Ideal for: Process engineers, PhD / Post-doc researchers
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedInquiryType('engineer')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: selectedInquiryType === 'engineer' ? '#e7f3ff' : '#f8f9fa',
                  borderRadius: '8px',
                  border: selectedInquiryType === 'engineer' ? '2px solid #2563eb' : '2px solid #e9ecef',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  width: '100%'
                }}
              >
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>🅲 Talk to an Engineer</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
                  Direct technical discussion without sales pressure.
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
                  Ideal for: Researchers who prefer technical dialogue
                </p>
              </button>
            </div>
            
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
              {selectedInquiryType === 'budgetary' && 'Request a Budgetary Quote'}
              {selectedInquiryType === 'feasibility' && 'Technical Feasibility Check'}
              {selectedInquiryType === 'engineer' && 'Talk to an Engineer (No Sales)'}
              {!selectedInquiryType && 'Send Us a Message'}
            </h2>
            <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
              Fill out the form below and we'll get back to you within 24–48 hours.
            </p>
            <ContactFormInline topic={topic} inquiryType={selectedInquiryType} />
            
            {/* What Happens After You Submit - Trust Block */}
            <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: '#333', textAlign: 'center' }}>What Happens After You Submit</h3>
              <ul style={{ listStyle: 'none', padding: 0, maxWidth: '600px', margin: '0 auto' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ color: '#28a745', fontSize: '1.1rem', fontWeight: 'bold' }}>✓</span>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>Your message is reviewed by a technical team member</span>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ color: '#28a745', fontSize: '1.1rem', fontWeight: 'bold' }}>✓</span>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>We typically respond within 1–2 business days</span>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ color: '#28a745', fontSize: '1.1rem', fontWeight: 'bold' }}>✓</span>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>No automated sales sequences or mailing lists</span>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ color: '#28a745', fontSize: '1.1rem', fontWeight: 'bold' }}>✓</span>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>NDA available upon request</span>
                </li>
              </ul>
            </div>
            
            {/* Safety Commitment */}
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '6px', textAlign: 'center', border: '1px solid #e9ecef' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
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