import { Link } from 'react-router-dom';

export function ProductsPage() {
  return (
    <>
      <section className="products-hero">
        <div className="container">
          <div className="products-header">
            <h1>Our Products</h1>
            <p className="subtitle">Advanced Semiconductor Processing Equipment for Research and Manufacturing</p>
          </div>
        </div>
      </section>

      <section className="product-categories">
        <div className="container">
          <div className="category-grid">
            <div className="category-card">
              <Link to="/products/icp-etcher">
                <img src="/assets/images/products/icp-etcher/main.jpg" alt="ICP Etcher" />
                <h3>ICP Etcher Series</h3>
                <p>Advanced plasma etching system with superior process control and high etch rates.</p>
                <ul className="feature-list">
                  <li>High-density plasma source</li>
                  <li>Multi-gas capability</li>
                  <li>Advanced temperature control</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/rie-etcher">
                <img src="/assets/images/products/rie-etcher/main.jpg" alt="RIE Etcher" />
                <h3>RIE Etcher Series</h3>
                <p>Versatile reactive ion etching system for precise material processing.</p>
                <ul className="feature-list">
                  <li>Flexible process control</li>
                  <li>Multiple gas options</li>
                  <li>Compact design</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/hdp-cvd">
                <img src="/assets/images/products/hdp-cvd/main.jpg" alt="HDP-CVD System" />
                <h3>HDP-CVD System Series</h3>
                <p>High-density plasma CVD for superior film quality and gap-fill performance.</p>
                <ul className="feature-list">
                  <li>Excellent gap-fill capability</li>
                  <li>High deposition rates</li>
                  <li>Multi-zone heating</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/pecvd">
                <img src="/assets/images/products/pecvd/main.jpg" alt="PECVD System" />
                <h3>PECVD System Series</h3>
                <p>Plasma-enhanced CVD system for high-quality thin film deposition.</p>
                <ul className="feature-list">
                  <li>Low temperature processing</li>
                  <li>Multiple material options</li>
                  <li>Precise control</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/ald">
                <img src="/assets/images/products/ald/main.jpg" alt="ALD System" />
                <h3>ALD System Series</h3>
                <p>Atomic layer deposition system for precise thin film growth.</p>
                <ul className="feature-list">
                  <li>Atomic-level precision</li>
                  <li>Excellent conformality</li>
                  <li>Multiple precursor lines</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/sputter">
                <img src="/assets/images/products/sputter/main.jpg" alt="Sputter System" />
                <h3>Sputter System Series</h3>
                <p>Advanced PVD system for high-quality thin film coating.</p>
                <ul className="feature-list">
                  <li>Multiple target positions</li>
                  <li>DC/RF capability</li>
                  <li>Co-sputtering option</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/ibe-ribe">
                <img src="/assets/images/products/ibe-ribe/main.jpg" alt="IBE/RIBE System" />
                <h3>IBE/RIBE System Series</h3>
                <p>Ion beam etching system for precise material processing.</p>
                <ul className="feature-list">
                  <li>Dual mode operation</li>
                  <li>Precise angle control</li>
                  <li>Multiple gas options</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/striper">
                <img src="/assets/images/products/striper/main.jpg" alt="Striper System" />
                <h3>Striper System Series</h3>
                <p>Advanced photoresist removal and surface cleaning system.</p>
                <ul className="feature-list">
                  <li>Multiple process modes</li>
                  <li>High throughput</li>
                  <li>Process monitoring</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/coater-developer">
                <img src="/assets/images/products/coater-developer/main.jpg" alt="Coater/Developer System" />
                <h3>Coater/Developer System Series</h3>
                <p>Precision coating and developing system for photolithography.</p>
                <ul className="feature-list">
                  <li>Dual module design</li>
                  <li>Advanced dispensing</li>
                  <li>Environmental control</li>
                </ul>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="manufacturer-partner">
        <div className="container">
          <h2>Our Trusted Manufacturer Partner</h2>
          
          <div className="partner-content">
            <div className="partner-info">
              <p className="partner-description">
                We are proud to partner with Tylon, a leading manufacturer 
                of semiconductor processing equipment with over 30 years 
                of experience in the industry. Their commitment to 
                innovation and quality aligns perfectly with our mission to 
                provide cutting-edge research equipment solutions.
              </p>

              <div className="key-strengths">
                <h3>Key strengths of our manufacturer partner:</h3>
                <ul>
                  <li>✓ Industry-leading R&D capabilities</li>
                  <li>✓ Global technical support network</li>
                  <li>✓ Proven track record in semiconductor manufacturing</li>
                  <li>✓ Comprehensive training and documentation</li>
                  <li>✓ Customizable solutions for specific research needs</li>
                </ul>
              </div>
            </div>

            <div className="partner-stats">
              <div className="stat-card">
                <div className="stat-number">30+</div>
                <div className="stat-label">Years of Experience</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">1000+</div>
                <div className="stat-label">Global Installations</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">300+</div>
                <div className="stat-label">Research Institutions Served</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="products-cta">
        <div className="container">
          <div className="cta-content">
            <h2>Need Help Choosing?</h2>
            <p>Our technical team is ready to help you select the right equipment for your application.</p>
            <Link to="/contact" className="btn btn-primary">Contact Our Experts</Link>
          </div>
        </div>
      </section>
    </>
  );
} 