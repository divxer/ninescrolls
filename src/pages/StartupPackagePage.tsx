import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../components/common/SEO';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { QuoteModal } from '../components/common/QuoteModal';
import { DownloadGateModal } from '../components/common/DownloadGateModal';

const benefitCards = [
  { icon: 'savings', title: 'Discounted Pricing', items: ['Special rates for new PIs within the first 2 years of appointment'] },
  { icon: 'build', title: 'Extended Warranty & Training', items: ['2–3 years warranty plus free installation and training'] },
  { icon: 'redeem', title: 'Complimentary Accessories', items: ['Bundle options like a Spin Coater or UV-Ozone Cleaner'] },
  { icon: 'bolt', title: 'Fast Delivery & Setup', items: ['Prioritized scheduling for startup labs to get you running quickly'] },
];

const productCards = [
  { icon: 'precision_manufacturing', title: 'ICP-RIE / RIE', desc: 'High-uniformity plasma etching systems for advanced microfabrication.', link: '/products/icp-etcher' },
  { icon: 'layers', title: 'Low-Temperature PECVD / ALD', desc: 'Conformal thin film deposition for sensitive substrates and research.', link: '/products/pecvd' },
  { icon: 'rotate_right', title: 'Spin Coater', desc: 'Reliable resist coating with developer modules and accessories.', link: '/products/coater-developer' },
];

export function StartupPackagePage() {
  useScrollToTop();

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <>
      <SEO
        title="NineScrolls Startup Package – Supporting New Labs from Day One"
        description="Special discounts, standard warranty included, and complimentary accessories for new faculty establishing their labs. ICP-RIE/RIE, PECVD/ALD."
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
                "isPartOf": { "@type": "WebSite", "name": "NineScrolls LLC", "url": "https://ninescrolls.com" }
              },
              {
                "@type": "Service",
                "name": "Startup Package for New Faculty Labs",
                "serviceType": "Laboratory equipment discount and onboarding program",
                "provider": { "@type": "Organization", "name": "NineScrolls LLC", "url": "https://ninescrolls.com" },
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
                "description": "Special discounts, standard warranty, and complimentary accessories on ICP-RIE/RIE etching systems, low-temperature PECVD/ALD systems, and spin coaters for new faculty labs."
              }
            ]
          })}
        </script>
      </Helmet>

      <main>
        {/* Hero */}
        <section className="relative min-h-[600px] flex items-center bg-surface-container-low">
          <div className="container mx-auto px-8 py-20">
            <div className="max-w-3xl">
              <span className="inline-block px-4 py-1 bg-tertiary text-white rounded-full text-xs font-bold mb-6">STARTUP PACKAGE 2025</span>
              <h1 className="text-6xl font-headline font-bold mb-8">Supporting New Labs from Day One</h1>
              <p className="text-xl text-on-surface-variant leading-relaxed mb-10">Special discounts, standard warranty included, and complimentary accessories for new faculty establishing their labs.</p>
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity" onClick={() => setQuoteOpen(true)}>Request Your Startup Package Quote</button>
                <button className="px-8 py-3 border border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors" onClick={() => setGateOpen(true)}>Download Equipment Guide (PDF)</button>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose */}
        <section className="py-24 px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-headline font-bold mb-2">Why Choose the Startup Package</h2>
            <p className="text-on-surface-variant text-lg mb-12">Designed for new PIs to launch fast and confidently</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {benefitCards.map(c => (
                <div key={c.title} className="bg-surface-container p-8 rounded-xl border border-outline-variant/10">
                  <span className="material-symbols-outlined text-4xl text-primary mb-6 block">{c.icon}</span>
                  <h3 className="text-2xl font-headline font-bold mb-4">{c.title}</h3>
                  <ul className="space-y-3">
                    {c.items.map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0"></span>
                        <span className="text-on-surface-variant">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Applicable Products */}
        <section className="py-24 px-8 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-headline font-bold mb-12">Applicable Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {productCards.map(c => (
                <Link key={c.title} to={c.link} className="group bg-white p-8 rounded-xl border border-outline-variant/10 hover:border-primary transition-colors">
                  <span className="material-symbols-outlined text-4xl text-primary mb-6 block">{c.icon}</span>
                  <h3 className="text-2xl font-headline font-bold mb-4">{c.title}</h3>
                  <p className="text-on-surface-variant mb-6">{c.desc}</p>
                  <span className="inline-flex items-center gap-1 text-primary font-bold group-hover:gap-2 transition-all">
                    Explore
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trusted */}
        <section className="py-24 px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-headline font-bold mb-6">Trusted by New Faculty Labs</h2>
            <p className="text-on-surface-variant text-lg mb-10">Over 300 research institutions worldwide trust NineScrolls systems, including numerous new faculty labs.</p>
            <button className="px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity" onClick={() => setQuoteOpen(true)}>Request Your Startup Package Quote</button>
          </div>
        </section>
      </main>

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
