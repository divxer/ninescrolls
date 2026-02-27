import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function ALDSystem() {
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

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/ald#product",
    "name": "ALD System Series",
    "description": "Atomic Layer Deposition system offering atomic-level precision with compact uni-body design for thin film growth.",
    "image": ["https://ninescrolls.com/assets/images/products/ald/main.jpg"],
    "sku": "ald",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/ald",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": "NineScrolls LLC", "url": "https://ninescrolls.com" }
    }
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is atomic layer deposition (ALD) and how does it work?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "ALD is a thin-film deposition technique that builds films one atomic layer at a time through sequential, self-limiting surface reactions. Each cycle deposits a precise monolayer (typically 0.5-2 angstroms), enabling exceptional thickness control, conformality (>98% step coverage), and uniformity (<1% for Al2O3). This makes ALD ideal for gate dielectrics, passivation, and conformal coatings on 3D structures."
              }
            },
            {
              "@type": "Question",
              "name": "What materials can the ALD system deposit?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The ALD system supports oxides (Al2O3, HfO2, SiO2, TiO2, Ga2O3, ZnO), nitrides (TiN, TaN, SiNx, AlN, GaN), metals (Pt, Pd, W, Ru), and complex oxides. With the optional remote plasma source (300-1000W), plasma-enhanced ALD (PEALD) enables lower-temperature deposition and access to additional materials."
              }
            },
            {
              "@type": "Question",
              "name": "What temperature range does the ALD system support?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The wafer temperature range is 20°C to 400°C (higher temperatures available as an option). Source temperatures range from 20°C to 150°C standard, with up to 200°C optional for high-vapor-pressure precursors. The system supports 2 to 6 customizable precursor lines."
              }
            }
          ]
        })}</script>
      </Helmet>
      <section className="product-detail-hero">
        <div className="container">
          <Breadcrumbs items={[
            { name: 'Products', path: '/products' },
            { name: 'ALD System Series', path: '/products/ald' }
          ]} />
          <div className="product-header">
            <h1>ALD System Series</h1>
            <p>Advanced Atomic Layer Deposition System for Precision Thin Film Growth</p>
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
                src="/assets/images/products/ald/main.jpg" 
                alt="ALD System" 
                className="main-product-image" 
              />
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The ALD Series offers atomic-level precision in thin film deposition through sequential, self-limiting surface reactions within a compact uni-body design (footprint approx. 0.8m x 1.0m). Engineered for both research and production environments, it delivers exceptional film quality, outstanding high-aspect-ratio (AR) step coverage, and configurable options for performance and cost optimization.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Compact uni-body design (0.8m x 1.0m footprint)</li>
                <li>Box-in-box process chamber for enhanced process stability</li>
                <li>Showerhead gas feed-in system with independently configurable parameters</li>
                <li>Excellent high-aspect-ratio (AR) step coverage</li>
                <li>Multiple gas inlets and vertical precursor flow configuration</li>
                <li>Optional remote plasma (RF) capability (300-1000W)</li>
                <li>Precise electrode temperature and chamber liner control for diverse processes</li>
                <li>Flexible cost-performance customization (RF system, vacuum pumps, valves, etc.)</li>
                <li>Optional sample handling: Open-load or Load-lock systems</li>
                <li>User-friendly interface and automated process control</li>
              </ul>

              <h3>Target Applications</h3>
              <ul className="application-list-styled">
                <li><span className="app-icon">&#x1F4BB;</span> Advanced semiconductor devices</li>
                <li><span className="app-icon">&#x1F52C;</span> Nanotechnology research</li>
                <li><span className="app-icon">&#x1F50B;</span> Energy storage materials</li>
                <li><span className="app-icon">&#x1F4A1;</span> Optical applications</li>
                <li><span className="app-icon">&#x1F6E1;</span> Protective coatings</li>
                <li><span className="app-icon">&#x1F9EA;</span> Novel materials development</li>
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
                  <td>4", 6", 8", 12", or supersize configurations (optional)</td>
                </tr>
                <tr>
                  <td>Wafer Temperature Range</td>
                  <td>20°C to 400°C (higher temperature optional)</td>
                </tr>
                <tr>
                  <td>Source Temperature</td>
                  <td>Standard 20°C-150°C, optional up to 200°C</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Less than 5x10^-5 Torr (TMP and mechanical pump)</td>
                </tr>
                <tr>
                  <td>Growth Rate</td>
                  <td>Typical 0.5-2 Å per cycle</td>
                </tr>
                <tr>
                  <td>Film Uniformity</td>
                  <td>Less than 1% (Al₂O₃, edge exclusion)</td>
                </tr>
                <tr>
                  <td>Number of Precursor Lines</td>
                  <td>2-6 lines (customizable)</td>
                </tr>
                <tr>
                  <td>Remote Plasma</td>
                  <td>Optional RF capability (300-1000W)</td>
                </tr>
                <tr>
                  <td>Footprint</td>
                  <td>Approximately 0.8m x 1.0m</td>
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
                <li>Sub-nanometer thickness control</li>
                <li>Outstanding high-AR step coverage ({'>'}98%)</li>
                <li>Exceptional film conformality</li>
                <li>Precise control of film composition</li>
                <li>Low impurity and defect content</li>
                <li>Multi-layer film deposition capability</li>
                <li>Excellent process repeatability</li>
                <li>In-situ monitoring capability (optional)</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Systems</h3>
              <ul>
                <li>Oxides: Al₂O₃, HfO₂, SiO₂, TiO₂, Ga₂O₃, ZnO, etc.</li>
                <li>Nitrides: TiN, TaN, SiNx, AlN, GaN, etc.</li>
                <li>Metals: Pt, Pd, W, Ru, etc.</li>
                <li>Complex oxides and 2D materials (optional)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="NineScrolls systems are used by researchers publishing in top-tier journals, enabling breakthroughs in thin film deposition, nanofabrication, and advanced materials."
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
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Graphene-armored aluminum foil with enhanced anticorrosion performance as current collectors for lithium-ion battery',
            authors: 'M Wang, M Tang, S Chen et al.',
            year: '2017',
            citations: 149,
          },
        ]}
        journalNames={['Nature Communications', 'Science', 'Adv. Materials', 'Adv. Functional Materials', 'Energy & Env. Science']}
        onRequestQuote={() => openContactForm(true)}
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
              <p>Plasma-enhanced deposition alternative for versatile thin film growth applications.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/products/hdp-cvd" className="related-card">
              <span className="related-card-icon">&#x1F3D7;</span>
              <h3>HDP-CVD System Series</h3>
              <p>High-density plasma CVD for superior gap-fill and dense dielectric films.</p>
              <span className="related-card-link">View Product &rarr;</span>
            </a>
            <a href="/insights/plasma-etching" className="related-card">
              <span className="related-card-icon">&#x1F4D6;</span>
              <h3>Plasma Etching Fundamentals</h3>
              <p>Terminology and concepts useful for ALD/CVD integration workflows.</p>
              <span className="related-card-link">Read Article &rarr;</span>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: What is atomic layer deposition (ALD) and how does it work?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: ALD is a thin-film deposition technique that builds films one atomic layer at a time through sequential, self-limiting surface reactions. Each cycle deposits a precise monolayer (typically 0.5-2 angstroms), enabling exceptional thickness control, conformality ({'>'}98% step coverage), and uniformity ({'<'}1% for Al2O3). This makes ALD ideal for gate dielectrics, passivation, and conformal coatings on 3D structures.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: What materials can the ALD system deposit?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: The ALD system supports oxides (Al2O3, HfO2, SiO2, TiO2, Ga2O3, ZnO), nitrides (TiN, TaN, SiNx, AlN, GaN), metals (Pt, Pd, W, Ru), and complex oxides. With the optional remote plasma source (300-1000W), plasma-enhanced ALD (PEALD) enables lower-temperature deposition and access to additional materials.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: What temperature range does the ALD system support?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: The wafer temperature range is 20°C to 400°C (higher temperatures available as an option). Source temperatures range from 20°C to 150°C standard, with up to 200°C optional for high-vapor-pressure precursors. The system supports 2 to 6 customizable precursor lines.
              </p>
            </div>
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
        productName="ALD System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/ald-system-datasheet.pdf'; a.download='NineScrolls-ALD-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal isOpen={gateOpen} onClose={()=>setGateOpen(false)} fileUrl={'/docs/ald-system-datasheet.pdf'} fileName={'NineScrolls-ALD-Datasheet.pdf'} title={'Download ALD Datasheet'} turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string} />
    </>
  );
} 