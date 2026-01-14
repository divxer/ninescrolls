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

      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Plasma Treatment/Cleaner System</h1>
            <p>Compact Plasma Cleaning and Surface Treatment System</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <div className="main-image">
                <OptimizedImage
                  src="/assets/images/products/plasma-cleaner/main.jpg"
                  alt="Plasma Treatment/Cleaner System - compact plasma cleaning system"
                  width={800}
                  height={600}
                  className="main-product-image"
                />
              </div>
            </div>

            <div className="product-info">
              <div className="info-section">
                <h2>Overview</h2>
                <p>
                  The Plasma Treatment/Cleaner System is a compact plasma cleaning and surface treatment system 
                  designed for research laboratories and manufacturing applications. With an ultra-small footprint 
                  of 630mm × 600mm, this one-piece system offers excellent space efficiency while providing 
                  powerful plasma treatment capabilities for surface cleaning, modification, and activation.
                </p>
              </div>

              <div className="info-section">
                <h2>Key Features</h2>
                <ul>
                  <li><strong>Ultra-compact footprint:</strong> 630mm × 600mm one-piece design</li>
                  <li><strong>Touchscreen control:</strong> Fully automated operation system with simple interface</li>
                  <li><strong>Tabletop design:</strong> Can be used for single or multiple wafer processing</li>
                  <li><strong>Modular design:</strong> Easy maintenance and convenient transport</li>
                  <li><strong>Stable performance:</strong> Excellent cost-effectiveness for research applications</li>
                  <li><strong>Flexible processing:</strong> Supports 6" and smaller wafers, multi-wafer batch processing</li>
                  <li><strong>Multiple gas options:</strong> O₂, N₂, Ar process gases</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Specifications</h2>
                <ul>
                  <li><strong>Wafer Size:</strong> 6" and smaller specifications, multi-wafer batch processing</li>
                  <li><strong>RF Power:</strong> 0 ~ 300W / 500W, automatic matching</li>
                  <li><strong>Pump System:</strong> Mechanical pump / optional molecular pump</li>
                  <li><strong>Process Gases:</strong> 2 ~ 3 gas lines</li>
                  <li><strong>Gas Types:</strong> O₂, N₂, Ar</li>
                  <li><strong>Flow Control Range:</strong> 0 ~ 300 sccm</li>
                  <li><strong>Flow Control:</strong> MFC / manual control</li>
                  <li><strong>Footprint:</strong> 630mm × 600mm</li>
                  <li><strong>Operation:</strong> Touchscreen control, fully automated system</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Compatible Materials</h2>
                <ul>
                  <li>Photoresist (PR)</li>
                  <li>PMMA (Polymethyl methacrylate)</li>
                  <li>PDMS (Polydimethylsiloxane)</li>
                  <li>HDMS (Hexamethyldisilazane)</li>
                  <li>Organic films and polymers</li>
                  <li>Semiconductor materials</li>
                  <li>Optical materials</li>
                  <li>Biomedical materials</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Main Functions</h2>
                <h3>Surface Cleaning</h3>
                <ul>
                  <li>Removal of organic contaminants and residues</li>
                  <li>Cleaning of PR, PMMA, PDMS, and other organic films</li>
                  <li>Surface preparation for bonding and coating</li>
                </ul>
                <h3>Surface Modification</h3>
                <ul>
                  <li>Hydrophilic/hydrophobic surface treatment</li>
                  <li>Surface activation for improved adhesion</li>
                  <li>Chemical functional group modification (-OH/-H/-COOH)</li>
                  <li>Contact-free surface treatment without changing material properties</li>
                </ul>
              </div>

              <div className="info-section">
                <h2>Applications</h2>
                <ul>
                  <li><strong>Chemical and biological laboratories:</strong> Surface cleaning of semiconductor components, microelectronic components, optical components, and thin film sheets</li>
                  <li><strong>Failure analysis:</strong> Cleaning of microelectronic chips, biochips, and glass chips, as well as surface modification of polymer materials</li>
                  <li><strong>Optical components:</strong> Improving hydrophilicity, adhesion, and wettability of optical elements, biomedical materials, and aerospace materials</li>
                  <li><strong>Biomedical applications:</strong> Surface pretreatment of plant and animal tissues, silicone mold materials to enhance hydrophilicity, adhesion, and wettability</li>
                  <li><strong>Medical devices:</strong> Surface sterilization and disinfection</li>
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

          {/* Other Application Areas */}
          <div className="process-result-category">
            <h3>Other Application Areas</h3>
            <ul>
              <li><strong>Ultra-cleaning:</strong> Optical devices, electronic components, semiconductor components, laser devices, and coated substrates</li>
              <li><strong>Biochip and microfluidic cleaning:</strong> Cleaning of biochips, microfluidic chips, and substrates with deposited gels, as well as modification of polymer material surfaces</li>
              <li><strong>Adhesion improvement:</strong> Improving the adhesion of glues used for optical components, optical fibers, biomedical materials, and aerospace materials</li>
              <li><strong>Biomaterial pretreatment:</strong> Pre-treatment of implants, biomaterial surfaces, and silicone mold materials to enhance their wettability, adhesion, and compatibility</li>
              <li><strong>Medical device sterilization:</strong> Disinfection and sterilization of medical devices</li>
            </ul>
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
