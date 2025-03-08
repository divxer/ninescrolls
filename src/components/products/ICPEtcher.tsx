import { useState, useEffect } from 'react';
import { ContactFormModal } from '../common/ContactFormModal';
import { ContactFormData } from '../../types';

export function ICPEtcher() {
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
            <h1>ICP Etcher Series</h1>
            <p>Advanced Inductively Coupled Plasma Etching System with Uni-body Design</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/icp-etcher/large.jpg" alt="ICP Etcher System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/icp-etcher/detail-1.jpg" alt="ICP Source View" />
                <img src="/assets/images/products/icp-etcher/detail-2.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/icp-etcher/detail-3.jpg" alt="Control System" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The ICP Etcher Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.5m). The system's process design kits and chamber liner temperature control ensure superior process performance for various applications.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design with compact footprint (1.0m × 1.5m)</li>
                <li>Advanced plasma source technology</li>
                <li>Comprehensive process control system</li>
                <li>Multiple process design kits</li>
                <li>Automated recipe management</li>
                <li>Real-time monitoring capabilities</li>
                <li>Flexible configuration options</li>
                <li>Enhanced safety features</li>
              </ul>

              <h3>Target Applications</h3>
              <ul className="application-list">
                <li>Advanced semiconductor research</li>
                <li>Production environment processing</li>
                <li>Materials development</li>
                <li>Device fabrication</li>
                <li>Process optimization</li>
                <li>Specialty manufacturing</li>
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
                  <td>4", 6", 8", 12" or multi-wafers optional</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>Source: 1000-3000W, Bias: 300-1000W, optional</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>5 lines (Standard) and He backside cooling, or customized</td>
                </tr>
                <tr>
                  <td>Wafer Stage Temperature Range</td>
                  <td>From -70℃ to 200℃, optional</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±5% (Edge Exclusion)</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>TMP & Mechanical Pump</td>
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
              <h3>System Performance</h3>
              <ul>
                <li>Chamber liner and electrode temperature control</li>
                <li>Tunable plasma discharge gap</li>
                <li>Cost or performance orientation options</li>
                <li>Customizable RF configurations</li>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing options</li>
                <li>Open-Load or Load-Lock configurations</li>
                <li>Advanced process monitoring</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Processing</h3>
              <ul>
                <li>Si-Based Materials (Si, SiO2, SiNx, SiC, Quartz)</li>
                <li>Compound Semiconductors (InP, GaN, GaAs, Ga2O3)</li>
                <li>2D Materials (MoS2, BN, Graphene)</li>
                <li>Metals (W, Ta, Mo)</li>
                <li>Diamond Processing</li>
                <li>Failure Analysis Applications</li>
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
            <a href="/docs/icp-etcher-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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
        productName="ICP Etcher Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 