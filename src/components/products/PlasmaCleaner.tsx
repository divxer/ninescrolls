import { useState } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import '../../styles/ProcessResults.css';

export function PlasmaCleaner() {
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
    "@id": "https://ninescrolls.com/products/plasma-cleaner#product",
    "name": "Plasma Treatment/Cleaner System",
    "description": "Compact plasma treatment and cleaning system with ultra-small footprint (630mm×600mm), ideal for surface treatment, cleaning, and surface modification applications.",
    "image": ["https://ninescrolls.com/assets/images/products/plasma-cleaner/main.jpg"],
    "sku": "plasma-cleaner",
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
        title="Plasma Treatment/Cleaner System - Surface Treatment & Cleaning | NineScrolls"
        description="Compact plasma treatment and cleaning system with 630mm×600mm footprint. Ideal for surface cleaning, modification, and treatment applications. Touchscreen control, fully automated."
        keywords="plasma cleaner, plasma treatment, surface cleaning, surface modification, plasma cleaning system, semiconductor cleaning"
        url="/products/plasma-cleaner"
        image="/assets/images/products/plasma-cleaner/main.jpg"
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Plasma Treatment/Cleaner System</h1>
            <p>Compact Plasma Cleaning and Surface Treatment System</p>
          </div>
        </div>
      </section>

      {/* System Overview - Z-Pattern: Image + Overview */}
      <section className="product-overview product-overview-hero">
        <div className="container">
          <div className="product-hero-layout">
            <div className="product-hero-image">
              <OptimizedImage
                src="/assets/images/products/plasma-cleaner/main.jpg"
                alt="Plasma Treatment/Cleaner System - compact plasma cleaning system"
                width={800}
                height={600}
                className="main-product-image"
              />
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="lead-text">
                The Plasma Treatment/Cleaner System is a compact plasma cleaning and surface treatment system 
                designed for research laboratories and manufacturing applications.
              </p>
              <p>
                With an ultra-small footprint of 630mm × 600mm, this one-piece system offers excellent space 
                efficiency while providing powerful plasma treatment capabilities for surface cleaning, modification, 
                and activation.
              </p>
              <div className="key-highlights">
                <div className="highlight-item">
                  <span className="highlight-icon">📐</span>
                  <span className="highlight-text">630mm × 600mm footprint</span>
                </div>
                <div className="highlight-item">
                  <span className="highlight-icon">⚡</span>
                  <span className="highlight-text">Up to 300W/500W RF power</span>
                </div>
                <div className="highlight-item">
                  <span className="highlight-icon">🖥️</span>
                  <span className="highlight-text">Touchscreen control</span>
                </div>
                <div className="highlight-item">
                  <span className="highlight-icon">🔬</span>
                  <span className="highlight-text">Multi-wafer batch processing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features - Full Width Cards */}
      <section className="product-features-section">
        <div className="container">
          <h2 className="section-title">Key Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Ultra-Compact Design</h3>
              <p>630mm × 600mm one-piece design optimizes valuable workspace while maintaining full functionality.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🖥️</div>
              <h3>Touchscreen Control</h3>
              <p>Fully automated operation system with simple interface that streamlines your workflows.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Flexible Processing</h3>
              <p>Supports 6" and smaller wafers, multi-wafer batch processing for various research needs.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3>Modular Design</h3>
              <p>Easy maintenance and convenient transport with customizable configurations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Applications - Z-Pattern: Text + Image */}
      <section className="product-applications-section">
        <div className="container">
          <div className="applications-layout">
            <div className="applications-content">
              <h2>Applications</h2>
              <div className="application-categories">
                <div className="application-category">
                  <h3>Chemical & Biological Laboratories</h3>
                  <p>Surface cleaning of semiconductor components, microelectronic parts, and optical components.</p>
                </div>
                <div className="application-category">
                  <h3>Failure Analysis</h3>
                  <p>Cleaning of biochips and microfluidic devices, as well as surface modification of polymer materials.</p>
                </div>
                <div className="application-category">
                  <h3>Medical Devices</h3>
                  <p>Sterilization and surface modification to improve adhesion and hydrophilicity.</p>
                </div>
                <div className="application-category">
                  <h3>Optical Components</h3>
                  <p>Enhancing wettability and adhesion for optical elements used in various high-tech applications.</p>
                </div>
              </div>
            </div>
            <div className="applications-image">
              <OptimizedImage
                src="/assets/images/products/plasma-cleaner/main.jpg"
                alt="Plasma Treatment System Applications"
                width={600}
                height={450}
                className="application-image"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Functions - Full Width */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">Main Functions</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>Surface Cleaning</h3>
              <ul>
                <li>Removal of organic contaminants and residues</li>
                <li>Cleaning of PR, PMMA, PDMS, and other organic films</li>
                <li>Surface preparation for bonding and coating</li>
              </ul>
            </div>
            <div className="function-card">
              <h3>Surface Modification</h3>
              <ul>
                <li>Hydrophilic/hydrophobic surface treatment</li>
                <li>Surface activation for improved adhesion</li>
                <li>Chemical functional group modification (-OH/-H/-COOH)</li>
                <li>Contact-free surface treatment without changing material properties</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications - Full Width Table */}
      <section className="product-specs-section">
        <div className="container">
          <h2 className="section-title">Specifications</h2>
          <div className="specs-table-wrapper">
            <table className="specs-table">
              <tbody>
                <tr>
                  <td className="spec-label">Wafer Size</td>
                  <td className="spec-value">6" and smaller specifications, multi-wafer batch processing</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Power</td>
                  <td className="spec-value">0 ~ 300W / 500W, automatic matching</td>
                </tr>
                <tr>
                  <td className="spec-label">Pump System</td>
                  <td className="spec-value">Mechanical pump / optional molecular pump</td>
                </tr>
                <tr>
                  <td className="spec-label">Process Gases</td>
                  <td className="spec-value">2 ~ 3 gas lines (O₂, N₂, Ar)</td>
                </tr>
                <tr>
                  <td className="spec-label">Flow Control Range</td>
                  <td className="spec-value">0 ~ 300 sccm</td>
                </tr>
                <tr>
                  <td className="spec-label">Flow Control</td>
                  <td className="spec-value">MFC / manual control</td>
                </tr>
                <tr>
                  <td className="spec-label">Footprint</td>
                  <td className="spec-value">630mm × 600mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Operation</td>
                  <td className="spec-value">Touchscreen control, fully automated system</td>
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
            <div className="material-tag">Photoresist (PR)</div>
            <div className="material-tag">PMMA</div>
            <div className="material-tag">PDMS</div>
            <div className="material-tag">HDMS</div>
            <div className="material-tag">Organic films and polymers</div>
            <div className="material-tag">Semiconductor materials</div>
            <div className="material-tag">Optical materials</div>
            <div className="material-tag">Biomedical materials</div>
          </div>
        </div>
      </section>

      {/* Process Results - Z-Pattern: Image + Results */}
      <section className="process-results-section">
        <div className="container">
          <h2 className="section-title">Process Results</h2>
          <p className="section-intro">
            Real-world results demonstrating the capabilities of the Plasma Treatment/Cleaner System for surface modification, cleaning, and treatment applications.
          </p>

          {/* Surface Modification */}
          <div className="process-result-category">
            <h3>Surface Modification</h3>
            <p>
              Surface modification can be used for hydrophobic/hydrophilic treatment of material surfaces and 
              grafting functional groups (-OH/-H/-COOH) to alter the physicochemical properties of the material surface. 
              This enables contact-free surface treatment without changing the material's bulk properties.
            </p>
            <div className="result-images-grid">
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/plasma-cleaner/process-results/hydrophobic-1.jpg"
                  alt="Silicon surface hydrophobic treatment - water droplets with high contact angle"
                  width={585}
                  height={435}
                  className="result-image"
                />
                <p className="image-caption">Hydrophobic surface - high contact angle</p>
              </div>
              <div className="result-image-item">
                <OptimizedImage
                  src="/assets/images/products/plasma-cleaner/process-results/hydrophobic-2.jpg"
                  alt="Silicon surface hydrophobic treatment - water droplet demonstrating hydrophobicity"
                  width={412}
                  height={391}
                  className="result-image"
                />
                <p className="image-caption">Silicon surface hydrophobic treatment</p>
              </div>
            </div>
          </div>

          {/* Organic Film Patterning and Etching */}
          <div className="process-result-category">
            <h3>Organic Film Patterning and Etching</h3>
            <p>
              PR/PMMA/PDMS and other organic film materials can be patterned and removed, which can be used for 
              cleaning organic matter from substrate surfaces. This process enables precise removal of organic 
              contaminants and residues while maintaining substrate integrity.
            </p>
            <div className="result-images-grid result-images-single">
              <div className="result-image-item result-image-item-large">
                <div className="sem-image-wrapper">
                  <OptimizedImage
                    src="/assets/images/products/plasma-cleaner/process-results/organic-patterning.jpg"
                    alt="Organic polarizing film patterned etching - SEM view showing regular grid-like array"
                    width={800}
                    height={600}
                    className="result-image sem-image"
                  />
                </div>
                <p className="image-caption">Organic Polarizing Film Patterned Etching (SEM view)</p>
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
              Plasma treatment systems are professionally integrated, configured, and branded by NineScrolls LLC. 
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
        productName="Plasma Treatment/Cleaner System"
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
