import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { SEO } from '../common/SEO';
import { cdnUrl } from '../../config/imageConfig';

export function ALDSystem() {
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
    "@id": "https://ninescrolls.com/products/ald#product",
    "name": "ALD System Series",
    "description": "Atomic Layer Deposition system offering atomic-level precision with compact uni-body design for thin film growth.",
    "image": ["https://ninescrolls.com/assets/images/products/ald/main.jpg"],
    "sku": "ald",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/ald",
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
        title="ALD System - Atomic Layer Deposition Equipment"
        description="ALD systems with sub-nanometer thickness control and <1% uniformity. Thermal and plasma-enhanced modes for Al₂O₃, HfO₂, TiN. 4&quot;–12&quot; wafers."
        keywords="ALD, atomic layer deposition, ALD system, ALD equipment, Al2O3 deposition, thin film deposition, conformal coating"
        url="/products/ald"
        image={cdnUrl('/assets/images/products/ald/main.jpg')}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is atomic layer deposition (ALD) and how does it work?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "ALD is a thin-film deposition technique that builds films one atomic layer at a time through sequential, self-limiting surface reactions. Each cycle deposits a precise monolayer (typically 0.5-2 angstroms), enabling exceptional thickness control, conformality (>98% step coverage), and uniformity (<1% for Al2O3). This makes ALD ideal for gate dielectrics, passivation, and conformal coatings on 3D structures."
              }
            },
            {
              "@type": "Question",
              "name": "What materials can the ALD system deposit?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The ALD system supports oxides (Al2O3, HfO2, SiO2, TiO2, Ga2O3, ZnO), nitrides (TiN, TaN, SiNx, AlN, GaN), metals (Pt, Pd, W, Ru), and complex oxides. With the optional remote plasma source (300-1000W), plasma-enhanced ALD (PEALD) enables lower-temperature deposition and access to additional materials."
              }
            },
            {
              "@type": "Question",
              "name": "What temperature range does the ALD system support?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The wafer temperature range is 20°C to 400°C (higher temperatures available as an option). Source temperatures range from 20°C to 150°C standard, with up to 200°C optional for high-vapor-pressure precursors. The system supports 2 to 6 customizable precursor lines."
              }
            }
          ]
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/products/product-detail-bg.jpg')} alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'ALD System Series', path: '/products/ald' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">ALD System Series</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Advanced Atomic Layer Deposition System for Precision Thin Film Growth</p>
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
                src={cdnUrl('/assets/images/products/ald/main.jpg')}
                alt="ALD System"
                className="w-full rounded-xl shadow-lg"
              />
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">Product Description</h2>
              <p className="text-on-surface-variant leading-relaxed mb-6">The ALD Series offers atomic-level precision in thin film deposition through sequential, self-limiting surface reactions within a compact uni-body design (footprint approx. 0.8m x 1.0m). Engineered for both research and production environments, it delivers exceptional film quality, outstanding high-aspect-ratio (AR) step coverage, and configurable options for performance and cost optimization.</p>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Key Features</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Compact uni-body design (0.8m x 1.0m footprint)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Box-in-box process chamber for enhanced process stability
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Showerhead gas feed-in system with independently configurable parameters
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Excellent high-aspect-ratio (AR) step coverage
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Multiple gas inlets and vertical precursor flow configuration
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Optional remote plasma (RF) capability (300-1000W)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Precise electrode temperature and chamber liner control for diverse processes
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Flexible cost-performance customization (RF system, vacuum pumps, valves, etc.)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Optional sample handling: Open-load or Load-lock systems
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  User-friendly interface and automated process control
                </li>
              </ul>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Target Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">computer</span>
                  Advanced semiconductor devices
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">search</span>
                  Nanotechnology research
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
                  Energy storage materials
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
                  Optical applications
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                  Protective coatings
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">biotech</span>
                  Novel materials development
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
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Wafer Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">4", 6", 8", 12", or supersize configurations (optional)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Wafer Temperature Range</td>
                  <td className="px-6 py-3 text-on-surface-variant">20°C to 400°C (higher temperature optional)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Source Temperature</td>
                  <td className="px-6 py-3 text-on-surface-variant">Standard 20°C-150°C, optional up to 200°C</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Base Pressure</td>
                  <td className="px-6 py-3 text-on-surface-variant">Less than 5x10^-5 Torr (TMP and mechanical pump)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Growth Rate</td>
                  <td className="px-6 py-3 text-on-surface-variant">Typical 0.5-2 Å per cycle</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Film Uniformity</td>
                  <td className="px-6 py-3 text-on-surface-variant">Less than 1% (Al₂O₃, edge exclusion)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Number of Precursor Lines</td>
                  <td className="px-6 py-3 text-on-surface-variant">2-6 lines (customizable)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Remote Plasma</td>
                  <td className="px-6 py-3 text-on-surface-variant">Optional RF capability (300-1000W)</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint</td>
                  <td className="px-6 py-3 text-on-surface-variant">Approximately 0.8m x 1.0m</td>
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
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Sub-nanometer thickness control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Outstanding high-AR step coverage ({'>'}98%)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Exceptional film conformality</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Precise control of film composition</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Low impurity and defect content</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Multi-layer film deposition capability</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Excellent process repeatability</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> In-situ monitoring capability (optional)</li>
              </ul>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Material Systems</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Oxides: Al₂O₃, HfO₂, SiO₂, TiO₂, Ga₂O₃, ZnO, etc.</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Nitrides: TiN, TaN, SiNx, AlN, GaN, etc.</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Metals: Pt, Pd, W, Ru, etc.</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Complex oxides and 2D materials (optional)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="NineScrolls systems are used by researchers publishing in top-tier journals, enabling breakthroughs in thin film deposition, nanofabrication, and advanced materials."
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
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Graphene-armored aluminum foil with enhanced anticorrosion performance as current collectors for lithium-ion battery',
            authors: 'M Wang, M Tang, S Chen et al.',
            year: '2017',
            citations: 149,
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
            <a href="/products/pecvd" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">settings</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">PECVD System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Plasma-enhanced deposition alternative for versatile thin film growth applications.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/products/hdp-cvd" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">precision_manufacturing</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">HDP-CVD System Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">High-density plasma CVD for superior gap-fill and dense dielectric films.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/insights/atomic-layer-deposition-ald-comprehensive-guide" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">ALD Comprehensive Guide</h3>
              <p className="text-sm text-on-surface-variant mb-3">Principles, precursor chemistries, and process windows for atomic layer deposition.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What is atomic layer deposition (ALD) and how does it work?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: ALD is a thin-film deposition technique that builds films one atomic layer at a time through sequential, self-limiting surface reactions. Each cycle deposits a precise monolayer (typically 0.5-2 angstroms), enabling exceptional thickness control, conformality ({'>'}98% step coverage), and uniformity ({'<'}1% for Al2O3). This makes ALD ideal for gate dielectrics, passivation, and conformal coatings on 3D structures.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What materials can the ALD system deposit?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The ALD system supports oxides (Al2O3, HfO2, SiO2, TiO2, Ga2O3, ZnO), nitrides (TiN, TaN, SiNx, AlN, GaN), metals (Pt, Pd, W, Ru), and complex oxides. With the optional remote plasma source (300-1000W), plasma-enhanced ALD (PEALD) enables lower-temperature deposition and access to additional materials.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What temperature range does the ALD system support?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The wafer temperature range is 20°C to 400°C (higher temperatures available as an option). Source temperatures range from 20°C to 150°C standard, with up to 200°C optional for high-vapor-pressure precursors. The system supports 2 to 6 customizable precursor lines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Request Information</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">Get detailed specs, pricing & customization options.</p>
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
        productName="ALD System Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{ const a=document.createElement('a'); a.href='/docs/ald-system-datasheet.pdf'; a.download='NineScrolls-ALD-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal isOpen={gateOpen} onClose={()=>setGateOpen(false)} fileUrl={'/docs/ald-system-datasheet.pdf'} fileName={'NineScrolls-ALD-Datasheet.pdf'} title={'Download ALD Datasheet'} turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string} />
    </>
  );
}
