import { useState, useEffect } from 'react';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function HDPCVDSystem() {
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
            <h1>HDP-CVD System Series</h1>
            <p>Advanced High-Density Plasma Chemical Vapor Deposition System for Superior Film Quality</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/hdp-cvd/large.jpg" alt="HDP-CVD System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/hdp-cvd/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/hdp-cvd/detail-2.jpg" alt="Plasma Source" />
                <img src="/assets/images/products/hdp-cvd/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The HDP-CVD System Series delivers exceptional film quality through high-density plasma chemical vapor deposition. Designed for advanced semiconductor manufacturing and research applications, it offers superior gap-fill performance and precise control over film properties.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>High-density plasma source (≥ 10¹¹ cm⁻³)</li>
                <li>Advanced temperature control system</li>
                <li>Multi-zone gas distribution</li>
                <li>Real-time process monitoring</li>
                <li>Automated recipe management</li>
                <li>Dual RF power delivery system</li>
                <li>In-situ plasma diagnostics</li>
                <li>Integrated endpoint detection</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>High-Quality Dielectric Films</li>
                <li>Gap-Fill Applications</li>
                <li>Inter-Metal Dielectric (IMD)</li>
                <li>Shallow Trench Isolation (STI)</li>
                <li>Pre-Metal Dielectric (PMD)</li>
                <li>Advanced Packaging</li>
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
                  <td>Up to 300mm (12") compatibility</td>
                </tr>
                <tr>
                  <td>RF System</td>
                  <td>Source: 2-3 kW, 13.56 MHz / Bias: 1-2 kW, 13.56 MHz</td>
                </tr>
                <tr>
                  <td>Process Temperature</td>
                  <td>Room temperature to 700°C</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 1×10⁻⁷ Torr</td>
                </tr>
                <tr>
                  <td>Gas Distribution</td>
                  <td>Multi-zone with up to 8 process gases</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>≤ ±2% (3σ) across wafer</td>
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
                <li>Excellent gap-fill capability</li>
                <li>High deposition rates</li>
                <li>Superior film density</li>
                <li>Low particle contamination</li>
                <li>Precise thickness control</li>
                <li>High aspect ratio filling</li>
                <li>Excellent step coverage</li>
                <li>Low thermal budget processing</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Silicon Dioxide (SiO₂)</li>
                <li>Silicon Nitride (Si₃N₄)</li>
                <li>Silicon Oxynitride (SiON)</li>
                <li>Phosphosilicate Glass (PSG)</li>
                <li>Borophosphosilicate Glass (BPSG)</li>
                <li>Low-k Dielectrics</li>
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
            <a href="/docs/hdp-cvd-system-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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
        productName="HDP-CVD System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 