import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
// import { ContactFormModal } from '../common/ContactFormModal';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';

export function SputterSystem() {
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
            <h1>Sputter System Series</h1>
            <p>Advanced Physical Vapor Deposition System for High-Performance Thin Film Growth</p>
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
                src="/assets/images/products/sputter/main.jpg" 
                alt="Sputter System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Sputter Series provides advanced thin-film deposition through DC, RF, and magnetron sputtering within a compact uni-body design (footprint approximately 1.0m x 1.7m). With an innovative, customer-oriented magnetron target configuration, precise substrate temperature control, and flexible modular options, the system is tailored for versatile research and production applications, ensuring excellent deposition uniformity and process reliability.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design with optimized footprint (approx. 1.0m x 1.7m)</li>
                <li>Creatively designed magnetron target structure, customizable per customer requirements</li>
                <li>Multiple magnetron sputtering sources (2 to 6 sources available)</li>
                <li>Flexible substrate temperature management (water-cooled, 400°C, 800°C, up to 1200°C optional)</li>
                <li>RF-biased substrate capability for improved in-situ cleaning and film quality</li>
                <li>Advanced RF/DC power delivery system (customizable power range)</li>
                <li>Configurable sample handling options (Open-load or Load-lock system)</li>
                <li>Automated process control with real-time deposition monitoring</li>
                <li>Flexible selection of vacuum pumps, valves, and gas systems based on cost-performance orientation</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list-styled">
                <li><span className="app-icon">&#x2699;</span> Metallic thin films</li>
                <li><span className="app-icon">&#x1F9F2;</span> Magnetic materials and coatings</li>
                <li><span className="app-icon">&#x1F4BB;</span> Compound semiconductors</li>
                <li><span className="app-icon">&#x1F9F2;</span> Magnetic films and devices</li>
                <li><span className="app-icon">&#x1F4A1;</span> Optical and protective coatings</li>
                <li><span className="app-icon">&#x26A1;</span> Compound semiconductor devices</li>
                <li><span className="app-icon">&#x1F52C;</span> Advanced materials research</li>
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
                  <td>4", 6", 8", 12", or multi-wafer/supersize substrates (optional)</td>
                </tr>
                <tr>
                  <td>Magnetron Sputtering Sources</td>
                  <td>2 to 6 independently configurable targets</td>
                </tr>
                <tr>
                  <td>Substrate Temperature</td>
                  <td>Water-cooled up to 1200°C (optional configurations available)</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Less than 5x10^-7 Torr (standard), higher vacuum options available upon request</td>
                </tr>
                <tr>
                  <td>Process Gas Lines</td>
                  <td>Standard 2 lines, additional lines customizable</td>
                </tr>
                <tr>
                  <td>Power System</td>
                  <td>DC/RF sputtering modes (customizable power range, RF: 300-1000W, DC optional)</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 1% (typical), less than 5% edge exclusion guaranteed</td>
                </tr>
                <tr>
                  <td>Footprint</td>
                  <td>Approximately 1.0m x 1.7m</td>
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
                <li>High deposition rates</li>
                <li>Excellent film uniformity and thickness control</li>
                <li>Outstanding high-aspect-ratio step coverage</li>
                <li>Precise temperature and power control</li>
                <li>Low particle contamination and impurity levels</li>
                <li>Multi-layer and co-sputtering capabilities</li>
                <li>Real-time deposition monitoring and repeatability</li>
                <li>In-situ RF substrate cleaning capability (optional)</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Pure Metals (Pt, Pd, W, Ru, etc.)</li>
                <li>Oxides (SiO₂, Al₂O₃, TiO₂, Ga₂O₃, ZnO, etc.)</li>
                <li>Nitrides (TiN, TaN, AlN, SiNx, GaN, etc.)</li>
                <li>Magnetic Materials (Fe-based, Co-based, Ni-based alloys, etc.)</li>
                <li>Metallic films and compound semiconductors</li>
                <li>Magnetic materials and complex thin-film structures</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our sputtering systems are used by researchers publishing in top-tier journals, enabling breakthroughs in catalysis, thin film engineering, and advanced materials."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'ACS Applied Materials & Interfaces',
            tier: 'high',
            title: 'Tuning the catalytic selectivity toward C2+ oxygenate products by manipulating Cu oxidation states in CO electroreduction',
            authors: 'Y Yan, B Lei, X Wang et al.',
            year: '2024',
            citations: 4,
          },
          {
            journal: 'Applied Catalysis B',
            tier: 'high',
            title: 'Mixed CO adsorption modes induced by lattice strain to facilitate C-C coupling during electrochemical CO reduction',
            authors: 'Y Li, X Huang, B Zhang et al.',
            year: '2025',
            citations: 4,
          },
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Graphene-armored aluminum foil with enhanced anticorrosion performance as current collectors for lithium-ion battery',
            authors: 'M Wang, M Tang, S Chen et al.',
            year: '2017',
            citations: 149,
          },
        ]}
        journalNames={['ACS AMI', 'Applied Catalysis B', 'Adv. Materials', 'Energy & Env. Science', 'Adv. Functional Materials']}
        onRequestQuote={openContactForm}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related equipment & articles */}
      <section className="related-reading-cards">
        <div className="container">
          <h2>Related Equipment & Articles</h2>
          <div className="related-cards-grid">
            <a href="/products/pecvd" className="related-card">
              <span className="related-card-icon">&#x2699;</span>
              <h3>PECVD System Series</h3>
              <p>CVD alternative for dielectric films and versatile thin film deposition.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/products/ald" className="related-card">
              <span className="related-card-icon">&#x1F52C;</span>
              <h3>ALD System Series</h3>
              <p>Conformal thin films for complex topography with atomic-level precision.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/insights/plasma-etching-explained-fundamentals-applications" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Plasma Etching Explained</h3>
              <p>Downstream pattern transfer considerations for integrated processes.</p>
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
        productName="Sputter System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/sputter-system-datasheet.pdf'; a.download='NineScrolls-Sputter-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal isOpen={gateOpen} onClose={()=>setGateOpen(false)} fileUrl={'/docs/sputter-system-datasheet.pdf'} fileName={'NineScrolls-Sputter-Datasheet.pdf'} title={'Download Sputter System Datasheet'} turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string} />
    </>
  );
} 