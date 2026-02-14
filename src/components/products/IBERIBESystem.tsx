import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
// import { ContactFormModal } from '../common/ContactFormModal';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';

export function IBERIBESystem() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
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

  const openContactForm = (quote = false) => {
    setIsQuoteIntent(quote);
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
            <h1>IBE/RIBE System Series</h1>
            <p>Advanced Ion Beam Etching System for High-Precision Material Processing</p>
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
              <button className="btn btn-primary" onClick={() => openContactForm(true)}>Request a Quote</button>
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
                src="/assets/images/products/ibe-ribe/main.jpg" 
                alt="IBE/RIBE System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The IBE/RIBE Series combines Ion Beam Etching (IBE) and Reactive Ion Beam Etching (RIBE) capabilities within a compact, uni-body design (footprint approx. 1.0m x 0.8m). Engineered for precision material processing, the system provides exceptional control over ion beam parameters, flexible configuration, and ease of maintenance, making it highly adaptable for diverse research and production applications.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design with minimal footprint (1.0m x 0.8m)</li>
                <li>Easy-to-maintain sample holder and ion source configuration</li>
                <li>Quick-swap ion source system (Kaufman/RF ion sources), configurable according to user requirements</li>
                <li>Dual-mode operation: IBE and RIBE modes available</li>
                <li>Variable incident angle (0-90°) with programmable rotation (1-10 rpm)</li>
                <li>Flexible wafer stage cooling (standard water cooling from 5°C to 20°C; optional backside He cooling)</li>
                <li>Configurable gas injection system (standard 1-3 lines, customizable)</li>
                <li>Optional RF-biased substrate stage for enhanced in-situ cleaning and control</li>
                <li>Automated sample handling options (Open-Load or Load-Lock)</li>
                <li>Real-time process monitoring and endpoint detection</li>
                <li>Cost-performance oriented customization (ion source, pumps, valves, etc.)</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list-styled">
                <li><span className="app-icon">&#x1F9F2;</span> Magnetic materials processing</li>
                <li><span className="app-icon">&#x1F4A1;</span> Optical device fabrication</li>
                <li><span className="app-icon">&#x2699;</span> MEMS/NEMS device development</li>
                <li><span className="app-icon">&#x1F4CB;</span> Multilayer film etching</li>
                <li><span className="app-icon">&#x1F6E0;</span> Surface planarization</li>
                <li><span className="app-icon">&#x1F3AF;</span> Precise pattern transfer</li>
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
                  <td>Ion Source Options</td>
                  <td>
                    <ul>
                      <li>Kaufman-type ion source (up to 6" wafers)</li>
                      <li>RF ion source (up to 12" wafers)</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>Wafer Size</td>
                  <td>Supports up to 12-inch wafers or multi-wafer configurations</td>
                </tr>
                <tr>
                  <td>Wafer Stage Motion</td>
                  <td>Tilt angle adjustable from 0° to 90°, rotation speed programmable from 1-10 rpm</td>
                </tr>
                <tr>
                  <td>Substrate Cooling</td>
                  <td>Water cooling (5°C-20°C standard); optional backside helium cooling</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Less than 7x10^-7 Torr (standard); higher vacuum available upon request</td>
                </tr>
                <tr>
                  <td>Gas Injection System</td>
                  <td>Standard 1-3 lines, additional lines customizable</td>
                </tr>
                <tr>
                  <td>Film Non-Uniformity</td>
                  <td>Less than 5% (edge exclusion)</td>
                </tr>
                <tr>
                  <td>Footprint</td>
                  <td>Approximately 1.0m x 0.8m</td>
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
                <li>High-precision ion beam angle and current control</li>
                <li>Excellent uniformity of etched surfaces</li>
                <li>Low surface damage and contamination levels</li>
                <li>Wide and flexible process window</li>
                <li>Excellent process reproducibility</li>
                <li>Multi-layer and advanced materials processing</li>
                <li>Real-time process monitoring and automated control</li>
                <li>Optional in-situ RF-biased substrate cleaning</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Magnetic Materials: NiFe, CoFe, etc.</li>
                <li>Optical Materials: Glass, Quartz</li>
                <li>Semiconductors: Si, GaAs, InP</li>
                <li>Metals: Au, Pt, Cu</li>
                <li>Dielectrics: SiO₂, Si₃N₄</li>
                <li>Advanced Materials: 2D and Quantum materials</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Chosen by Top Research Institutions"
        subtitle="Our etching and ion beam systems support groundbreaking research published in 60+ peer-reviewed publications across leading journals including Science, Nature Communications, and Advanced Materials."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Hierarchical graphene foam for efficient omnidirectional solar-thermal energy conversion',
            authors: 'H Ren, M Tang, B Guan et al.',
            year: '2017',
            citations: 945,
          },
          {
            journal: 'Nature Communications',
            tier: 'top',
            title: 'Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions',
            authors: 'X Zhang, B Liu, L Gao et al.',
            year: '2021',
            citations: 218,
          },
          {
            journal: 'Science',
            tier: 'top',
            title: 'Multifunctional tendon-mimetic hydrogels',
            authors: 'M Sun, H Li, Y Hou et al.',
            year: '2023',
            citations: 135,
          },
        ]}
        journalNames={['Science', 'Nature Communications', 'Adv. Materials', 'Adv. Functional Materials', 'Nano Letters']}
        onRequestQuote={() => openContactForm(true)}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related equipment & articles */}
      <section className="related-reading-cards">
        <div className="container">
          <h2>Related Equipment & Articles</h2>
          <div className="related-cards-grid">
            <a href="/products/rie-etcher" className="related-card">
              <span className="related-card-icon">&#x26A1;</span>
              <h3>RIE Etcher Series</h3>
              <p>Plasma etching platform with different mechanism for reactive ion processing.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/products/icp-etcher" className="related-card">
              <span className="related-card-icon">&#x2699;</span>
              <h3>ICP Etcher Series</h3>
              <p>High-density plasma etching alternative for advanced semiconductor processing.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/insights/plasma-etching" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Plasma Etching Fundamentals</h3>
              <p>Process basics and terminology for understanding etch technologies.</p>
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
            <button className="btn btn-primary" onClick={() => openContactForm(true)}>Contact Sales Team</button>
            <a href="#" className="btn btn-secondary" onClick={(e)=>{e.preventDefault(); setGateOpen(true);}}>
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={() => openContactForm(true)}>
          Contact Sales Team
        </button>
      </div>

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="IBE/RIBE System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/ibe-ribe-system-datasheet.pdf'; a.download='NineScrolls-IBE-RIBE-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal isOpen={gateOpen} onClose={()=>setGateOpen(false)} fileUrl={'/docs/ibe-ribe-system-datasheet.pdf'} fileName={'NineScrolls-IBE-RIBE-Datasheet.pdf'} title={'Download IBE/RIBE Datasheet'} turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string} />
    </>
  );
} 