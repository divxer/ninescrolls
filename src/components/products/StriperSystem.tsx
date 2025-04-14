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
              <img 
                src="/assets/images/products/striper/main.jpg" 
                alt="Striper System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Striper Series provides efficient photoresist removal and surface cleaning capabilities within a compact uni-body design (footprint approx. 0.8m x 0.8m). Engineered for flexibility and ease of use in both research and production environments, this system ensures complete removal of organic materials, precise process control, and minimal impact on underlying layers.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design with minimal footprint (0.8m x 0.8m)</li>
                <li>Uniform chamber center pump-down design for enhanced process uniformity</li>
                <li>Configurable gas delivery system with independently adjustable parameters</li>
                <li>Adjustable plasma discharge gap, configurable for optimal process tuning</li>
                <li>Flexible cost-performance orientation, customizable RF power, vacuum pumps, and valves</li>
                <li>Automated open-load sample handling</li>
                <li>Real-time process monitoring and automated endpoint detection</li>
                <li>Water-cooled wafer stage with precise temperature control (5°C to 200°C, optional)</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Photoresist Stripping (positive and negative)</li>
                <li>Post-etch Residue Cleaning</li>
                <li>Organic Contamination Removal</li>
                <li>Surface Activation and Descum</li>
                <li>Surface Preparation and Pre-metal Cleaning</li>
                <li>2D Materials Etching (e.g., MoS₂, BN, Graphene)</li>
                <li>Failure Analysis Sample Cleaning</li>
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
                  <td>4", 6", 8", 12", or multi-wafer configurations available</td>
                </tr>
                <tr>
                  <td>Process Modes</td>
                  <td>Plasma processing (standard), optional customized configurations</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>Customizable from 300W to 1000W (optional)</td>
                </tr>
                <tr>
                  <td>Wafer Stage Temperature</td>
                  <td>5°C to 200°C (water cooling), optional configurations</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>2 lines standard, additional gas lines customizable</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>Mechanical pump, customizable vacuum levels</td>
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
                <li>High stripping rates with minimal surface damage</li>
                <li>Excellent process uniformity and repeatability</li>
                <li>Multiple configurable process recipes</li>
                <li>Adjustable plasma gap and uniform gas distribution for optimized results</li>
                <li>Automated endpoint detection for precise control</li>
                <li>Real-time monitoring and automated process management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Materials and Processes</h3>
              <ul>
                <li>Organic materials (Photoresist, PMMA, PS nanospheres, etc.)</li>
                <li>Two-dimensional (2D) materials (MoS₂, BN, Graphene, etc.)</li>
                <li>Surface cleaning for failure analysis</li>
                <li>General organic contamination removal and activation processes</li>
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