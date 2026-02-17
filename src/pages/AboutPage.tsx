import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import '../styles/AboutPage.css';

export function AboutPage() {
  // Scroll to top when component mounts
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About NineScrolls LLC",
    "description": "NineScrolls LLC is a U.S.-based scientific equipment platform serving universities and research institutions with advanced plasma processing and thin film deposition systems.",
    "mainEntity": {
      "@type": "Organization",
      "name": "NineScrolls LLC",
      "description": "NineScrolls LLC is a U.S.-based scientific equipment supplier dedicated to advancing innovation in plasma processing and thin film deposition for research institutions.",
      "foundingDate": "2023",
      "url": "https://ninescrolls.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "San Diego",
        "addressRegion": "CA",
        "addressCountry": "US"
      },
      "areaServed": {
        "@type": "Country",
        "name": "United States"
      },
      "knowsAbout": [
        "Semiconductor Manufacturing Equipment",
        "Thin Film Deposition",
        "Plasma Etching",
        "ALD Systems",
        "PECVD Systems",
        "Scientific Research Equipment"
      ]
    }
  };

  return (
    <>
      <SEO 
        title="About Us"
        description="NineScrolls LLC is a U.S.-based scientific equipment platform serving universities and research institutions with advanced plasma processing and thin film deposition systems."
        keywords="scientific equipment supplier, plasma processing, thin film deposition, research equipment, US-based semiconductor equipment, NineScrolls LLC, university lab equipment"
        url="/about"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="container">
          <h1>U.S.-Based Scientific Equipment Platform</h1>
          <p className="about-hero-subtitle">
            Serving universities, research institutions, and advanced semiconductor laboratories with precision plasma processing and thin film deposition systems.
          </p>
        </div>
      </section>

      {/* What We Do — Service Responsibilities */}
      <section className="about-services">
        <div className="container">
          <h2>How We Support You</h2>
          <p className="section-subtitle">End-to-end support from consultation through installation and beyond</p>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Pre-Sales Technical Consultation</h3>
              <p>We handle all technical discussions, feasibility assessments, and system configuration consultations directly from the U.S., ensuring you get expert guidance from day one.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3>System Configuration & Quotation</h3>
              <p>All quotations, pricing, and configuration details are provided by NineScrolls LLC, ensuring consistency, transparency, and full accountability throughout the process.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </div>
              <h3>Project Coordination & Delivery</h3>
              <p>We manage project timelines, shipping coordination, and delivery logistics to ensure smooth handover and seamless integration into your facility.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h3>Post-Installation Support</h3>
              <p>Technical support, maintenance coordination, and service requests are handled through our U.S.-based support team with dedicated response channels.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturing Partner Section */}
      <section className="about-partner" id="manufacturer">
        <div className="container">
          <h2>Engineering & Manufacturing Partner</h2>
          <div className="partner-content">
            <div className="partner-description">
              <p>
                NineScrolls LLC partners with Tyloong Semiconductor Equipment, a manufacturer with over three decades 
                of expertise in plasma processing and thin film deposition systems. This partnership enables us to offer 
                proven, production-grade platforms backed by deep engineering knowledge and continuous R&D investment.
              </p>
              <p>
                As the exclusive U.S. representative, NineScrolls manages all customer-facing operations — from 
                pre-sales consultation through installation and ongoing support — while leveraging Tyloong's 
                manufacturing excellence and technical depth.
              </p>
            </div>
            <div className="partner-stats">
              <div className="partner-stat-card">
                <span className="stat-number">30+</span>
                <span className="stat-label">Years of Semiconductor Equipment Experience</span>
              </div>
              <div className="partner-stat-card">
                <span className="stat-number">1,000+</span>
                <span className="stat-label">Systems Installed Globally</span>
              </div>
              <div className="partner-stat-card">
                <span className="stat-number">R&D</span>
                <span className="stat-label">Continuous Platform Innovation</span>
              </div>
              <div className="partner-stat-card">
                <span className="stat-number">6+</span>
                <span className="stat-label">Equipment Platform Categories</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Philosophy */}
      <section className="about-philosophy">
        <div className="container">
          <h2>Our Story</h2>
          <p className="section-subtitle">Order in the Universe. Precision in Engineering.</p>
          <div className="philosophy-content">
            <p className="philosophy-intro">
              At NineScrolls, we believe that science and engineering are expressions of a deeper order
              that governs both the universe and human innovation. Our visual symbol and name reflect two
              complementary traditions of understanding order.
            </p>
            <div className="philosophy-grid">
              <div className="philosophy-card">
                <div className="philosophy-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a7.5 7.5 0 0 0 0 20 7.5 7.5 0 0 0 0-20" />
                    <path d="M12 2c3 2.5 4.5 6 4.5 10s-1.5 7.5-4.5 10" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <h3>The Dragon: Cosmic Order</h3>
                <p>
                  Our circular dragon motif represents an ancient understanding of the universe — celestial
                  motion, the continuous flow of energy, and harmony between opposing forces. In early Chinese
                  philosophy, the universe is structured and dynamic, governed by balance, motion, and
                  transformation. <strong>Nature operates through order.</strong>
                </p>
              </div>
              <div className="philosophy-card">
                <div className="philosophy-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <line x1="8" y1="7" x2="16" y2="7" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <h3>The Nine Chapters: Mathematical Order</h3>
                <p>
                  Our name draws inspiration from <em>The Nine Chapters on the Mathematical Art</em>, an ancient
                  text that systematized practical problem-solving — from land measurement and engineering
                  calculations to solving simultaneous equations. Its essence was simple and
                  powerful: <strong>Mathematics creates order in the human world.</strong>
                </p>
              </div>
            </div>
            <div className="philosophy-mission">
              <p>
                NineScrolls exists to translate scientific order into engineering precision. From cosmic order
                to engineered precision — this is the spirit of NineScrolls.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values — Timeline/Horizontal Layout */}
      <section className="about-values">
        <div className="container">
          <h2>Our Core Values</h2>
          <p className="section-subtitle">The principles that guide every decision we make</p>
          <div className="values-list">
            <div className="value-item">
              <div className="value-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="value-text">
                <h3>Integration</h3>
                <p>We create seamless connections between manufacturers, researchers, and industry professionals to accelerate scientific discovery and simplify procurement.</p>
              </div>
            </div>
            <div className="value-item">
              <div className="value-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="value-text">
                <h3>Innovation</h3>
                <p>We drive advancement in the scientific equipment industry through innovative solutions, platform integration, and continuous technology evaluation.</p>
              </div>
            </div>
            <div className="value-item">
              <div className="value-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="value-text">
                <h3>Collaboration</h3>
                <p>We foster partnerships and facilitate connections across the scientific community, bringing together research institutions, manufacturers, and domain experts.</p>
              </div>
            </div>
            <div className="value-item">
              <div className="value-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="value-text">
                <h3>Expertise</h3>
                <p>We leverage deep industry knowledge and hands-on experience to deliver tailored solutions that create lasting value for our partners and research clients.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Credentials */}
      <section className="about-trust">
        <div className="container">
          <h2>Trust & Credentials</h2>
          <div className="trust-grid">
            <div className="trust-item">
              <h4>U.S.-Based Operations</h4>
              <p>San Diego, California</p>
              <p>Direct technical support team</p>
            </div>
            <div className="trust-item">
              <h4>D-U-N-S Number</h4>
              <p className="trust-highlight">13-477-6662</p>
            </div>
            <div className="trust-item">
              <h4>UEI Number</h4>
              <p className="trust-highlight">C4BFCTH5L5D1</p>
            </div>
            <div className="trust-item">
              <h4>Government Ready</h4>
              <p>Registered for federal and institutional procurement</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="about-cta">
        <div className="container">
          <h2>Ready to Discuss Your Research Needs?</h2>
          <p>Our team is here to help you find the right equipment platform for your laboratory.</p>
          <div className="about-cta-buttons">
            <Link to="/products" className="btn btn-primary btn-large">Explore Equipment</Link>
            <Link to="/contact" className="btn btn-secondary btn-large">Contact Our Team</Link>
          </div>
        </div>
      </section>
    </>
  );
}
