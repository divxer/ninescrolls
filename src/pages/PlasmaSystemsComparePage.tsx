import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Helmet } from 'react-helmet-async';
import '../styles/PlasmaSystemsComparePage.css';

export function PlasmaSystemsComparePage() {
  useScrollToTop();

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "NS-Plasma Systems Comparison",
    "itemListElement": [
      {
        "@type": "Product",
        "name": "NS-Plasma 4R",
        "url": "https://ninescrolls.com/products/ns-plasma-4r"
      },
      {
        "@type": "Product",
        "name": "NS-Plasma 20R",
        "url": "https://ninescrolls.com/products/ns-plasma-20r"
      }
    ]
  };

  return (
    <>
      <SEO
        title="Compare NS-Plasma Systems - 4R vs 20R | NineScrolls"
        description="Compare NS-Plasma 4R and 20R systems. Find the right compact RF plasma system for your research laboratory needs."
        keywords="NS-Plasma comparison, plasma system comparison, NS-Plasma 4R vs 20R, research plasma systems"
        url="/products/plasma-systems/compare"
        type="website"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <section className="compare-hero">
        <div className="container">
          <h1>Compare NS-Plasma Systems</h1>
          <p className="compare-subtitle compare-subtitle-guide">
            Start with 4R for validation. Choose 20R for core research.
          </p>
          <p className="compare-description">
            Compare NS-Plasma 4R and 20R to determine which system fits your research stage.
          </p>
        </div>
      </section>

      <section className="compare-table-section">
        <div className="container">
          <div className="compare-table-wrapper">
            <div className="compare-grid">
              {/* Header Row */}
              <div className="grid-header grid-feature">Feature</div>
              <div className="grid-header grid-product-4r">
                <div className="product-header">
                  <h3>NS-Plasma 4R</h3>
                  <p className="product-subtitle">Compact / Teaching / Validation</p>
                  <Link to="/products/ns-plasma-4r" className="product-link">
                    View Details →
                  </Link>
                </div>
              </div>
              <div className="grid-divider"></div>
              <div className="grid-header grid-product-20r">
                <div className="product-header">
                  <h3>NS-Plasma 20R</h3>
                  <p className="product-subtitle">Core Research / Batch Processing</p>
                  <Link to="/products/ns-plasma-20r" className="product-link">
                    View Details →
                  </Link>
                </div>
              </div>

              {/* Content Rows */}
              <div className="grid-cell grid-feature">Typical Use</div>
              <div className="grid-cell grid-product-4r">Teaching / Validation</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r">Core Research</div>

              <div className="grid-cell grid-feature">Batch Processing</div>
              <div className="grid-cell grid-product-4r">Designed for small-volume use</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r feature-value-highlight">
                <span className="checkmark">✔</span> Full batch capacity
              </div>

              <div className="grid-cell grid-feature">Process Repeatability</div>
              <div className="grid-cell grid-product-4r">Moderate</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r feature-value-highlight">High</div>

              <div className="grid-cell grid-feature">Automation</div>
              <div className="grid-cell grid-product-4r">Simplified for teaching & validation</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r feature-value-highlight">Full PLC</div>

              <div className="grid-cell grid-feature">Chamber Volume</div>
              <div className="grid-cell grid-product-4r">~4 L</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r">~20 L</div>

              <div className="grid-cell grid-feature">RF Power</div>
              <div className="grid-cell grid-product-4r">Adjustable (research-grade range)</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r">Up to 300 W</div>

              <div className="grid-cell grid-feature">Control System</div>
              <div className="grid-cell grid-product-4r">Manual / Semi-automatic</div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r">PLC + Touch Screen</div>

              <div className="grid-cell grid-feature">Upgrade Path</div>
              <div className="grid-cell grid-product-4r">
                <Link to="/products/ns-plasma-20r" className="upgrade-link">
                  → 20R
                </Link>
              </div>
              <div className="grid-divider"></div>
              <div className="grid-cell grid-product-20r">—</div>
            </div>
          </div>

          <div className="compare-upgrade-note">
            <p>
              Many laboratories begin with NS-Plasma 4R and upgrade to NS-Plasma 20R as their process requirements evolve.
            </p>
          </div>

          {/* Split Path CTAs - Direct Action */}
          <div className="compare-split-cta">
            <div className="split-cta-card split-cta-4r">
              <h3>Start with NS-Plasma 4R</h3>
              <p>Ideal for validation, teaching labs, and exploratory research</p>
              <Link to="/products/ns-plasma-4r" className="btn btn-primary">
                Explore NS-Plasma 4R →
              </Link>
            </div>
            <div className="split-cta-card split-cta-20r">
              <h3>Explore NS-Plasma 20R</h3>
              <p>Designed for core research requiring batch processing and reproducibility</p>
              <Link to="/products/ns-plasma-20r" className="btn btn-primary">
                Explore NS-Plasma 20R →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="compare-cta-section">
        <div className="container">
          <h2>Need help choosing?</h2>
          <p>Contact our team for personalized recommendations based on your research needs.</p>
          <div className="cta-buttons">
            <Link to="/contact" className="btn btn-secondary btn-large">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
