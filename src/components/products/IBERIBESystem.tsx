import { useState, useEffect } from 'react';
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
            <p>Advanced Ion Beam Etching and Reactive Ion Beam Etching System</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/ibe-ribe/large.jpg" alt="IBE/RIBE System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/ibe-ribe/detail-1.jpg" alt="Ion Source View" />
                <img src="/assets/images/products/ibe-ribe/detail-2.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/ibe-ribe/detail-3.jpg" alt="Control System" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The IBE/RIBE System Series combines ion beam etching and reactive ion beam etching capabilities in a versatile platform. Designed for precision material processing, it offers exceptional control over beam parameters and process conditions.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Dual mode operation: IBE and RIBE</li>
                <li>Advanced ion source technology</li>
                <li>Precise beam current control</li>
                <li>Variable incident angle (0-90°)</li>
                <li>In-situ process monitoring</li>
                <li>Automated sample handling</li>
                <li>Multiple gas injection options</li>
                <li>Real-time endpoint detection</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Magnetic Materials Processing</li>
                <li>Optical Device Fabrication</li>
                <li>MEMS/NEMS Development</li>
                <li>Multilayer Film Etching</li>
                <li>Surface Planarization</li>
                <li>Pattern Transfer</li>
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
                  <td>Ion Source</td>
                  <td>RF/DC, 100-1200 eV energy range</td>
                </tr>
                <tr>
                  <td>Beam Current</td>
                  <td>10-200 mA, continuously adjustable</td>
                </tr>
                <tr>
                  <td>Sample Size</td>
                  <td>Up to 8" wafers or 200mm substrates</td>
                </tr>
                <tr>
                  <td>Rotation Speed</td>
                  <td>1-30 rpm, programmable</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 5×10⁻⁷ Torr</td>
                </tr>
                <tr>
                  <td>Process Gases</td>
                  <td>Ar, O₂, CF₄, SF₆, Cl₂ (optional)</td>
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
                <li>High-precision angle control</li>
                <li>Uniform beam profile</li>
                <li>Low surface damage</li>
                <li>Excellent reproducibility</li>
                <li>Wide process window</li>
                <li>Multi-layer processing</li>
                <li>Automated recipe control</li>
                <li>Advanced process monitoring</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Magnetic Materials (NiFe, CoFe)</li>
                <li>Optical Materials (Glass, Quartz)</li>
                <li>Semiconductors (Si, GaAs, InP)</li>
                <li>Metals (Au, Pt, Cu)</li>
                <li>Dielectrics (SiO₂, Si₃N₄)</li>
                <li>Advanced Materials (2D, Quantum)</li>
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
            <a href="/docs/ibe-ribe-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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