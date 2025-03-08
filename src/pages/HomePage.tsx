import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Advanced Semiconductor Processing Equipment</h1>
            <p className="hero-subtitle">
              Cutting-edge solutions for research and manufacturing in semiconductor and nanotechnology
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary">Explore Our Products</Link>
              <Link to="/contact" className="btn btn-secondary">Contact Us</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>Why Choose NineScrolls</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🔬</div>
              <h3>Cutting-Edge Technology</h3>
              <p>State-of-the-art equipment designed for advanced research and production</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>High Performance</h3>
              <p>Superior process control and reliability for consistent results</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛠️</div>
              <h3>Customizable Solutions</h3>
              <p>Flexible configurations to meet your specific requirements</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Expert Support</h3>
              <p>Comprehensive technical support and training</p>
            </div>
          </div>
        </div>
      </section>

      <section className="product-categories">
        <div className="container">
          <h2>Featured Equipment</h2>
          <div className="category-grid">
            <div className="category-card">
              <Link to="/products/icp-etcher">
                <h3>ICP Etcher Series</h3>
                <p>Advanced plasma etching systems with superior process control</p>
              </Link>
            </div>
            <div className="category-card">
              <Link to="/products/hdp-cvd">
                <h3>HDP-CVD Systems</h3>
                <p>High-density plasma chemical vapor deposition for superior film quality</p>
              </Link>
            </div>
            <div className="category-card">
              <Link to="/products/ald">
                <h3>ALD Systems</h3>
                <p>Atomic layer deposition for precise thin film growth</p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="applications">
        <div className="container">
          <h2>Applications</h2>
          <div className="application-grid">
            <div className="application-card">
              <h3>Semiconductor Processing</h3>
              <ul>
                <li>Advanced Node Development</li>
                <li>Power Devices</li>
                <li>MEMS/NEMS</li>
              </ul>
            </div>
            <div className="application-card">
              <h3>Research & Development</h3>
              <ul>
                <li>Materials Research</li>
                <li>Device Development</li>
                <li>Process Innovation</li>
              </ul>
            </div>
            <div className="application-card">
              <h3>Specialty Manufacturing</h3>
              <ul>
                <li>Optical Devices</li>
                <li>Sensors</li>
                <li>Advanced Packaging</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Advance Your Research?</h2>
            <p>Contact us to discuss your equipment needs and discover how we can help achieve your goals.</p>
            <Link to="/contact" className="btn btn-primary">Get in Touch</Link>
          </div>
        </div>
      </section>
    </>
  );
} 