import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
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
            <h1>ICP Etcher Series</h1>
            <p>Advanced Inductively Coupled Plasma Etching System with Uni-body Design</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/icp-etcher/main.jpg" 
                alt="ICP Etcher System" 
                className="main-product-image" 
              />
              <div className="technical-diagram" style={{ 
                background: 'white', 
                borderRadius: '12px', 
                padding: '2rem', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
                border: '1px solid #e0e0e0', 
                marginTop: '2rem',
                marginBottom: '2rem'
              }}>
                <h3 style={{ 
                  color: '#0066cc', 
                  marginBottom: '1.5rem', 
                  fontSize: '1.4rem', 
                  fontWeight: '600', 
                  textAlign: 'center' 
                }}>
                  ICP System Schematic Diagram
                </h3>
                <img 
                  src="/assets/images/products/icp-etcher/icp-system-schematic.png" 
                  alt="Inductively Coupled Plasma (ICP) Etching System Schematic - Showing plasma generation coil, etching stations, RF power connections, and gas flow paths" 
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    marginBottom: '1rem',
                    background: '#f8f9fa',
                    padding: '1rem',
                    display: 'block',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    console.log('Image failed to load:', target.src);
                    // Fallback to WebP if PNG fails
                    target.src = '/assets/images/products/icp-etcher/icp-system-schematic.webp';
                  }}
                />
                <p style={{ 
                  fontSize: '0.95rem', 
                  color: '#666', 
                  lineHeight: '1.5', 
                  textAlign: 'center', 
                  margin: '0', 
                  fontStyle: 'italic',
                  padding: '0 1rem'
                }}>
                  <strong>System Components:</strong> Etching gas inlet, ICP coupling coil, etching stations, RF power connection, 
                  helium piping for wafer cooling, and vacuum channel for gas evacuation.
                </p>
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
            <a 
              href="/docs/icp-etcher-datasheet.pdf" 
              className="btn btn-secondary" 
              download="NineScrolls-ICP-Etcher-Datasheet.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => {
                // Track download event
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'download', {
                    event_category: 'Product Datasheet',
                    event_label: 'ICP Etcher',
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
        productName="ICP Etcher Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
} 