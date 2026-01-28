import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import '../styles/AboutPage.css';

export function AboutPage() {
  // Scroll to top when component mounts
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About Nine Scrolls Technology",
    "description": "Learn about Nine Scrolls Technology's commitment to innovation in semiconductor manufacturing equipment.",
    "mainEntity": {
      "@type": "Organization",
      "name": "Nine Scrolls Technology",
      "description": "NineScrolls LLC is a dynamic start-up company dedicated to advancing innovation and integration in the scientific research equipment industry.",
      "foundingDate": "2023",
      "url": "https://ninescrolls.us",
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
        "Surface Treatment",
        "Scientific Research Equipment"
      ]
    }
  };

  return (
    <>
      <SEO 
        title="About Us"
        description="Learn about Nine Scrolls Technology's commitment to innovation in semiconductor manufacturing equipment. Discover our history, mission, and dedication to advancing semiconductor technology."
        keywords="semiconductor technology, manufacturing equipment, company history, semiconductor innovation, about Nine Scrolls, research and development"
        url="/about"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <section className="about-hero">
        <div className="container">
          <h1>A US-Based Scientific Equipment Provider for Advanced Research</h1>
          <div style={{ marginTop: '2rem', maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
            <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', display: 'inline-block' }}>
              <li style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>• Focused on custom-configured research equipment</li>
              <li style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>• Serving universities and research institutions</li>
              <li style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>• Managing projects, delivery, and support from the US</li>
            </ul>
          </div>
          <p style={{marginTop: '20px', opacity: 0.9, fontSize: '0.9rem'}}>UEI: C4BFCTH5L5D1</p>
        </div>
      </section>

      <section className="story">
        <div className="container">
          <h2>Engineering & Manufacturing Partner</h2>
          <div className="story-content">
            <p>
              NineScrolls LLC works with established manufacturing partners with proven track records in 
              semiconductor equipment development and production.
            </p>
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Our Manufacturing Partner</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ marginBottom: '0.75rem' }}>• 30+ years of semiconductor equipment experience</li>
                <li style={{ marginBottom: '0.75rem' }}>• 1000+ systems installed globally</li>
                <li style={{ marginBottom: '0.75rem' }}>• Proven platforms used in research institutes</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="values" style={{ padding: '4rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2>Who We Are Responsible For</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Pre-Sales Technical Discussion</h3>
              <p>We handle all technical consultations, feasibility assessments, and system configuration discussions directly from the US.</p>
            </div>
            <div className="value-card">
              <h3>System Configuration & Quotation</h3>
              <p>All quotations, pricing, and configuration details are provided by NineScrolls LLC, ensuring consistency and accountability.</p>
            </div>
            <div className="value-card">
              <h3>Project Coordination & Delivery</h3>
              <p>We manage project timelines, shipping coordination, and delivery logistics to ensure smooth handover to your facility.</p>
            </div>
            <div className="value-card">
              <h3>Post-Installation Support Routing</h3>
              <p>Technical support, maintenance coordination, and service requests are handled through our US-based support team.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="values">
        <div className="container">
          <h2>Our Core Values and Mission</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Integration</h3>
              <p>We create seamless connections between manufacturers, researchers, and industry professionals to advance scientific discovery.</p>
            </div>
            <div className="value-card">
              <h3>Innovation</h3>
              <p>We drive advancement in the scientific equipment industry through innovative solutions and platforms.</p>
            </div>
            <div className="value-card">
              <h3>Collaboration</h3>
              <p>We foster partnerships and facilitate connections across the scientific community to accelerate progress.</p>
            </div>
            <div className="value-card">
              <h3>Expertise</h3>
              <p>We leverage deep industry knowledge to deliver tailored solutions that create value for our partners and clients.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
} 