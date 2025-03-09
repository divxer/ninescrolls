import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import '../styles/AboutPage.css';

export function AboutPage() {
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
          <h1>About NineScrolls LLC</h1>
          <p>Leading Innovation in Scientific Research Equipment</p>
        </div>
      </section>

      <section className="story">
        <div className="container">
          <h2>Our Story</h2>
          <div className="story-content">
            <p>
              NineScrolls LLC is a dynamic start-up company dedicated to advancing innovation and 
              integration in the scientific research equipment industry. Our primary focus is on establishing a 
              comprehensive platform that connects manufacturers, researchers, and industry professionals 
              across the United States.
            </p>
            <p>
              By fostering collaboration and streamlining access to cutting-edge laboratory equipment, we aim 
              to empower scientific discovery and drive technological advancements. At NineScrolls LLC, we 
              are committed to delivering tailored solutions and creating value for our partners and clients 
              through expertise, efficiency, and innovation.
            </p>
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