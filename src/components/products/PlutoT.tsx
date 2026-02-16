import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';
import { AcademicCitations } from '../common/AcademicCitations';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function PlutoT() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'front-view' | 'chamber' | 'samples' | 'with-pump'>('main');
  const navigate = useNavigate();
  const { addItem } = useCart();

  useScrollToTop();

  const openContactForm = (quote = false) => {
    setIsQuoteIntent(quote);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleAddToCart = () => {
    addItem({
      id: 'pluto-t',
      name: 'PLUTO-T - 200W RF Plasma Cleaner',
      price: 9999,
      quantity: 1,
      image: '/assets/images/products/pluto-t/main.jpg',
      sku: 'pluto-t',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 9999,
          items: [{
            item_id: 'pluto-t',
            item_name: 'PLUTO-T - 200W RF Plasma Cleaner',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 9999,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('pluto-t', 'PLUTO-T - 200W RF Plasma Cleaner', 9999);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pluto-t#product",
    "name": "PLUTO-T - 200W RF Plasma Cleaner for Research Labs",
    "description": "Compact, high-performance 200W RF plasma cleaner (13.56 MHz) with ~4.3L stainless steel chamber, touchscreen control, and 1 gas line (optional 2nd). Designed for research laboratories requiring true RF capability at an accessible price point. Under $10,000.",
    "image": ["https://ninescrolls.com/assets/images/products/pluto-t/main.jpg"],
    "sku": "pluto-t",
    "mpn": "PLUTO-T",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "9999",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pluto-t",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "NineScrolls LLC",
        "url": "https://ninescrolls.com"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "USD"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "businessDays": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
          },
          "cutoffTime": "14:00",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 21,
            "maxValue": 28,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 7,
            "maxValue": 14,
            "unitCode": "DAY"
          }
        }
      }
    }
  };

  return (
    <>
      <SEO
        title="PLUTO-T | 200W RF Plasma Cleaner | 13.56 MHz | Under $10,000 | NineScrolls"
        description="Compact 200W RF plasma cleaner (13.56 MHz) with ~4.3L stainless steel chamber, touchscreen control, and 1 gas line (optional 2nd). High-power RF cleaning for research labs under $10,000. Authorized US distributor."
        keywords="PLUTO-T, 200W RF plasma cleaner, 13.56 MHz, plasma cleaning, surface activation, polymer treatment, research lab plasma, affordable RF plasma, touchscreen plasma cleaner"
        url="/products/pluto-t"
        image="/assets/images/products/pluto-t/main.jpg"
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
          <Breadcrumbs items={[
            { name: 'Products', path: '/products' },
            { name: 'PLUTO-T', path: '/products/pluto-t' }
          ]} />
          <div className="product-header-enhanced">
            <h1>PLUTO-T</h1>
            <p className="product-subtitle">200W RF Plasma Cleaner for Research Labs</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                High-power RF cleaning under $10,000 | Research-validated technology
              </p>
              <p className="hero-subtitle-emphasis">
                US-based scientific equipment provider · Authorized distributor for US research labs & institutions
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
                True 13.56 MHz RF performance, accessible pricing
              </h3>
              <p style={{
                margin: 0,
                fontSize: '0.95rem',
                color: '#EAEAEA',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                PLUTO-T delivers 33% more RF power than comparable entry-level systems with touchscreen automation
                and a stainless steel chamber — all for under $10,000. Ideal for labs that need real RF capability without overspending.
              </p>
            </div>

            <div className="hero-bullets">
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">200W RF (13.56 MHz)</span>
                  <span className="bullet-text-sub">continuously adjustable, research-grade power</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">📦</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">~4.3L Stainless Steel Chamber</span>
                  <span className="bullet-text-sub">durable construction for consistent plasma processing</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🖥️</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Touchscreen Control</span>
                  <span className="bullet-text-sub">fully automated operation</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">💰</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Under $10,000</span>
                  <span className="bullet-text-sub">accessible RF plasma for research budgets</span>
                </div>
              </div>
            </div>

            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">US Price:</span>
                <span className="pricing-amount">$9,999 USD</span>
              </div>
              <p className="pricing-note">Availability: In Stock</p>
            </div>

            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <button className="btn btn-secondary btn-large" onClick={() => openContactForm(true)}>
                Contact Sales
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
                  {selectedImage === 'main' && (
                    <OptimizedImage src="/assets/images/products/pluto-t/main.jpg" alt="PLUTO-T - 200W RF Plasma Cleaner" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'front-view' && (
                    <OptimizedImage src="/assets/images/products/pluto-t/front-view.jpg" alt="PLUTO-T - System with Pump" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'chamber' && (
                    <OptimizedImage src="/assets/images/products/pluto-t/chamber.jpg" alt="PLUTO-T - Chamber Interior" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'samples' && (
                    <OptimizedImage src="/assets/images/products/pluto-t/samples.jpg" alt="PLUTO-T - Sample Processing" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'with-pump' && (
                    <OptimizedImage src="/assets/images/products/pluto-t/with-pump.jpg" alt="PLUTO-T - Complete System" width={800} height={600} className="main-product-image" />
                  )}
                </div>
              </div>
              <div className="product-image-thumbnails-wrapper">
                <div className="product-image-thumbnails">
                  {(['main', 'front-view', 'chamber', 'samples', 'with-pump'] as const).map((img) => (
                    <button key={img} className={`thumbnail-btn ${selectedImage === img ? 'active' : ''}`} onClick={() => setSelectedImage(img)} type="button">
                      <OptimizedImage src={`/assets/images/products/pluto-t/${img}.jpg`} alt={img.replace(/-/g, ' ')} width={150} height={112} className="thumbnail-image" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="narrative-text">
                PLUTO-T is a compact, high-performance 200W RF plasma cleaner designed for research laboratories
                that require true 13.56 MHz RF capability at an accessible price point. With 33% more RF power
                than comparable entry-level systems, PLUTO-T delivers superior plasma cleaning, surface activation,
                and polymer treatment performance — all for under $10,000.
              </p>
              <p className="narrative-text">
                The system features a stainless steel chamber (~4.3L), touchscreen-controlled fully automated operation,
                and a gas line supporting O₂, N₂, and Ar (optional second line available). An oil pump is included as standard, with an optional
                dry pump upgrade available for oil-free operation.
              </p>

              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0f4ff', borderRadius: '6px', borderLeft: '3px solid #2563eb' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#444', lineHeight: '1.6' }}>
                  <strong>Why 200W matters:</strong> Surface treatments that take 10+ min at 50W complete in 2–3 min. More power also means broader recipe flexibility for demanding substrates.
                </p>
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
            PLUTO-T is commonly installed in:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>University Cleanrooms</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Teaching and shared research facilities</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔬</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Materials Science Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Surface treatment and sample preparation</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧬</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Biomedical Research Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Polymer surface activation and bio-compatibility</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚗️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Semiconductor R&D</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Process development and substrate cleaning</p>
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
                <div className="feature-icon">⚡</div>
                <h3>200W RF Power at 13.56 MHz</h3>
                <p className="feature-highlight">33% more power than comparable entry-level RF systems</p>
                <p>Continuously adjustable 200W RF power source operating at the industry-standard 13.56 MHz frequency. Delivers superior plasma density for faster, more uniform cleaning and surface treatment compared to lower-power alternatives.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">📦</div>
                <h3>~4.3L Stainless Steel Chamber</h3>
                <p className="feature-highlight">Durable, contamination-resistant construction</p>
                <p>Stainless steel vacuum chamber providing approximately 4.3 liters of process volume. Resistant to chemical attack from process gases and easy to maintain for consistent plasma processing results.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">🖥️</div>
                <h3>Touchscreen Automated Control</h3>
                <p className="feature-highlight">Fully automated operation for reproducible results</p>
                <p>Intuitive touchscreen interface with fully automated process control. Set parameters once and achieve consistent, repeatable results across runs — critical for research documentation and publication-quality data.</p>
              </div>
            </div>
          </div>

          {/* Secondary Features */}
          <div className="features-secondary">
            <h3 className="features-subtitle">Additional Features</h3>
            <div className="features-grid features-grid-secondary">
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">💨</div>
                <h3>Flexible Gas Configuration</h3>
                <p>One gas inlet standard with optional second line, supporting O₂, N₂, and Ar for flexible process configurations. Enables a range of plasma chemistries for cleaning, activation, and treatment applications.</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">🔧</div>
                <h3>Included Oil Pump + Optional Dry Pump</h3>
                <p>Mechanical oil pump included as standard. Optional dry pump upgrade (+$2,500) available for oil-free operation in sensitive cleanroom environments.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="product-applications-section">
        <div className="container">
          <h2 className="section-title">Typical Applications</h2>
          <p className="section-intro">
            <strong>Designed for:</strong> Research laboratories and cleanroom environments requiring versatile RF plasma processing for surface preparation, cleaning, and material treatment.
          </p>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🧹</div>
              <h3>Plasma Cleaning</h3>
              <p className="application-use-case">Organic contaminant removal from substrates and components</p>
              <p>Effective removal of organic residues, photoresist remnants, and surface contaminants. 200W RF power ensures thorough cleaning with faster process times.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Surface Activation</h3>
              <p className="application-use-case">Enhance adhesion prior to bonding, coating, or deposition</p>
              <p>Improve surface energy and wettability for better adhesion in downstream processes. Essential for thin film deposition, bonding, and coating workflows.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🧬</div>
              <h3>Polymer Treatment</h3>
              <p className="application-use-case">Surface modification for improved bio-compatibility and wettability</p>
              <p>Modify polymer surfaces to enhance hydrophilicity, bio-compatibility, and adhesion characteristics without altering bulk material properties.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Sample Preparation</h3>
              <p className="application-use-case">Pre-analysis and pre-deposition substrate cleaning</p>
              <p>Prepare substrates and samples for characterization, deposition, or bonding steps. Consistent surface preparation ensures reliable experimental results.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📊</div>
              <h3>Process Development</h3>
              <p className="application-use-case">Recipe optimization and parameter studies</p>
              <p>Develop and optimize plasma process recipes with adjustable RF power, gas selection, and process timing. Touchscreen control enables systematic parameter exploration.</p>
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
              PLUTO-T occupies the sweet spot between budget desktop cleaners and premium research-grade systems,
              delivering true 13.56 MHz RF performance with touchscreen automation at a price point accessible
              to grant-funded and budget-conscious research labs.
            </p>
            <p className="positioning-note">
              For labs requiring higher power or larger chamber volume, see the <Link to="/products/pluto-m" style={{ color: '#2563eb' }}>PLUTO-M</Link> upgrade path.
            </p>
          </div>
        </div>
      </section>

      {/* Why PLUTO-T - Competitive Differentiators */}
      <section className="product-features-section product-benefits-section">
        <div className="container">
          <h2 className="section-title">Why PLUTO-T</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>vs. HY-4L ($7,999 RF)</h3>
              <p>33% more RF power (200W vs 150W) with stainless steel chamber construction. The +$2,000 premium is justified by significantly better RF performance and a durable, contamination-resistant chamber.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>True Research-Grade RF</h3>
              <p>200W at 13.56 MHz with stainless steel chamber and touchscreen automation. Not a desktop cleaner with manual dials — a research-grade instrument designed for reproducible, documented plasma processing.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Accessible RF Performance</h3>
              <p>Under $10,000 makes PLUTO-T one of the most cost-effective true 13.56 MHz RF plasma cleaners available, suitable for grant-funded labs and institutional procurement.</p>
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
                  <td className="spec-label">Model</td>
                  <td className="spec-value">PLUTO-T</td>
                </tr>
                <tr>
                  <td className="spec-label">System Dimensions (W×H×D)</td>
                  <td className="spec-value">380 × 500 × 490 mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Dimensions</td>
                  <td className="spec-value">φ150 mm × 245 mm depth</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Volume</td>
                  <td className="spec-value">~4.3 L</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Material</td>
                  <td className="spec-value">Stainless steel</td>
                </tr>
                <tr>
                  <td className="spec-label">Electrode Size</td>
                  <td className="spec-value">95 × 170 mm, multi-control adaptive flat plate electrode</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Power</td>
                  <td className="spec-value">0–200W continuously adjustable, 1W precision</td>
                </tr>
                <tr>
                  <td className="spec-label">Frequency</td>
                  <td className="spec-value">13.56 MHz, auto-impedance matching</td>
                </tr>
                <tr>
                  <td className="spec-label">Vacuum Gauge</td>
                  <td className="spec-value">Thermocouple vacuum gauge, 0–100 KPa</td>
                </tr>
                <tr>
                  <td className="spec-label">Gas Lines</td>
                  <td className="spec-value">1 line standard, optional 2nd line (O₂, N₂, Ar supported)</td>
                </tr>
                <tr>
                  <td className="spec-label">Vacuum System</td>
                  <td className="spec-value">Mechanical pump (oil pump included; dry pump optional +$2,500)</td>
                </tr>
                <tr>
                  <td className="spec-label">Control</td>
                  <td className="spec-value">4.3″ Touchscreen, fully automated</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Supply</td>
                  <td className="spec-value">110 V</td>
                </tr>
                <tr>
                  <td className="spec-label">Manufacturer</td>
                  <td className="spec-value">Shanghai Peiyuan Instrument Equipment Co., Ltd.</td>
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
              <p>NineScrolls provides application-oriented system configuration tailored to your specific research needs and process requirements.</p>
            </div>
            <div className="function-card">
              <h3>Process Consultation</h3>
              <p>Expert process consultation for research environments, helping you optimize parameters and achieve desired results with PLUTO-T.</p>
            </div>
            <div className="function-card">
              <h3>Installation Guidance</h3>
              <p>Comprehensive installation guidance and training support to ensure your system is set up correctly and operating at peak performance.</p>
            </div>
            <div className="function-card">
              <h3>Warranty & Technical Support</h3>
              <p>US-based warranty service and ongoing technical support provided directly by NineScrolls LLC for all PLUTO Series systems.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Distributor Notice */}
      <section className="branding-notice-section" style={{ padding: '4rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <div className="branding-notice-wrapper" style={{ padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '12px', borderLeft: '5px solid #dee2e6' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#333', fontWeight: '600' }}>Distributor Notice</h3>
            <p style={{ margin: 0, fontSize: '1rem', color: '#666', lineHeight: '1.6' }}>
              PLUTO Series plasma systems are manufactured by Shanghai Peiyuan Instrument Equipment Co., Ltd. (上海沛沅仪器设备有限公司). NineScrolls LLC is the authorized US distributor, providing local sales, system configuration, technical support, installation guidance, and warranty service for US-based research laboratories and institutions.
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
              We specialize in connecting US research labs with high-performance plasma equipment at accessible price points. By partnering directly with established manufacturers, we deliver better specifications at lower cost than traditional distribution channels.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Direct manufacturer partnership</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>No unnecessary intermediaries</span>
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
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>US-based support included</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>Local sales, configuration, and warranty</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Lean operational structure</strong>
                  <span style={{ fontSize: '0.95rem', color: '#666' }}>Savings passed to researchers</span>
                </div>
              </li>
            </ul>
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#333' }}>Looking at other options?</h3>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#666', lineHeight: '1.8' }}>
                <li><Link to="/products/hy-4l" style={{ color: '#2563eb', textDecoration: 'none' }}>HY-4L ($7,999)</Link> — Budget-friendly 150W RF alternative</li>
                <li><Link to="/products/pluto-m" style={{ color: '#2563eb', textDecoration: 'none' }}>PLUTO-M</Link> — Upgrade path with higher power and expanded capability</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="The PLUTO-T plasma cleaner is cited in 20+ peer-reviewed publications across top-tier journals including Nature, ACS Nano, and Small Methods, enabling breakthroughs in nanofabrication, biosensors, microfluidics, and surface engineering."
        stats={[
          { value: '20', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '200', suffix: '+', label: 'Total Citations' },
          { value: '15', suffix: '+', label: 'Research Institutions' },
          { value: '4', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Advanced Optical Materials',
            tier: 'high',
            title: 'Ultraflexible photothermal superhydrophobic coating with multifunctional applications based on plasmonic TiN nanoparticles',
            authors: 'B Wang, Z Jing, M Zhao et al.',
            year: '2022',
            citations: 54,
          },
          {
            journal: 'Nature',
            tier: 'top',
            title: 'Metal 3D nanoprinting with coupled fields',
            authors: 'B Liu, S Liu, V Devaraj et al.',
            year: '2023',
            citations: 48,
          },
          {
            journal: 'Tribology International',
            tier: 'high',
            title: 'Fishbone-like micro-textured surface for unidirectional spreading of droplets and lubricity improvement',
            authors: 'H Zhang, DAI Songjie, LIU Yang et al.',
            year: '2024',
            citations: 40,
          },
          {
            journal: 'ACS Nano',
            tier: 'top',
            title: 'A calibration strategy for silicon nanowire field-effect transistor biosensors and its application in ultra-sensitive, label-free biosensing',
            authors: 'D Chen, T Xu, Y Dou, T Li',
            year: '2024',
            citations: 16,
          },
          {
            journal: 'ACS Applied Materials & Interfaces',
            tier: 'high',
            title: 'Facile transfer of a transparent silver nanowire pattern to a soft substrate using graphene oxide as a double-sided adhesion-tuning layer',
            authors: 'J Wang, Y Jin, K Wang et al.',
            year: '2023',
            citations: 15,
          },
        ]}
        journalNames={['Nature', 'ACS Nano', 'Small Methods', 'Nature Communications', 'Adv. Optical Materials', 'Lab on a Chip']}
        onRequestQuote={() => openContactForm(true)}
        ctaLabel="Request a Quote"
      />

      {/* Trust Logos Section */}
      <TrustSection />

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
                <span>Installation guidance & training support</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                <span>Engineering-backed system configuration</span>
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
            <h2>Ready to order?</h2>
            <p style={{ marginBottom: '1rem' }}>
              You don't need a finalized specification or PO to reach out.
              We often assist labs during early evaluation and proposal stages.
            </p>
            <div className="inquiry-buttons">
              <button className="btn btn-primary btn-large" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <button className="btn btn-secondary btn-large" onClick={() => openContactForm(true)}>
                Request a Budgetary Quote
              </button>
            </div>
            <div className="shipping-info" style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <p><strong>Shipping:</strong> Free shipping included. Standard delivery: 3-4 weeks after order confirmation.</p>
            </div>
          </div>
        </div>
      </section>

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="PLUTO-T"
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
