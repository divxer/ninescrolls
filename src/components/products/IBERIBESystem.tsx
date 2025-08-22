import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function IBERIBESystem() {
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
            <h1>IBE/RIBE System Series</h1>
            <p>Advanced Ion Beam Etching System for High-Precision Material Processing</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/ibe-ribe/main.jpg" 
                alt="IBE/RIBE System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The IBE/RIBE Series combines Ion Beam Etching (IBE) and Reactive Ion Beam Etching (RIBE) capabilities within a compact, uni-body design (footprint approx. 1.0m x 0.8m). Engineered for precision material processing, the system provides exceptional control over ion beam parameters, flexible configuration, and ease of maintenance, making it highly adaptable for diverse research and production applications.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design with minimal footprint (1.0m x 0.8m)</li>
                <li>Easy-to-maintain sample holder and ion source configuration</li>
                <li>Quick-swap ion source system (Kaufman/RF ion sources), configurable according to user requirements</li>
                <li>Dual-mode operation: IBE and RIBE modes available</li>
                <li>Variable incident angle (0-90°) with programmable rotation (1-10 rpm)</li>
                <li>Flexible wafer stage cooling (standard water cooling from 5°C to 20°C; optional backside He cooling)</li>
                <li>Configurable gas injection system (standard 1-3 lines, customizable)</li>
                <li>Optional RF-biased substrate stage for enhanced in-situ cleaning and control</li>
                <li>Automated sample handling options (Open-Load or Load-Lock)</li>
                <li>Real-time process monitoring and endpoint detection</li>
                <li>Cost-performance oriented customization (ion source, pumps, valves, etc.)</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Magnetic materials processing</li>
                <li>Optical device fabrication</li>
                <li>MEMS/NEMS device development</li>
                <li>Multilayer film etching</li>
                <li>Surface planarization</li>
                <li>Precise pattern transfer</li>
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
                  <td>Ion Source Options</td>
                  <td>
                    <ul>
                      <li>Kaufman-type ion source (up to 6" wafers)</li>
                      <li>RF ion source (up to 12" wafers)</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>Wafer Size</td>
                  <td>Supports up to 12-inch wafers or multi-wafer configurations</td>
                </tr>
                <tr>
                  <td>Wafer Stage Motion</td>
                  <td>Tilt angle adjustable from 0° to 90°, rotation speed programmable from 1-10 rpm</td>
                </tr>
                <tr>
                  <td>Substrate Cooling</td>
                  <td>Water cooling (5°C-20°C standard); optional backside helium cooling</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Less than 7x10^-7 Torr (standard); higher vacuum available upon request</td>
                </tr>
                <tr>
                  <td>Gas Injection System</td>
                  <td>Standard 1-3 lines, additional lines customizable</td>
                </tr>
                <tr>
                  <td>Film Non-Uniformity</td>
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
                <li>High-precision ion beam angle and current control</li>
                <li>Excellent uniformity of etched surfaces</li>
                <li>Low surface damage and contamination levels</li>
                <li>Wide and flexible process window</li>
                <li>Excellent process reproducibility</li>
                <li>Multi-layer and advanced materials processing</li>
                <li>Real-time process monitoring and automated control</li>
                <li>Optional in-situ RF-biased substrate cleaning</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Magnetic Materials: NiFe, CoFe, etc.</li>
                <li>Optical Materials: Glass, Quartz</li>
                <li>Semiconductors: Si, GaAs, InP</li>
                <li>Metals: Au, Pt, Cu</li>
                <li>Dielectrics: SiO₂, Si₃N₄</li>
                <li>Advanced Materials: 2D and Quantum materials</li>
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
              href="/docs/ibe-ribe-system-datasheet.pdf" 
              className="btn btn-secondary" 
              download="NineScrolls-IBE-RIBE-Datasheet.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                // Track download event
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'download', {
                    event_category: 'Product Datasheet',
                    event_label: 'IBE RIBE System',
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
        productName="IBE/RIBE System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 