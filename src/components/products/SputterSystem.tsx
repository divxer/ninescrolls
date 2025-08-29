import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function SputterSystem() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  // Scroll to top when component mounts
  useScrollToTop();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Sputter System Series</h1>
            <p>Advanced Physical Vapor Deposition System for High-Performance Thin Film Growth</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/sputter/main.jpg" 
                alt="Sputter System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Sputter Series provides advanced thin-film deposition through DC, RF, and magnetron sputtering within a compact uni-body design (footprint approximately 1.0m x 1.7m). With an innovative, customer-oriented magnetron target configuration, precise substrate temperature control, and flexible modular options, the system is tailored for versatile research and production applications, ensuring excellent deposition uniformity and process reliability.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design with optimized footprint (approx. 1.0m x 1.7m)</li>
                <li>Creatively designed magnetron target structure, customizable per customer requirements</li>
                <li>Multiple magnetron sputtering sources (2 to 6 sources available)</li>
                <li>Flexible substrate temperature management (water-cooled, 400°C, 800°C, up to 1200°C optional)</li>
                <li>RF-biased substrate capability for improved in-situ cleaning and film quality</li>
                <li>Advanced RF/DC power delivery system (customizable power range)</li>
                <li>Configurable sample handling options (Open-load or Load-lock system)</li>
                <li>Automated process control with real-time deposition monitoring</li>
                <li>Flexible selection of vacuum pumps, valves, and gas systems based on cost-performance orientation</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Metallic thin films</li>
                <li>Magnetic materials and coatings</li>
                <li>Compound semiconductors</li>
                <li>Magnetic films and devices</li>
                <li>Optical and protective coatings</li>
                <li>Compound semiconductor devices</li>
                <li>Advanced materials research</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="detailed-specs">
        <div className="container">
          <h2>Technical Specifications</h2>
          <div className="specs-table-container">
            <table className="detailed-specs-table">
              <tbody>
                <tr>
                  <th colSpan={2}>System Specifications</th>
                </tr>
                <tr>
                  <td>Wafer Size</td>
                  <td>4", 6", 8", 12", or multi-wafer/supersize substrates (optional)</td>
                </tr>
                <tr>
                  <td>Magnetron Sputtering Sources</td>
                  <td>2 to 6 independently configurable targets</td>
                </tr>
                <tr>
                  <td>Substrate Temperature</td>
                  <td>Water-cooled up to 1200°C (optional configurations available)</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Less than 5x10^-7 Torr (standard), higher vacuum options available upon request</td>
                </tr>
                <tr>
                  <td>Process Gas Lines</td>
                  <td>Standard 2 lines, additional lines customizable</td>
                </tr>
                <tr>
                  <td>Power System</td>
                  <td>DC/RF sputtering modes (customizable power range, RF: 300-1000W, DC optional)</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 1% (typical), less than 5% edge exclusion guaranteed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="process-capabilities">
        <div className="container">
          <h2>Process Capabilities</h2>
          <div className="capability-grid">
            <div className="capability-card">
              <h3>Performance Features</h3>
              <ul>
                <li>High deposition rates</li>
                <li>Excellent film uniformity and thickness control</li>
                <li>Outstanding high-aspect-ratio step coverage</li>
                <li>Precise temperature and power control</li>
                <li>Low particle contamination and impurity levels</li>
                <li>Multi-layer and co-sputtering capabilities</li>
                <li>Real-time deposition monitoring and repeatability</li>
                <li>In-situ RF substrate cleaning capability (optional)</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Pure Metals (Pt, Pd, W, Ru, etc.)</li>
                <li>Oxides (SiO₂, Al₂O₃, TiO₂, Ga₂O₃, ZnO, etc.)</li>
                <li>Nitrides (TiN, TaN, AlN, SiNx, GaN, etc.)</li>
                <li>Magnetic Materials (Fe-based, Co-based, Ni-based alloys, etc.)</li>
                <li>Metallic films and compound semiconductors</li>
                <li>Magnetic materials and complex thin-film structures</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Related equipment & articles */}
      <section className="related-reading">
        <div className="container">
          <h2>Related Equipment & Articles</h2>
          <ul>
            <li>
              <a href="/products/pecvd">PECVD System Series</a> – CVD alternative for dielectric films.
            </li>
            <li>
              <a href="/products/ald">ALD System Series</a> – conformal thin films for complex topography.
            </li>
            <li>
              <a href="/insights/plasma-etching-explained-fundamentals-applications">Plasma Etching Explained</a> – downstream pattern transfer considerations.
            </li>
          </ul>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Request Information</h2>
          <p>Get detailed specs, pricing & customization options.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Sales Team</button>
            <a 
              href="/docs/sputter-system-datasheet.pdf" 
              className="btn btn-secondary" 
              download="NineScrolls-Sputter-Datasheet.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                // Track download event
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'download', {
                    event_category: 'Product Datasheet',
                    event_label: 'Sputter System',
                    value: 1
                  });
                }
              }}
            >
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="Sputter System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 