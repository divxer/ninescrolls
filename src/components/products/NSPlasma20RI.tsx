import { useState } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';

export function NSPlasma20RI() {
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const handleDownloadBrochure = () => {
    const a = document.createElement('a');
    a.href = '/docs/ns-plasma-20r-i-datasheet.pdf';
    a.download = 'NineScrolls-NS-Plasma-20R-I-Datasheet.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/ns-plasma-20r-i#product",
    "name": "NS-Plasma 20R-I (Integrated) — Research-Grade Batch Plasma Cleaning",
    "description": "Research-grade 20L RF vacuum plasma cleaner for batch surface cleaning and activation. 13.56MHz up to 300W, PLC touchscreen control, 2 gas lines (O₂/N₂/Ar). US price $14,499.",
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-20r-i/main.jpg"],
    "sku": "ns-plasma-20r-i",
    "mpn": "NS-Plasma-20R-I",
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "14499",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/ns-plasma-20r-i",
      "itemCondition": "https://schema.org/NewCondition",
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
        title="NS-Plasma 20R-I (Integrated) | 20L RF Vacuum Plasma Cleaner | 13.56MHz 300W | $14,499"
        description="Research-grade 20L RF vacuum plasma cleaner for batch surface cleaning and activation. 13.56MHz up to 300W, PLC touchscreen control, 2 gas lines (O₂/N₂/Ar). US price $14,499."
        keywords="NS-Plasma 20R-I, RF Plasma Cleaner, Vacuum Plasma, 20L Chamber, Surface Activation, Batch Processing, Research Lab, Integrated plasma system, 13.56MHz plasma, 300W RF"
        url="/products/ns-plasma-20r-i"
        image="/assets/images/products/ns-plasma-20r-i/main.jpg"
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
      <section className="product-detail-hero product-hero-enhanced">
        <div className="container">
          <div className="product-header-enhanced">
            <h1>NS-Plasma 20R-I (Integrated)</h1>
            <p className="product-subtitle">Research-Grade Batch Plasma Cleaning (20 L)</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Higher power + larger chamber + higher throughput for labs needing repeatable plasma surface treatment.
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
                  <span className="bullet-text-strong">20 L Stainless-Steel Batch Chamber</span>
                  <span className="bullet-text-sub">higher throughput for batch processing</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">13.56 MHz RF Plasma, up to 300 W</span>
                  <span className="bullet-text-sub">customizable power for research needs</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🖥️</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">PLC + Touchscreen Control</span>
                  <span className="bullet-text-sub">Auto / Manual modes for reproducibility</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">💨</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">2 Gas Inlets (O₂ / N₂ / Ar)</span>
                  <span className="bullet-text-sub">mixed gases supported</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🔬</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Dry Cleaning & Surface Activation</span>
                  <span className="bullet-text-sub">without wet chemistry</span>
                </div>
              </div>
            </div>
            
            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">US Price:</span>
                <span className="pricing-amount">$14,499 USD</span>
              </div>
              <p className="pricing-note">Availability: In Stock • Ships in 3–4 weeks</p>
            </div>
            
            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={openContactForm}>
                Request a Quote / Lead Time
              </button>
              <button className="btn btn-secondary btn-large" onClick={openContactForm}>
                Ask for Process Recommendation
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* System Overview */}
      <section className="product-overview product-overview-narrative">
        <div className="container">
          <div className="product-hero-layout">
            <div className="product-hero-image product-image-gallery">
              <div className="product-image-main-wrapper">
                <div className="product-image-main">
                  {selectedImage === 'main' && (
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-20r-i/main.jpg"
                      alt="NS-Plasma 20R-I (Integrated) - 20L Batch Plasma Cleaning System"
                      width={800}
                      height={600}
                      className="main-product-image"
                    />
                  )}
                  {selectedImage === 'front' && (
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-20r-i/front-view.jpg"
                      alt="NS-Plasma 20R-I (Integrated) - Front View"
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
                    aria-label="Main view"
                  >
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-20r-i/main.jpg"
                      alt="Main View Thumbnail"
                      width={150}
                      height={112}
                      className="thumbnail-image"
                    />
                  </button>
                  <button
                    className={`thumbnail-btn ${selectedImage === 'front' ? 'active' : ''}`}
                    onClick={() => setSelectedImage('front')}
                    type="button"
                    aria-label="Front view"
                  >
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-20r-i/front-view.jpg"
                      alt="Front View Thumbnail"
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
                NS-Plasma 20R-I (Integrated) is a compact, research-grade RF vacuum plasma system designed for batch plasma cleaning, 
                surface activation, and adhesion improvement. With a 20-liter chamber and PLC-controlled operation, 
                it delivers repeatable results for academic labs and R&D environments.
              </p>
              <p className="narrative-text">
                The system features a stainless-steel batch chamber, 13.56 MHz RF plasma source with up to 300W power 
                (customizable), and dual gas inlets supporting O₂, N₂, Ar, and mixed gases. PLC + touchscreen control 
                with Auto / Manual modes ensures reproducible processes suitable for research documentation and scale-up studies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="product-applications-section">
        <div className="container">
          <h2 className="section-title">Typical Applications</h2>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🧹</div>
              <h3>Surface Cleaning</h3>
              <p className="application-use-case">Organic removal and residue cleaning</p>
              <p>Effective removal of organic contaminants, photoresist residues, and surface contaminants from substrates and components.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Surface Activation</h3>
              <p className="application-use-case">Adhesion improvement before coating/bonding</p>
              <p>Enhance surface energy and improve adhesion characteristics prior to thin film deposition, coating, or bonding processes.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Polymer/Plastics Treatment</h3>
              <p className="application-use-case">Pre-bond activation and surface modification</p>
              <p>Surface treatment of polymers and plastics to improve wettability, adhesion, and bonding characteristics.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📊</div>
              <h3>Sample Preparation</h3>
              <p className="application-use-case">Prior to thin film deposition / coating</p>
              <p>Prepare substrates and samples for subsequent processing steps, ensuring clean and activated surfaces for optimal results.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications */}
      <section className="product-specs-section">
        <div className="container">
          <h2 className="section-title">System Specifications</h2>
          <div className="specs-table-wrapper">
            <table className="specs-table">
              <tbody>
                <tr>
                  <td className="spec-label">Model</td>
                  <td className="spec-value">NS-Plasma 20R-I (Integrated)</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Supply</td>
                  <td className="spec-value">110 V</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Power</td>
                  <td className="spec-value">300 W (customizable)</td>
                </tr>
                <tr>
                  <td className="spec-label">Frequency</td>
                  <td className="spec-value">13.56 MHz RF</td>
                </tr>
                <tr>
                  <td className="spec-label">System Dimensions (L×W×H)</td>
                  <td className="spec-value">630 × 580 × 810 mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Size</td>
                  <td className="spec-value">250 × 250 × 320 mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Volume</td>
                  <td className="spec-value">20 L</td>
                </tr>
                <tr>
                  <td className="spec-label">Sample Tray Size</td>
                  <td className="spec-value">242 × 250 × 45 mm (4 layers)</td>
                </tr>
                <tr>
                  <td className="spec-label">Control</td>
                  <td className="spec-value">PLC + Touchscreen, Auto / Manual switchable</td>
                </tr>
                <tr>
                  <td className="spec-label">Gas Lines</td>
                  <td className="spec-value">2 lines</td>
                </tr>
                <tr>
                  <td className="spec-label">Compatible Gases</td>
                  <td className="spec-value">O₂, N₂, Ar (mixed gases supported)</td>
                </tr>
                <tr>
                  <td className="spec-label">Pumping Speed</td>
                  <td className="spec-value">Mechanical pump 4.4 L/s</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">What's Included</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>NS-Plasma 20R-I Main System</h3>
              <p>Integrated RF plasma source and vacuum chamber with stainless-steel construction.</p>
            </div>
            <div className="function-card">
              <h3>PLC Touchscreen Control Interface</h3>
              <p>User-friendly control system with Auto / Manual operation modes.</p>
            </div>
            <div className="function-card">
              <h3>4-Layer Sample Tray Set</h3>
              <p>Multi-level sample trays (242 × 250 × 45 mm) for efficient batch processing.</p>
            </div>
            <div className="function-card">
              <h3>Standard Vacuum Pump</h3>
              <p>Mechanical pump with 4.4 L/s pumping speed for optimal process conditions.</p>
            </div>
            <div className="function-card">
              <h3>User Documentation</h3>
              <p>Comprehensive user manual and basic operation guidance for quick startup.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Options / Customization */}
      <section className="product-functions-section" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="container">
          <h2 className="section-title">Options / Customization (Recommended)</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>Power Customization</h3>
              <p>Customize RF power output based on your specific process needs and material requirements.</p>
            </div>
            <div className="function-card">
              <h3>Additional Gas Configuration</h3>
              <p>Upgrade to 3 gas lines if your processes require more complex gas mixing capabilities.</p>
            </div>
            <div className="function-card">
              <h3>Process Recipe Templates</h3>
              <p>Pre-configured process recipes and training package for common applications.</p>
            </div>
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
                Q: Is this system suitable for delicate samples?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: Plasma is a dry process; users can tune gas/power/time for gentle activation. The PLC control system allows precise parameter adjustment to minimize sample damage while achieving desired surface modification.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: What gases can I use?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: Common choices include O₂, N₂, Ar, and mixed gases (with 2 gas lines). The system supports flexible gas configurations for various surface treatment applications.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: Is it repeatable for research data?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: PLC + touchscreen control supports stable, repeatable operation across runs. Process parameters can be saved and recalled, ensuring consistent results for research documentation and publication.
              </p>
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
              <button className="btn btn-secondary" onClick={openContactForm}>
                Ask for Process Recommendation
              </button>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
              Tell us your material and process goals, and we'll provide technical recommendations.
            </p>
          </div>
        </div>
      </section>

      <QuoteModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        onDownloadBrochure={handleDownloadBrochure}
        productName="NS-Plasma 20R-I (Integrated)"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
