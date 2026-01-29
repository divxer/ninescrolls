import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';
import { OptimizedImage } from '../components/common/OptimizedImage';
import '../styles/PlasmaSystemsPage.css';

export function PlasmaSystemsPage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "NS-Plasma Systems",
    "description": "Compact RF plasma processing systems for research laboratories",
    "itemListElement": [
      {
        "@type": "Product",
        "name": "NS-Plasma 4R",
        "url": "https://ninescrolls.com/products/ns-plasma-4r",
        "description": "Compact RF plasma system for teaching and validation"
      },
      {
        "@type": "Product",
        "name": "NS-Plasma 20R",
        "url": "https://ninescrolls.com/products/ns-plasma-20r",
        "description": "Research-grade RF plasma processing system with batch processing"
      },
      {
        "@type": "Product",
        "name": "NS-Plasma 20R-I (Integrated)",
        "url": "https://ninescrolls.com/products/ns-plasma-20r-i",
        "description": "Integrated RF vacuum plasma cleaner with 20L batch chamber"
      }
    ]
  };

  return (
    <>
      <SEO
        title="NS-Plasma Systems - Compact RF Plasma Processing | NineScrolls"
        description="NS-Plasma series: Compact RF plasma processing systems for research laboratories. From teaching labs to core research applications."
        keywords="NS-Plasma, plasma systems, RF plasma, research plasma, batch plasma processing"
        url="/products/plasma-systems"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <section className="plasma-systems-hero">
        <div className="container">
          <h1>NS-Plasma Systems</h1>
          <p className="hero-subtitle">
            Compact RF plasma processing systems for research laboratories
          </p>
          <p className="hero-description">
            From teaching labs to core research applications, the NS-Plasma series offers scalable solutions for plasma cleaning, surface activation, and batch processing.
          </p>
        </div>
      </section>

      <section className="plasma-systems-grid">
        <div className="container">
          <div className="systems-grid">
            {/* NS-Plasma 4R */}
            <div className="system-card system-card-entry">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/ns-plasma-4r/main.jpg"
                  alt="NS-Plasma 4R - Compact RF Plasma System"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-entry">Entry Level</div>
                <h2>NS-Plasma 4R</h2>
                <p className="system-tagline">Compact / Teaching / Validation</p>
                <p className="system-description">
                  Designed for exploratory plasma processing and small-volume sample preparation. 
                  Practical entry point for laboratories requiring 13.56 MHz RF plasma capability.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>~4 L Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>13.56 MHz RF</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🔬</span>
                    <span>Simple Operation</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">Starting at</span>
                  <span className="price-amount">$7,999</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/ns-plasma-4r" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* NS-Plasma 20R */}
            <div className="system-card system-card-core">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/ns-plasma-20r/main.jpg"
                  alt="NS-Plasma 20R - Research-Grade RF Plasma Processing System"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-core">Core Research</div>
                <h2>NS-Plasma 20R</h2>
                <p className="system-tagline">Core Research / Batch Processing</p>
                <p className="system-description">
                  Designed for research laboratories requiring batch processing and process reproducibility. 
                  Full PLC-controlled operation with 20-liter chamber capacity.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>20 L Batch Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>Up to 300 W RF</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🖥️</span>
                    <span>Full PLC Control</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">Starting at</span>
                  <span className="price-amount">$14,999</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/ns-plasma-20r" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* NS-Plasma 20R-I (Integrated) */}
            <div className="system-card system-card-core">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/ns-plasma-20r-i/main.jpg"
                  alt="NS-Plasma 20R-I (Integrated) - Research-Grade Batch Plasma Cleaning"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-core">Integrated</div>
                <h2>NS-Plasma 20R-I</h2>
                <p className="system-tagline">Integrated / Batch Processing</p>
                <p className="system-description">
                  Integrated RF vacuum plasma cleaner with 20-liter batch chamber. 
                  Higher power + larger chamber + higher throughput for labs needing repeatable plasma surface treatment.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>20 L Batch Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>300 W RF (13.56 MHz)</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🖥️</span>
                    <span>PLC + Touchscreen</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">US Price</span>
                  <span className="price-amount">$14,499</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/ns-plasma-20r-i" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="plasma-systems-compare-cta">
        <div className="container">
          <h2>Which system is right for you?</h2>
          <p>Compare features, specifications, and use cases to find the best fit for your laboratory.</p>
          <Link to="/products/plasma-systems/compare" className="btn btn-secondary btn-large">
            Compare Models
          </Link>
        </div>
      </section>
    </>
  );
}
