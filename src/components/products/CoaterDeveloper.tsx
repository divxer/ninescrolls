import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { SEO } from '../common/SEO';
import { cdnUrl } from '../../config/imageConfig';

export function CoaterDeveloper() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Scroll to top when component mounts
  useScrollToTop();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = (quote = false) => {
    setIsQuoteIntent(quote);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/coater-developer#product",
    "name": "Coater/Developer System Series",
    "description": "High-precision photoresist coating and developing system with modular configuration.",
    "image": ["https://ninescrolls.com/assets/images/products/coater-developer/main.jpg"],
    "sku": "coater-developer",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/coater-developer",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": "NineScrolls LLC", "url": "https://ninescrolls.com" },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "US"
        },
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "USD"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "businessDays": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
          },
          "cutoffTime": "14:00",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 21,
            "maxValue": 28,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 7,
            "maxValue": 14,
            "unitCode": "DAY"
          }
        }
      }
    }
  };

  return (
    <>
      <SEO
        title="Spin Coater & Developer System - Photoresist Coating Equipment"
        description="Precision spin coater and developer systems with <0.5% coating uniformity. Modular hotplate, EBR options. 2&quot;–12&quot; wafers and square substrates."
        keywords="spin coater, photoresist coater, wafer developer, coating system, lithography equipment, resist coating, spin coating"
        url="/products/coater-developer"
        image={cdnUrl('/assets/images/products/coater-developer/main.jpg')}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Hero */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/products/product-detail-bg.jpg')} alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Coater/Developer System Series', path: '/products/coater-developer' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">Coater/Developer System Series</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Advanced Photoresist Coating and Developing System</p>
            <p className="text-base text-white/80 tracking-wide">
              US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
            </p>

            <div className="mt-8 p-6 bg-black/60 backdrop-blur-sm rounded-lg max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white/90 mb-3 text-center">
                Cost-efficient, research-grade configurations
              </h3>
              <p className="text-[0.95rem] text-white/90 leading-relaxed text-center">
                We specialize in cost-efficient configurations for research labs that need to balance performance and budget.
                We help labs avoid paying for unnecessary industrial features and focus on what matters for research applications.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                onClick={() => openContactForm(true)}
              >
                Request a Quote
              </button>
              <a
                href="#"
                className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors no-underline"
                onClick={(e) => { e.preventDefault(); setGateOpen(true); }}
              >
                Download Datasheet
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Product Overview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="min-w-0">
              <img
                src={cdnUrl('/assets/images/products/coater-developer/main.jpg')}
                alt="Coater/Developer System"
                className="w-full rounded-xl shadow-lg"
              />
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">Product Description</h2>
              <p className="text-on-surface-variant leading-relaxed mb-6">The Coater/Developer Series provides high-precision photoresist coating and developing capabilities within a compact uni-body design (footprint approx. 1.0m x 0.8m). Engineered for advanced lithography applications, it offers exceptional flexibility, customizable module configurations, and precise automated process control, ensuring uniform and reproducible results.</p>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Key Features</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Compact uni-body design (footprint 1.0m x 0.8m)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Flexible configuration with customizable numbers of Coater, Developer, and Hotplate modules
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Advanced dispensing systems with configurable dispense arms (up to 2 photoresist lines and 2 developer lines plus DI water)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  High-speed spin modules with precise spin profile programming (Coater up to 8000 rpm ±1 rpm; Developer up to 5000 rpm ±1 rpm)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Precise temperature control with configurable Hotplate modules (up to 200°C standard; higher temperatures optional)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Cost-performance customization (dispense systems, pumps, valves, etc.)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Automated open-load sample handling
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Automated safety interlocks (vacuum pressure, lid interlocks, etc.)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Edge bead removal (EBR) capability (optional)
                </li>
              </ul>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">palette</span>
                  Photoresist Coating (positive/negative resists, electron-beam resists)
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">science</span>
                  HMDS Priming and Adhesion Promotion
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
                  Developer Processing and Lift-off Processes
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">layers</span>
                  Thick Film and Multi-layer Applications
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                  Anti-reflective and Specialty Polymer Coatings
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                  Small-piece substrate and wafer processing (up to 12-inch or square substrates)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Technical Specifications</h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
              <tbody>
                <tr>
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">System Specifications</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Wafer Size Range</td>
                  <td className="px-6 py-3 text-on-surface-variant">Small pieces, 2", 4", 6", 8", 12" wafers or square substrates (optional)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Spin Speed</td>
                  <td className="px-6 py-3 text-on-surface-variant">
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Coater module: up to 8000 rpm ±1 rpm, acceleration up to 8000 rpm/s</li>
                      <li>Developer module: up to 5000 rpm ±1 rpm, acceleration up to 5000 rpm/s</li>
                    </ul>
                  </td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Temperature Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">Room temperature to 200°C standard (hotplate); higher temperature options available</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Dispense Arm Configurations</td>
                  <td className="px-6 py-3 text-on-surface-variant">
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Coater: up to 2 photoresist lines</li>
                      <li>Developer: up to 2 developer lines plus DI water line</li>
                    </ul>
                  </td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Mechanical pump (standard), configurable for specific vacuum levels</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Film Uniformity</td>
                  <td className="px-6 py-3 text-on-surface-variant">Less than 0.5% (3σ typical coating uniformity)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Environmental Control (optional)</td>
                  <td className="px-6 py-3 text-on-surface-variant">Temperature (23±0.5°C), Humidity (45±5% RH)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint</td>
                  <td className="px-6 py-3 text-on-surface-variant">Approximately 1.0m x 0.8m</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Edge Bead Removal</td>
                  <td className="px-6 py-3 text-on-surface-variant">Optional EBR capability</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Process Capabilities */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Process Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Performance Features</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> High coating uniformity and precise thickness control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Excellent process repeatability and uniform temperature distribution</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Automated cleaning cycles and advanced developing control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Multiple programmable spin and coating profiles</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Real-time process monitoring and automated control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Customizable process recipes tailored to specific applications</li>
              </ul>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Material Compatibility</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Positive and Negative Photoresists</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Electron Beam and Thick Film Resists</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Anti-reflective coatings and specialty polymers</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Wide compatibility with specialty materials through configurable dispense systems</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="NineScrolls equipment is used by researchers publishing in top-tier journals, enabling breakthroughs across nanofabrication, photonics, and advanced materials."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Hierarchical graphene foam for efficient omnidirectional solar-thermal energy conversion',
            authors: 'H Ren, M Tang, B Guan et al.',
            year: '2017',
            citations: 945,
          },
          {
            journal: 'Nature Communications',
            tier: 'top',
            title: 'Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions',
            authors: 'X Zhang, B Liu, L Gao et al.',
            year: '2021',
            citations: 218,
          },
          {
            journal: 'Science',
            tier: 'top',
            title: 'Multifunctional tendon-mimetic hydrogels',
            authors: 'M Sun, H Li, Y Hou et al.',
            year: '2023',
            citations: 135,
          },
        ]}
        journalNames={['Nature Communications', 'Science', 'Adv. Materials', 'Adv. Functional Materials', 'Energy & Env. Science']}
        onRequestQuote={() => openContactForm(true)}
        onDownloadDatasheet={() => setGateOpen(true)}
        ctaLabel="Request a Quote"
      />

      {/* Related Equipment & Articles */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Related Equipment & Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/products/rie-etcher" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">settings</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">RIE Etcher Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Pattern transfer and hardmask opening after resist development.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/insights/coater-developer-systems-equipment-guide" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Coater/Developer Equipment Guide</h3>
              <p className="text-sm text-on-surface-variant mb-3">Selection criteria, throughput, and process windows for lithography track tools.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
            <a href="/insights/spin-coating-development-guide" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Spin Coating & Development Guide</h3>
              <p className="text-sm text-on-surface-variant mb-3">Resist dispense, spin profiles, EBR, PEB, and develop chemistry fundamentals.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Request Information</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">Contact our sales team for detailed specifications, pricing, and customization options.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary/90 transition-colors"
              onClick={() => openContactForm(true)}
            >
              <span className="material-symbols-outlined text-[20px]">call</span>
              Contact Sales Team
            </button>
            <a
              href="#"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary hover:text-on-primary transition-colors no-underline"
              onClick={(e) => { e.preventDefault(); setGateOpen(true); }}
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      {/* Floating Contact Button */}
      {showFloatingContact && (
        <div className="fixed bottom-6 right-6 z-50 animate-[slideIn_0.3s_ease-out]">
          <button
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-full font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            onClick={() => openContactForm(true)}
          >
            <span className="material-symbols-outlined text-[20px]">call</span>
            Contact Sales Team
          </button>
        </div>
      )}

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="Coater/Developer System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/coater-developer-system-datasheet.pdf'; a.download='NineScrolls-Coater-Developer-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/docs/coater-developer-system-datasheet.pdf'}
        fileName={'NineScrolls-Coater-Developer-Datasheet.pdf'}
        title={'Download Coater/Developer Datasheet'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
