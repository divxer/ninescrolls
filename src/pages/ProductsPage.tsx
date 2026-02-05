import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useState, useMemo, useEffect } from 'react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { DownloadGateModal } from '../components/common/DownloadGateModal';
import { QuoteModal } from '../components/common/QuoteModal';
import type { ProductRecord } from '../types';
import { listProducts, listCategories } from '../services/catalogService';
import '../styles/ProductsPage.css';

export function ProductsPage() {
  // Scroll to top when component mounts
  useScrollToTop();
  const [selected, setSelected] = useState<string>('All');
  const [gateOpen, setGateOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [tabs, setTabs] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [loadedProducts, loadedCategories] = await Promise.all([
        listProducts(),
        listCategories(),
      ]);
      setProducts(loadedProducts);
      const categoryNames = loadedCategories.map((c) => c.name);
      const unique = Array.from(new Set(['All', ...categoryNames]));
      setTabs(unique);
      setLoading(false);
    };
    load();
  }, []);

  const schema = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Plasma Etching Systems",
    "itemListElement": products.map((product) => ({
      "@type": "Product",
      "name": product.name,
      "url": `https://ninescrolls.com/products/${product.slug}`
    }))
  }), [products]);

  return (
    <>
      <SEO 
        title="Plasma Etching & Thin-Film Systems | ICP‑RIE, RIE, PECVD & ALD | NineScrolls"
        description="Advanced plasma etching and low‑temperature thin‑film tools for labs: ICP‑RIE, RIE, PECVD, ALD. ±3% uniformity, low‑damage processes, 150–200 mm wafers."
        keywords="plasma etching systems, ICP-RIE equipment, RIE vs DRIE comparison, semiconductor plasma etching tools, RIE etcher, DRIE Bosch"
        url="/products/"
      />
      <section className="products-hero">
        <div className="container">
          <h1>Plasma Etching & Thin-Film Systems</h1>
          <p><strong>NineScrolls provides ICP‑RIE, RIE, PECVD and ALD systems</strong> for research labs, delivering low‑damage processing, ±3% uniformity, and wide temperature control for 150–200 mm wafers.</p>
          <div style={{marginTop:'16px', display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap'}}>
            <a href="#" className="btn btn-primary" onClick={(e)=>{e.preventDefault(); setQuoteOpen(true);}}>Request a Quote</a>
            <a href="#" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); setGateOpen(true); }}>Download Brochure</a>
            <Link to="/contact?topic=expert" className="btn btn-secondary">Talk to an Expert</Link>
          </div>
        </div>
      </section>

      <section className="manufacturer-intro">
        <div className="container">
          <div className="manufacturer-content">
            <h2>Our Trusted Manufacturer Partner</h2>
            <div className="manufacturer-info">
              <div className="manufacturer-text">
                <p>
                  We are proud to partner with <a href="http://en.beijingtailong.com/" target="_blank" rel="noopener noreferrer">Beijing Tailong Electronic Technology</a> (Tyloong), a leading manufacturer
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
          {/* Category Tabs */}
          <div className="product-tabs">
            {tabs.map((t) => (
              <button
                key={t}
                className={`tab-btn ${selected === t ? 'active' : ''}`}
                onClick={() => setSelected(t)}
              >{t}</button>
            ))}
          </div>
          <p className="section-intro">
            Our comprehensive range of plasma etching equipment and semiconductor processing systems is designed to meet the diverse needs of research institutions and manufacturers. From reactive ion etching (RIE) to inductively coupled plasma etching, our plasma etching processes deliver optimized etch rates and superior plasma treatment capabilities. Each system is built with precision, reliability, and innovation in mind.
          </p>
          <div className="category-grid">
            {loading && (
              <div className="category-card">
                <p>Loading products...</p>
              </div>
            )}
            {!loading && products.length === 0 && (
              <div className="category-card">
                <p>No products available at the moment.</p>
              </div>
            )}
            {!loading && products
              .filter((product) => selected === 'All' || product.category === selected)
              .map((product) => {
                const image = product.thumbnail || product.images?.[0] || '/assets/images/products/product-placeholder.jpg';
                const features = product.features?.slice(0, 3) || product.bullets?.slice(0, 3) || [];
                return (
                  <div className="category-card" key={product.slug}>
                    <Link to={`/products/${product.slug}`}>
                      <img src={image} alt={product.name} loading="lazy" decoding="async" />
                      <h3>{product.name}</h3>
                      <p>{product.shortDesc || 'Custom-configured system for research labs and cleanrooms.'}</p>
                      {features.length > 0 && (
                        <ul className="feature-list">
                          {features.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {/* Etching Processes – modular sections like ICP‑RIE / RIE / DRIE */}
      <section className="etching-processes">
        <div className="container">
          <h2>Etching Processes</h2>

          <div className="process-modules">
            <div className="process-module">
              <div className="process-text">
                <div className="process-header">
                  <span className="process-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4 12h4"/><path d="M16 12h4"/><circle cx="12" cy="12" r="5"/></svg>
                  </span>
                  <h3>ICP‑RIE — High‑Density Plasma for Advanced Etching</h3>
                </div>
                <p>
                  ICP‑RIE systems provide high‑density plasma with independent ion energy control, enabling vertical profiles and high
                  aspect‑ratio features. Ideal for compound semiconductors and hard dielectrics that require fast etch rates with excellent selectivity.
                </p>
                <ul>
                  <li><strong>Independent control</strong> of ion density and ion energy</li>
                  <li><strong>High aspect‑ratio</strong> pattern transfer</li>
                  <li><strong>Excellent uniformity</strong> on 4–8 inch wafers</li>
                </ul>
                <div className="process-cta">
                  <Link className="btn btn-cta" to="/products/icp-etcher">Explore ICP‑RIE Systems</Link>
                </div>
                <div className="process-secondary-links">
                  <Link className="text-link" to="/insights/icp-rie-technology-advanced-etching">Read: ICP‑RIE Technology</Link>
                </div>
              </div>
            </div>

            <div className="process-module">
              <div className="process-text">
                <div className="process-header">
                  <span className="process-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
                  </span>
                  <h3>RIE — Directional Plasma Etching for Research</h3>
                </div>
                <p>
                  RIE plasma etching offers anisotropic, directional profiles by combining chemical reactions with physical ion bombardment —
                  a versatile choice for materials research and general microfabrication.
                </p>
                <ul>
                  <li><strong>Ideal for development</strong> and materials exploration</li>
                  <li><strong>Diverse chemistries</strong> and multi‑gas recipes</li>
                  <li><strong>Compact footprint</strong> with robust control</li>
                </ul>
                <div className="process-cta">
                  <Link className="btn btn-cta" to="/products/rie-etcher">Explore RIE Systems</Link>
                </div>
                <div className="process-secondary-links">
                  <Link className="text-link" to="/insights/reactive-ion-etching-guide">Read: RIE Principles & Guide</Link>
                  <Link className="text-link" to="/insights/reactive-ion-etching-vs-ion-milling">RIE vs Ion Milling</Link>
                </div>
              </div>
            </div>

            <div className="process-module">
              <div className="process-text">
                <div className="process-header">
                  <span className="process-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20v-6a8 8 0 0 1 16 0v6"/><path d="M2 20h20"/></svg>
                  </span>
                  <h3>DRIE (Bosch Process) — Deep Silicon Etching for MEMS & TSV</h3>
                </div>
                <p>
                  DRIE Bosch process systems enable deep silicon etching by alternating passivation and etch steps, producing vertical trenches for MEMS,
                  TSV, and microfluidics with excellent sidewall control.
                </p>
                <ul>
                  <li><strong>High aspect‑ratio</strong> deep silicon etching</li>
                  <li><strong>Optimized scalloping</strong> and sidewall quality</li>
                  <li><strong>Stable long cycles</strong> for extended processes</li>
                </ul>
                <div className="process-cta">
                  <Link className="btn btn-cta" to="/products/rie-etcher#drie">See DRIE Configurations</Link>
                </div>
                <div className="process-secondary-links">
                  <Link className="text-link" to="/insights/deep-reactive-ion-etching-bosch-process">Read: DRIE — Bosch Process</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="applications-section">
        <div className="container">
          <h2>Applications</h2>
          <div className="applications-grid">
            <div className="app-card">
              <h3>MEMS Deep Silicon</h3>
              <p>Accelerometers, pressure sensors, micro‑mirrors. DRIE enables high aspect‑ratio silicon structures.</p>
            </div>
            <div className="app-card">
              <h3>3D IC / TSV</h3>
              <p>Through‑silicon vias and wafer‑level packaging where vertical vias with high selectivity are required.</p>
            </div>
            <div className="app-card">
              <h3>Photonics</h3>
              <p>Waveguides and gratings on Si/SiN/III–V materials using ICP‑RIE for smooth sidewalls and uniformity.</p>
            </div>
            <div className="app-card">
              <h3>Materials Research</h3>
              <p>Flexible RIE platforms for etching dielectrics, polymers, and novel materials in academic labs.</p>
            </div>
          </div>
          <div className="applications-cta">
            <Link to="/contact?topic=application" className="btn btn-primary">Discuss Your Application</Link>
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

      {/* Related reading – internal links to key plasma etching articles */}
      <section className="related-reading">
        <div className="container">
          <h2>Related Technical Articles</h2>
          <p className="section-intro">Further reading on plasma etching processes and best practices.</p>
          <ul>
            <li>
              <Link to="/insights/plasma-etching">Plasma Etching Fundamentals</Link>
              <span> – overview of processes, terminology, and etch rate control.</span>
            </li>
            <li>
              <Link to="/insights/plasma-cleaning-precision-surface-preparation">Plasma Cleaning for Precision Surface Preparation</Link>
              <span> – how plasma cleaning improves adhesion and device performance.</span>
            </li>
            <li>
              <Link to="/insights/plasma-etching-explained-fundamentals-applications">Plasma Etching Explained: Fundamentals & Applications</Link>
              <span> – practical tips applicable to RIE and ICP processes.</span>
            </li>
          </ul>
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
                <h4>Standard Warranty Included</h4>
                <p className="warranty-note">(Most major manufacturers only provide 1-year coverage. NineScrolls includes 2 years standard warranty with equipment purchase.)</p>
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
                <h4>Optional Service Contracts</h4>
                <ul className="warranty-features">
                  <li>Optional service contracts (billed annually)</li>
                  <li>Annual Maintenance Contracts (AMC) - billed annually</li>
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
            <a href="#" className="btn btn-primary" onClick={(e)=>{e.preventDefault(); setQuoteOpen(true);}}>Contact Our Team</a>
            <a 
              href="#" 
              className="btn btn-secondary"
              style={{ 
                position: 'relative', 
                zIndex: 1000,
                pointerEvents: 'auto',
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.preventDefault();
                setGateOpen(true);
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

      {/* JSON‑LD Schema */}
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <DownloadGateModal 
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/NineScrolls-Equipment-Guide.pdf'}
        fileName={'NineScrolls-Equipment-Guide.pdf'}
        title={'Download Equipment Guide'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />

      <QuoteModal
        isOpen={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={() => {
          setQuoteOpen(false);
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
