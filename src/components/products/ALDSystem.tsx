import { useState, useEffect } from 'react';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function ALDSystem() {
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
            <h1>ALD System Series</h1>
            <p>Advanced Atomic Layer Deposition System for Precise Thin Film Growth</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/ald/large.jpg" alt="ALD System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/ald/detail-1.jpg" alt="Reaction Chamber" />
                <img src="/assets/images/products/ald/detail-2.jpg" alt="Precursor Delivery" />
                <img src="/assets/images/products/ald/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The ALD System Series delivers atomic-level precision in thin film deposition through sequential, self-limiting surface reactions. Designed for research and production environments, it offers exceptional film quality and conformality.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Advanced ALD reactor design</li>
                <li>Multiple precursor delivery system</li>
                <li>Precise temperature management</li>
                <li>Automated process control</li>
                <li>Comprehensive monitoring suite</li>
                <li>Recipe management system</li>
                <li>Safety monitoring system</li>
                <li>User-friendly interface</li>
              </ul>

              <h3>Target Applications</h3>
              <ul className="application-list">
                <li>Advanced semiconductor devices</li>
                <li>Nanotechnology research</li>
                <li>Energy storage materials</li>
                <li>Optical applications</li>
                <li>Protective coatings</li>
                <li>Novel materials development</li>
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
                  <td>Temperature Range</td>
                  <td>Room temperature to 400°C</td>
                </tr>
                <tr>
                  <td>Precursor Lines</td>
                  <td>4-8 independent lines with heating</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 1×10⁻⁶ Torr</td>
                </tr>
                <tr>
                  <td>Growth Rate</td>
                  <td>0.5-2 Å/cycle typical</td>
                </tr>
                <tr>
                  <td>Uniformity</td>
                  <td>≤ ±2% across wafer</td>
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
                <li>Sub-nanometer thickness control</li>
                <li>Excellent step coverage ({'>'}98%)</li>
                <li>High film conformality</li>
                <li>Precise composition control</li>
                <li>Low impurity content</li>
                <li>Multi-layer capability</li>
                <li>Process repeatability</li>
                <li>In-situ monitoring</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Metal Oxides (Al₂O₃, HfO₂, ZrO₂)</li>
                <li>Nitrides (TiN, AlN, Si₃N₄)</li>
                <li>Pure Metals (Pt, Ru, W)</li>
                <li>Sulfides (ZnS, WS₂)</li>
                <li>Complex Oxides</li>
                <li>2D Materials</li>
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
            <a href="/docs/ald-system-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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
        productName="ALD System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 