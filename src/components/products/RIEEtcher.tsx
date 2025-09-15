import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
// import { ContactFormModal } from '../common/ContactFormModal';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';

export function RIEEtcher() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  // no-op placeholders removed: using QuoteModal

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

  // no-op

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>RIE Etcher Series</h1>
            <p>High-precision Reactive Ion Etching System with Compact Design</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/rie-etcher/main.jpg" 
                alt="RIE Etcher System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The RIE Etcher Series delivers high-precision reactive ion etching in a compact 1.0m × 1.0m footprint. Designed for research and development environments, it offers exceptional process control and monitoring capabilities.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact footprint design (1.0m × 1.0m)</li>
                <li>Advanced plasma control system</li>
                <li>Real-time process monitoring</li>
                <li>Multiple gas line configuration</li>
                <li>Precise temperature control</li>
                <li>Flexible RF power options</li>
                <li>User-friendly interface</li>
                <li>Comprehensive safety features</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Silicon Processing</li>
                <li>Dielectric Etching</li>
                <li>Metal Etching</li>
                <li>Polymer Processing</li>
                <li>MEMS Fabrication</li>
                <li>Research & Development</li>
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
                  <td>4" to 12" compatibility</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>13.56 MHz, up to 600W</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>4 process gas lines with MFCs</td>
                </tr>
                <tr>
                  <td>Temperature Control</td>
                  <td>20°C to 80°C</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>≤ 5×10⁻⁶ Torr</td>
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
                <li>High etch rate control</li>
                <li>Excellent process uniformity</li>
                <li>Advanced endpoint detection (OES/IV/impedance ready)</li>
                <li>Stable plasma generation</li>
                <li>Precise pressure control</li>
                <li>Multiple process recipes storage</li>
                <li>Real-time parameter monitoring</li>
                <li>Automated pressure control</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Applications</h3>
              <ul>
                <li>Silicon dioxide etching</li>
                <li>Silicon nitride processing</li>
                <li>Polysilicon etching</li>
                <li>Metal pattern definition</li>
                <li>Polymer removal</li>
                <li>Surface treatment</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Related equipment & articles */}
      <section className="related-reading">
        <div className="container">
          <h2>Related Equipment & Articles</h2>
          <ul>
            <li>
              <a href="/products/icp-etcher">ICP Etcher Series</a> – high-density plasma etching alternative.
            </li>
            <li>
              <a href="/insights/plasma-etching">Plasma Etching Fundamentals</a> – key concepts, terms, and control knobs.
            </li>
            <li>
              <a href="/insights/plasma-etching-explained-fundamentals-applications">Plasma Etching Explained</a> – practical guidance and applications.
            </li>
            <li>
              <a href="/insights/future-of-plasma-etching-microelectronics">Future of Plasma Etching</a> – trends: ALE, pulsed plasma, low‑damage etch.
            </li>
          </ul>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Request Information</h2>
          <p>Get detailed specs, pricing & customization options.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Sales Team</button>
            <a href="#" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); setGateOpen(true); }}>
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

      <QuoteModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="RIE Etcher Series"
        onDownloadBrochure={()=>{
          const a=document.createElement('a'); a.href='/docs/rie-etcher-datasheet.pdf'; a.download='NineScrolls-RIE-Etcher-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/docs/rie-etcher-datasheet.pdf'}
        fileName={'NineScrolls-RIE-Etcher-Datasheet.pdf'}
        title={'Download RIE Etcher Datasheet'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
} 