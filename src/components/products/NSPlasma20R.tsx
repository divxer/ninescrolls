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
    "name": "NS-Plasma 20R - Compact RF Plasma Processing System",
    "description": "Compact, research-grade RF plasma processing system with 20-liter chamber for batch plasma cleaning, photoresist ashing, and surface activation. 13.56 MHz RF power up to 300W, PLC-controlled operation.",
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
        title="NS-Plasma 20R - Compact RF Plasma Processing System (20L) | NineScrolls"
        description="Compact, research-grade RF plasma processing system with 20-liter chamber. Ideal for batch plasma cleaning, photoresist ashing, and surface activation. 13.56 MHz RF power up to 300W, PLC-controlled operation."
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
            <p className="product-subtitle">Research-Grade RF Plasma Processing System (20 L)</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Beyond desktop plasma cleaners. Full batch processing capacity for research labs and pilot-scale applications.
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
                  <span className="bullet-text-strong">13.56 MHz RF, up to 300 W</span>
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
                With a 20-liter stainless steel chamber, 13.56 MHz RF power, and PLC-controlled operation, NS-Plasma 20R 
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
                <h3>13.56 MHz RF, up to 300 W</h3>
                <p className="feature-highlight">Research-grade power with industrial stability</p>
                <p>Standard 13.56 MHz RF power source, continuously adjustable up to 300W. Stable plasma generation suitable for cleaning, ashing, and surface modification with reproducible results.</p>
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

      {/* Positioning Statement - Heavy Visual Section */}
      <section className="product-positioning-section">
        <div className="container">
          <div className="positioning-statement">
            <h2 className="positioning-title">System Positioning</h2>
            <div className="positioning-content">
              <div className="positioning-main">
                <p className="positioning-lead">
                  NS-Plasma 20R bridges the gap between desktop plasma cleaners and full-scale industrial systems.
                </p>
                <div className="positioning-comparison">
                  <div className="positioning-item positioning-item-for">
                    <h3>Designed For</h3>
                    <ul>
                      <li>Plasma cleaning of organic contaminants</li>
                      <li>Photoresist (PR) removal and ashing</li>
                      <li>Surface activation prior to bonding/coating</li>
                      <li>Surface energy modification</li>
                      <li>Batch sample preparation for materials research</li>
                    </ul>
                  </div>
                  <div className="positioning-item positioning-item-not">
                    <h3>Not Intended For</h3>
                    <ul>
                      <li>Anisotropic dry etching</li>
                      <li>Ion-biased RIE processes</li>
                      <li>High-aspect-ratio etching</li>
                    </ul>
                  </div>
                </div>
              </div>
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
                  <td className="spec-value">RF Plasma</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Frequency</td>
                  <td className="spec-value">13.56 MHz</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Power</td>
                  <td className="spec-value">0–300 W (adjustable)</td>
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
                  <td className="spec-value">220 V</td>
                </tr>
                <tr>
                  <td className="spec-label">System Dimensions</td>
                  <td className="spec-value">630 × 580 × 810 mm</td>
                </tr>
              </tbody>
            </table>
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

      {/* Contact Section */}
      <section className="product-inquiry-section">
        <div className="container">
          <div className="product-inquiry">
            <h2>Interested in this product?</h2>
            <p>Contact our team for pricing, lead time, and configuration options.</p>
            <div className="inquiry-buttons">
              <button className="btn btn-primary" onClick={openContactForm}>
                Request Information
              </button>
              <a 
                href="mailto:sales@ninescrolls.com" 
                className="btn btn-secondary"
              >
                Contact Sales
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
