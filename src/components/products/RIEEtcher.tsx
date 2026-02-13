import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';

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

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>RIE Etcher Series</h1>
            <p>High-precision Reactive Ion Etching System with Compact Design</p>
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
              <ul className="application-list-styled">
                <li><span className="app-icon">&#x1F4BB;</span> Silicon Processing</li>
                <li><span className="app-icon">&#x1F4A0;</span> Dielectric Etching</li>
                <li><span className="app-icon">&#x2699;</span> Metal Etching</li>
                <li><span className="app-icon">&#x1F9EA;</span> Polymer Processing</li>
                <li><span className="app-icon">&#x1F3D7;</span> MEMS Fabrication</li>
                <li><span className="app-icon">&#x1F52C;</span> Research & Development</li>
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
                <tr>
                  <td>Footprint</td>
                  <td>1.0m x 1.0m</td>
                </tr>
                <tr>
                  <td>Pump System</td>
                  <td>TMP & mechanical pump</td>
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

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our RIE etching systems are cited in 60+ peer-reviewed publications across top-tier journals including Science, Nature Communications, and Advanced Materials, powering breakthroughs in nanofabrication, 2D materials, and flexible electronics."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
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
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Hidden vacancy benefit in monolayer 2D semiconductors',
            authors: 'X Zhang, Q Liao, Z Kang et al.',
            year: '2021',
            citations: 115,
          },
          {
            journal: 'Advanced Functional Materials',
            tier: 'high',
            title: 'Breathable and skin-conformal electronics with hybrid integration of microfabricated multifunctional sensors',
            authors: 'H Li, Z Wang, M Sun et al.',
            year: '2022',
            citations: 68,
          },
          {
            journal: 'Nano Research',
            tier: 'high',
            title: 'Record-high saturation current in end-bond contacted monolayer MoS2 transistors',
            authors: 'J Xiao, Z Kang, B Liu et al.',
            year: '2022',
            citations: 48,
          },
          {
            journal: 'InfoMat',
            tier: 'high',
            title: 'Synergistic-engineered van der Waals photodiodes with high efficiency',
            authors: 'B Liu, X Zhang, J Du et al.',
            year: '2022',
            citations: 38,
          },
        ]}
        journalNames={['Nature Communications', 'Science', 'Adv. Materials', 'Adv. Functional Materials', 'Nano Research', 'Nano Letters']}
        onRequestQuote={openContactForm}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related equipment & articles */}
      <section className="related-reading-cards">
        <div className="container">
          <h2>Related Equipment & Articles</h2>
          <div className="related-cards-grid">
            <a href="/products/icp-etcher" className="related-card">
              <span className="related-card-icon">&#x2699;</span>
              <h3>ICP Etcher Series</h3>
              <p>High-density plasma etching alternative for advanced applications.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/insights/plasma-etching" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Plasma Etching Fundamentals</h3>
              <p>Key concepts, terms, and control knobs for plasma etch processes.</p>
              <span className="related-card-link">Read Article &rarr;</span>
            </a>
            <a href="/insights/plasma-etching-explained-fundamentals-applications" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Plasma Etching Explained</h3>
              <p>Practical guidance and applications for plasma etching technology.</p>
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
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
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