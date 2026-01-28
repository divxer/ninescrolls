import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/CartContext';

export function NSPlasma4R() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'image1' | 'image2'>('main');
  const [selectedFrequency, setSelectedFrequency] = useState<'rf' | 'mf'>('rf'); // Default to RF
  const navigate = useNavigate();
  const { addItem } = useCart();

  useScrollToTop();

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleAddToCart = () => {
    const frequencyLabel = selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)';
    const price = selectedFrequency === 'rf' ? 7999 : 6499;
    const sku = selectedFrequency === 'rf' ? 'ns-plasma-4r-rf' : 'ns-plasma-4r-mf';
    
    // Add item to cart
    addItem({
      id: sku,
      name: `NS-Plasma 4R - ${frequencyLabel} Plasma Cleaner`,
      price: price,
      quantity: 1,
      image: '/assets/images/products/ns-plasma-4r/main.jpg',
      sku: sku,
    });

    // Track add to cart event for Google Analytics and Google Merchants
    if (typeof window !== 'undefined') {
      // Google Analytics 4 e-commerce event
      if ((window as any).gtag) {
        const frequencyLabel = selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)';
        const price = selectedFrequency === 'rf' ? 7999 : 6499;
        const sku = selectedFrequency === 'rf' ? 'ns-plasma-4r-rf' : 'ns-plasma-4r-mf';
        
        (window as any).gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: price,
          items: [{
            item_id: sku,
            item_name: `NS-Plasma 4R - ${frequencyLabel} Plasma Cleaner`,
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: price,
            quantity: 1
          }]
        });
      }

      // Analytics service tracking
      const frequencyLabel = selectedFrequency === 'rf' ? 'RF (13.56 MHz)' : 'Mid-Frequency (40 kHz)';
      const price = selectedFrequency === 'rf' ? 7999 : 6499;
      const sku = selectedFrequency === 'rf' ? 'ns-plasma-4r-rf' : 'ns-plasma-4r-mf';
      analytics.trackAddToCart(sku, `NS-Plasma 4R - ${frequencyLabel} Plasma Cleaner`, price);
    }

    // Navigate to cart page
    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/ns-plasma-4r#product",
    "name": "NS-Plasma 4R - Plasma Cleaner (RF or Mid-Frequency)",
    "description": "Compact plasma system for research and sample preparation. 4L chamber volume, available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations, ideal for teaching labs and low-volume processing.",
    "image": ["https://ninescrolls.com/assets/images/products/ns-plasma-4r/main.jpg"],
    "sku": "ns-plasma-4r",
    "mpn": "NS-Plasma-4R-Standard",
    "brand": {
      "@type": "Brand",
      "name": "Nine Scrolls Technology"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "6499",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/ns-plasma-4r",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "Nine Scrolls Technology",
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
        title="NS-Plasma 4R - Plasma Cleaner (RF or Mid-Frequency) | $6,499-$7,999 USD | NineScrolls"
        description="NS-Plasma 4R Plasma Cleaner. Compact 4L chamber, available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations. In stock. Free shipping. Ships in 3–4 weeks."
        keywords="NS-Plasma 4R, RF plasma cleaner, mid-frequency plasma, plasma cleaning system, research plasma equipment, $6499, $7999"
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
            <p className="product-subtitle">Plasma Cleaner (RF or Mid-Frequency)</p>
            <div className="hero-positioning">
              <p className="hero-tagline">
                Compact plasma system for research and sample preparation applications
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
                  <span className="bullet-text-strong">~4 L Processing Chamber</span>
                  <span className="bullet-text-sub">optimized for single samples or small batches</span>
                </div>
              </div>
              <div className="hero-bullet-item hero-bullet-primary">
                <span className="bullet-icon">⚡</span>
                <div className="bullet-content">
                  <span className="bullet-text-strong">RF or Mid-Frequency Plasma</span>
                  <span className="bullet-text-sub">choose RF for process flexibility or MF for best value</span>
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
                    Cost-effective, robust for routine lab cleaning and surface activation
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#28a745', fontWeight: '700' }}>$6,499 USD • 300W</p>
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
                    Finer process control, broader recipe window for advanced surface activation
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#2563eb', fontWeight: '700' }}>$7,999 USD • 150W</p>
                </button>
              </div>
            </div>
            
            <div className="hero-pricing">
              <div className="pricing-main">
                <span className="pricing-label">Price:</span>
                <span className="pricing-amount">
                  {selectedFrequency === 'rf' ? '$7,999' : '$6,499'} USD
                </span>
              </div>
              <p className="pricing-note">Availability: In Stock • Ships in 3–4 weeks</p>
            </div>
            
            <div className="hero-cta">
              <button className="btn btn-primary btn-large" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <button className="btn btn-secondary btn-large" onClick={openContactForm}>
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
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-4r/main.jpg"
                      alt="NS-Plasma 4R - Compact RF Plasma System"
                      width={800}
                      height={600}
                      className="main-product-image"
                    />
                  )}
                  {selectedImage === 'image1' && (
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-4r/image-1.jpg"
                      alt="NS-Plasma 4R - View 1"
                      width={800}
                      height={600}
                      className="main-product-image"
                    />
                  )}
                  {selectedImage === 'image2' && (
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-4r/image-2.jpg"
                      alt="NS-Plasma 4R - View 2"
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
                      src="/assets/images/products/ns-plasma-4r/main.jpg"
                      alt="Main View"
                      width={150}
                      height={112}
                      className="thumbnail-image"
                    />
                  </button>
                  <button
                    className={`thumbnail-btn ${selectedImage === 'image1' ? 'active' : ''}`}
                    onClick={() => setSelectedImage('image1')}
                    type="button"
                    aria-label="View 1"
                  >
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-4r/image-1.jpg"
                      alt="View 1"
                      width={150}
                      height={112}
                      className="thumbnail-image"
                    />
                  </button>
                  <button
                    className={`thumbnail-btn ${selectedImage === 'image2' ? 'active' : ''}`}
                    onClick={() => setSelectedImage('image2')}
                    type="button"
                    aria-label="View 2"
                  >
                    <OptimizedImage
                      src="/assets/images/products/ns-plasma-4r/image-2.jpg"
                      alt="View 2"
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
                NS-Plasma 4R is a compact plasma system designed for small-batch plasma cleaning, surface activation, 
                and exploratory research applications where process flexibility and minimal footprint are preferred over high throughput.
              </p>
              <p className="narrative-text">
                Positioned below full batch plasma platforms, NS-Plasma 4R provides a practical entry point for laboratories 
                that require RF or Mid-Frequency plasma capability without the complexity or space requirements of larger systems.
              </p>
              
              <div className="comparison-block">
                <h3>Compared to:</h3>
                <div className="comparison-items">
                  <div className="comparison-item">
                    <div className="comparison-label">Desktop plasma cleaners</div>
                    <div className="comparison-arrow">→</div>
                    <div className="comparison-value">RF or Mid-Frequency plasma technology</div>
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

      {/* Who Uses This - Use Case Block */}
      <section className="product-use-cases-section" style={{ padding: '3rem 0', backgroundColor: '#fff' }}>
        <div className="container">
          <h2 className="section-title">Who Uses This</h2>
          <p className="section-intro" style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
            NS-Plasma 4R is commonly installed in:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>University Cleanrooms</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Teaching labs and research facilities</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔬</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Materials Science Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Surface treatment and activation</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Failure Analysis Labs</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Sample preparation workflows</p>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚗️</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Pilot-Scale R&D Lines</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Early-stage process development</p>
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
              <h3>RF or Mid-Frequency Plasma Capability</h3>
              <p>Available in RF (13.56 MHz, 150W) or Mid-Frequency (40 kHz, 300W) configurations. Adjustable power suitable for gentle plasma processes and stable generation for research and educational use.</p>
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
              <p>Standard single or dual gas configuration, compatible with common process gases for versatile lab integration.</p>
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
              <p>Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations. RF option provides standard frequency for academic compatibility, matching larger research systems.</p>
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
                  <td className="spec-value">RF Plasma / Mid-Frequency Plasma</td>
                </tr>
                <tr>
                  <td className="spec-label">Plasma Frequency</td>
                  <td className="spec-value">13.56 MHz (RF) / 40 kHz (Mid-Frequency)</td>
                </tr>
                <tr>
                  <td className="spec-label">Power Output</td>
                  <td className="spec-value">150W (RF) / 300W (Mid-Frequency)</td>
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
                  <td className="spec-value">Standard single / dual gas</td>
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
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', fontSize: '0.9rem', color: '#666', lineHeight: '1.6' }}>
            <p style={{ margin: 0 }}>
              <strong>Frequency Selection Guide:</strong> Mid-Frequency (40 kHz) is ideal for cost-sensitive research labs and routine cleaning applications. 
              RF (13.56 MHz) supports more advanced surface activation recipes and offers finer process control.
            </p>
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
              <h3>Additional Options</h3>
              <p>Additional options and accessories are available to enhance system capabilities for specific research or teaching requirements.</p>
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
              We understand that many research projects operate under tight budgets. Our systems are designed to deliver essential performance without unnecessary industrial features, making them a practical and cost-efficient choice for university and research laboratories.
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
            <h2>Ready to order?</h2>
            <p style={{ marginBottom: '1rem' }}>
              You don't need a finalized specification or PO to reach out. 
              We often assist labs during early evaluation and proposal stages.
            </p>
            <div className="inquiry-buttons">
              <button className="btn btn-primary btn-large" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <button className="btn btn-secondary btn-large" onClick={openContactForm}>
                Request a Budgetary Quote
              </button>
            </div>
            <div className="shipping-info" style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <p><strong>Shipping:</strong> Free shipping included. Standard delivery: 3–4 weeks after order confirmation.</p>
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
