import { useState, useEffect } from 'react';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function SputterSystem() {
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
            <h1>Sputter System Series</h1>
            <p>Advanced Physical Vapor Deposition System for High-Quality Thin Film Coating</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/sputter/large.jpg" alt="Sputter System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/sputter/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/sputter/detail-2.jpg" alt="Target Assembly" />
                <img src="/assets/images/products/sputter/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Sputter System Series provides advanced physical vapor deposition capabilities through DC, RF, and magnetron sputtering. Designed for versatile thin film deposition, it offers exceptional control over film properties and composition.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Multiple sputtering modes (DC/RF/Magnetron)</li>
                <li>Up to 4 target positions</li>
                <li>Advanced power delivery system</li>
                <li>Precise substrate temperature control</li>
                <li>Automated process control</li>
                <li>Real-time deposition monitoring</li>
                <li>Load-lock system available</li>
                <li>Co-sputtering capability</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Metallic Films</li>
                <li>Magnetic Materials</li>
                <li>Transparent Conductors</li>
                <li>Dielectric Layers</li>
                <li>Barrier Coatings</li>
                <li>Decorative Coatings</li>
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
                  <td>Target Size</td>
                  <td>2" to 6" diameter targets</td>
                </tr>
                <tr>
                  <td>Power Supply</td>
                  <td>DC: up to 1kW, RF: up to 600W per target</td>
                </tr>
                <tr>
                  <td>Substrate Size</td>
                  <td>Up to 8" wafers or 200mm substrates</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 5×10⁻⁸ Torr</td>
                </tr>
                <tr>
                  <td>Process Gases</td>
                  <td>Ar, N₂, O₂, optional reactive gases</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>Room temperature to 800°C</td>
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
                <li>High deposition rate</li>
                <li>Excellent uniformity</li>
                <li>Multi-layer deposition</li>
                <li>Precise thickness control</li>
                <li>Good step coverage</li>
                <li>Low contamination levels</li>
                <li>Process repeatability</li>
                <li>In-situ monitoring</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Pure Metals (Au, Ag, Cu, Al)</li>
                <li>Alloys (NiFe, CuNi)</li>
                <li>Oxides (ITO, AZO)</li>
                <li>Nitrides (TiN, AlN)</li>
                <li>Magnetic Materials</li>
                <li>Compound Semiconductors</li>
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
            <a href="/docs/sputter-system-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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
        productName="Sputter System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 