import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import '../styles/ProductsPage.css';

export function ProductsPage() {
  // Scroll to top when component mounts
  useScrollToTop();

  return (
    <>
      <SEO 
        title="Plasma Etching Equipment & Systems | NineScrolls - Advanced Semiconductor Manufacturing Solutions"
        description="Expert plasma etching equipment and systems for semiconductor manufacturing. Discover our wide range of plasma etching processes including reactive ion etching (RIE), inductively coupled plasma etching, and wet etching solutions. Leading provider of etch rates optimization and plasma treatment technology."
        keywords="plasma etching, plasma etching equipment, plasma etching systems, reactive ion etching, etch rates, plasma treatment, plasma etching process, plasma processing, wet etching, etching processes, semiconductor manufacturing"
        url="/products/"
      />
      <section className="products-hero">
        <div className="container">
          <h1>Plasma Etching Equipment & Systems</h1>
          <p>Advanced plasma etching equipment and systems for semiconductor manufacturing, MEMS fabrication, and research applications. Our wide range of plasma etching processes delivers optimized etch rates and superior plasma treatment capabilities.</p>
        </div>
      </section>

      <section className="manufacturer-intro">
        <div className="container">
          <div className="manufacturer-content">
            <h2>Our Trusted Manufacturer Partner</h2>
            <div className="manufacturer-info">
              <div className="manufacturer-text">
                <p>
                  We are proud to partner with Tyloong, a leading manufacturer
                  of plasma etching equipment and semiconductor processing systems with over 30 years 
                  of experience in the industry. Their expertise in plasma etching processes, 
                  reactive ion etching technology, and plasma treatment solutions aligns perfectly with our mission to 
                  provide cutting-edge plasma etching equipment for research and manufacturing applications.
                </p>
                <ul className="manufacturer-strengths">
                  <li>Industry-leading R&D capabilities</li>
                  <li>Global technical support network</li>
                  <li>Proven track record in semiconductor manufacturing</li>
                  <li>Comprehensive training and documentation</li>
                  <li>Customizable solutions for specific research needs</li>
                </ul>
              </div>
              <div className="manufacturer-stats">
                <div className="stat-item">
                  <span className="stat-number">30+</span>
                  <span className="stat-label">Years of<br />Experience</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">1000+</span>
                  <span className="stat-label">Global<br />Installations</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">300+</span>
                  <span className="stat-label">Research<br />Institutions Served</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="product-categories">
        <div className="container">
          <p className="section-intro">
            Our comprehensive range of plasma etching equipment and semiconductor processing systems is designed to meet the diverse needs of research institutions and manufacturers. From reactive ion etching (RIE) to inductively coupled plasma etching, our plasma etching processes deliver optimized etch rates and superior plasma treatment capabilities. Each system is built with precision, reliability, and innovation in mind.
          </p>
          <div className="category-grid">
            <div className="category-card">
              <Link to="/products/icp-etcher">
                <img src="/assets/images/products/icp-etcher/main.jpg" alt="ICP Etcher" />
                <h3>ICP Etcher Series - Inductively Coupled Plasma Etching</h3>
                <p>Advanced inductively coupled plasma etching system with superior process control and optimized etch rates for high-aspect-ratio etching applications.</p>
                <ul className="product-features">
                  <li>High-density plasma source</li>
                  <li>Multi-gas capability</li>
                  <li>Advanced temperature control</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/rie-etcher">
                <img src="/assets/images/products/rie-etcher/main.jpg" alt="RIE Etcher" />
                <h3>RIE Etcher Series - Reactive Ion Etching</h3>
                <p>Versatile reactive ion etching system for precise material processing with excellent plasma treatment capabilities and controlled etch rates.</p>
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

      <section className="equipment-solutions">
        <div className="container">
          <div className="solutions-content">
            <h2>Plasma Etching Equipment Solutions</h2>
            <p>
              Our plasma etching equipment solutions are tailored to meet the specific needs of research institutions and manufacturers. From reactive ion etching to inductively coupled plasma etching, we provide a wide range of plasma processing capabilities with optimized etch rates and superior plasma treatment technology.
            </p>
            <ul className="solutions-list">
              <li>Customizable plasma etching system configurations</li>
              <li>Integration with existing semiconductor manufacturing facilities</li>
              <li>Comprehensive training and support for plasma etching processes</li>
              <li>Ongoing maintenance and upgrades for plasma processing equipment</li>
            </ul>
          </div>
        </div>
      </section>

      {/* New Semantic Content Section for SEO */}
      <section className="plasma-etching-processes">
        <div className="container">
          <h2>Plasma Etching Processes & Technologies</h2>
          <div className="processes-grid">
            <div className="process-card">
              <h3>Reactive Ion Etching (RIE)</h3>
              <p>Our reactive ion etching systems combine chemical and physical etching mechanisms to achieve precise control over etch rates and profile anisotropy. Ideal for semiconductor manufacturing and MEMS fabrication applications.</p>
            </div>
            <div className="process-card">
              <h3>Inductively Coupled Plasma Etching</h3>
              <p>Advanced inductively coupled plasma etching technology delivers high-density plasma for superior etch rates and deep reactive ion etching (DRIE) capabilities. Perfect for high-aspect-ratio etching applications.</p>
            </div>
            <div className="process-card">
              <h3>Plasma Treatment Solutions</h3>
              <p>Comprehensive plasma treatment solutions for surface modification, cleaning, and activation. Our plasma processing equipment supports both wet etching and dry etching processes for maximum flexibility.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Warranty & Service Section */}
      <section className="warranty-service">
        <div className="container">
          <h2>Warranty & Service</h2>
          <p className="warranty-intro">Comprehensive service solutions designed to maximize your equipment performance and minimize downtime.</p>
          
          <div className="warranty-blocks">
            <div className="warranty-block">
              <div className="block-header" aria-labelledby="hdr-warranty">
                <span className="block-icon-wrap" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.8"
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M12 8v6M9 11h6"/>
                  </svg>
                </span>
                <h3 id="hdr-warranty">Standard Warranty</h3>
              </div>
              <div className="block-content">
                <h4>2-Year Full Warranty</h4>
                <p className="warranty-note">(Most major manufacturers only provide 1-year coverage. NineScrolls offers 2 years as standard.)</p>
                <ul className="warranty-features">
                  <li>Parts & labor coverage</li>
                  <li>Manufacturing defects</li>
                  <li>Component failures</li>
                  <li>Technical support included</li>
                </ul>
              </div>
            </div>

            <div className="warranty-block">
              <div className="block-header" aria-labelledby="hdr-pm">
                <span className="block-icon-wrap" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.8"
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2l-6 6"/>
                    <path d="M3 22l7.5-7.5"/>
                    <path d="M16 8a4 4 0 1 0-5.66-5.66L7 5.68 9.32 8l3.34-3.34"/>
                  </svg>
                </span>
                <h3 id="hdr-pm">Preventive Maintenance</h3>
              </div>
              <div className="block-content">
                <h4>One free PM service included</h4>
                <ul className="warranty-features">
                  <li>System optimization</li>
                  <li>Performance calibration</li>
                  <li>Preventive recommendations</li>
                  <li>Expert technician service</li>
                </ul>
              </div>
            </div>

            <div className="warranty-block">
              <div className="block-header" aria-labelledby="hdr-ext">
                <span className="block-icon-wrap" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.8"
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6"/>
                    <path d="M16 13H8M16 17H8M10 9H8"/>
                  </svg>
                </span>
                <h3 id="hdr-ext">Extended Options</h3>
              </div>
              <div className="block-content">
                <h4>Flexible service plans</h4>
                <ul className="warranty-features">
                  <li>Extended warranty plans</li>
                  <li>Annual Maintenance Contracts (AMC)</li>
                  <li>Custom service agreements</li>
                  <li>Priority support access</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="warranty-cta">
            <p className="cta-text">👉 Want full details? Contact us for warranty terms and AMC pricing.</p>
            <div className="cta-buttons">
              <Link to="/contact" className="btn btn-primary">Contact Service Team</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Need Equipment Consultation?</h2>
          <p>Our technical team is ready to help you choose the right equipment for your application.</p>
          <div className="contact-buttons">
            <Link to="/contact" className="btn btn-primary">Contact Our Team</Link>
            <a 
              href="/equipment-guide.pdf" 
              className="btn btn-secondary"
              download="NineScrolls-Equipment-Guide.pdf"
              style={{ 
                position: 'relative', 
                zIndex: 1000,
                pointerEvents: 'auto',
                cursor: 'pointer'
              }}
              onClick={(e) => {
                console.log('Equipment Guide clicked!', e);
                // Track download event
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'download', {
                    event_category: 'Equipment Guide',
                    event_label: 'Products Page',
                    value: 1
                  });
                }
                // Force download by creating a temporary link
                const link = document.createElement('a');
                link.href = '/equipment-guide.pdf';
                link.download = 'NineScrolls-Equipment-Guide.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                e.preventDefault();
              }}
            >
              Download Equipment Guide
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section for Featured Snippets */}
      <section className="faq-section">
        <div className="container">
          <h2>Frequently Asked Questions About Plasma Etching Equipment</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3>What is plasma etching equipment?</h3>
              <p>Plasma etching equipment uses ionized gas (plasma) to remove material from substrates with precise control. Our plasma etching systems include reactive ion etching (RIE) and inductively coupled plasma etching technologies for semiconductor manufacturing and research applications.</p>
            </div>
            <div className="faq-item">
              <h3>How do plasma etching processes work?</h3>
              <p>Plasma etching processes work by creating a plasma from process gases using RF power. The plasma contains reactive species that chemically react with the substrate material, while ions provide physical bombardment for directional etching, achieving optimized etch rates and superior material selectivity.</p>
            </div>
            <div className="faq-item">
              <h3>What are the advantages of plasma etching over wet etching?</h3>
              <p>Plasma etching offers superior anisotropy (directional control), better etch rate control, reduced chemical waste, and compatibility with photoresist masks. Our plasma treatment solutions provide both wet etching and dry etching capabilities for maximum process flexibility.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
} 