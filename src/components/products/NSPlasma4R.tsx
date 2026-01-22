import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';

export function NSPlasma4R() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

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
    "@id": "https://ninescrolls.com/products/ns-plasma-4r#product",
    "name": "NS-Plasma 4R - Compact RF Plasma System",
    "description": "Compact RF plasma system for research and sample preparation. 4L chamber volume, 13.56 MHz RF power, ideal for teaching labs and low-volume processing.",
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-4r/main.jpg"],
    "sku": "ns-plasma-4r",
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "7999",
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
        title="NS-Plasma 4R - Compact RF Plasma System for Research | NineScrolls"
        description="Compact RF plasma system for research and sample preparation. 4L chamber volume, 13.56 MHz RF power, ideal for teaching labs and low-volume processing."
        keywords="NS-Plasma 4R, compact plasma system, research plasma, sample preparation, teaching lab equipment, plasma cleaning"
        url="/products/ns-plasma-4r"
        image="/assets/images/products/ns-plasma-4r/main.jpg"
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Hero Section - Entry-Level Positioning */}
      <section className="product-detail-hero product-hero-enhanced">
        <div className="container">
          <div className="product-header-enhanced">
            <h1>NS-Plasma 4R</h1>
            <p className="product-subtitle">Compact RF Plasma System for Research & Teaching Labs</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Designed for exploratory plasma processing and small-volume sample preparation
              </p>
            </div>
            <div className="hero-bullets">
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">📦</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">~4 L Processing Chamber</span>
                  <span className="bullet-text-sub">optimized for single samples or small batches</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">13.56 MHz RF Plasma</span>
                  <span className="bullet-text-sub">standard RF technology for academic compatibility</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🔬</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Simplified Operation</span>
                  <span className="bullet-text-sub">intuitive interface, easy setup for new users</span>
                </div>
              </div>
            </div>
            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">price:</span>
                <span className="pricing-amount">7,999 USD</span>
              </div>
              <p className="pricing-note">availability: in stock</p>
            </div>
            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={openContactForm}>
                Request Information
              </button>
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
                  <OptimizedImage
                    src="/assets/images/products/ns-plasma-4r/main.jpg"
                    alt="NS-Plasma 4R - Compact RF Plasma System"
                    width={800}
                    height={600}
                    className="main-product-image"
                  />
                </div>
              </div>
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="narrative-text">
                NS-Plasma 4R is a compact RF plasma system designed for small-batch plasma cleaning, surface activation, 
                and exploratory research applications where process flexibility and minimal footprint are preferred over high throughput.
              </p>
              <p className="narrative-text">
                Positioned below full batch plasma platforms, NS-Plasma 4R provides a practical entry point for laboratories 
                that require 13.56 MHz RF plasma capability without the complexity or space requirements of larger systems.
              </p>
              
              <div className="comparison-block">
                <h3>Compared to:</h3>
                <div className="comparison-items">
                  <div className="comparison-item">
                    <div className="comparison-label">Desktop plasma cleaners</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">Standard RF plasma technology</div>
                  </div>
                  <div className="comparison-item">
                    <div className="comparison-label">Batch plasma platforms</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">Lower entry cost, simpler operation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Characteristics - Lightweight (3-4 points only) */}
      <section className="product-features-section">
        <div className="container">
          <h2 className="section-title">Key Characteristics</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Compact RF Plasma Capability</h3>
              <p>Standard 13.56 MHz RF plasma source with adjustable power suitable for gentle plasma processes and stable generation for research and educational use.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Small-Volume Processing Chamber</h3>
              <p>Approx. 4 L chamber volume, optimized for single samples or small batches. Suitable for wafers, coupons, and discrete components.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Simple Operation for Teaching & Research</h3>
              <p>Intuitive control interface with manual or semi-automated operation modes. Easy setup and low learning curve for new users.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💨</div>
              <h3>Flexible Gas Configuration</h3>
              <p>Standard single or dual gas configuration (configurable), compatible with common process gases for versatile lab integration.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade Path Card - 4R → 20R Bridge */}
      <section className="upgrade-path-section">
        <div className="container">
          <div className="upgrade-path-card">
            <div className="upgrade-path-content">
              <h3>Need higher throughput or better process repeatability?</h3>
              <p>
                For larger batch processing, automated process control, and improved reproducibility,
                consider upgrading to NS-Plasma 20R.
              </p>
            </div>
            <div className="upgrade-path-cta">
              <Link to="/products/ns-plasma-20r" className="btn btn-secondary btn-large">
                View NS-Plasma 20R →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Applications - With Real Use Cases */}
      <section className="product-applications-section">
        <div className="container">
          <h2 className="section-title">Typical Applications</h2>
          <p className="section-intro">
            <strong>Commonly used in:</strong> Research laboratories with limited space, teaching and instructional labs, and facilities requiring low-volume plasma processing.
          </p>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🧹</div>
              <h3>Plasma Cleaning</h3>
              <p className="application-use-case">Removal of organic residues from substrates</p>
              <p>Effective cleaning of organic residues from wafers, coupons, and discrete components. Ideal for sample preparation workflows.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Surface Activation</h3>
              <p className="application-use-case">Preparation prior to bonding or coating</p>
              <p>Surface activation to enhance adhesion for bonding and coating applications. Commonly used in materials research and device fabrication.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Surface Energy Modification</h3>
              <p className="application-use-case">Modification for polymers and metals</p>
              <p>Modification of surface energy properties for polymers and metals. Suitable for exploratory research and process development.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📚</div>
              <h3>Educational Demonstrations</h3>
              <p className="application-use-case">Teaching plasma processes in instructional labs</p>
              <p>Ideal for educational demonstrations of plasma processes. Low learning curve makes it suitable for teaching environments.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔍</div>
              <h3>Process Development</h3>
              <p className="application-use-case">Early-stage feasibility studies</p>
              <p>Early-stage process development and feasibility studies. Provides a practical platform for validating plasma processes before scaling up.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Positioning - Integrated */}
      <section className="product-features-section">
        <div className="container">
          <h2 className="section-title">System Positioning</h2>
          <div className="positioning-note-integrated">
            <p className="positioning-text-integrated">
              <strong>Designed for:</strong> Research laboratories with limited space, teaching and instructional labs, low-volume or exploratory plasma processing, and users transitioning from desktop plasma cleaners.
            </p>
            <p className="positioning-text-integrated" style={{ marginTop: '1rem' }}>
              <strong>Not intended for:</strong> High-throughput batch processing, industrial-scale plasma treatment, or anisotropic dry etching and RIE processes.
            </p>
          </div>
        </div>
      </section>

      {/* Why NS-Plasma 4R - Benefits */}
      <section className="product-features-section product-benefits-section">
        <div className="container">
          <h2 className="section-title">Why NS-Plasma 4R</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Lower Entry Cost</h3>
              <p>Lower entry cost compared to batch plasma platforms, making it accessible for teaching labs and research validation.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Standard RF Technology</h3>
              <p>Standard RF plasma technology for academic compatibility. Uses the same 13.56 MHz frequency as larger research systems.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Simple Operation</h3>
              <p>Simple operation with minimal infrastructure requirements. Ideal companion system to larger plasma processing tools.</p>
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
                  <td className="spec-value">Adjustable (research-grade range)</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Volume</td>
                  <td className="spec-value">~4 L</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Dimensions</td>
                  <td className="spec-value">148mm diameter × 266mm depth</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Material</td>
                  <td className="spec-value">Stainless steel</td>
                </tr>
                <tr>
                  <td className="spec-label">Sample Tray Dimensions</td>
                  <td className="spec-value">220 × 110 × 90 mm (L × W × H)</td>
                </tr>
                <tr>
                  <td className="spec-label">Gas Configuration</td>
                  <td className="spec-value">Standard single / dual gas (configurable)</td>
                </tr>
                <tr>
                  <td className="spec-label">Vacuum System</td>
                  <td className="spec-value">Mechanical vacuum pump</td>
                </tr>
                <tr>
                  <td className="spec-label">Operation Mode</td>
                  <td className="spec-value">Manual / Semi-automatic</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Supply</td>
                  <td className="spec-value">110 V</td>
                </tr>
                <tr>
                  <td className="spec-label">Installation</td>
                  <td className="spec-value">Bench-top</td>
                </tr>
                <tr>
                  <td className="spec-label">System Dimensions</td>
                  <td className="spec-value">630 × 500 × 480 mm (L × W × H)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Support & Integration */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">Support & Integration</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>Application-Oriented Configuration</h3>
              <p>Application-oriented configuration guidance tailored to your specific research needs and teaching requirements.</p>
            </div>
            <div className="function-card">
              <h3>Documentation & Support</h3>
              <p>Comprehensive documentation and basic process support to help you get started quickly and effectively.</p>
            </div>
            <div className="function-card">
              <h3>Upgrade Consultation</h3>
              <p>Upgrade consultation toward larger plasma systems when your research needs grow beyond the 4R's capabilities.</p>
            </div>
            <div className="function-card">
              <h3>Custom Configurations</h3>
              <p>Custom configurations are available upon request to meet your specific research or teaching requirements.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="product-inquiry-section">
        <div className="container">
          <div className="product-inquiry">
            <h2>Interested in this system?</h2>
            <p>Contact NineScrolls for configuration options and availability.</p>
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
        productName="NS-Plasma 4R"
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
