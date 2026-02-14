import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function ICPEtcher() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  // using QuoteModal; no local form state is necessary for this component

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
          <Breadcrumbs items={[
            { name: 'Products', path: '/products' },
            { name: 'ICP Etcher Series', path: '/products/icp-etcher' }
          ]} />
          <div className="product-header">
            <h1>ICP Etcher Series</h1>
            <p>Advanced Inductively Coupled Plasma Etching System with Uni-body Design</p>
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
                <picture>
                  <source 
                    media="(max-width: 768px)"
                    srcSet="/assets/images/products/icp-etcher/icp-system-schematic-sm.webp" 
                    type="image/webp" 
                  />
                  <source 
                    media="(max-width: 768px)"
                    srcSet="/assets/images/products/icp-etcher/icp-system-schematic-sm.png" 
                    type="image/png" 
                  />
                  <source 
                    media="(max-width: 1200px)"
                    srcSet="/assets/images/products/icp-etcher/icp-system-schematic-md.webp" 
                    type="image/webp" 
                  />
                  <source 
                    media="(max-width: 1200px)"
                    srcSet="/assets/images/products/icp-etcher/icp-system-schematic-md.png" 
                    type="image/png" 
                  />
                  <source 
                    srcSet="/assets/images/products/icp-etcher/icp-system-schematic.webp" 
                    type="image/webp" 
                  />
                  <source 
                    srcSet="/assets/images/products/icp-etcher/icp-system-schematic.png" 
                    type="image/png" 
                  />
                  <img 
                    src="/assets/images/products/icp-etcher/icp-system-schematic.webp" 
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
                      // Fallback to PNG if WebP fails
                      target.src = '/assets/images/products/icp-etcher/icp-system-schematic.png';
                    }}
                  />
                </picture>
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
              <ul className="application-list-styled">
                <li><span className="app-icon">&#x1F4BB;</span> Advanced semiconductor research</li>
                <li><span className="app-icon">&#x1F3ED;</span> Production environment processing</li>
                <li><span className="app-icon">&#x1F9EA;</span> Materials development</li>
                <li><span className="app-icon">&#x2699;</span> Device fabrication</li>
                <li><span className="app-icon">&#x1F50D;</span> Process optimization</li>
                <li><span className="app-icon">&#x1F3D7;</span> Specialty manufacturing</li>
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
                <tr>
                  <td>Footprint</td>
                  <td>1.0m x 1.5m</td>
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
              <h3>System Performance</h3>
              <ul>
                <li>Chamber liner and electrode temperature control</li>
                <li>Tunable plasma discharge gap</li>
                <li>Cost or performance orientation options</li>
                <li>Customizable RF configurations</li>
                <li>Low-power / pulsed plasma options for <strong>low‑damage etch</strong></li>
                <li>ALE‑ready control modes and multi‑frequency bias</li>
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

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our ICP etching systems are cited in 60+ peer-reviewed publications across top-tier journals including Nature Communications, Advanced Materials, and Light: Science & Applications, powering breakthroughs in photonics, micro-optics, and nanofabrication."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'PhotoniX',
            tier: 'high',
            title: 'Biomimetic sapphire windows enabled by inside-out femtosecond laser deep-scribing',
            authors: 'XQ Liu, YL Zhang, QK Li et al.',
            year: '2022',
            citations: 124,
          },
          {
            journal: 'Advanced Functional Materials',
            tier: 'high',
            title: 'Rapid engraving of artificial compound eyes from curved sapphire substrate',
            authors: 'XQ Liu, SN Yang, L Yu et al.',
            year: '2019',
            citations: 110,
          },
          {
            journal: 'IEEE Photonics Technology Letters',
            tier: 'mid',
            title: 'Sapphire concave microlens arrays for high-fluence pulsed laser homogenization',
            authors: 'XQ Liu, L Yu, QD Chen et al.',
            year: '2019',
            citations: 32,
          },
          {
            journal: 'Laser & Photonics Reviews',
            tier: 'high',
            title: 'Neural-optic co-designed polarization-multiplexed metalens for compact computational spectral imaging',
            authors: 'Q Zhang, P Lin, C Wang et al.',
            year: '2024',
            citations: 24,
          },
          {
            journal: 'Optics Letters',
            tier: 'mid',
            title: 'Ultra-smooth micro-optical components of various geometries',
            authors: 'XQ Liu, SN Yang, YL Sun et al.',
            year: '2019',
            citations: 23,
          },
          {
            journal: 'Applied Optics',
            tier: 'mid',
            title: 'Silicon three-dimensional structures fabricated by femtosecond laser modification with dry etching',
            authors: 'XQ Liu, L Yu, ZC Ma et al.',
            year: '2017',
            citations: 22,
          },
        ]}
        journalNames={['Adv. Functional Materials', 'PhotoniX', 'Laser & Photonics Reviews', 'Light: Sci. & Applications', 'Optics Letters', 'Applied Optics']}
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
              <p>Compact RIE platform for research labs with high-precision etching.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/insights/plasma-cleaning-precision-surface-preparation" className="related-card">
              <span className="related-card-icon">&#x2728;</span>
              <h3>Plasma Cleaning for Surface Preparation</h3>
              <p>Improves adhesion and yield through precision surface preparation.</p>
              <span className="related-card-link">Read Article &rarr;</span>
            </a>
            <a href="/insights/future-of-plasma-etching-microelectronics" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Future of Plasma Etching</h3>
              <p>Trends in ALE, pulsed plasma, and EUV resist removal technologies.</p>
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
            <a href="#" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); setGateOpen(true); }}>
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
        productName="ICP Etcher Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{
          const a=document.createElement('a'); a.href='/docs/icp-etcher-datasheet.pdf'; a.download='NineScrolls-ICP-Etcher-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/docs/icp-etcher-datasheet.pdf'}
        fileName={'NineScrolls-ICP-Etcher-Datasheet.pdf'}
        title={'Download ICP Etcher Datasheet'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
} 