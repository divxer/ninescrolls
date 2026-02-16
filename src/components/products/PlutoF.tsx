import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function PlutoF() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'with-pump' | 'chamber-open' | 'chamber-interior'>('main');
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

  const handleDownloadBrochure = () => {
    const a = document.createElement('a');
    a.href = '/docs/pluto-f-datasheet.pdf';
    a.download = 'NineScrolls-PLUTO-F-Datasheet.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleAddToCart = () => {
    addItem({
      id: 'pluto-f',
      name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
      price: 15999,
      quantity: 1,
      image: '/assets/images/products/pluto-f/main.jpg',
      sku: 'pluto-f',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 15999,
          items: [{
            item_id: 'pluto-f',
            item_name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 15999,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('pluto-f', 'PLUTO-F - 500W RF Flagship Plasma Cleaner', 15999);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pluto-f#product",
    "name": "PLUTO-F — 500W RF Flagship Plasma Cleaner",
    "description": "The most powerful RF plasma cleaner under $20K. 500W continuously adjustable at 13.56 MHz, ~14.5L 6061-T6 aluminum alloy chamber, touchscreen control with advanced recipe management. Designed for university core facilities, advanced materials labs, and semiconductor process development.",
    "image": ["https://ninescrolls.com/assets/images/products/pluto-f/main.jpg"],
    "sku": "pluto-f",
    "mpn": "PLUTO-F",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "15999",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pluto-f",
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
        title="PLUTO-F | 500W RF Flagship Plasma Cleaner | 14.5L Chamber | $15,999"
        description="The most powerful RF plasma cleaner under $20K. 500W continuously adjustable at 13.56 MHz with ~14.5L 6061-T6 aluminum alloy chamber. Designed for core facilities, advanced materials research, and semiconductor process development. Touchscreen control, advanced recipe management."
        keywords="PLUTO-F, 500W RF Plasma Cleaner, Flagship Plasma Cleaner, 14.5L Chamber, Harrick Alternative, Surface Activation, Batch Processing, Research Lab, 13.56MHz plasma, Advanced Recipe Management"
        url="/products/pluto-f"
        image="/assets/images/products/pluto-f/main.jpg"
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
            { name: 'PLUTO-F', path: '/products/pluto-f' }
          ]} />
          <div className="product-header-enhanced">
            <h1>PLUTO-F</h1>
            <p className="product-subtitle">500W RF Flagship Plasma Cleaner</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                The most powerful RF plasma cleaner under $20K | 14.5L large-capacity chamber
              </p>
              <p className="hero-subtitle-emphasis">
                US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
              </p>
            </div>

            {/* Flagship Positioning Hero Card */}
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
                500W RF. 14.5L aluminum alloy chamber. Under $16K.
              </h3>
              <p style={{
                margin: 0,
                fontSize: '0.95rem',
                color: '#EAEAEA',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                When your research requires aggressive surface activation, large-batch plasma cleaning, or complex
                multi-step recipes — you need real RF power, not a desktop cleaner. PLUTO-F delivers industrial-level
                capability at a research-lab price point.
              </p>
            </div>

            <div className="hero-bullets">
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">500W RF (13.56 MHz)</span>
                  <span className="bullet-text-sub">continuously adjustable, highest in its class under $20K</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">📦</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">~14.5L Aluminum Alloy Chamber</span>
                  <span className="bullet-text-sub">process wafers, devices, and components in batch</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">🖥️</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Touchscreen + Recipe Management</span>
                  <span className="bullet-text-sub">multi-step sequences, reproducible across users</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">💰</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">Under $16,000</span>
                  <span className="bullet-text-sub">industrial-level RF power at research-lab pricing</span>
                </div>
              </div>
            </div>

            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">US Price:</span>
                <span className="pricing-amount">$15,999 USD</span>
              </div>
              <p className="pricing-note">Availability: In Stock · Ships in 3–4 weeks</p>
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

      {/* System Overview */}
      <section className="product-overview product-overview-narrative">
        <div className="container">
          <div className="product-hero-layout">
            <div className="product-hero-image product-image-single">
              <div className="product-image-main-wrapper">
                <div className="product-image-main">
                  {selectedImage === 'main' && (
                    <OptimizedImage src="/assets/images/products/pluto-f/main.jpg" alt="PLUTO-F - 500W RF Flagship Plasma Cleaner" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'with-pump' && (
                    <OptimizedImage src="/assets/images/products/pluto-f/with-pump.jpg" alt="PLUTO-F - System with Pump" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'chamber-open' && (
                    <OptimizedImage src="/assets/images/products/pluto-f/chamber-open.jpg" alt="PLUTO-F - Chamber Open" width={800} height={600} className="main-product-image" />
                  )}
                  {selectedImage === 'chamber-interior' && (
                    <OptimizedImage src="/assets/images/products/pluto-f/chamber-interior.jpg" alt="PLUTO-F - Chamber Interior with Wafers" width={800} height={600} className="main-product-image" />
                  )}
                </div>
              </div>
              <div className="product-image-thumbnails-wrapper">
                <div className="product-image-thumbnails">
                  {(['main', 'with-pump', 'chamber-open', 'chamber-interior'] as const).map((img) => (
                    <button key={img} className={`thumbnail-btn ${selectedImage === img ? 'active' : ''}`} onClick={() => setSelectedImage(img)} type="button">
                      <OptimizedImage src={`/assets/images/products/pluto-f/${img}.jpg`} alt={img.replace(/-/g, ' ')} width={150} height={112} className="thumbnail-image" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="product-hero-content">
              <h2>System Overview</h2>
              <p className="narrative-text">
                PLUTO-F is NineScrolls' flagship RF plasma cleaner, delivering an unmatched combination of 500W RF power
                and 14.5-liter chamber capacity at under $16,000. No other system in this price range comes close to
                this RF power level.
              </p>
              <p className="narrative-text">
                For labs that have outgrown entry-level desktop cleaners or need capabilities beyond what compact
                systems can deliver — aggressive ashing, deep surface activation, large-batch processing — PLUTO-F
                provides the RF power and chamber volume to handle it, with touchscreen recipe management for
                reproducible, documented results across users and sessions.
              </p>
              <p className="narrative-text">
                The system features continuously adjustable 13.56 MHz RF power, 2 gas lines supporting O₂, N₂, and Ar,
                and advanced recipe management via a touchscreen interface. A mechanical vacuum pump is included, with an
                optional dry pump upgrade available.
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
                    Learn how research-grade plasma cleaners compare across power, chamber size, and price →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What 500W RF Enables */}
      <section style={{ padding: '4rem 0', backgroundColor: '#f8f9fa' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>What 500W RF Power Enables</h2>
          <p style={{ textAlign: 'center', marginBottom: '2.5rem', color: '#666', fontSize: '1.05rem' }}>
            Higher RF power isn't just a bigger number — it unlocks processes that lower-power systems cannot perform.
          </p>
          <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px', borderTop: '3px solid #2563eb' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>Faster process cycles</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>Surface activation that takes 10–15 minutes at 50W completes in 1–2 minutes at 500W. For high-throughput labs, this means dramatically higher daily sample capacity.</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px', borderTop: '3px solid #2563eb' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>Deeper surface modification</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>Aggressive ashing, deep activation, and stubborn contaminant removal require sustained high-power plasma density that low-power sources cannot generate — regardless of treatment time.</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px', borderTop: '3px solid #2563eb' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>Uniform large-batch processing</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>A 14.5L chamber needs significantly more RF power to maintain uniform plasma density across the entire volume. 500W ensures consistent treatment from center to edge, batch after batch.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses This */}
      <section className="product-use-cases-section" style={{ padding: '3rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2 className="section-title">Who Uses This</h2>
          <p className="section-intro" style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
            PLUTO-F is designed for labs that need maximum RF power and large-batch capability:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏛️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>University Core Facilities</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Shared-use labs needing high throughput</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔬</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Advanced Materials Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>High-power surface treatment & modification</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💻</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Semiconductor Process Dev</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Plasma cleaning & activation at scale</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏥</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Biomedical Device Mfg</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Large-batch surface activation</p>
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
                <h3>500W RF Power at 13.56 MHz</h3>
                <p className="feature-highlight">Highest RF power available in any benchtop plasma cleaner under $20K</p>
                <p>Continuously adjustable 500W RF power at 13.56 MHz. Enables aggressive cleaning, deep surface activation, and complex multi-step recipes. The power headroom to handle demanding processes — not just routine cleaning.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">📦</div>
                <h3>~14.5L Aluminum Alloy Chamber</h3>
                <p className="feature-highlight">Large-capacity batch processing for multi-sample workflows</p>
                <p>6061-T6 aluminum alloy chamber with ~14.5 liters of processing volume. Supports large-batch processing of multiple substrates, components, or devices simultaneously — essential for core facilities and production-scale R&D workflows.</p>
              </div>
              <div className="feature-card feature-card-primary feature-card-top">
                <div className="feature-icon">🖥️</div>
                <h3>Touchscreen Control with Recipe Management</h3>
                <p className="feature-highlight">Fully automated operation with advanced recipe storage</p>
                <p>Touchscreen interface with advanced recipe management enables multi-step process sequences, parameter storage, and reproducible operation across users and sessions — critical for research documentation and multi-user core facilities.</p>
              </div>
            </div>
          </div>

          {/* Secondary Features */}
          <div className="features-secondary">
            <h3 className="features-subtitle">Additional Features</h3>
            <div className="features-grid features-grid-secondary">
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">💨</div>
                <h3>2 Gas Lines (O₂, N₂, Ar)</h3>
                <p>Multi-gas capability supporting O₂, N₂, Ar, and mixed-gas processes. More flexible than single-gas systems, enabling a wider range of surface treatment chemistries and process optimization.</p>
              </div>
              <div className="feature-card feature-card-secondary">
                <div className="feature-icon">🔧</div>
                <h3>Vacuum System with Dry Pump Option</h3>
                <p>Mechanical oil pump included as standard. Optional dry pump upgrade (+$2,500) for oil-free operation in cleanroom or sensitive research environments.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="product-applications-section">
        <div className="container">
          <h2 className="section-title">Typical Applications</h2>
          <p className="section-intro">
            <strong>Commonly used for:</strong> High-power plasma processing in university core facilities, advanced materials labs, semiconductor process development, and biomedical device manufacturing.
          </p>
          <div className="applications-grid">
            <div className="application-card">
              <div className="application-icon">🧹</div>
              <h3>High-Power Plasma Cleaning</h3>
              <p className="application-use-case">Aggressive contaminant removal at 500W</p>
              <p>Remove stubborn organic residues, photoresist, and surface contaminants with 500W of RF power. High power density means faster cycle times and more thorough cleaning — even on difficult substrates.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">⚡</div>
              <h3>Advanced Surface Activation</h3>
              <p className="application-use-case">Deep activation for demanding bonding & coating</p>
              <p>Achieve deep surface activation and energy modification for advanced bonding, thin film deposition, and coating processes. 500W enables activation levels and contact angle changes that lower-power systems cannot reach.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📦</div>
              <h3>Large-Batch Processing</h3>
              <p className="application-use-case">Process multiple substrates in a single run</p>
              <p>14.5L chamber supports batch processing of multiple wafers, devices, or components simultaneously — essential for core facilities and production-scale research workflows.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">📊</div>
              <h3>Complex Recipe Management</h3>
              <p className="application-use-case">Multi-step automated process sequences</p>
              <p>Advanced recipe management enables complex multi-step plasma sequences with precise parameter control. Store, recall, and share recipes across users and sessions.</p>
            </div>
            <div className="application-card">
              <div className="application-icon">🔬</div>
              <h3>Industrial-Grade Research Processing</h3>
              <p className="application-use-case">Research-grade pricing with industrial-level RF power</p>
              <p>Industrial-level RF power in a benchtop form factor at research-grade pricing. PLUTO-F fills the gap between entry-level cleaners and full industrial platforms — ideal for labs that need more capability without the complexity and cost of production-scale systems.</p>
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
              PLUTO-F is NineScrolls' flagship RF plasma cleaner, delivering 500W of continuously adjustable RF power
              with a 14.5-liter aluminum alloy chamber at under $16,000. Designed for university core facilities,
              advanced materials labs, and semiconductor process development teams that need high-power plasma
              processing with reproducible, recipe-managed workflows.
            </p>
            <p className="positioning-note">
              For labs needing a mid-tier option, see <Link to="/products/pluto-m" style={{ color: '#2563eb' }}>PLUTO-M</Link> ($12,999, 200W, ~8L).
              For a budget RF alternative, see <Link to="/products/hy-20lrf" style={{ color: '#2563eb' }}>HY-20LRF</Link> ($14,499, 150W, 20L).
            </p>
          </div>
        </div>
      </section>

      {/* Choose PLUTO-F If */}
      <section className="product-comparison-section">
        <div className="container">
          <h2 className="section-title">Choose PLUTO-F if you:</h2>
          <div className="comparison-choice-grid">
            <div className="choice-item">
              <div className="choice-icon">⚡</div>
              <h3>Your processes demand high RF power</h3>
              <p>Aggressive ashing, deep surface activation, stubborn contaminant removal — these require sustained high-power plasma density. 500W at 13.56 MHz gives you the headroom to handle demanding applications.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">📦</div>
              <h3>You process multiple samples per run</h3>
              <p>14.5L aluminum alloy chamber supports batch processing of wafers, devices, and components. Essential for core facilities and labs with high daily sample throughput.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">🖥️</div>
              <h3>Multiple users share your system</h3>
              <p>Touchscreen recipe management ensures every user runs the same documented process. Store, recall, and lock recipes — critical for shared facilities and publication-quality reproducibility.</p>
            </div>
            <div className="choice-item">
              <div className="choice-icon">💰</div>
              <h3>You need industrial capability at research pricing</h3>
              <p>PLUTO-F delivers the RF power and chamber capacity of systems costing $30K+ in a benchtop format under $16K. Designed for labs that need real processing capability without production-scale complexity.</p>
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
                  <td className="spec-value">PLUTO-F</td>
                </tr>
                <tr>
                  <td className="spec-label">System Dimensions (W×H×D)</td>
                  <td className="spec-value">405 × 610 × 670 mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Dimensions</td>
                  <td className="spec-value">240 × 300 × 200 mm</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Volume</td>
                  <td className="spec-value">~14.5 L</td>
                </tr>
                <tr>
                  <td className="spec-label">Chamber Material</td>
                  <td className="spec-value">6061-T6 Aluminum alloy</td>
                </tr>
                <tr>
                  <td className="spec-label">Electrode Size</td>
                  <td className="spec-value">205 × 205 mm, multi-control adaptive flat plate electrode</td>
                </tr>
                <tr>
                  <td className="spec-label">RF Power</td>
                  <td className="spec-value">0–500W continuously adjustable, 1W precision</td>
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
                  <td className="spec-value">2 lines, precision needle valve control (O₂, N₂, Ar supported)</td>
                </tr>
                <tr>
                  <td className="spec-label">Vacuum System</td>
                  <td className="spec-value">Mechanical pump (oil pump included; dry pump optional +$2,500)</td>
                </tr>
                <tr>
                  <td className="spec-label">Control</td>
                  <td className="spec-value">4.3″ Touchscreen, fully automated with advanced recipe management</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Supply</td>
                  <td className="spec-value">220 V, 10 A</td>
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

      {/* What's Included */}
      <section className="product-functions-section">
        <div className="container">
          <h2 className="section-title">What's Included</h2>
          <div className="functions-grid">
            <div className="function-card">
              <h3>PLUTO-F Main System</h3>
              <p>500W RF plasma source with ~14.5L 6061-T6 aluminum alloy vacuum chamber and integrated power supply.</p>
            </div>
            <div className="function-card">
              <h3>Touchscreen Control Interface</h3>
              <p>Advanced recipe management with multi-step process sequencing and parameter storage.</p>
            </div>
            <div className="function-card">
              <h3>Mechanical Vacuum Pump</h3>
              <p>Oil-sealed mechanical pump included. Optional dry pump upgrade available (+$2,500).</p>
            </div>
            <div className="function-card">
              <h3>Gas Delivery System</h3>
              <p>2 gas line configuration supporting O₂, N₂, Ar, and mixed-gas processes.</p>
            </div>
            <div className="function-card">
              <h3>User Documentation</h3>
              <p>Comprehensive user manual, recipe templates, and basic operation guidance for quick startup.</p>
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
              <h3>Dry Pump Upgrade (+$2,500)</h3>
              <p>Oil-free vacuum pumping for cleanroom environments and contamination-sensitive processes.</p>
            </div>
            <div className="function-card">
              <h3>Additional Gas Line Configuration</h3>
              <p>Expand from 2 to 3 gas lines for more complex multi-gas process development.</p>
            </div>
            <div className="function-card">
              <h3>Process Recipe Templates</h3>
              <p>Pre-configured recipes and training package for common applications (cleaning, activation, ashing).</p>
            </div>
          </div>
        </div>
      </section>

      {/* PLUTO Series Lineup */}
      <section style={{ padding: '4rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>PLUTO Series Lineup</h2>
          <p style={{ textAlign: 'center', marginBottom: '2.5rem', color: '#666', fontSize: '1.05rem' }}>
            Three tiers of RF plasma cleaning to match your lab's power and capacity needs.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <Link to="/products/pluto-t" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef', transition: 'border-color 0.2s' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#333' }}>PLUTO-T</h3>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>200W RF · ~4.3L · Touchscreen</p>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#2563eb', fontWeight: '600' }}>$9,999 USD</p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#888' }}>Compact entry-level PLUTO</p>
              </div>
            </Link>
            <Link to="/products/pluto-m" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef', transition: 'border-color 0.2s' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#333' }}>PLUTO-M</h3>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>200W RF · ~8L · Touchscreen</p>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#2563eb', fontWeight: '600' }}>$12,999 USD</p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#888' }}>Mid-size batch processing</p>
              </div>
            </Link>
            <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px', border: '2px solid #2563eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', backgroundColor: '#2563eb', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>FLAGSHIP</span>
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#333' }}>PLUTO-F</h3>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>500W RF · ~14.5L · Recipe Mgmt</p>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#2563eb', fontWeight: '600' }}>$15,999 USD</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#888' }}>Maximum power & capacity</p>
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
                Q: Who is PLUTO-F designed for?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: PLUTO-F is designed for labs that need more capability than compact desktop plasma cleaners can provide. If your work involves aggressive ashing, deep surface activation, large-batch processing, or multi-step recipe sequences — and you need reproducible, documented results across multiple users — PLUTO-F provides the RF power, chamber volume, and automation to handle it.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: Why would I choose PLUTO-F over HY-20LRF?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: PLUTO-F delivers 3.3x the RF power (500W vs 150W) for only $1,500 more ($15,999 vs $14,499). If your processes benefit from higher RF power — more aggressive cleaning, deeper surface activation, or faster processing — PLUTO-F is the clear upgrade. The advanced recipe management is also a significant advantage for multi-user labs.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: Should I upgrade to the dry pump option?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: The standard oil-sealed mechanical pump works well for most research applications. We recommend the dry pump upgrade (+$2,500) for cleanroom environments, contamination-sensitive processes, or facilities that prefer oil-free operation. Contact us to discuss which option is best for your lab.
              </p>
            </div>
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>
                Q: What gases can I use?
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', lineHeight: '1.6' }}>
                A: PLUTO-F supports O₂, N₂, Ar, and mixed-gas processes with 2 gas lines. The system is designed for flexible gas configuration to support a wide range of surface treatment applications.
              </p>
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
              PLUTO Series plasma systems are manufactured by Shanghai Peiyuan Instrument Equipment Co., Ltd., a professional plasma equipment manufacturer specializing in high-power RF plasma systems for research and industrial applications. NineScrolls LLC is the authorized US distributor, providing local sales, technical support, system configuration, and warranty service.
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
                <li>Core facilities needing high-throughput plasma processing</li>
                <li>Grant-funded labs needing maximum capability per dollar</li>
                <li>R&D centers requiring industrial-level RF power at research pricing</li>
                <li>Multi-user shared facilities needing recipe management</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

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

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        onDownloadBrochure={handleDownloadBrochure}
        productName="PLUTO-F"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
