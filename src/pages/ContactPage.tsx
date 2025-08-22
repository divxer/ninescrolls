import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { ContactFormInline } from '../components/common/ContactFormInline';
import '../styles/ContactPage.css';

export function ContactPage() {
  // Scroll to top when component mounts
  useScrollToTop();

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
          "telephone": "+1-858-537-7743",
          "availableLanguage": ["English", "Chinese"],
          "hoursAvailable": "Mo-Fr 09:00-17:00 PST"
        },
        {
          "@type": "ContactPoint",
          "contactType": "technical support",
          "email": "support@ninescrolls.com",
          "availableLanguage": ["English", "Chinese"],
          "hoursAvailable": "Mo-Fr 08:00-18:00 PST"
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
          <h1>Contact Us</h1>
          <p>Get in touch with our team for expert guidance on your research equipment needs</p>
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
              
              <p className="note">For urgent matters only: +1 (858) 537-7743</p>
            </div>

            <div className="contact-card">
              <h3>Technical Support</h3>
              <p>For equipment maintenance and technical assistance:</p>
              <p>
                <a href="mailto:support@ninescrolls.com">support@ninescrolls.com</a>
              </p>
              
              <div className="support-hours">
                <p className="contact-label">Support Hours</p>
                <p>Monday - Friday: 8:00 AM - 6:00 PM PST</p>
                <p className="note">24/7 emergency support available for critical issues</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="container">
          <h2>Send Us a Message</h2>
          <p>Have questions about our products or services? Fill out the form below and we'll get back to you shortly.</p>
          <ContactFormInline />
        </div>
      </section>
    </>
  );
} 