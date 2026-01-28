import { useState } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';

export function NSPlasma20R() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'front'>('main');
  const [selectedFrequency, setSelectedFrequency] = useState<'rf' | 'mf'>('rf'); // Default to RF

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
    "@id": "https://ninescrolls.com/products/ns-plasma-20r#product",
    "name": "NS-Plasma 20R - Plasma Processing System (RF or Mid-Frequency)",
    "description": "Compact, research-grade plasma processing system with 20-liter chamber for batch plasma cleaning, photoresist ashing, and surface activation. Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations, PLC-controlled operation.",
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-20r/main.jpg"],
    "sku": "ns-plasma-20r",
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "11999",
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
        title="NS-Plasma 20R - Compact RF Plasma Processing System (20L) | NineScrolls"
        description="Compact, research-grade plasma processing system with 20-liter chamber. Ideal for batch plasma cleaning, photoresist ashing, and surface activation. Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations, up to 300W, PLC-controlled operation."
        keywords="NS-Plasma 20R, plasma cleaning, photoresist ashing, surface activation, RF plasma, batch processing, research plasma system"
        url="/products/ns-plasma-20r"
        image="/assets/images/products/ns-plasma-20r/main.jpg"
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
            <h1>NS-Plasma 20R</h1>
            <p className="product-subtitle">Compact RF Plasma Processing System (20 L)</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Designed for research laboratories requiring batch processing and process reproducibility
              </p>
              <p style={{ marginTop: '1rem', fontSize: '0.95rem', color: '#666', fontStyle: 'italic' }}>
                US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
              </p>
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
            <div className="hero-bullets">
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">📦</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">20 L Batch Chamber</span>
                  <span className="bullet-text-sub">vs. desktop cleaners: 5–10× capacity</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">RF or Mid-Frequency, up to 300 W</span>
                  <span className="bullet-text-sub">research-grade power & stability</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🖥️</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">PLC-Controlled Reproducibility</span>
                  <span className="bullet-text-sub">documented processes for scale-up</span>
                </div>
              </div>
            </div>
            {/* Power Frequency Options */}
            <div className="frequency-options" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#333', fontWeight: '600' }}>Power Frequency Options</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedFrequency('mf')}
                  style={{
                    padding: '1rem',
                    backgroundColor: selectedFrequency === 'mf' ? '#fff' : '#f8f9fa',
                    borderRadius: '6px',
                    border: selectedFrequency === 'mf' ? '2px solid #28a745' : '2px solid #dee2e6',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', backgroundColor: '#28a745', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>BEST VALUE</span>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#333' }}>Mid-Frequency (40 kHz)</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>
                    Cost-effective, robust for routine batch cleaning and surface activation
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#28a745', fontWeight: '700' }}>$11,999 USD • 300W</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFrequency('rf')}
                  style={{
                    padding: '1rem',
                    backgroundColor: selectedFrequency === 'rf' ? '#fff' : '#f8f9fa',
                    borderRadius: '6px',
                    border: selectedFrequency === 'rf' ? '2px solid #2563eb' : '2px solid #dee2e6',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#333' }}>RF (13.56 MHz)</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>
                    Finer process control, broader recipe window for advanced batch processing
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#2563eb', fontWeight: '700' }}>$14,999 USD • 150W</p>
                </button>
              </div>
            </div>
            
            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">price:</span>
                <span className="pricing-amount">
                  {selectedFrequency === 'rf' ? '14,999' : '11,999'} USD
                </span>
              </div>
              <p className="pricing-note">availability: in stock</p>
            </div>
            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={openContactForm}>
                Request Configuration
              </button>
              <a 
                href="/products/plasma-systems/compare" 
                className="btn btn-secondary btn-large"
              >
                Compare Models
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
                      src="/assets/images/products/ns-plasma-20r/main.jpg"
                      alt="NS-Plasma 20R - Compact RF Plasma Processing System"
                      width={800}
                      height={600}
                      className="main-product-image"
                    />
                  ) : (
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-20r/front-view.jpg"
                      alt="NS-Plasma 20R - Front View"
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
                      src="/assets/images/products/ns-plasma-20r/main.jpg"
                      alt="Main View"
                      width={150}
                      height={112}
                      className="thumbnail-image"
                    />
                  </button>
                  <button 
                    className={`thumbnail-btn ${selectedImage === 'front' ? 'active' : ''}`}
                    onClick={() => setSelectedImage('front')}
                    type="button"
                  >
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-20r/front-view.jpg"
                      alt="Front View"
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
                NS-Plasma 20R is a compact, research-grade RF plasma processing system designed for batch plasma cleaning, 
                photoresist ashing, and surface activation in academic laboratories and pilot-scale research environments.
              </p>
              <p className="narrative-text">
                With a 20-liter stainless steel chamber, RF or Mid-Frequency power options, and PLC-controlled operation, NS-Plasma 20R 
                bridges the gap between entry-level plasma cleaners and full-scale industrial plasma systems—delivering 
                repeatable process performance without unnecessary system complexity.
              </p>
              
              <div className="comparison-block">
                <h3>Compared to:</h3>
                <div className="comparison-items">
                  <div className="comparison-item">
                    <div className="comparison-label">Desktop plasma cleaners</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">Larger batch, higher power</div>
                  </div>
                  <div className="comparison-item">
                    <div className="comparison-label">Industrial plasma tools</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">Simpler operation, lower cost</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses This - Use Case Block */}
      <section className="product-use-cases-section" style={{ padding: '3rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2 className="section-title">Who Uses This</h2>
          <p className="section-intro" style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
            NS-Plasma 20R is commonly installed in:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>University Cleanrooms</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Materials science and research facilities</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔬</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Materials Science Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Batch processing and surface treatment</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Failure Analysis Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Batch sample preparation workflows</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚗️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Pilot-Scale R&D Lines</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Process development and scale-up</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features - Primary and Secondary */}
      <section className="product-features-section">
        <div className="container">
          <h2 className="section-title">Key Features</h2>
          
          {/* Primary Features - TOP 3 */}
          <div className="features-primary">
            <h3 className="features-subtitle">Core Capabilities</h3>
            <div className="features-grid features-grid-primary">
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">📦</div>
                <h3>20 L Batch Processing Chamber</h3>
                <p className="feature-highlight">5–10× larger capacity than desktop plasma cleaners</p>
                <p>Internal chamber: 250 × 250 × 320 mm with multi-level removable sample trays. Process multiple samples, components, or substrates simultaneously—essential for research labs requiring batch throughput.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">⚡</div>
                <h3>RF or Mid-Frequency, up to 300W (MF) / 150W (RF)</h3>
                <p className="feature-highlight">Research-grade power with industrial stability</p>
                <p>Available in RF (13.56 MHz, 150W) or Mid-Frequency (40 kHz, 300W) configurations, continuously adjustable. Stable plasma generation suitable for cleaning, ashing, and surface modification with reproducible results.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">🖥️</div>
                <h3>PLC-Based Reproducibility</h3>
                <p className="feature-highlight">Documented processes ready for scale-up</p>
                <p>PLC control system with touch screen interface. Automatic and manual operation modes with reproducible process parameters—critical for research documentation and transitioning to production.</p>
              </div>
            </div>
          </div>

          {/* Secondary Features */}
          <div className="features-secondary">
            <h3 className="features-subtitle">Additional Features</h3>
            <div className="features-grid features-grid-secondary">
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">💨</div>
                <h3>Process-Focused Vacuum Design</h3>
                <p>Mechanical vacuum pumping system matched to chamber volume. Optimized for plasma processing pressures with fast pump-down and stable operating conditions.</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">🔧</div>
                <h3>Flexible Gas Configuration</h3>
                <p>Dual gas inlets (standard) compatible with common process gases such as O₂, N₂, and Ar. Mixed-gas plasma processes supported.</p>
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
            <strong>Commonly installed in:</strong> Materials science cleanrooms, failure analysis facilities, and pilot-scale processing environments requiring batch plasma treatment capabilities.
          </p>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🧹</div>
              <h3>Plasma Cleaning</h3>
              <p className="application-use-case">Used for batch PR removal before lithography steps</p>
              <p>Effective removal of organic contaminants from substrates, including photoresist (PR), PMMA, PDMS, and more. Typical batch: 10–20 substrates per run.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔥</div>
              <h3>Photoresist Ashing</h3>
              <p className="application-use-case">Complete PR removal with uniform processing across batch samples</p>
              <p>Precise control and uniform processing across batch samples. Essential for materials research labs processing multiple wafers simultaneously.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Surface Activation</h3>
              <p className="application-use-case">Preparation prior to bonding, coating, or deposition</p>
              <p>Enhance adhesion and improve material performance. Commonly used in MEMS fabrication and advanced packaging workflows.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Surface Energy Modification</h3>
              <p className="application-use-case">Modify wettability for polymers, metals, and ceramics</p>
              <p>Achieve desired wettability and adhesion characteristics. Typical users: polymer research labs and biomaterials facilities.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📊</div>
              <h3>Batch Sample Preparation</h3>
              <p className="application-use-case">Efficient processing of multiple substrates for materials research</p>
              <p>Ideal for batch preparation workflows, enabling efficient processing of multiple substrates simultaneously—critical for research productivity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Positioning Block - Strategic Statement */}
      <section className="product-positioning-section">
        <div className="container">
          <div className="positioning-statement positioning-block-strategic">
            <h2 className="positioning-title">System Positioning</h2>
            <p className="positioning-lead">
              NS-Plasma 20R bridges the gap between desktop plasma cleaners and full industrial plasma platforms, 
              offering controlled batch processing without excessive system complexity.
            </p>
            <p className="positioning-note">
              This is NineScrolls' strategic positioning statement for research-grade plasma processing.
            </p>
          </div>
        </div>
      </section>

      {/* Reverse Comparison - 20R vs 4R */}
      <section className="product-comparison-section">
        <div className="container">
          <h2 className="section-title">Choose NS-Plasma 20R if you:</h2>
          <div className="comparison-choice-grid">
            <div className="choice-item">
              <div className="choice-icon">📦</div>
              <h3>Process multiple samples per run</h3>
              <p>20-liter chamber enables efficient batch processing of 10–20 substrates simultaneously, essential for research productivity.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">🔄</div>
              <h3>Require repeatable plasma conditions</h3>
              <p>Full PLC control with documented process parameters ensures consistent results across runs, critical for scale-up studies.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">📈</div>
              <h3>Plan to scale from validation to routine use</h3>
              <p>Automated operation and process reproducibility make NS-Plasma 20R ideal for transitioning from exploratory research to routine processing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why NS-Plasma 20R - Benefits */}
      <section className="product-features-section product-benefits-section">
        <div className="container">
          <h2 className="section-title">Why NS-Plasma 20R</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Larger Batch Capacity</h3>
              <p>20-liter chamber provides 5–10× larger batch capacity than desktop plasma cleaners, enabling efficient processing of multiple samples—essential for research workflows.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Higher Power & Control</h3>
              <p>Up to 300W RF power with better process control than entry-level systems, delivering research-grade performance suitable for scale-up studies.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Simpler Operation</h3>
              <p>Simpler installation and operation than industrial plasma tools, optimized for academic research labs and pilot-scale processing environments.</p>
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
                  <td className="spec-label">Plasma Type</td>
                  <td className="spec-value">RF Plasma / Mid-Frequency Plasma</td>
                </tr>
                <tr>
                  <td className="spec-label">Plasma Frequency</td>
                  <td className="spec-value">13.56 MHz (RF) / 40 kHz (Mid-Frequency)</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Output</td>
                  <td className="spec-value">300W (Mid-Frequency) / 150W (RF), adjustable</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Volume</td>
                  <td className="spec-value">20 L</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Material</td>
                  <td className="spec-value">Stainless steel</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Dimensions</td>
                  <td className="spec-value">250 × 250 × 320 mm (internal)</td>
                </tr>
                <tr>
                  <td className="spec-label">Sample Tray Dimensions</td>
                  <td className="spec-value">242 × 250 × 45 mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Gas Channels</td>
                  <td className="spec-value">2</td>
                </tr>
                <tr>
                  <td className="spec-label">Pumping Speed</td>
                  <td className="spec-value">~4.4 L/s (mechanical pump)</td>
                </tr>
                <tr>
                  <td className="spec-label">Control System</td>
                  <td className="spec-value">PLC + Touch Screen</td>
                </tr>
                <tr>
                  <td className="spec-label">Operation Modes</td>
                  <td className="spec-value">Automatic / Manual</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Supply</td>
                  <td className="spec-value">110 V</td>
                </tr>
                <tr>
                  <td className="spec-label">System Dimensions</td>
                  <td className="spec-value">630 × 580 × 810 mm</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', fontSize: '0.9rem', color: '#666', lineHeight: '1.6' }}>
            <p style={{ margin: 0 }}>
              <strong>Frequency Selection Guide:</strong> Mid-Frequency (40 kHz) is ideal for cost-sensitive research labs and routine batch cleaning applications. 
              RF (13.56 MHz) supports more advanced surface activation recipes and offers finer process control for demanding batch processing requirements.
            </p>
          </div>
        </div>
      </section>

      {/* Support & Integration - Full Width */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">Support & Integration</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>Application-Oriented Configuration</h3>
              <p>NineScrolls provides application-oriented system configuration tailored to your specific research needs and process requirements.</p>
            </div>
            <div className="function-card">
              <h3>Process Consultation</h3>
              <p>Expert process consultation for research environments, helping you optimize parameters and achieve desired results.</p>
            </div>
            <div className="function-card">
              <h3>Documentation & Support</h3>
              <p>Comprehensive documentation and long-term technical support to ensure your system operates at peak performance.</p>
            </div>
            <div className="function-card">
              <h3>Custom Configurations</h3>
              <p>Custom configurations and scale-up options are available upon request to meet your specific research or production needs.</p>
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
              NS-Plasma™ systems are professionally integrated, configured, and branded by NineScrolls LLC. 
              Certain internal components or manufacturing nameplates may reflect our original manufacturing partner platforms. 
              All performance specifications, technical warranty, and professional support are fully guaranteed and provided directly by NineScrolls LLC to ensure academic and research compliance.
            </p>
          </div>
        </div>
      </section>

      {/* Cost Advantage Block */}
      <section className="cost-advantage-section" style={{ padding: '4rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>Why Our Systems Are Cost-Efficient</h2>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <p style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.05rem', color: '#666', lineHeight: '1.7' }}>
              We specialize in cost-efficient configurations for research labs that need to balance performance and budget. We help labs avoid paying for unnecessary industrial features and focus on what matters for research applications.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Modular design</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>Pay only for what you need</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Research-focused configuration</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>Not overbuilt for production</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Direct engineering collaboration</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>No unnecessary intermediaries</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Lean operational structure</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>Efficient cost structure</span>
                </div>
              </li>
            </ul>
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#333' }}>Typical use cases include:</h3>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#666', lineHeight: '1.8' }}>
                <li>New lab setup with limited initial funding</li>
                <li>Grant-based or proposal-stage projects</li>
                <li>Pilot or exploratory research</li>
                <li>Teaching and shared facilities</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Block - What You Can Expect */}
      <section className="trust-block-section" style={{ padding: '4rem 0', backgroundColor: '#f8f9fa' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>What You Can Expect When Working With Us</h2>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <span>US-based sales & project coordination</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <span>Installation & training support available</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <span>Engineering-backed configuration (not off-the-shelf)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <span>NDA & export compliance supported</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <span>Responsive support before & after delivery</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="product-inquiry-section">
        <div className="container">
          <div className="product-inquiry">
            <h2>Interested in this product?</h2>
            <p style={{ marginBottom: '1rem' }}>
              You don't need a finalized specification or PO to reach out. 
              We often assist labs during early evaluation and proposal stages.
            </p>
            <div className="inquiry-buttons">
              <button className="btn btn-primary" onClick={openContactForm}>
                Request a Budgetary Quote
              </button>
              <a 
                href="mailto:sales@ninescrolls.com" 
                className="btn btn-secondary"
              >
                Talk to an Engineer
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
        productName="NS-Plasma 20R"
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
