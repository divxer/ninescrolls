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
            <p>Advanced Atomic Layer Deposition System for Precision Thin Film Growth</p>
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
              <p>The ALD Series offers atomic-level precision in thin film deposition through sequential, self-limiting surface reactions within a compact uni-body design (footprint approx. 0.8m x 1.0m). Engineered for both research and production environments, it delivers exceptional film quality, outstanding high-aspect-ratio (AR) step coverage, and configurable options for performance and cost optimization.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design (0.8m x 1.0m footprint)</li>
                <li>Box-in-box process chamber for enhanced process stability</li>
                <li>Showerhead gas feed-in system with independently configurable parameters</li>
                <li>Excellent high-aspect-ratio (AR) step coverage</li>
                <li>Multiple gas inlets and vertical precursor flow configuration</li>
                <li>Optional remote plasma (RF) capability (300-1000W)</li>
                <li>Precise electrode temperature and chamber liner control for diverse processes</li>
                <li>Flexible cost-performance customization (RF system, vacuum pumps, valves, etc.)</li>
                <li>Optional sample handling: Open-load or Load-lock systems</li>
                <li>User-friendly interface and automated process control</li>
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
                  <td>Wafer Size</td>
                  <td>4", 6", 8", 12", or supersize configurations (optional)</td>
                </tr>
                <tr>
                  <td>Wafer Temperature Range</td>
                  <td>20°C to 400°C (higher temperature optional)</td>
                </tr>
                <tr>
                  <td>Source Temperature</td>
                  <td>Standard 20°C-150°C, optional up to 200°C</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Less than 5x10^-5 Torr (TMP and mechanical pump)</td>
                </tr>
                <tr>
                  <td>Growth Rate</td>
                  <td>Typical 0.5-2 Å per cycle</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 1% (Al₂O₃, edge exclusion)</td>
                </tr>
                <tr>
                  <td>Number of Precursor Lines</td>
                  <td>2-6 lines (customizable)</td>
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
                <li>Outstanding high-AR step coverage ({'>'}98%)</li>
                <li>Exceptional film conformality</li>
                <li>Precise control of film composition</li>
                <li>Low impurity and defect content</li>
                <li>Multi-layer film deposition capability</li>
                <li>Excellent process repeatability</li>
                <li>In-situ monitoring capability (optional)</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Oxides: Al₂O₃, HfO₂, SiO₂, TiO₂, Ga₂O₃, ZnO, etc.</li>
                <li>Nitrides: TiN, TaN, SiNx, AlN, GaN, etc.</li>
                <li>Metals: Pt, Pd, W, Ru, etc.</li>
                <li>Complex oxides and 2D materials (optional)</li>
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