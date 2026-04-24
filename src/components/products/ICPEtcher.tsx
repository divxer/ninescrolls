import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { AcademicCitations } from '../common/AcademicCitations';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { SEO } from '../common/SEO';
import { cdnUrl } from '../../config/imageConfig';

export function ICPEtcher() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  // using QuoteModal; no local form state is necessary for this component

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
    "@id": "https://ninescrolls.com/products/icp-etcher#product",
    "name": "ICP Etcher Series",
    "description": "Inductively Coupled Plasma etching system for high-aspect-ratio and advanced etching applications in semiconductor research.",
    "image": ["https://ninescrolls.com/assets/images/products/icp-etcher/main.jpg"],
    "sku": "icp-etcher",
    "brand": { "@type": "Brand", "name": "NineScrolls LLC" },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/icp-etcher",
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
        title="ICP Etcher - Inductively Coupled Plasma Etching System"
        description="ICP-RIE etching systems with independent ion energy and density control. 2000W ICP + 600W bias for high-aspect-ratio deep etching on 12&quot; wafers."
        keywords="ICP etcher, ICP-RIE, ICP RIE etching, inductively coupled plasma, plasma etching, deep reactive ion etching, DRIE, semiconductor etcher"
        url="/products/icp-etcher"
        image={cdnUrl('/assets/images/products/icp-etcher/main.jpg')}
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
              "name": "What applications is the ICP etcher best suited for?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The ICP etcher is ideal for high-aspect-ratio etching, deep silicon etching (DRIE/Bosch process), III-V compound semiconductor processing (GaN, GaAs, InP, SiC), MEMS fabrication, photonic device patterning, and 2D materials research. The independent source and bias power control enables precise profile tuning for demanding applications."
              }
            },
            {
              "@type": "Question",
              "name": "What is the difference between ICP etching and RIE etching?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "ICP etching uses a separate inductively coupled plasma source (1000-3000W) to generate high-density plasma, while a separate bias RF controls ion energy. This decoupled design enables higher etch rates, better uniformity, and independent control of plasma density vs. ion bombardment energy. Standard RIE uses a single RF source for both, which limits process flexibility for advanced applications."
              }
            },
            {
              "@type": "Question",
              "name": "What wafer sizes does the ICP etcher support?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The ICP etcher supports wafer sizes from 4 inches to 12 inches, with optional multi-wafer configurations. The system can be configured with either open-load or load-lock sample loading to match your lab workflow requirements."
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
            { name: 'ICP Etcher Series', path: '/products/icp-etcher' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">ICP Etcher Series</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Advanced Inductively Coupled Plasma Etching System with Uni-body Design</p>
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
                src={cdnUrl('/assets/images/products/icp-etcher/main.jpg')}
                alt="ICP Etcher System"
                className="w-full rounded-xl shadow-lg"
              />
              <div className="bg-white rounded-xl p-8 shadow-sm border border-outline-variant/30 mt-8 mb-8">
                <h3 className="font-headline text-xl font-semibold text-primary mb-6 text-center">
                  ICP System Schematic Diagram
                </h3>
                <picture>
                  <source
                    media="(max-width: 768px)"
                    srcSet={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic-sm.webp')}
                    type="image/webp"
                  />
                  <source
                    media="(max-width: 768px)"
                    srcSet={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic-sm.png')}
                    type="image/png"
                  />
                  <source
                    media="(max-width: 1200px)"
                    srcSet={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic-md.webp')}
                    type="image/webp"
                  />
                  <source
                    media="(max-width: 1200px)"
                    srcSet={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic-md.png')}
                    type="image/png"
                  />
                  <source
                    srcSet={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic.webp')}
                    type="image/webp"
                  />
                  <source
                    srcSet={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic.png')}
                    type="image/png"
                  />
                  <img
                    src={cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic.webp')}
                    alt="Inductively Coupled Plasma (ICP) Etching System Schematic - Showing plasma generation coil, etching stations, RF power connections, and gas flow paths"
                    className="w-full max-w-full h-auto rounded-lg shadow-sm mb-4 bg-surface-container-lowest p-4 block object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      console.log('Image failed to load:', target.src);
                      // Fallback to PNG if WebP fails
                      target.src = cdnUrl('/assets/images/products/icp-etcher/icp-system-schematic.png');
                    }}
                  />
                </picture>
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed text-center m-0 italic px-4">
                  <strong>System Components:</strong> Etching gas inlet, ICP coupling coil, etching stations, RF power connection,
                  helium piping for wafer cooling, and vacuum channel for gas evacuation.
                </p>
              </div>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">Product Description</h2>
              <p className="text-on-surface-variant leading-relaxed mb-6">The ICP Etcher Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.5m). The system's process design kits and chamber liner temperature control ensure superior process performance for various applications.</p>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Key Features</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Uni-body design with compact footprint (1.0m × 1.5m)
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Advanced plasma source technology
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Comprehensive process control system
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Multiple process design kits
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Automated recipe management
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Real-time monitoring capabilities
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Flexible configuration options
                </li>
                <li className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                  Enhanced safety features
                </li>
              </ul>

              <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Target Applications</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">computer</span>
                  Advanced semiconductor research
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">factory</span>
                  Production environment processing
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">science</span>
                  Materials development
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
                  Device fabrication
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">search</span>
                  Process optimization
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px]">precision_manufacturing</span>
                  Specialty manufacturing
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
                  <td className="px-6 py-3 text-on-surface-variant">4", 6", 8", 12" or multi-wafers optional</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">Source: 1000-3000W, Bias: 300-1000W, optional</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas System</td>
                  <td className="px-6 py-3 text-on-surface-variant">5 lines (Standard) and He backside cooling, or customized</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Wafer Stage Temperature Range</td>
                  <td className="px-6 py-3 text-on-surface-variant">From -70℃ to 200℃, optional</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Non-Uniformity</td>
                  <td className="px-6 py-3 text-on-surface-variant">Less than ±5% (Edge Exclusion)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">TMP & Mechanical Pump</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint</td>
                  <td className="px-6 py-3 text-on-surface-variant">1.0m x 1.5m</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Sample Loading</td>
                  <td className="px-6 py-3 text-on-surface-variant">Open-Load or Load-Lock (configurable)</td>
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
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">System Performance</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Chamber liner and electrode temperature control</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Tunable plasma discharge gap</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Cost or performance orientation options</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Customizable RF configurations</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Low-power / pulsed plasma options for <strong>low‑damage etch</strong></li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> ALE‑ready control modes and multi‑frequency bias</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Open-Load or Load-Lock configurations</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Advanced process monitoring</li>
              </ul>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Material Processing</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Si-Based Materials (Si, SiO2, SiNx, SiC, Quartz)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Compound Semiconductors (InP, GaN, GaAs, Ga2O3)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> 2D Materials (MoS2, BN, Graphene)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Metals (W, Ta, Mo)</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Diamond Processing</li>
                <li className="flex items-start gap-2 text-on-surface-variant"><span className="text-primary mt-1">•</span> Failure Analysis Applications</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="Our ICP etching systems are cited in 60+ peer-reviewed publications across top-tier journals including Nature Communications, Advanced Materials, and Light: Science & Applications, powering breakthroughs in photonics, micro-optics, and nanofabrication."
        stats={[
          { value: '60', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '2800', suffix: '+', label: 'Total Citations' },
          { value: '20', suffix: '+', label: 'Research Institutions' },
          { value: '9', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'PhotoniX',
            tier: 'high',
            title: 'Biomimetic sapphire windows enabled by inside-out femtosecond laser deep-scribing',
            authors: 'XQ Liu, YL Zhang, QK Li et al.',
            year: '2022',
            citations: 124,
          },
          {
            journal: 'Advanced Functional Materials',
            tier: 'high',
            title: 'Rapid engraving of artificial compound eyes from curved sapphire substrate',
            authors: 'XQ Liu, SN Yang, L Yu et al.',
            year: '2019',
            citations: 110,
          },
          {
            journal: 'IEEE Photonics Technology Letters',
            tier: 'mid',
            title: 'Sapphire concave microlens arrays for high-fluence pulsed laser homogenization',
            authors: 'XQ Liu, L Yu, QD Chen et al.',
            year: '2019',
            citations: 32,
          },
          {
            journal: 'Laser & Photonics Reviews',
            tier: 'high',
            title: 'Neural-optic co-designed polarization-multiplexed metalens for compact computational spectral imaging',
            authors: 'Q Zhang, P Lin, C Wang et al.',
            year: '2024',
            citations: 24,
          },
          {
            journal: 'Optics Letters',
            tier: 'mid',
            title: 'Ultra-smooth micro-optical components of various geometries',
            authors: 'XQ Liu, SN Yang, YL Sun et al.',
            year: '2019',
            citations: 23,
          },
          {
            journal: 'Applied Optics',
            tier: 'mid',
            title: 'Silicon three-dimensional structures fabricated by femtosecond laser modification with dry etching',
            authors: 'XQ Liu, L Yu, ZC Ma et al.',
            year: '2017',
            citations: 22,
          },
        ]}
        journalNames={['Adv. Functional Materials', 'PhotoniX', 'Laser & Photonics Reviews', 'Light: Sci. & Applications', 'Optics Letters', 'Applied Optics']}
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
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">RIE Etcher Series</h3>
              <p className="text-sm text-on-surface-variant mb-3">Compact RIE platform for research labs with high-precision etching.</p>
              <span className="text-sm text-primary font-medium">View Product →</span>
            </a>
            <a href="/insights/icp-rie-technology-advanced-etching" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">auto_awesome</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">ICP-RIE Technology Guide</h3>
              <p className="text-sm text-on-surface-variant mb-3">High-density plasma etching for deep, anisotropic, and III-V processing.</p>
              <span className="text-sm text-primary font-medium">Read Article →</span>
            </a>
            <a href="/insights/future-of-plasma-etching-microelectronics" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline block">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">menu_book</span>
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">Future of Plasma Etching</h3>
              <p className="text-sm text-on-surface-variant mb-3">Trends in ALE, pulsed plasma, and EUV resist removal technologies.</p>
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
                Q: What applications is the ICP etcher best suited for?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed m-0">
                A: The ICP etcher is ideal for high-aspect-ratio etching, deep silicon etching (DRIE/Bosch process), III-V compound semiconductor processing (GaN, GaAs, InP, SiC), MEMS fabrication, photonic device patterning, and 2D materials research. The independent source and bias power control enables precise profile tuning for demanding applications.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What is the difference between ICP etching and RIE etching?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed m-0">
                A: ICP etching uses a separate inductively coupled plasma source (1000–3000W) to generate high-density plasma, while a separate bias RF controls ion energy. This decoupled design enables higher etch rates, better uniformity, and independent control of plasma density vs. ion bombardment energy. Standard RIE uses a single RF source for both, which limits process flexibility for advanced applications.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What wafer sizes does the ICP etcher support?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed m-0">
                A: The ICP etcher supports wafer sizes from 4 inches to 12 inches, with optional multi-wafer configurations. The system can be configured with either open-load or load-lock sample loading to match your lab workflow requirements.
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
        productName="ICP Etcher Series"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={()=>{
          const a=document.createElement('a'); a.href='/docs/icp-etcher-datasheet.pdf'; a.download='NineScrolls-ICP-Etcher-Datasheet.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        downloadLabel="Download Datasheet"
      />

      <DownloadGateModal
        isOpen={gateOpen}
        onClose={() => setGateOpen(false)}
        fileUrl={'/docs/icp-etcher-datasheet.pdf'}
        fileName={'NineScrolls-ICP-Etcher-Datasheet.pdf'}
        title={'Download ICP Etcher Datasheet'}
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}