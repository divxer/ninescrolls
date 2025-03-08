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
              <p>The HDP-CVD Series features a uni-body design that delivers exceptional film quality and superior gap-fill capability. Designed for semiconductor manufacturing, advanced packaging, and research applications, it balances high performance with space efficiency (footprint: approximately 1.0m x 1.5m). The system supports modular configuration, allowing for optimized cost and performance according to specific process requirements.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design with outstanding space efficiency</li>
                <li>Compatible with various deposition materials (Si, SiO₂, SiNx, SiON, SiC, etc.)</li>
                <li>Optional RF system (Source: 1000-3000W / Bias: 300-1000W)</li>
                <li>Chamber liner & electrode temperature control for optimized process applications</li>
                <li>Configurable sample handling options (Open-Load or Load-Lock)</li>
                <li>Multi-zone gas system (Standard: 6 lines, customizable)</li>
                <li>Excellent step coverage with tunable parameters</li>
                <li>Non-uniformity: less than 5% (edge exclusion)</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>High-quality dielectric film deposition</li>
                <li>Gap-fill applications</li>
                <li>Inter-metal dielectric (IMD)</li>
                <li>Shallow trench isolation (STI)</li>
                <li>Pre-metal dielectric (PMD)</li>
                <li>Advanced packaging</li>
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
                  <td>Supports 4", 6", 8", 12", or multi-wafer processing</td>
                </tr>
                <tr>
                  <td>RF Power System</td>
                  <td>Source power: 1000-3000W (13.56 MHz)<br />Bias power: 300-1000W (13.56 MHz, optional)</td>
                </tr>
                <tr>
                  <td>Process Temperature</td>
                  <td>20°C to 200°C</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Supports high vacuum operation with TMP & mechanical pump</td>
                </tr>
                <tr>
                  <td>Gas Distribution</td>
                  <td>Standard 6-line system, customizable upon request</td>
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
                <li>Excellent gap-fill capability</li>
                <li>Superior film density and deposition uniformity</li>
                <li>Precise thickness control</li>
                <li>Excellent step coverage (parameter-tunable)</li>
                <li>Low particle contamination</li>
                <li>Low thermal budget processing</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Silicon Dioxide (SiO₂)</li>
                <li>Silicon Nitride (Si₃N₄)</li>
                <li>Silicon Oxynitride (SiON)</li>
                <li>Silicon Carbide (SiC)</li>
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