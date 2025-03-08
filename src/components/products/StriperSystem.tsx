import { useState, useEffect } from 'react';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function StriperSystem() {
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
            <h1>Striper System Series</h1>
            <p>Advanced Photoresist Removal and Surface Cleaning System</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/striper/large.jpg" alt="Striper System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/striper/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/striper/detail-2.jpg" alt="Control Interface" />
                <img src="/assets/images/products/striper/detail-3.jpg" alt="Loading System" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Striper System Series provides efficient photoresist removal and surface cleaning capabilities with advanced process control. Designed for both research and production environments, it ensures complete removal of organic materials while protecting underlying layers.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Advanced plasma source technology</li>
                <li>Multiple process modes available</li>
                <li>Precise temperature control</li>
                <li>Automated endpoint detection</li>
                <li>High throughput capability</li>
                <li>Process recipe management</li>
                <li>Real-time monitoring system</li>
                <li>Safety interlocking system</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Photoresist Stripping</li>
                <li>Post-etch Cleaning</li>
                <li>Organic Contamination Removal</li>
                <li>Surface Activation</li>
                <li>Descum Processing</li>
                <li>Pre-diffusion Cleaning</li>
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
                  <td>Process Modes</td>
                  <td>Plasma, UV-Ozone, Combined</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>20°C to 350°C</td>
                </tr>
                <tr>
                  <td>Process Gases</td>
                  <td>O₂, N₂, CF₄, H₂ (optional)</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 1×10⁻⁵ Torr</td>
                </tr>
                <tr>
                  <td>Process Control</td>
                  <td>Automated with endpoint detection</td>
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
                <li>High stripping rate</li>
                <li>Excellent uniformity</li>
                <li>Low damage processing</li>
                <li>Multiple process recipes</li>
                <li>Endpoint detection</li>
                <li>Process monitoring</li>
                <li>Temperature uniformity</li>
                <li>Automated control</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Applications</h3>
              <ul>
                <li>Positive Photoresist Removal</li>
                <li>Negative Photoresist Stripping</li>
                <li>Post-etch Residue Cleaning</li>
                <li>Organic Contamination Removal</li>
                <li>Surface Treatment</li>
                <li>Pre-metal Clean</li>
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
            <a href="/docs/striper-system-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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
        productName="Striper System Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}