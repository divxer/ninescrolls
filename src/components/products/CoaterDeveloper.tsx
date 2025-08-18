import { useState, useEffect } from 'react';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function CoaterDeveloper() {
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
            <h1>Coater/Developer System Series</h1>
            <p>Advanced Photoresist Coating and Developing System</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/coater-developer/main.jpg" 
                alt="Coater/Developer System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Coater/Developer Series provides high-precision photoresist coating and developing capabilities within a compact uni-body design (footprint approx. 1.0m x 0.8m). Engineered for advanced lithography applications, it offers exceptional flexibility, customizable module configurations, and precise automated process control, ensuring uniform and reproducible results.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design (footprint 1.0m x 0.8m)</li>
                <li>Flexible configuration with customizable numbers of Coater, Developer, and Hotplate modules</li>
                <li>Advanced dispensing systems with configurable dispense arms (up to 2 photoresist lines and 2 developer lines plus DI water)</li>
                <li>High-speed spin modules with precise spin profile programming (Coater up to 8000 rpm ±1 rpm; Developer up to 5000 rpm ±1 rpm)</li>
                <li>Precise temperature control with configurable Hotplate modules (up to 200°C standard; higher temperatures optional)</li>
                <li>Cost-performance customization (dispense systems, pumps, valves, etc.)</li>
                <li>Automated open-load sample handling</li>
                <li>Automated safety interlocks (vacuum pressure, lid interlocks, etc.)</li>
                <li>Edge bead removal (EBR) capability (optional)</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Photoresist Coating (positive/negative resists, electron-beam resists)</li>
                <li>HMDS Priming and Adhesion Promotion</li>
                <li>Developer Processing and Lift-off Processes</li>
                <li>Thick Film and Multi-layer Applications</li>
                <li>Anti-reflective and Specialty Polymer Coatings</li>
                <li>Small-piece substrate and wafer processing (up to 12-inch or square substrates)</li>
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
                  <td>Wafer Size Range</td>
                  <td>Small pieces, 2", 4", 6", 8", 12" wafers or square substrates (optional)</td>
                </tr>
                <tr>
                  <td>Spin Speed</td>
                  <td>
                    <ul>
                      <li>Coater module: up to 8000 rpm ±1 rpm, acceleration up to 8000 rpm/s</li>
                      <li>Developer module: up to 5000 rpm ±1 rpm, acceleration up to 5000 rpm/s</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>Temperature Control</td>
                  <td>Room temperature to 200°C standard (hotplate); higher temperature options available</td>
                </tr>
                <tr>
                  <td>Dispense Arm Configurations</td>
                  <td>
                    <ul>
                      <li>Coater: up to 2 photoresist lines</li>
                      <li>Developer: up to 2 developer lines plus DI water line</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>Mechanical pump (standard), configurable for specific vacuum levels</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 0.5% (3σ typical coating uniformity)</td>
                </tr>
                <tr>
                  <td>Environmental Control (optional)</td>
                  <td>Temperature (23±0.5°C), Humidity (45±5% RH)</td>
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
                <li>High coating uniformity and precise thickness control</li>
                <li>Excellent process repeatability and uniform temperature distribution</li>
                <li>Automated cleaning cycles and advanced developing control</li>
                <li>Multiple programmable spin and coating profiles</li>
                <li>Real-time process monitoring and automated control</li>
                <li>Customizable process recipes tailored to specific applications</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Positive and Negative Photoresists</li>
                <li>Electron Beam and Thick Film Resists</li>
                <li>Anti-reflective coatings and specialty polymers</li>
                <li>Wide compatibility with specialty materials through configurable dispense systems</li>
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
              href="/docs/coater-developer-system-datasheet.pdf" 
              className="btn btn-secondary" 
              download="NineScrolls-Coater-Developer-Datasheet.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                // Track download event
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'download', {
                    event_category: 'Product Datasheet',
                    event_label: 'Coater Developer System',
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
        productName="Coater/Developer System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 