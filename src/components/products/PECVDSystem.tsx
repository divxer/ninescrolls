import { useState, useEffect } from 'react';
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
            <p>Advanced Plasma-Enhanced Chemical Vapor Deposition System for High-Quality Film Growth</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/pecvd/large.jpg" alt="PECVD System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/pecvd/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/pecvd/detail-2.jpg" alt="Plasma Source" />
                <img src="/assets/images/products/pecvd/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The PECVD System Series delivers superior thin film deposition through plasma-enhanced chemical vapor deposition. Designed for versatile applications in research and production environments, it offers excellent film quality and process control.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>State-of-the-art plasma technology</li>
                <li>Advanced thermal management</li>
                <li>Integrated gas delivery system</li>
                <li>Comprehensive control interface</li>
                <li>Automated process sequences</li>
                <li>Safety interlock system</li>
                <li>Data logging capabilities</li>
                <li>Modular design architecture</li>
              </ul>

              <h3>Target Applications</h3>
              <ul className="application-list">
                <li>Advanced semiconductor devices</li>
                <li>Optoelectronic components</li>
                <li>Protective coatings</li>
                <li>Research and development</li>
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
                  <td>Substrate Size</td>
                  <td>Up to 8" wafers or 200mm substrates</td>
                </tr>
                <tr>
                  <td>RF System</td>
                  <td>13.56 MHz, up to 1000W</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>Room temperature to 400°C</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 1×10⁻⁶ Torr</td>
                </tr>
                <tr>
                  <td>Gas Distribution</td>
                  <td>Up to 6 process gases with MFCs</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>≤ ±3% (3σ) across wafer</td>
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
                <li>Low temperature processing ({'>'}200°C)</li>
                <li>High deposition rates</li>
                <li>Excellent step coverage</li>
                <li>Superior film adhesion</li>
                <li>Precise thickness control</li>
                <li>Low particle contamination</li>
                <li>Process repeatability</li>
                <li>Multi-layer capability</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Silicon Nitride (SiNx)</li>
                <li>Silicon Dioxide (SiO₂)</li>
                <li>Silicon Oxynitride (SiON)</li>
                <li>Amorphous Silicon (a-Si)</li>
                <li>Silicon Carbide (SiC)</li>
                <li>Diamond-like Carbon (DLC)</li>
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
            <a href="/docs/pecvd-system-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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