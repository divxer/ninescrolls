import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';
import { OptimizedImage } from '../components/common/OptimizedImage';
import '../styles/PlasmaSystemsPage.css';

export function PlasmaCleanerOverviewPage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "Plasma Cleaners - HY & PLUTO Series",
    "description": "RF plasma cleaners for research laboratories. HY Series (慧仪智控) and PLUTO Series (沛沅仪器) available through NineScrolls LLC.",
    "itemListElement": [
      {
        "@type": "Product",
        "name": "HY-4L",
        "url": "https://ninescrolls.com/products/hy-4l",
        "description": "Compact RF/MF plasma cleaner for teaching and validation (~4L chamber)"
      },
      {
        "@type": "Product",
        "name": "PLUTO-T",
        "url": "https://ninescrolls.com/products/pluto-t",
        "description": "200W RF plasma cleaner with ~4.3L stainless steel chamber"
      },
      {
        "@type": "Product",
        "name": "HY-20L",
        "url": "https://ninescrolls.com/products/hy-20l",
        "description": "Research-grade batch plasma processing system with 20L chamber"
      },
      {
        "@type": "Product",
        "name": "PLUTO-M",
        "url": "https://ninescrolls.com/products/pluto-m",
        "description": "200W RF plasma cleaner with ~8L stainless steel chamber"
      },
      {
        "@type": "Product",
        "name": "HY-20LRF",
        "url": "https://ninescrolls.com/products/hy-20lrf",
        "description": "Integrated RF vacuum plasma cleaner with 20L batch chamber"
      },
      {
        "@type": "Product",
        "name": "PLUTO-F",
        "url": "https://ninescrolls.com/products/pluto-f",
        "description": "500W RF flagship plasma cleaner with ~14.5L stainless steel chamber"
      }
    ]
  };

  return (
    <>
      <SEO
        title="Plasma Cleaners - HY & PLUTO Series | NineScrolls"
        description="RF plasma cleaners for research laboratories. HY Series and PLUTO Series — from compact teaching systems to 500W flagship cleaners. US-based sales, support, and warranty."
        keywords="plasma cleaner, RF plasma, research plasma system, HY-4L, HY-20L, PLUTO-T, PLUTO-M, PLUTO-F, batch plasma processing, surface activation"
        url="/products/plasma-cleaner"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <section className="plasma-systems-hero">
        <div className="container">
          <h1>Plasma Cleaners</h1>
          <p className="hero-subtitle">
            HY Series & PLUTO Series — RF Plasma Systems for Research Labs
          </p>
          <p className="hero-description">
            From compact teaching systems to 500W flagship cleaners. Six models covering every research plasma cleaning need, from $6,499 to $15,999.
          </p>
        </div>
      </section>

      <section className="plasma-systems-grid">
        <div className="container">
          <div className="systems-grid">
            {/* HY-4L */}
            <div className="system-card system-card-entry">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/ns-plasma-4r/main.jpg"
                  alt="HY-4L - Compact RF/MF Plasma Cleaner"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-entry">Entry Level</div>
                <h2>HY-4L</h2>
                <p className="system-tagline">Compact / Teaching / Validation</p>
                <p className="system-description">
                  Practical entry point for laboratories requiring RF or Mid-Frequency plasma capability.
                  Designed for exploratory plasma processing, small-volume sample preparation, and teaching.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>~4 L Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>RF or Mid-Frequency</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🔬</span>
                    <span>Simple Operation</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">Starting at</span>
                  <span className="price-amount">$6,499</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/hy-4l" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* PLUTO-T */}
            <div className="system-card system-card-entry">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/pluto-t/main.jpg"
                  alt="PLUTO-T - 200W RF Plasma Cleaner"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-entry">RF Compact</div>
                <h2>PLUTO-T</h2>
                <p className="system-tagline">200W RF / Touchscreen / Under $10K</p>
                <p className="system-description">
                  High-performance 200W RF plasma cleaner with touchscreen control at an accessible price point.
                  33% more RF power than comparable entry-level systems.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>~4.3 L Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>200W RF (13.56 MHz)</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🖥️</span>
                    <span>Touchscreen</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">US Price</span>
                  <span className="price-amount">$9,999</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/pluto-t" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* HY-20L */}
            <div className="system-card system-card-core">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/ns-plasma-20r/main.jpg"
                  alt="HY-20L - Research-Grade Batch Plasma Processing System"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-core">Batch Processing</div>
                <h2>HY-20L</h2>
                <p className="system-tagline">Core Research / 20L Batch Chamber</p>
                <p className="system-description">
                  Research-grade batch plasma processing with 20-liter chamber and full PLC control.
                  Available in RF (13.56 MHz) or Mid-Frequency (40 kHz) configurations.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>20 L Batch Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>Up to 300W</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🖥️</span>
                    <span>Full PLC Control</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">Starting at</span>
                  <span className="price-amount">$11,999</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/hy-20l" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* PLUTO-M */}
            <div className="system-card system-card-core">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/pluto-m/main.jpg"
                  alt="PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-core">RF Mid-Size</div>
                <h2>PLUTO-M</h2>
                <p className="system-tagline">200W RF / 8L Chamber / Batch Capable</p>
                <p className="system-description">
                  Optimal balance of RF precision and batch capability. 8-liter chamber with 200W RF power
                  for efficient multi-sample processing without sacrificing performance.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>~8 L Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>200W RF (13.56 MHz)</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🖥️</span>
                    <span>Recipe Storage</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">US Price</span>
                  <span className="price-amount">$12,999</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/pluto-m" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* HY-20LRF */}
            <div className="system-card system-card-core">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/ns-plasma-20r-i/main.jpg"
                  alt="HY-20LRF - Integrated RF Vacuum Plasma Cleaner"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-core">Integrated RF</div>
                <h2>HY-20LRF</h2>
                <p className="system-tagline">20L Integrated / 300W RF / PLC + Touchscreen</p>
                <p className="system-description">
                  Integrated RF vacuum plasma cleaner with 20-liter batch chamber and 300W RF power.
                  Higher throughput for labs needing repeatable plasma surface treatment.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>20 L Batch Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>300W RF (13.56 MHz)</span>
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
                  <Link to="/products/hy-20lrf" className="btn btn-primary">
                    View Details
                  </Link>
                </div>
              </div>
            </div>

            {/* PLUTO-F */}
            <div className="system-card system-card-core">
              <div className="system-image">
                <OptimizedImage
                  src="/assets/images/products/pluto-f/main.jpg"
                  alt="PLUTO-F - 500W RF Flagship Plasma Cleaner"
                  width={600}
                  height={400}
                  className="system-card-image"
                />
              </div>
              <div className="system-content">
                <div className="system-badge system-badge-core">RF Flagship</div>
                <h2>PLUTO-F</h2>
                <p className="system-tagline">500W RF / 14.5L Chamber / Advanced Recipes</p>
                <p className="system-description">
                  NineScrolls' most powerful RF plasma cleaner. 500W RF with 14.5-liter chamber and advanced recipe management.
                  11x the RF power of comparable desktop systems at a fraction of the price.
                </p>
                <div className="system-highlights">
                  <div className="highlight-item">
                    <span className="highlight-icon">📦</span>
                    <span>~14.5 L Chamber</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">⚡</span>
                    <span>500W RF (13.56 MHz)</span>
                  </div>
                  <div className="highlight-item">
                    <span className="highlight-icon">🖥️</span>
                    <span>Advanced Recipes</span>
                  </div>
                </div>
                <div className="system-pricing">
                  <span className="price-label">US Price</span>
                  <span className="price-amount">$15,999</span>
                </div>
                <div className="system-cta">
                  <Link to="/products/pluto-f" className="btn btn-primary">
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
          <Link to="/products/plasma-cleaner/compare" className="btn btn-secondary btn-large">
            Compare Models
          </Link>
        </div>
      </section>
    </>
  );
}
