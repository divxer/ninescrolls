import { useState, useEffect } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import '../../styles/ProcessResults.css';

export function CompactRIE() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

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

      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Compact RIE Etcher (SV-RIE)</h1>
            <p>Ultra-Compact Reactive Ion Etching System with Small Footprint</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <div className="main-image">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/main.jpg"
                  alt="Compact RIE Etcher (SV-RIE) - ultra-compact reactive ion etching system"
                  width={800}
                  height={600}
                  className="main-product-image"
                />
              </div>
              <div className="image-gallery">
                <OptimizedImage
                  src="/assets/images/products/compact-rie/main-2.jpg"
                  alt="Compact RIE Etcher (SV-RIE) - additional view"
                  width={400}
                  height={300}
                  className="gallery-image"
                />
              </div>
            </div>

            <div className="product-info">
              <div className="info-section">
                <h2>Overview</h2>
                <p>
                  The Compact RIE Etcher (SV-RIE) is a compact reactive ion etching system designed for research laboratories, 
                  pilot-scale processes, and failure analysis applications. With an ultra-small footprint of 630mm × 600mm, 
                  this one-piece system offers excellent space efficiency while maintaining high performance and reliability.
                </p>
              </div>

              <div className="info-section">
                <h2>Key Features</h2>
                <ul>
                  <li><strong>Ultra-compact footprint:</strong> 630mm × 600mm one-piece design</li>
                  <li><strong>Touchscreen control:</strong> Fully automated operation system with simple interface</li>
                  <li><strong>Modular design:</strong> Easy maintenance and convenient transport</li>
                  <li><strong>Stable performance:</strong> Excellent cost-effectiveness for research applications</li>
                  <li><strong>Flexible wafer support:</strong> 4", 6", 8", 12" wafers (customizable for smaller sizes)</li>
                  <li><strong>Multi-gas capability:</strong> Up to 5 process gas lines simultaneously</li>
                  <li><strong>Optional features:</strong> Removable contamination-resistant liner, turbo pump option</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Specifications</h2>
                <ul>
                  <li><strong>Wafer Size:</strong> 4", 6", 8", 12" (customizable for smaller sizes)</li>
                  <li><strong>RF Power:</strong> 300W / 500W / 1000W (customizable)</li>
                  <li><strong>Process Gases:</strong> Up to 5 gas lines simultaneously</li>
                  <li><strong>Flow Control:</strong> 0 ~ 1000 sccm range (selectable based on application)</li>
                  <li><strong>Pump System:</strong> Mechanical pump standard / optional turbo pump</li>
                  <li><strong>Footprint:</strong> 630mm × 600mm</li>
                  <li><strong>Operation:</strong> Touchscreen control, fully automated system</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Compatible Materials</h2>
                <h3>Inorganic Materials</h3>
                <ul>
                  <li>Silicon (Si)</li>
                  <li>Silicon Dioxide (SiO₂)</li>
                  <li>Silicon Nitride (SiNx)</li>
                  <li>Silicon Carbide (SiC)</li>
                </ul>
                <h3>Organic Materials</h3>
                <ul>
                  <li>Photoresist (PR)</li>
                  <li>Organic Polymers (PMMA / HDMS)</li>
                  <li>Organic Films</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Applications</h2>
                <ul>
                  <li><strong>Organic material etching:</strong> Photoresist (PR), PMMA, HDMS, polymer etching, and descumming</li>
                  <li><strong>Inorganic material rapid etching:</strong> Fast etching of inorganic materials</li>
                  <li><strong>Passivation etching:</strong> Passivation layer removal</li>
                  <li><strong>Package decapsulation:</strong> Opening packages for analysis</li>
                  <li><strong>Failure Analysis (FA):</strong> Chip failure analysis decapsulation etching</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Available Models</h2>
                <ul>
                  <li>SHL100SV-RIE</li>
                  <li>SHL150SV-RIE</li>
                  <li>SHL200SV-RIE</li>
                </ul>
              </div>

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
          </div>
        </div>
      </section>

      {/* Process Results Section */}
      <section className="process-results-section">
        <div className="container">
          <h2>Process Results</h2>
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
