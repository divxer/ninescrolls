import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { QuoteModal } from '../components/common/QuoteModal';
import { DownloadGateModal } from '../components/common/DownloadGateModal';
import '../styles/ProductsPage.css';
import '../styles/AboutPage.css';

export function StartupPackagePage() {
  useScrollToTop();

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <>
      <SEO
        title="NineScrolls Startup Package – Supporting New Labs from Day One"
        description="Special discounts, extended warranty, and complimentary accessories for new faculty establishing their labs. ICP-RIE/RIE, PECVD/ALD."
        keywords="startup lab package, startup package etching, startup package PECVD, startup package ALD, startup package ICP-RIE, startup package RIE, new faculty startup package, new PI equipment package, university lab startup package, semiconductor lab startup, cleanroom equipment startup, plasma etching startup, MEMS lab startup, photonics lab startup"
        url="/startup-package"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://ninescrolls.com/startup-package",
                "url": "https://ninescrolls.com/startup-package",
                "name": "NineScrolls Startup Package – Supporting New Labs from Day One",
                "description": "Special discounts, extended warranty, and complimentary accessories for new faculty establishing their labs. ICP-RIE/RIE, PECVD/ALD.",
                "isPartOf": { "@type": "WebSite", "name": "NineScrolls Technology", "url": "https://ninescrolls.com" }
              },
              {
                "@type": "Service",
                "name": "Startup Package for New Faculty Labs",
                "serviceType": "Laboratory equipment discount and onboarding program",
                "provider": { "@type": "Organization", "name": "NineScrolls Technology", "url": "https://ninescrolls.com" },
                "areaServed": ["US", "EU", "APAC"],
                "audience": {
                  "@type": "Audience",
                  "audienceType": ["New Faculty (PI)", "Academic Research Labs", "University Cleanroom Facilities"]
                },
                "offers": {
                  "@type": "Offer",
                  "availability": "https://schema.org/InStock",
                  "eligibleCustomerType": "New customers (new faculty)"
                },
                "hasOfferCatalog": {
                  "@type": "OfferCatalog",
                  "name": "Applicable Products",
                  "itemListElement": [
                    { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "ICP-RIE / RIE Etching Systems" } },
                    { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Low-temperature PECVD / ALD Systems" } },
                    { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Spin Coater" } }
                  ]
                }
              }
            ]
          })}
        </script>
      </Helmet>

      <section className="hero">
        <div className="container">
          <h1>NineScrolls Startup Package – Supporting New Labs from Day One</h1>
          <p>Special discounts, extended warranty, and complimentary accessories for new faculty establishing their labs.</p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={() => setQuoteOpen(true)}>Request Your Startup Package Quote</button>
            <button className="btn btn-secondary" onClick={() => setGateOpen(true)}>Download Equipment Guide (PDF)</button>
          </div>
        </div>
      </section>

      <section className="products">
        <div className="container">
          <h2>Why Choose the Startup Package</h2>
          <p className="section-subtitle">Designed for new PIs to launch fast and confidently</p>
          <div className="tech-grid">
            <div className="tech-card"><span className="tech-icon">💰</span><h3>Discounted Pricing</h3><p>Special rates for new PIs within the first 2 years of appointment.</p></div>
            <div className="tech-card"><span className="tech-icon">🛠</span><h3>Extended Warranty & Training</h3><p>2–3 years warranty plus free installation and training.</p></div>
            <div className="tech-card"><span className="tech-icon">🎁</span><h3>Complimentary Accessories</h3><p>Bundle options like a Spin Coater or UV‑Ozone Cleaner.</p></div>
            <div className="tech-card"><span className="tech-icon">⚡</span><h3>Fast Delivery & Setup</h3><p>Prioritized scheduling for startup labs to get you running quickly.</p></div>
          </div>
        </div>
      </section>

      <section className="technologies">
        <div className="container">
          <h2>Applicable Products</h2>
          <div className="product-showcase">
            <Link to="/products/icp-etcher" className="product-card">
              <div className="product-card-content">
                <h3>ICP-RIE / RIE</h3>
                <p>High-uniformity plasma etching systems for advanced microfabrication.</p>
                <span className="learn-more">Explore →</span>
              </div>
            </Link>
            <Link to="/products/pecvd" className="product-card">
              <div className="product-card-content">
                <h3>Low-Temperature PECVD / ALD</h3>
                <p>Conformal thin film deposition for sensitive substrates and research.</p>
                <span className="learn-more">Explore →</span>
              </div>
            </Link>
            <Link to="/products/coater-developer" className="product-card">
              <div className="product-card-content">
                <h3>Spin Coater</h3>
                <p>Reliable resist coating with developer modules and accessories.</p>
                <span className="learn-more">Explore →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="partners">
        <div className="container">
          <h2>Trusted by New Faculty Labs</h2>
          <p>Over 300 research institutions worldwide trust NineScrolls systems, including numerous new faculty labs.</p>
          <div className="text-center" style={{ marginTop: '12px' }}>
            <button className="btn btn-primary" onClick={() => setQuoteOpen(true)}>Request Your Startup Package Quote</button>
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
        isOpen={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={() => {
          setQuoteOpen(false);
          const a = document.createElement('a');
          a.href = '/NineScrolls-Equipment-Guide.pdf';
          a.download = 'NineScrolls-Equipment-Guide.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
        downloadLabel="Download Equipment Guide"
      />
    </>
  );
}

export default StartupPackagePage;


