import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
// import { ContactFormModal } from '../common/ContactFormModal';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';

export function PECVDSystem() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

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


  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>PECVD System Series</h1>
            <p>Advanced Plasma-Enhanced Chemical Vapor Deposition System for Versatile Film Growth</p>
            <p className="hero-subtitle-emphasis">
              US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
            </p>
            
            {/* Cost-Efficiency Hero Card */}
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              backgroundColor: 'rgba(0, 0, 0, 0.65)', 
              borderRadius: '8px',
              backdropFilter: 'blur(4px)',
              maxWidth: '800px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <h3 style={{ 
                margin: '0 0 0.75rem 0', 
                fontSize: '1.1rem', 
                color: '#EAEAEA', 
                fontWeight: '600',
                textAlign: 'center'
              }}>
                Cost-efficient, research-grade configurations
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: '0.95rem', 
                color: '#EAEAEA', 
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                We specialize in cost-efficient configurations for research labs that need to balance performance and budget. 
                We help labs avoid paying for unnecessary industrial features and focus on what matters for research applications.
              </p>
            </div>
            <div className="hero-cta-simple">
              <button className="btn btn-primary" onClick={openContactForm}>Request a Quote</button>
              <a href="#" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); setGateOpen(true); }}>
                Download Datasheet
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/pecvd/main.jpg" 
                alt="PECVD System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The PECVD Series utilizes plasma-enhanced chemical vapor deposition (PECVD) technology within a compact uni-body design featuring a small footprint (approx. 1.0m x 1.0m). Engineered for versatile applications in research and production environments, it delivers excellent film quality, superior process flexibility, and precise control with configurable options to optimize performance or cost-efficiency.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body compact design (footprint: ~1.0m x 1.0m)</li>
                <li>Variable plasma discharge gap for optimized process performance</li>
                <li>Electrode RF-driven configuration (13.56 MHz and/or 400 KHz) for low-stress films and precise tuning</li>
                <li>Chamber liner and electrode temperature control suitable for various deposition processes</li>
                <li>Integrated gas delivery system (standard: 6 lines, customizable)</li>
                <li>Optional sample handling system (Open-load or Load-lock)</li>
                <li>Automated and modular process design kits tailored to specific requirements</li>
                <li>Cost-performance customization options (RF system, pumps, valves, etc.)</li>
              </ul>

              <h3>Target Applications</h3>
              <ul className="application-list-styled">
                <li><span className="app-icon">&#x1F4BB;</span> Advanced semiconductor devices</li>
                <li><span className="app-icon">&#x1F4A1;</span> Optoelectronic components</li>
                <li><span className="app-icon">&#x1F6E1;</span> Protective coatings</li>
                <li><span className="app-icon">&#x1F52C;</span> Research & development</li>
                <li><span className="app-icon">&#x1F9EA;</span> Novel materials synthesis</li>
                <li><span className="app-icon">&#x2699;</span> Device optimization</li>
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
                  <td>4", 6", 8", 12" wafers or multi-wafer configurations (optional)</td>
                </tr>
                <tr>
                  <td>RF System</td>
                  <td>13.56 MHz and/or 400 KHz, power range 500-2000 W (optional)</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>20°C to 400°C (higher temperature optional)</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>Roots pump & mechanical pump</td>
                </tr>
                <tr>
                  <td>Gas Distribution</td>
                  <td>Up to 6 gas lines (standard), customizable</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 5% (edge exclusion)</td>
                </tr>
                <tr>
                  <td>Plasma Discharge Gap</td>
                  <td>Variable, optimized per process</td>
                </tr>
                <tr>
                  <td>Footprint</td>
                  <td>Approximately 1.0m x 1.0m</td>
                </tr>
                <tr>
                  <td>Sample Loading</td>
                  <td>Open-Load or Load-Lock (configurable)</td>
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
                <li>Excellent step coverage (gap parameter adjustable)</li>
                <li>High deposition rates</li>
                <li>Superior film adhesion and density</li>
                <li>Precise thickness and stress control</li>
                <li>Low particle contamination</li>
                <li>Low-temperature processing capability</li>
                <li>Process repeatability and multi-layer deposition capability</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Amorphous Silicon (α-Si:H)</li>
                <li>Silicon Dioxide (SiO₂)</li>
                <li>Silicon Nitride (SiNx)</li>
                <li>Silicon Carbide (SiC)</li>
                <li>Silicon Oxynitride (SiON)</li>
                <li>Diamond-like Carbon (DLC, optional)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our PECVD systems are used by researchers publishing in top-tier journals, enabling breakthroughs in thin film encapsulation, 2D materials, and semiconductor device fabrication."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Small',
            tier: 'high',
            title: 'In situ selenization engineered dual Schottky heterojunctions for high-speed broadband photonic communication detector arrays',
            authors: 'S Ke, M Ge, S Zu et al.',
            year: '2025',
            citations: 1,
          },
          {
            journal: 'Applied Physics Letters',
            tier: 'mid',
            title: 'A synaptic transistor with a stacked layer of SiNx and SiO2 deposited from hexamethyldisiloxane/O2',
            authors: 'C Peng, Y Liu, C Yu et al.',
            year: '2025',
            citations: 3,
          },
          {
            journal: 'Thin Solid Films',
            tier: 'mid',
            title: 'Low temperature plasma deposited SiO2/organosilicon stacked film for transparent gate dielectric of InGaZnO thin film transistor',
            authors: 'C Peng, H Qin, Y Liu et al.',
            year: '2024',
            citations: 1,
          },
        ]}
        journalNames={['Small', 'Applied Physics Letters', 'Thin Solid Films', 'Materials Today', 'ACS AMI']}
        onRequestQuote={openContactForm}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related equipment & articles */}
      <section className="related-reading-cards">
        <div className="container">
          <h2>Related Equipment & Articles</h2>
          <div className="related-cards-grid">
            <a href="/products/ald" className="related-card">
              <span className="related-card-icon">&#x1F52C;</span>
              <h3>ALD System Series</h3>
              <p>Atomic layer precision for conformal films with sub-nanometer thickness control.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/products/hdp-cvd" className="related-card">
              <span className="related-card-icon">&#x2699;</span>
              <h3>HDP-CVD System Series</h3>
              <p>Gap-fill and dense dielectric films for advanced semiconductor manufacturing.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/insights/plasma-etching-explained-fundamentals-applications" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Plasma Etching Explained</h3>
              <p>Downstream steps and integration notes for etch/deposition workflows.</p>
              <span className="related-card-link">Read Article &rarr;</span>
            </a>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Request Information</h2>
          <p>Get detailed specs, pricing & customization options.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Sales Team</button>
            <a href="#" className="btn btn-secondary" onClick={(e)=>{e.preventDefault(); setGateOpen(true);}}>
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
        productName="PECVD System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/pecvd-system-datasheet.pdf'; a.download='NineScrolls-PECVD-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal isOpen={gateOpen} onClose={()=>setGateOpen(false)} fileUrl={'/docs/pecvd-system-datasheet.pdf'} fileName={'NineScrolls-PECVD-Datasheet.pdf'} title={'Download PECVD Datasheet'} turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string} />
    </>
  );
} 