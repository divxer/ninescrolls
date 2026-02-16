import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';
import { AcademicCitations } from '../common/AcademicCitations';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function PlutoM() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'with-pump' | 'chamber-open'>('main');
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
      id: 'pluto-m',
      name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
      price: 12999,
      quantity: 1,
      image: '/assets/images/products/pluto-m/main.jpg',
      sku: 'pluto-m',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 12999,
          items: [{
            item_id: 'pluto-m',
            item_name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 12999,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('pluto-m', 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber', 12999);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pluto-m#product",
    "name": "PLUTO-M - 200W RF Plasma Cleaner with 8L Mid-Capacity Chamber",
    "description": "200W RF plasma cleaner (13.56 MHz) with ~8L stainless steel chamber. Batch capability meets RF precision. Touchscreen control with recipe storage. Ideal for university research labs, MEMS fabrication, and multi-sample preparation.",
    "image": ["https://ninescrolls.com/assets/images/products/pluto-m/main.jpg"],
    "sku": "pluto-m",
    "mpn": "PLUTO-M",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "12999",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pluto-m",
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
        title="PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber | NineScrolls"
        description="200W RF plasma cleaner (13.56 MHz) with ~8L stainless steel chamber. Batch capability meets RF precision. Touchscreen control with recipe storage. Best value in mid-range RF plasma. $12,999 USD."
        keywords="PLUTO-M, RF plasma cleaner, 200W plasma, 8L chamber, batch plasma cleaning, surface activation, 13.56 MHz, research plasma system"
        url="/products/pluto-m"
        image="/assets/images/products/pluto-m/main.jpg"
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
            { name: 'PLUTO-M', path: '/products/pluto-m' }
          ]} />
          <div className="product-header-enhanced">
            <h1>PLUTO-M</h1>
            <p className="product-subtitle">200W RF Plasma Cleaner with 8L Mid-Capacity Chamber</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Batch capability meets RF precision | Best value in mid-range RF plasma
              </p>
              <p className="hero-subtitle-emphasis">
                US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
              </p>
            </div>

            {/* Positioning Hero Card */}
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
                The optimal RF plasma cleaner for batch processing
              </h3>
              <p style={{
                margin: 0,
                fontSize: '0.95rem',
                color: '#EAEAEA',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                PLUTO-M is the optimal choice for laboratories that need both RF precision and batch processing capability.
                With an 8-liter chamber (2x the capacity of PLUTO-T) and 200W RF power, PLUTO-M enables efficient multi-sample
                processing without sacrificing RF performance.
              </p>
            </div>
            <div className="hero-bullets">
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">200W RF (13.56 MHz)</span>
                  <span className="bullet-text-sub">continuously adjustable, research-grade precision</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">📦</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">~8L Stainless Steel Chamber</span>
                  <span className="bullet-text-sub">2x capacity vs PLUTO-T for batch processing</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🖥️</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Touchscreen Control with Recipe Storage</span>
                  <span className="bullet-text-sub">fully automated operation for reproducible results</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">💰</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">$1,500 Less Than HY-20LRF</span>
                  <span className="bullet-text-sub">with superior 200W RF power (vs 150W)</span>
                </div>
              </div>
            </div>

            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">price:</span>
                <span className="pricing-amount">12,999 USD</span>
              </div>
              <p className="pricing-note">availability: in stock</p>
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
                    <OptimizedImage src="/assets/images/products/pluto-m/main.jpg" alt="PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'with-pump' && (
                    <OptimizedImage src="/assets/images/products/pluto-m/with-pump.jpg" alt="PLUTO-M - System with Pump" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'chamber-open' && (
                    <OptimizedImage src="/assets/images/products/pluto-m/chamber-open.jpg" alt="PLUTO-M - Chamber Interior" width={800} height={600} className="main-product-image" />
                  )}
                </div>
              </div>
              <div className="product-image-thumbnails-wrapper">
                <div className="product-image-thumbnails">
                  {(['main', 'with-pump', 'chamber-open'] as const).map((img) => (
                    <button key={img} className={`thumbnail-btn ${selectedImage === img ? 'active' : ''}`} onClick={() => setSelectedImage(img)} type="button">
                      <OptimizedImage src={`/assets/images/products/pluto-m/${img}.jpg`} alt={img.replace(/-/g, ' ')} width={150} height={112} className="thumbnail-image" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="narrative-text">
                PLUTO-M is a 200W RF plasma cleaner with an ~8-liter stainless steel chamber, designed for laboratories
                that need both RF precision and batch processing capability. It delivers the same 200W / 13.56 MHz RF power
                as the compact PLUTO-T, but with double the chamber volume for efficient multi-sample processing.
              </p>
              <p className="narrative-text">
                With touchscreen control, recipe storage, and a fully automated vacuum cycle, PLUTO-M bridges the gap
                between compact desktop RF cleaners and larger industrial systems—offering research-grade RF performance
                at a price point significantly below comparable Western-brand alternatives.
              </p>

              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0f4ff', borderRadius: '6px', borderLeft: '3px solid #2563eb' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#444', lineHeight: '1.6' }}>
                  <Link
                    to="/insights/plasma-cleaner-comparison-research-labs"
                    style={{
                      color: '#2563eb',
                      textDecoration: 'none',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Learn how research-grade RF plasma cleaners compare across price and performance tiers →
                  </Link>
                </p>
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0f4ff', borderRadius: '6px', borderLeft: '3px solid #2563eb' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#444', lineHeight: '1.6' }}>
                  <strong>Why PLUTO-M:</strong> 2x the chamber of PLUTO-T for batch processing, 33% more RF power than HY-20LRF at $1,500 less. The sweet spot between compact and industrial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses This */}
      <section className="product-use-cases-section" style={{ padding: '3rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2 className="section-title">Who Uses This</h2>
          <p className="section-intro" style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
            PLUTO-M is commonly installed in:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>University Research Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Multi-sample RF plasma processing</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔬</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Materials Characterization Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Surface analysis sample preparation</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>MEMS / Micro Fabrication</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Surface activation and photoresist ashing</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏛️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Multi-user Core Facilities</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Shared-use batch processing workflows</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="product-features-section">
        <div className="container">
          <h2 className="section-title">Key Features</h2>

          {/* Primary Features */}
          <div className="features-primary">
            <h3 className="features-subtitle">Core Capabilities</h3>
            <div className="features-grid features-grid-primary">
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">⚡</div>
                <h3>200W RF Power (13.56 MHz)</h3>
                <p className="feature-highlight">Continuously adjustable, research-grade RF precision</p>
                <p>True RF plasma at 13.56 MHz with 200W continuously adjustable power. Delivers finer process control and broader recipe windows than mid-frequency alternatives, essential for advanced surface activation and selective etching applications.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">📦</div>
                <h3>~8L Stainless Steel Chamber</h3>
                <p className="feature-highlight">2x capacity vs PLUTO-T for batch processing</p>
                <p>Mid-capacity stainless steel chamber enables efficient multi-sample processing. Large enough for batch workflows while maintaining uniform plasma distribution across the chamber volume.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">🖥️</div>
                <h3>Touchscreen Control with Recipe Storage</h3>
                <p className="feature-highlight">Fully automated operation for reproducible results</p>
                <p>Intuitive touchscreen interface with built-in recipe storage. Save, recall, and execute process recipes for consistent results across runs—critical for multi-user facilities and documented research workflows.</p>
              </div>
            </div>
          </div>

          {/* Secondary Features */}
          <div className="features-secondary">
            <h3 className="features-subtitle">Additional Features</h3>
            <div className="features-grid features-grid-secondary">
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">💨</div>
                <h3>Mechanical Vacuum System</h3>
                <p>Oil pump included as standard; dry pump available as an option (+$2,500) for oil-free operation in sensitive environments. Optimized for plasma processing pressures with reliable pump-down performance.</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">🔧</div>
                <h3>Multi-Gas Configuration</h3>
                <p>2 gas lines supporting O₂, N₂, and Ar. Flexible gas mixing enables a wide range of plasma chemistries for cleaning, activation, and etching applications.</p>
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
            <strong>Commonly used for:</strong> Batch plasma cleaning, surface activation, polymer treatment, photoresist ashing, and multi-sample preparation in research and development environments.
          </p>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🧹</div>
              <h3>Batch Plasma Cleaning</h3>
              <p className="application-use-case">Multi-sample organic contaminant removal in a single run</p>
              <p>Efficient removal of organic residues from multiple substrates simultaneously. The 8L chamber enables batch workflows that improve lab throughput without compromising RF cleaning quality.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Surface Activation</h3>
              <p className="application-use-case">Improve adhesion prior to bonding, coating, or deposition</p>
              <p>RF plasma activation enhances surface energy for improved wettability and adhesion. Commonly used before PDMS bonding, thin film deposition, and coating applications.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Polymer / Plastics Treatment</h3>
              <p className="application-use-case">Surface modification for biocompatibility and adhesion</p>
              <p>Modify surface properties of polymers and plastics without affecting bulk material characteristics. Widely used in biomedical device research and materials science studies.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔥</div>
              <h3>Photoresist Ashing</h3>
              <p className="application-use-case">Complete PR removal with uniform RF processing</p>
              <p>Precise photoresist removal using oxygen-based RF plasma. Uniform processing across the chamber volume ensures consistent ashing results across batch samples.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📊</div>
              <h3>Multi-sample Preparation</h3>
              <p className="application-use-case">Efficient batch preparation for characterization workflows</p>
              <p>Prepare multiple samples simultaneously for XPS, SEM, TEM, and other characterization techniques. Recipe storage ensures repeatable preparation protocols.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Positioning Block */}
      <section className="product-positioning-section">
        <div className="container">
          <div className="positioning-statement positioning-block-strategic">
            <h2 className="positioning-title">System Positioning</h2>
            <p className="positioning-lead">
              PLUTO-M is the optimal choice for laboratories that need both RF precision and batch processing capability.
              With an 8-liter chamber (2x the capacity of PLUTO-T) and the same 200W RF power, PLUTO-M enables efficient
              multi-sample processing without sacrificing RF performance.
            </p>
            <p className="positioning-note">
              Clear upgrade path: <Link to="/products/pluto-t" style={{ color: '#2563eb' }}>PLUTO-T</Link> (compact, $9,999) → <strong>PLUTO-M</strong> (mid-capacity, $12,999) → <Link to="/products/pluto-f" style={{ color: '#2563eb' }}>PLUTO-F</Link> (flagship, $15,999)
            </p>
          </div>
        </div>
      </section>

      {/* Competitive Comparison */}
      <section className="product-comparison-section">
        <div className="container">
          <h2 className="section-title">Choose PLUTO-M if you:</h2>
          <div className="comparison-choice-grid">
            <div className="choice-item">
              <div className="choice-icon">📦</div>
              <h3>Need RF precision with batch capability</h3>
              <p>8L chamber handles multiple samples per run while maintaining the RF plasma quality needed for advanced surface treatment and activation applications.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">💰</div>
              <h3>Want the best value in mid-range RF plasma</h3>
              <p>$1,500 less than HY-20LRF with 33% more RF power (200W vs 150W). Stainless steel construction and touchscreen recipe management deliver research-grade reproducibility for multi-user labs.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">📈</div>
              <h3>Are upgrading from a compact plasma cleaner</h3>
              <p>Clear upgrade path from PLUTO-T: same 200W RF power with 2x chamber volume for $3,000 more. Scales naturally as your lab's batch processing needs grow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why PLUTO-M */}
      <section className="product-features-section product-benefits-section">
        <div className="container">
          <h2 className="section-title">Why PLUTO-M</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Superior RF Power</h3>
              <p>200W at 13.56 MHz delivers true research-grade RF performance with the power headroom for demanding surface activation, polymer treatment, and multi-step process development. More power means faster cycle times and broader recipe flexibility.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Right-Sized for Batch</h3>
              <p>~8L chamber provides 2x the capacity of PLUTO-T without the footprint of a 20L system. Ideal for labs that process 3–10 samples per run and need efficient batch throughput.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Exceptional Value</h3>
              <p>At $12,999, PLUTO-M delivers 200W of true 13.56 MHz RF power with an 8L stainless steel batch chamber and touchscreen recipe management. Research-grade performance without production-scale pricing.</p>
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
                  <td className="spec-label">Plasma Type</td>
                  <td className="spec-value">RF Plasma</td>
                </tr>
                <tr>
                  <td className="spec-label">Plasma Frequency</td>
                  <td className="spec-value">13.56 MHz</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Output</td>
                  <td className="spec-value">200W, continuously adjustable</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Volume</td>
                  <td className="spec-value">~8 L</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Material</td>
                  <td className="spec-value">Stainless steel</td>
                </tr>
                <tr>
                  <td className="spec-label">Gas Lines</td>
                  <td className="spec-value">2 lines (O₂, N₂, Ar supported)</td>
                </tr>
                <tr>
                  <td className="spec-label">Vacuum System</td>
                  <td className="spec-value">Mechanical pump (oil pump included; dry pump optional +$2,500)</td>
                </tr>
                <tr>
                  <td className="spec-label">Control System</td>
                  <td className="spec-value">Touchscreen, fully automated with recipe storage</td>
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
              <p>Expert process consultation for research environments, helping you optimize parameters and achieve desired results.</p>
            </div>
            <div className="function-card">
              <h3>Documentation & Support</h3>
              <p>Comprehensive documentation and long-term technical support to ensure your system operates at peak performance.</p>
            </div>
            <div className="function-card">
              <h3>Custom Configurations</h3>
              <p>Custom configurations and upgrade options are available upon request, including dry pump upgrade and additional gas line configurations.</p>
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
              PLUTO Series plasma systems are manufactured by Shanghai Peiyuan Instrument Equipment Co., Ltd., a specialized plasma equipment manufacturer. NineScrolls LLC is the authorized US distributor, providing local sales, technical support, system configuration, and warranty service.
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

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="The PLUTO-M plasma cleaner is cited in peer-reviewed publications across top-tier journals including Science, Advanced Materials, and ACS Applied Materials, supporting research in 2D materials, photodetectors, nano-antibiotics, and surface engineering."
        stats={[
          { value: '6', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '85', suffix: '+', label: 'Total Citations' },
          { value: '5', suffix: '+', label: 'Research Institutions' },
          { value: '4', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Science',
            tier: 'top',
            title: 'Transformable nano-antibiotics for mechanotherapy and immune activation against drug-resistant Gram-negative bacteria',
            authors: 'RS Li, J Liu, C Wen, Y Shi et al.',
            year: '2023',
            citations: 37,
          },
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'An Ultrasensitive and Broad-Spectrum MoS₂ Photodetector with Extrinsic Response Using Surrounding Homojunction',
            authors: 'X Liu, J Zhu, Y Shan, C Liu et al.',
            year: '2024',
            citations: 21,
          },
          {
            journal: 'Advanced Electronic Materials',
            tier: 'high',
            title: 'Few-layered MoS₂ Based Vertical van der Waals p-n Homojunction by Highly-efficient N₂ Plasma Implantation',
            authors: 'Y Shan, Z Yin, J Zhu, X Li et al.',
            year: '2022',
            citations: 16,
          },
          {
            journal: 'ACS Applied Materials & Interfaces',
            tier: 'high',
            title: 'Ultrafast and Highly Sensitive Dual-Channel FET Photodetector Based on a Two-Dimensional MoS₂ Homojunction',
            authors: 'Y Shan, Z Yin, Y Zhang, C Pan et al.',
            year: '2021',
            citations: 7,
          },
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Tailoring Dynamic Chains of Cross-Linked PDMS to Hinder Oil Penetration',
            authors: 'R Hao, H Jing, Q Wang, Y Han et al.',
            year: '2025',
            citations: 4,
          },
        ]}
        journalNames={['Science', 'Adv. Materials', 'Adv. Electronic Materials', 'ACS Applied Materials']}
        onRequestQuote={() => openContactForm(true)}
        ctaLabel="Request a Quote"
      />

      {/* Trust Logos Section */}
      <TrustSection />

      {/* Trust Block */}
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
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="PLUTO-M"
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
