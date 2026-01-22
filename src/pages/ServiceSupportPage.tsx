import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { Link } from 'react-router-dom';
import '../styles/ServiceSupportPage.css';

export function ServiceSupportPage() {
  useScrollToTop();

  return (
    <>
      <SEO 
        title="Warranty & Service Support | NineScrolls - Comprehensive Equipment Maintenance"
        description="Comprehensive warranty and service support for semiconductor equipment. Standard warranty included with purchase, preventive maintenance, and optional annual service contracts. Expert technical support and cost-effective solutions."
        keywords="warranty, service support, equipment maintenance, AMC, preventive maintenance, technical support, semiconductor equipment"
        url="/service-support"
      />
      
      <section className="service-hero">
        <div className="container">
          <h1>Warranty & Service Support</h1>
          <p>Comprehensive service solutions designed to maximize your equipment performance and minimize downtime</p>
        </div>
      </section>

      {/* Warranty Overview */}
      <section className="warranty-overview">
        <div className="container">
          <h2>Standard Warranty Coverage</h2>
          <p className="warranty-intro">Comprehensive warranty and service solutions designed to maximize your equipment performance and minimize downtime.</p>
          
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
                <h4>Standard Warranty Included</h4>
                <p className="warranty-note">(Most major manufacturers only provide 1-year coverage. NineScrolls includes 2 years standard warranty with equipment purchase. This is bundled with the sale, not a separately sold extended warranty product.)</p>
                <ul className="warranty-features">
                  <li>Parts and labor coverage</li>
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
                <h4>Optional Service Contracts</h4>
                <ul className="warranty-features">
                  <li>Optional service contracts (billed annually, not prepaid)</li>
                  <li>Annual Maintenance Contracts (AMC) - billed annually</li>
                  <li>Custom service agreements</li>
                  <li>Priority support access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Comparison */}
      <section className="comparison-section">
        <div className="container">
          <h2>Warranty Coverage – Quick Compare</h2>
          <p className="comparison-intro">Most major manufacturers provide only 1-year standard coverage. NineScrolls includes 2 years standard warranty with equipment purchase.</p>
          <div className="comparison-table">
            <table role="table" aria-label="Warranty Coverage Comparison">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Major Manufacturers</th>
                  <th scope="col">NineScrolls</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Standard Warranty</strong></td>
                  <td>1 year (parts & labor)</td>
                  <td className="highlight">
                    <span className="check-mark" aria-label="Advantage">✔</span>
                    <span className="advantage-text">2 years standard warranty included (parts & labor)</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Preventive Maintenance</strong></td>
                  <td>Paid option</td>
                  <td className="highlight">
                    <span className="check-mark" aria-label="Advantage">✔</span>
                    <span className="advantage-text">1 free PM visit</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Response Time</strong></td>
                  <td>5-10 business days</td>
                  <td className="highlight">
                    <span className="check-mark" aria-label="Advantage">✔</span>
                    <span className="advantage-text">2-3 business days</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Service Cost</strong></td>
                  <td>Premium rates</td>
                  <td className="highlight">
                    <span className="check-mark" aria-label="Advantage">✔</span>
                    <span className="advantage-text">Competitive pricing</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Technical Support</strong></td>
                  <td>Limited hours</td>
                  <td className="highlight">
                    <span className="check-mark" aria-label="Advantage">✔</span>
                    <span className="advantage-text">Extended availability</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Custom Solutions</strong></td>
                  <td>Standard only</td>
                  <td className="highlight">
                    <span className="check-mark" aria-label="Advantage">✔</span>
                    <span className="advantage-text">Tailored to your needs</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          

          <div className="comparison-cta">
            <Link to="/contact?topic=compare" className="btn btn-primary">Get Detailed Comparison</Link>
          </div>
        </div>
      </section>

      {/* TCO Analysis */}
      <section className="tco-section">
        <div className="container">
          <h2>Total Cost of Ownership (5-Year)</h2>
          <p className="tco-intro">A realistic view of where budgets go helps optimize long-term planning and uptime.</p>
          <div className="tco-content">
            <div className="tco-chart">
              <div className="donut-container">
                <svg className="donut-chart" viewBox="0 0 200 200" role="img" aria-label="TCO donut chart">
                  {/* Background track */}
                  <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="28" />
                  
                  {/* Equipment Purchase - 40% */}
                  <circle 
                    cx="100" cy="100" r="78" 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="28" 
                    strokeDasharray="196 293.6" 
                    strokeDashoffset="0" 
                    className="donut-segment"
                    data-percent="40"
                  />
                  
                  {/* Maintenance & Service - 25% */}
                  <circle 
                    cx="100" cy="100" r="78" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="28" 
                    strokeDasharray="122.4 367.2" 
                    strokeDashoffset="-196" 
                    className="donut-segment"
                    data-percent="25"
                  />
                  
                  {/* Operating Costs - 25% */}
                  <circle 
                    cx="100" cy="100" r="78" 
                    fill="none" 
                    stroke="#06b6d4" 
                    strokeWidth="28" 
                    strokeDasharray="122.4 367.2" 
                    strokeDashoffset="-318.4" 
                    className="donut-segment"
                    data-percent="25"
                  />
                  
                  {/* Downtime Impact - 10% */}
                  <circle 
                    cx="100" cy="100" r="78" 
                    fill="none" 
                    stroke="#f59e0b" 
                    strokeWidth="28" 
                    strokeDasharray="48.96 440.64" 
                    strokeDashoffset="-440.8" 
                    className="donut-segment"
                    data-percent="10"
                  />
                </svg>
                <div className="donut-center">
                  <div className="donut-center-content">
                    <div className="donut-label">5-Year TCO</div>
                    <div className="donut-value">100%</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="tco-legend">
              <div className="legend-item">
                <span className="legend-color" style={{backgroundColor: '#3b82f6'}}></span>
                <span className="legend-text">Equipment Purchase – 40%</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{backgroundColor: '#10b981'}}></span>
                <span className="legend-text">Maintenance & Service – 25%</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{backgroundColor: '#06b6d4'}}></span>
                <span className="legend-text">Operating Costs – 25%</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{backgroundColor: '#f59e0b'}}></span>
                <span className="legend-text">Downtime Impact – 10%</span>
              </div>
              <div className="tco-cta">
                <Link to="/contact?topic=tco" className="btn btn-primary">Request a TCO Report</Link>
                <Link to="/contact?topic=expert" className="btn btn-secondary">Talk to an Expert</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AMC Details */}
      <section className="amc-section">
        <div className="container">
          <h2>AMC Packages</h2>
          <p className="amc-intro">Transparent service options designed for research institutions and manufacturing facilities. All service contracts are billed annually and not collected for multiple years in advance.</p>
          <div className="amc-plans">
            <div className="amc-plan">
              <div className="plan-badge">Basic AMC</div>
              <div className="plan-price">$12,000<span className="price-unit"> / year (billed annually)</span></div>
              <ul className="plan-features">
                <li><span className="feature-check">✓</span>2 preventive maintenance visits</li>
                <li><span className="feature-check">✓</span>Priority technical support</li>
                <li><span className="feature-check">✓</span>Parts discount (15%)</li>
                <li><span className="feature-check">✓</span>Remote diagnostics</li>
                <li><span className="feature-check">✓</span>Email support</li>
                <li><span className="feature-check">✓</span>Basic training</li>
              </ul>
              <Link to="/contact?topic=amc" className="plan-cta">Get AMC Pricing</Link>
            </div>
            <div className="amc-plan featured">
              <div className="popular-badge">Most Popular</div>
              <div className="plan-badge">Premium AMC</div>
              <div className="plan-price">$25,000<span className="price-unit"> / year (billed annually)</span></div>
              <ul className="plan-features">
                <li><span className="feature-check">✓</span>4 preventive maintenance visits</li>
                <li><span className="feature-check">✓</span>48-hour on-site response</li>
                <li><span className="feature-check">✓</span>Parts discount (25%)</li>
                <li><span className="feature-check">✓</span>Software updates included</li>
                <li><span className="feature-check">✓</span>24/7 phone support</li>
                <li><span className="feature-check">✓</span>Advanced training</li>
                <li><span className="feature-check">✓</span>Performance optimization</li>
                <li><span className="feature-check">✓</span>Priority parts availability</li>
              </ul>
              <Link to="/contact?topic=amc" className="plan-cta featured">Request Premium Quote</Link>
            </div>
            <div className="amc-plan">
              <div className="plan-badge">Custom AMC</div>
              <div className="plan-price">Tailored<span className="price-unit"> / quote</span></div>
              <ul className="plan-features">
                <li><span className="feature-check">✓</span>Dedicated support team</li>
                <li><span className="feature-check">✓</span>Flexible contract terms</li>
                <li><span className="feature-check">✓</span>Integration with existing systems</li>
                <li><span className="feature-check">✓</span>Optional parts coverage</li>
                <li><span className="feature-check">✓</span>Custom training programs</li>
                <li><span className="feature-check">✓</span>Multi-site support</li>
              </ul>
              <Link to="/contact?topic=amc" className="plan-cta secondary">Talk to Sales</Link>
            </div>
          </div>
          <div className="amc-cta">
            <Link to="/contact?topic=amc" className="btn btn-primary">Get AMC Pricing</Link>
            <p className="amc-note">Special discounts available for universities and research institutes — contact us for details.</p>
          </div>
        </div>
      </section>

      {/* Service Process */}
      <section className="service-process">
        <div className="container">
          <h2>Our Service Process</h2>
          <p className="process-intro">A systematic approach to ensure optimal equipment performance and minimal downtime.</p>
          <div className="process-flow">
            <div className="process-step">
              <div className="step-icon">🔍</div>
              <div className="step-content">
                <h3>Initial Assessment</h3>
                <p>Comprehensive evaluation of your equipment and requirements</p>
              </div>
              <div className="step-arrow">→</div>
            </div>
            <div className="process-step">
              <div className="step-icon">📝</div>
              <div className="step-content">
                <h3>Service Planning</h3>
                <p>Customized service plan tailored to your operational needs</p>
              </div>
              <div className="step-arrow">→</div>
            </div>
            <div className="process-step">
              <div className="step-icon">⚙️</div>
              <div className="step-content">
                <h3>Implementation</h3>
                <p>Professional installation and configuration of service solutions</p>
              </div>
              <div className="step-arrow">→</div>
            </div>
            <div className="process-step">
              <div className="step-icon">🔄</div>
              <div className="step-content">
                <h3>Ongoing Support</h3>
                <p>Continuous monitoring and proactive maintenance services</p>
              </div>
            </div>
          </div>
          <div className="process-cta">
            <Link to="/contact?topic=service" className="btn btn-primary">Start Service Planning</Link>
            <a
              href="/docs/NineScrolls_Service_Process_Guide.pdf"
              className="btn btn-secondary"
              download="NineScrolls_Service_Process_Guide.pdf"
            >
              Download Process Guide
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="service-cta-section">
        <div className="container">
          <h2>Ready to Optimize Your Equipment Performance?</h2>
          <p>Contact our service team to discuss your specific needs and get a customized quote</p>
          <div className="cta-buttons">
            <Link to="/contact?topic=service" className="btn btn-primary">Request Service Quote</Link>
          </div>
        </div>
      </section>
    </>
  );
}
