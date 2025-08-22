import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function PECVDSystem() {
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
            <h1>PECVD System Series</h1>
            <p>Advanced Plasma-Enhanced Chemical Vapor Deposition System for Versatile Film Growth</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/pecvd/main.jpg" 
                alt="PECVD System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The PECVD Series utilizes plasma-enhanced chemical vapor deposition (PECVD) technology within a compact uni-body design featuring a small footprint (approx. 1.0m x 1.0m). Engineered for versatile applications in research and production environments, it delivers excellent film quality, superior process flexibility, and precise control with configurable options to optimize performance or cost-efficiency.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body compact design (footprint: ~1.0m x 1.0m)</li>
                <li>Variable plasma discharge gap for optimized process performance</li>
                <li>Electrode RF-driven configuration (13.56 MHz and/or 400 KHz) for low-stress films and precise tuning</li>
                <li>Chamber liner and electrode temperature control suitable for various deposition processes</li>
                <li>Integrated gas delivery system (standard: 6 lines, customizable)</li>
                <li>Optional sample handling system (Open-load or Load-lock)</li>
                <li>Automated and modular process design kits tailored to specific requirements</li>
                <li>Cost-performance customization options (RF system, pumps, valves, etc.)</li>
              </ul>

              <h3>Target Applications</h3>
              <ul className="application-list">
                <li>Advanced semiconductor devices</li>
                <li>Optoelectronic components</li>
                <li>Protective coatings</li>
                <li>Research & development</li>
                <li>Novel materials synthesis</li>
                <li>Device optimization</li>
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
                  <td>4", 6", 8", 12" wafers or multi-wafer configurations (optional)</td>
                </tr>
                <tr>
                  <td>RF System</td>
                  <td>13.56 MHz and/or 400 KHz, power range 500-2000 W (optional)</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>20°C to 400°C (higher temperature optional)</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>Roots pump & mechanical pump</td>
                </tr>
                <tr>
                  <td>Gas Distribution</td>
                  <td>Up to 6 gas lines (standard), customizable</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 5% (edge exclusion)</td>
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
                <li>Excellent step coverage (gap parameter adjustable)</li>
                <li>High deposition rates</li>
                <li>Superior film adhesion and density</li>
                <li>Precise thickness and stress control</li>
                <li>Low particle contamination</li>
                <li>Low-temperature processing capability</li>
                <li>Process repeatability and multi-layer deposition capability</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Amorphous Silicon (α-Si:H)</li>
                <li>Silicon Dioxide (SiO₂)</li>
                <li>Silicon Nitride (SiNx)</li>
                <li>Silicon Carbide (SiC)</li>
                <li>Silicon Oxynitride (SiON)</li>
                <li>Diamond-like Carbon (DLC, optional)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Request Information</h2>
          <p>Contact our sales team for detailed specifications, pricing, and customization options.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Sales Team</button>
            <a 
              href="/docs/pecvd-system-datasheet.pdf" 
              className="btn btn-secondary" 
              download="NineScrolls-PECVD-Datasheet.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                // Track download event
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'download', {
                    event_category: 'Product Datasheet',
                    event_label: 'PECVD System',
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
        productName="PECVD System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 