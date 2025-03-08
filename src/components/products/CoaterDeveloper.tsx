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
            <p>Advanced Photoresist Coating and Developing System for Precision Lithography</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/coater-developer/large.jpg" alt="Coater/Developer System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/coater-developer/detail-1.jpg" alt="Coating Module" />
                <img src="/assets/images/products/coater-developer/detail-2.jpg" alt="Developer Module" />
                <img src="/assets/images/products/coater-developer/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Coater/Developer System Series provides high-precision photoresist coating and developing capabilities for advanced lithography applications. Featuring automated handling and precise process control, it ensures consistent and uniform results.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Dual coating and developing modules</li>
                <li>Advanced dispensing system</li>
                <li>Precise temperature control</li>
                <li>Programmable spin profiles</li>
                <li>Automated wafer handling</li>
                <li>Recipe management system</li>
                <li>Edge bead removal (EBR)</li>
                <li>Environmental control unit</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Photoresist Coating</li>
                <li>HMDS Priming</li>
                <li>Developer Processing</li>
                <li>Lift-off Processes</li>
                <li>Thick Film Applications</li>
                <li>Multi-layer Coating</li>
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
                  <td>Spin Speed</td>
                  <td>0 to 6000 rpm (±1 rpm)</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>Room temperature to 200°C</td>
                </tr>
                <tr>
                  <td>Coating Uniformity</td>
                  <td>≤ ±0.5% (3σ)</td>
                </tr>
                <tr>
                  <td>Process Modules</td>
                  <td>HMDS, Coating, Developing, Heating/Cooling</td>
                </tr>
                <tr>
                  <td>Environmental Control</td>
                  <td>Temperature: 23±0.5°C, Humidity: 45±5% RH</td>
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
                <li>High uniformity coating</li>
                <li>Precise thickness control</li>
                <li>Excellent repeatability</li>
                <li>Multiple coating modes</li>
                <li>Advanced developing control</li>
                <li>Automated cleaning cycles</li>
                <li>Process monitoring</li>
                <li>Recipe optimization</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Positive Photoresists</li>
                <li>Negative Photoresists</li>
                <li>Electron Beam Resists</li>
                <li>Thick Film Resists</li>
                <li>Anti-reflective Coatings</li>
                <li>Specialty Polymers</li>
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
            <a href="/docs/coater-developer-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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