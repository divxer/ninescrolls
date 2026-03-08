import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import '../styles/CareersPage.css';

export function CareersPage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Careers at NineScrolls LLC",
    "description": "Join NineScrolls LLC — a San Diego-based supplier of research-grade plasma and thin film systems. Explore opportunities in sales, applications engineering, and field service.",
    "mainEntity": {
      "@type": "Organization",
      "name": "NineScrolls LLC",
      "url": "https://ninescrolls.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "San Diego",
        "addressRegion": "CA",
        "addressCountry": "US"
      }
    }
  };

  return (
    <>
      <SEO
        title="Careers"
        description="Join NineScrolls LLC — a San Diego-based supplier of research-grade plasma and thin film systems serving US universities. Explore roles in sales, pre-sales engineering, and field service."
        keywords="scientific equipment careers, plasma processing jobs, thin film deposition careers, lab equipment sales, field service engineer, San Diego scientific jobs, NineScrolls careers"
        url="/careers"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="careers-hero">
        <div className="container">
          <h1>Join Our Team</h1>
          <p className="careers-hero-subtitle">
            Help us bring world-class plasma processing and thin film deposition systems to research institutions across the United States.
          </p>
        </div>
      </section>

      {/* Introduction */}
      <section className="careers-intro">
        <div className="container">
          <div className="careers-intro-content">
            <p>
              NineScrolls is a San Diego-based supplier of research-grade plasma surface treatment and thin film processing systems, serving universities and research institutions across the United States.
            </p>
            <p>
              As we expand our presence in the U.S. scientific equipment market, we are building a team of talented professionals who share our passion for enabling cutting-edge research.
            </p>
          </div>
        </div>
      </section>

      {/* Anticipated Roles */}
      <section className="careers-roles">
        <div className="container">
          <h2>Anticipated Roles</h2>
          <p className="section-subtitle">We are currently growing and expect to hire for the following positions</p>
          <div className="roles-grid">
            <div className="role-card">
              <div className="role-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3>Sales Representative</h3>
              <p>Develop relationships with universities, national labs, and research institutions. Manage the full sales cycle for capital equipment — from initial outreach to purchase order.</p>
              <ul className="role-highlights">
                <li>University and national lab account development</li>
                <li>Capital equipment sales cycle management</li>
                <li>Trade show and conference representation</li>
              </ul>
            </div>
            <div className="role-card">
              <div className="role-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3>Applications / Pre-Sales Engineer</h3>
              <p>Provide technical consultation and live demos. Help customers identify the right plasma or thin film solution for their specific research needs.</p>
              <ul className="role-highlights">
                <li>Technical feasibility assessments</li>
                <li>System configuration and selection guidance</li>
                <li>Application-specific demo and evaluation support</li>
              </ul>
            </div>
            <div className="role-card">
              <div className="role-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h3>Field Service / After-Sales Engineer</h3>
              <p>Support equipment installation, commissioning, and ongoing maintenance at customer sites across the U.S. Ensure researchers get the most out of their systems.</p>
              <ul className="role-highlights">
                <li>On-site installation and commissioning</li>
                <li>Preventive maintenance and troubleshooting</li>
                <li>Customer training and process optimization</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why NineScrolls */}
      <section className="careers-why">
        <div className="container">
          <h2>Why NineScrolls</h2>
          <div className="why-grid">
            <div className="why-item">
              <div className="why-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="why-text">
                <h3>San Diego Based</h3>
                <p>Work from one of the country's top life science and engineering hubs with access to leading universities and research institutions.</p>
              </div>
            </div>
            <div className="why-item">
              <div className="why-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <div className="why-text">
                <h3>Growth-Stage Opportunity</h3>
                <p>Join a company at an exciting growth phase where your contributions directly shape the direction and success of the business.</p>
              </div>
            </div>
            <div className="why-item">
              <div className="why-icon-circle">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="why-text">
                <h3>Cutting-Edge Technology</h3>
                <p>Work with advanced plasma processing and thin film deposition systems that power breakthrough research in materials science, photonics, and nanotechnology.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="careers-cta">
        <div className="container">
          <h2>Get in Touch</h2>
          <p>
            We don't always have open positions listed, but we welcome inquiries from motivated individuals interested in the scientific equipment industry.
          </p>
          <a href="mailto:careers@ninescrolls.com" className="careers-email-btn">
            careers@ninescrolls.com
          </a>
          <div className="careers-cta-alt">
            <p>Or learn more about what we do:</p>
            <div className="careers-cta-buttons">
              <Link to="/about" className="btn btn-secondary btn-large">About NineScrolls</Link>
              <Link to="/products" className="btn btn-secondary btn-large">Our Equipment</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
