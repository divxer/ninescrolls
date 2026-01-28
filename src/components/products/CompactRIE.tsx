import { useState } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import '../../styles/ProcessResults.css';

export function CompactRIE() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'main2'>('main');

  useScrollToTop();

  const openContactForm = () => {
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
    "@id": "https://ninescrolls.com/products/compact-rie#product",
    "name": "Compact RIE Etcher (SV-RIE)",
    "description": "Compact reactive ion etching system with ultra-small footprint (630mm×600mm), ideal for research labs, pilot-scale processes, and failure analysis applications.",
    "image": ["https://ninescrolls.com/assets/images/products/compact-rie/main.jpg"],
    "sku": "compact-rie",
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "seller": {
        "@type": "Organization",
        "name": "Nine Scrolls Technology",
        "url": "https://ninescrolls.com"
      }
    }
  };

  return (
    <>
      <SEO
        title="Compact RIE Etcher (SV-RIE) - Ultra-Compact Reactive Ion Etching | NineScrolls"
        description="Compact RIE etching system with 630mm×600mm footprint. Ideal for research labs, pilot-scale processes, and failure analysis. Touchscreen control, modular design."
        keywords="compact RIE, SV-RIE, small footprint RIE, compact reactive ion etching, research RIE system, failure analysis equipment"
        url="/products/compact-rie"
        image="/assets/images/products/compact-rie/main.jpg"
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Hero Section - Strong Information Hero with Positioning */}
      <section className="product-detail-hero product-hero-enhanced">
        <div className="container">
          <div className="product-header-enhanced">
            <h1>Compact RIE Etcher (SV-RIE)</h1>
            <p className="product-subtitle">Ultra-Compact Reactive Ion Etching System</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Ultra-small footprint RIE system for research labs. Full reactive ion etching capability in a 630mm × 600mm space.
              </p>
              <p style={{ marginTop: '1rem', fontSize: '0.95rem', color: '#666', fontStyle: 'italic' }}>
                US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
              </p>
            </div>
            <div className="hero-bullets">
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">📐</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">630mm × 600mm Footprint</span>
                  <span className="bullet-text-sub">vs. standard RIE: 50% smaller footprint</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">300W / 500W / 1000W RF Power</span>
                  <span className="bullet-text-sub">research-grade etching performance</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🖥️</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Touchscreen Control</span>
                  <span className="bullet-text-sub">fully automated operation system</span>
                </div>
              </div>
            </div>
            
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
            
            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={openContactForm}>
                Request Information
              </button>
              <a 
                href="#" 
                className="btn btn-secondary btn-large"
                onClick={(e) => {
                  e.preventDefault();
                  setGateOpen(true);
                }}
              >
                Download Datasheet
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* System Overview - Left Image, Right Text Layout */}
      <section className="product-overview product-overview-narrative">
        <div className="container">
          <div className="product-hero-layout">
            <div className="product-hero-image product-image-single">
              <div className="product-image-main-wrapper">
                <div className="product-image-main">
                  {selectedImage === 'main' ? (
                    <OptimizedImage
                      src="/assets/images/products/compact-rie/main.jpg"
                      alt="Compact RIE Etcher (SV-RIE) - ultra-compact reactive ion etching system"
                      width={800}
                      height={600}
                      className="main-product-image"
                    />
                  ) : (
                    <OptimizedImage
                      src="/assets/images/products/compact-rie/main-2.jpg"
                      alt="Compact RIE Etcher (SV-RIE) - additional view"
                      width={800}
                      height={600}
                      className="main-product-image"
                    />
                  )}
                </div>
              </div>
              <div className="product-image-thumbnails-wrapper">
                <div className="product-image-thumbnails">
                  <button 
                    className={`thumbnail-btn ${selectedImage === 'main' ? 'active' : ''}`}
                    onClick={() => setSelectedImage('main')}
                    type="button"
                  >
                    <OptimizedImage
                      src="/assets/images/products/compact-rie/main.jpg"
                      alt="Main View"
                      width={150}
                      height={112}
                      className="thumbnail-image"
                    />
                  </button>
                  <button 
                    className={`thumbnail-btn ${selectedImage === 'main2' ? 'active' : ''}`}
                    onClick={() => setSelectedImage('main2')}
                    type="button"
                  >
                    <OptimizedImage
                      src="/assets/images/products/compact-rie/main-2.jpg"
                      alt="Additional View"
                      width={150}
                      height={112}
                      className="thumbnail-image"
                    />
                  </button>
                </div>
              </div>
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="narrative-text">
                The Compact RIE Etcher (SV-RIE) is a compact reactive ion etching system designed for research laboratories, 
                pilot-scale processes, and failure analysis applications.
              </p>
              <p className="narrative-text">
                With an ultra-small footprint of 630mm × 600mm, this one-piece system offers excellent space efficiency 
                while maintaining high performance and reliability—ideal for labs where space is at a premium.
              </p>
              
              <div className="comparison-block">
                <h3>Compared to:</h3>
                <div className="comparison-items">
                  <div className="comparison-item">
                    <div className="comparison-label">Standard RIE systems</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">50% smaller footprint, same performance</div>
                  </div>
                  <div className="comparison-item">
                    <div className="comparison-label">Desktop plasma cleaners</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">True RIE capability, anisotropic etching</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features - Primary and Secondary */}
      <section className="product-features-section">
        <div className="container">
          <h2 className="section-title">Key Features</h2>
          
          {/* Primary Features */}
          <div className="features-primary">
            <h3 className="features-subtitle">Core Capabilities</h3>
            <div className="features-grid features-grid-primary">
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">📐</div>
                <h3>Ultra-Compact Footprint</h3>
                <p className="feature-highlight">630mm × 600mm—50% smaller than standard RIE systems</p>
                <p>One-piece design optimizes valuable lab space while maintaining full RIE functionality. Ideal for research environments where space efficiency is critical.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">⚡</div>
                <h3>Research-Grade RF Power</h3>
                <p className="feature-highlight">300W / 500W / 1000W customizable RF power</p>
                <p>Standard 13.56 MHz RF power source with adjustable output. Stable plasma generation suitable for precise anisotropic etching of silicon, dielectrics, and compound semiconductors.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">🖥️</div>
                <h3>Touchscreen Automation</h3>
                <p className="feature-highlight">Fully automated operation with simple interface</p>
                <p>Touchscreen control system streamlines workflows. Automatic and manual operation modes with reproducible process parameters for research documentation.</p>
              </div>
            </div>
          </div>

          {/* Secondary Features */}
          <div className="features-secondary">
            <h3 className="features-subtitle">Additional Features</h3>
            <div className="features-grid features-grid-secondary">
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">🔄</div>
                <h3>Modular Design</h3>
                <p>Easy maintenance and convenient transport. Removable contamination-resistant liner option available.</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">💨</div>
                <h3>Multi-Gas Capability</h3>
                <p>Up to 5 process gas lines simultaneously. Flow control range: 0 ~ 1000 sccm (selectable based on application).</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">📦</div>
                <h3>Flexible Wafer Support</h3>
                <p>4", 6", 8", 12" wafers (customizable for smaller sizes). Supports various substrate sizes for research flexibility.</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">🔧</div>
                <h3>Optional Turbo Pump</h3>
                <p>Mechanical pump standard / optional turbo pump for enhanced vacuum performance and process control.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Applications - With Real Use Cases */}
      <section className="product-applications-section">
        <div className="container">
          <h2 className="section-title">Typical Applications</h2>
          <p className="section-intro">
            <strong>Commonly installed in:</strong> Research laboratories, failure analysis facilities, and pilot-scale processing environments requiring compact RIE capabilities.
          </p>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Organic Material Etching</h3>
              <p className="application-use-case">Used for PR removal, PMMA etching, and polymer descumming</p>
              <p>Photoresist (PR), PMMA, HDMS, and organic polymer etching with precise control. Essential for lithography processes and polymer device fabrication.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Inorganic Material Rapid Etching</h3>
              <p className="application-use-case">Fast etching of silicon, SiO₂, SiNx, and compound semiconductors</p>
              <p>High-rate etching of inorganic materials with excellent selectivity. Typical applications: MEMS fabrication, optoelectronic devices, and compound semiconductor processing.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔍</div>
              <h3>Failure Analysis (FA)</h3>
              <p className="application-use-case">Chip decapsulation and package opening for analysis</p>
              <p>Precise package decapsulation etching for failure analysis workflows. Commonly used in semiconductor testing and quality control laboratories.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🎯</div>
              <h3>Passivation Layer Removal</h3>
              <p className="application-use-case">Selective removal of passivation layers for device access</p>
              <p>Controlled etching of passivation layers to expose underlying device structures. Critical for device characterization and reverse engineering applications.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📊</div>
              <h3>Research & Development</h3>
              <p className="application-use-case">Process development and material characterization</p>
              <p>Ideal for R&D environments requiring flexible etching capabilities. Supports process development for new materials and device structures.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications - Full Width Table */}
      <section className="product-specs-section">
        <div className="container">
          <h2 className="section-title">System Specifications</h2>
          <div className="specs-table-wrapper">
            <table className="specs-table">
              <tbody>
                <tr>
                  <td className="spec-label">Wafer Size</td>
                  <td className="spec-value">4", 6", 8", 12" (customizable for smaller sizes)</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Power</td>
                  <td className="spec-value">300W / 500W / 1000W (customizable)</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Frequency</td>
                  <td className="spec-value">13.56 MHz</td>
                </tr>
                <tr>
                  <td className="spec-label">Process Gases</td>
                  <td className="spec-value">Up to 5 gas lines simultaneously</td>
                </tr>
                <tr>
                  <td className="spec-label">Flow Control Range</td>
                  <td className="spec-value">0 ~ 1000 sccm (selectable based on application)</td>
                </tr>
                <tr>
                  <td className="spec-label">Pump System</td>
                  <td className="spec-value">Mechanical pump standard / optional turbo pump</td>
                </tr>
                <tr>
                  <td className="spec-label">Footprint</td>
                  <td className="spec-value">630mm × 600mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Operation</td>
                  <td className="spec-value">Touchscreen control, fully automated system</td>
                </tr>
                <tr>
                  <td className="spec-label">Optional Features</td>
                  <td className="spec-value">Removable contamination-resistant liner, turbo pump option</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Compatible Materials - Full Width */}
      <section className="product-materials-section">
        <div className="container">
          <h2 className="section-title">Compatible Materials</h2>
          <div className="materials-list">
            <div className="material-tag">Silicon (Si)</div>
            <div className="material-tag">Silicon Dioxide (SiO₂)</div>
            <div className="material-tag">Silicon Nitride (SiNx)</div>
            <div className="material-tag">Silicon Carbide (SiC)</div>
            <div className="material-tag">Photoresist (PR)</div>
            <div className="material-tag">PMMA</div>
            <div className="material-tag">HDMS</div>
            <div className="material-tag">Organic Polymers</div>
            <div className="material-tag">Compound Semiconductors</div>
          </div>
        </div>
      </section>

      {/* Available Models - Full Width */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">Available Models</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>SHL100SV-RIE</h3>
              <p>Base model with 300W RF power, ideal for standard research applications.</p>
            </div>
            <div className="function-card">
              <h3>SHL150SV-RIE</h3>
              <p>Mid-range model with 500W RF power, suitable for enhanced etching performance.</p>
            </div>
            <div className="function-card">
              <h3>SHL200SV-RIE</h3>
              <p>High-power model with 1000W RF power, designed for demanding etching applications.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Results Section */}
      <section className="process-results-section">
        <div className="container">
          <h2 className="section-title">Process Results</h2>
          <p className="section-intro">
            Real-world etching results demonstrating the capabilities of the Compact RIE Etcher (SV-RIE) system across various materials and applications.
          </p>

          {/* Quartz/Silicon Grating Etching */}
          <div className="process-result-category">
            <h3>Quartz/Silicon Grating Etching</h3>
            <p>
              Etching of quartz or silicon material grating arrays using PR (photoresist) masking. 
              Achieves minimum line widths of 300nm with sidewall verticality close to &gt;89°. 
              Applications include 3D displays, micro-optical devices, and optoelectronic communications.
            </p>
            <div className="result-images-grid">
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-1.jpg"
                  alt="Quartz/Silicon grating etching - top view showing parallel vertical trenches"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">Grating structure - top view</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-2.jpg"
                  alt="Quartz/Silicon grating etching - cross-sectional view showing deep narrow grooves"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">Cross-sectional view - deep trenches</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-3.jpg"
                  alt="Quartz/Silicon grating etching - cross-sectional view showing high aspect ratio features"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">High aspect ratio features</p>
              </div>
            </div>
          </div>

          {/* Compound Semiconductor Etching */}
          <div className="process-result-category">
            <h3>Compound Semiconductor Etching</h3>
            <p>
              Precise control over etch profiles for GaN-based, GaAs, InP, and metal materials by accurately 
              controlling the sample surface temperature. Suitable for blue LED devices, lasers, and optical communication applications.
            </p>
            <div className="result-images-grid">
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-4.jpg"
                  alt="Indium Phosphide (InP) etching - stepped terraced etch profile"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">InP (Indium Phosphide) - stepped profile</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-5.jpg"
                  alt="Gallium Nitride (GaN) etching - multi-layered etch profile with smooth transitions"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">GaN (Gallium Nitride) - multi-layered profile</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-6.jpg"
                  alt="Sapphire etching - corrugated surface with parallel ridges and valleys"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">Sapphire - corrugated surface</p>
              </div>
            </div>
          </div>

          {/* Silicon-based Material Etching */}
          <div className="process-result-category">
            <h3>Silicon-based Material Etching</h3>
            <p>
              Etching capabilities for silicon (Si), silicon dioxide (SiO₂), silicon nitride (SiNx), and other 
              silicon-based materials. Achieves silicon line etching above 50nm and silicon deep hole etching below 100μm.
            </p>
            <div className="result-images-grid">
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-7.jpg"
                  alt="SiO2 etching - cross-sectional view showing wide shallow trench"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">SiO₂ Etching</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-8.jpg"
                  alt="Silicon deep hole etching - high aspect ratio trench with vertical sidewalls"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">Silicon Deep Hole Etching (&lt;100μm)</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-9.jpg"
                  alt="50nm silicon line etching - top view showing extremely fine parallel lines"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">50nm Silicon Line Etching</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/process-results/result-10.jpg"
                  alt="Silicon nanopillar etching - dense array of uniformly sized nanopillars"
                  width={400}
                  height={300}
                  className="result-image"
                />
                <p className="image-caption">Silicon Nanopillar Etching</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Branding Notice for Risk Mitigation */}
      <section className="branding-notice-section" style={{ padding: '4rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <div className="branding-notice-wrapper" style={{ padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '12px', borderLeft: '5px solid #dee2e6' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#333', fontWeight: '600' }}>Branding Notice</h3>
            <p style={{ margin: 0, fontSize: '1rem', color: '#666', lineHeight: '1.6' }}>
              Semiconductor and etching systems are professionally integrated, configured, and branded by NineScrolls LLC. 
              Certain internal components or manufacturing nameplates may reflect our original manufacturing partner platforms. 
              All performance specifications, technical warranty, and professional support are fully guaranteed and provided directly by NineScrolls LLC to ensure academic and research compliance.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="product-inquiry-section">
        <div className="container">
          <div className="product-inquiry">
            <h2>Interested in this product?</h2>
            <p>Contact our team for detailed specifications, pricing information, and configuration options.</p>
            <div className="inquiry-buttons">
              <button className="btn btn-primary" onClick={openContactForm}>
                Request Information
              </button>
              <a 
                href="#" 
                className="btn btn-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  setGateOpen(true);
                }}
              >
                Download Brochure
              </a>
            </div>
          </div>
        </div>
      </section>

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/NineScrolls-Equipment-Guide.pdf'}
        fileName={'NineScrolls-Equipment-Guide.pdf'}
        title={'Download Equipment Guide'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />

      <QuoteModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="Compact RIE Etcher (SV-RIE)"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={() => {
          closeContactForm();
          const link = document.createElement('a');
          link.href = '/NineScrolls-Equipment-Guide.pdf';
          link.download = 'NineScrolls-Equipment-Guide.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      />
    </>
  );
}
