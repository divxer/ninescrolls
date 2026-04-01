import { useState } from 'react';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';

import { Breadcrumbs } from '../common/Breadcrumbs';
import { cdnUrl } from '../../config/imageConfig';

export function CompactRIE() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'main2'>('main');

  useScrollToTop();

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
    "@id": "https://ninescrolls.com/products/compact-rie#product",
    "name": "Compact RIE Etcher (SV-RIE)",
    "description": "Compact reactive ion etching system with ultra-small footprint (630mm×600mm), ideal for research labs, pilot-scale processes, and failure analysis applications.",
    "image": ["https://ninescrolls.com/assets/images/products/compact-rie/main.jpg"],
    "sku": "compact-rie",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "0",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "seller": {
        "@type": "Organization",
        "name": "NineScrolls LLC",
        "url": "https://ninescrolls.com"
      },
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
        title="Compact RIE Etcher (SV-RIE) - Ultra-Compact Reactive Ion Etching | NineScrolls"
        description="Compact RIE etching system with 630mm×600mm footprint. Ideal for research labs, pilot-scale processes, and failure analysis. Touchscreen control, modular design."
        keywords="compact RIE, SV-RIE, small footprint RIE, compact reactive ion etching, research RIE system, failure analysis equipment"
        url="/products/compact-rie"
        image={cdnUrl('/assets/images/products/compact-rie/main.jpg')}
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What makes the Compact RIE different from a standard RIE system?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The Compact RIE (SV-RIE) has a 50% smaller footprint (630mm x 600mm) compared to standard RIE systems while maintaining full process capability. It is available in three RF power options (300W, 500W, and 1000W) and supports wafer sizes from 4 to 12 inches with fully automated touchscreen operation."
              }
            },
            {
              "@type": "Question",
              "name": "What can I etch with the Compact RIE?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The Compact RIE processes Si, SiO2, SiNx, SiC, photoresist (PR), PMMA, HMDS, organic polymers, and compound semiconductors. It achieves minimum line widths of 300nm and sidewall verticality above 89 degrees, making it suitable for photoresist removal, failure analysis, passivation layer removal, and rapid R&D prototyping."
              }
            },
            {
              "@type": "Question",
              "name": "Is the Compact RIE suitable for a small research lab?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, it is specifically designed for space-constrained labs. Its compact footprint fits on a standard lab bench, and the touchscreen interface makes it accessible for multi-user environments. The modular design means you can choose the RF power level (300W/500W/1000W) that matches your process needs and budget."
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
            { name: 'Compact RIE Etcher (SV-RIE)', path: '/products/compact-rie' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">Compact RIE Etcher (SV-RIE)</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">Ultra-Compact Reactive Ion Etching System</p>
            <p className="text-base text-white/90 mb-2">
              Ultra-small footprint RIE system for research labs. Full reactive ion etching capability in a 630mm × 600mm space.
            </p>
            <p className="text-base text-white/80 tracking-wide">
              US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-3xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <span className="material-symbols-outlined text-white text-3xl mb-2 block">straighten</span>
                <div className="font-semibold text-white">630mm × 600mm Footprint</div>
                <div className="text-sm text-white/70">vs. standard RIE: 50% smaller footprint</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <span className="material-symbols-outlined text-white text-3xl mb-2 block">bolt</span>
                <div className="font-semibold text-white">300W / 500W / 1000W RF Power</div>
                <div className="text-sm text-white/70">research-grade etching performance</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <span className="material-symbols-outlined text-white text-3xl mb-2 block">touch_app</span>
                <div className="font-semibold text-white">Touchscreen Control</div>
                <div className="text-sm text-white/70">fully automated operation system</div>
              </div>
            </div>

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
                onClick={() => openContactForm(false)}
              >
                Request Information
              </button>
              <a
                href="#"
                className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors no-underline"
                onClick={(e) => {
                  e.preventDefault();
                  setGateOpen(true);
                }}
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
            <div className="min-w-0 overflow-hidden">
              <div className="rounded-xl overflow-hidden shadow-lg [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-auto">
                {selectedImage === 'main' ? (
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/compact-rie/main.jpg')}
                    alt="Compact RIE Etcher (SV-RIE) - ultra-compact reactive ion etching system"
                    width={800}
                    height={600}
                    className="w-full"
                  />
                ) : (
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/compact-rie/main-2.jpg')}
                    alt="Compact RIE Etcher (SV-RIE) - additional view"
                    width={800}
                    height={600}
                    className="w-full"
                  />
                )}
              </div>
              <div className="flex gap-3 mt-3 [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'main' ? 'border-primary shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('main')}
                  type="button"
                >
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/compact-rie/main.jpg')}
                    alt="Main View"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  className={`w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === 'main2' ? 'border-primary shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  onClick={() => setSelectedImage('main2')}
                  type="button"
                >
                  <OptimizedImage
                    src={cdnUrl('/assets/images/products/compact-rie/main-2.jpg')}
                    alt="Additional View"
                    width={150}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">System Overview</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                The Compact RIE Etcher (SV-RIE) is a compact reactive ion etching system designed for research laboratories,
                pilot-scale processes, and failure analysis applications.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                With an ultra-small footprint of 630mm × 600mm, this one-piece system offers excellent space efficiency
                while maintaining high performance and reliability—ideal for labs where space is at a premium.
              </p>

              <div className="bg-surface-container-low rounded-xl p-6 mb-6">
                <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">Compared to:</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-on-surface min-w-[160px]">Standard RIE systems</span>
                    <span className="text-primary">→</span>
                    <span className="text-on-surface-variant">50% smaller footprint, same performance</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-on-surface min-w-[160px]">Desktop plasma cleaners</span>
                    <span className="text-primary">→</span>
                    <span className="text-on-surface-variant">True RIE capability, anisotropic etching</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Key Features</h2>

          {/* Primary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-6 text-center">Core Capabilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">straighten</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Ultra-Compact Footprint</h3>
              <p className="text-sm font-medium text-primary mb-2">630mm × 600mm—50% smaller than standard RIE systems</p>
              <p className="text-sm text-on-surface-variant">One-piece design optimizes valuable lab space while maintaining full RIE functionality. Ideal for research environments where space efficiency is critical.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Research-Grade RF Power</h3>
              <p className="text-sm font-medium text-primary mb-2">300W / 500W / 1000W customizable RF power</p>
              <p className="text-sm text-on-surface-variant">Standard 13.56 MHz RF power source with adjustable output. Stable plasma generation suitable for precise anisotropic etching of silicon, dielectrics, and compound semiconductors.</p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">touch_app</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Touchscreen Automation</h3>
              <p className="text-sm font-medium text-primary mb-2">Fully automated operation with simple interface</p>
              <p className="text-sm text-on-surface-variant">Touchscreen control system streamlines workflows. Automatic and manual operation modes with reproducible process parameters for research documentation.</p>
            </div>
          </div>

          {/* Secondary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-6 text-center">Additional Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">sync</span>
              <h3 className="font-headline text-base font-semibold text-on-surface mb-2">Modular Design</h3>
              <p className="text-sm text-on-surface-variant">Easy maintenance and convenient transport. Removable contamination-resistant liner option available.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">air</span>
              <h3 className="font-headline text-base font-semibold text-on-surface mb-2">Multi-Gas Capability</h3>
              <p className="text-sm text-on-surface-variant">Up to 5 process gas lines simultaneously. Flow control range: 0 ~ 1000 sccm (selectable based on application).</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-base font-semibold text-on-surface mb-2">Flexible Wafer Support</h3>
              <p className="text-sm text-on-surface-variant">4", 6", 8", 12" wafers (customizable for smaller sizes). Supports various substrate sizes for research flexibility.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-base font-semibold text-on-surface mb-2">Optional Turbo Pump</h3>
              <p className="text-sm text-on-surface-variant">Mechanical pump standard / optional turbo pump for enhanced vacuum performance and process control.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Typical Applications</h2>
          <p className="text-on-surface-variant text-center mb-8 max-w-3xl mx-auto">
            <strong>Commonly installed in:</strong> Research laboratories, failure analysis facilities, and pilot-scale processing environments requiring compact RIE capabilities.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-surface-container-low rounded-xl p-6">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">biotech</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Organic Material Etching</h3>
              <p className="text-sm font-medium text-primary mb-2">Used for PR removal, PMMA etching, and polymer descumming</p>
              <p className="text-sm text-on-surface-variant">Photoresist (PR), PMMA, HDMS, and organic polymer etching with precise control. Essential for lithography processes and polymer device fabrication.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Inorganic Material Rapid Etching</h3>
              <p className="text-sm font-medium text-primary mb-2">Fast etching of silicon, SiO₂, SiNx, and compound semiconductors</p>
              <p className="text-sm text-on-surface-variant">High-rate etching of inorganic materials with excellent selectivity. Typical applications: MEMS fabrication, optoelectronic devices, and compound semiconductor processing.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">search</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Failure Analysis (FA)</h3>
              <p className="text-sm font-medium text-primary mb-2">Chip decapsulation and package opening for analysis</p>
              <p className="text-sm text-on-surface-variant">Precise package decapsulation etching for failure analysis workflows. Commonly used in semiconductor testing and quality control laboratories.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">target</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Passivation Layer Removal</h3>
              <p className="text-sm font-medium text-primary mb-2">Selective removal of passivation layers for device access</p>
              <p className="text-sm text-on-surface-variant">Controlled etching of passivation layers to expose underlying device structures. Critical for device characterization and reverse engineering applications.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">analytics</span>
              <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">Research & Development</h3>
              <p className="text-sm font-medium text-primary mb-2">Process development and material characterization</p>
              <p className="text-sm text-on-surface-variant">Ideal for R&D environments requiring flexible etching capabilities. Supports process development for new materials and device structures.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Specifications */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">System Specifications</h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
              <tbody>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Wafer Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">4", 6", 8", 12" (customizable for smaller sizes)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">300W / 500W / 1000W (customizable)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Frequency</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Process Gases</td>
                  <td className="px-6 py-3 text-on-surface-variant">Up to 5 gas lines simultaneously</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Flow Control Range</td>
                  <td className="px-6 py-3 text-on-surface-variant">0 ~ 1000 sccm (selectable based on application)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Pump System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Mechanical pump standard / optional turbo pump</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Footprint</td>
                  <td className="px-6 py-3 text-on-surface-variant">630mm × 600mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Operation</td>
                  <td className="px-6 py-3 text-on-surface-variant">Touchscreen control, fully automated system</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Optional Features</td>
                  <td className="px-6 py-3 text-on-surface-variant">Removable contamination-resistant liner, turbo pump option</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Compatible Materials */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Compatible Materials</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Silicon (Si)</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Silicon Dioxide (SiO₂)</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Silicon Nitride (SiNx)</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Silicon Carbide (SiC)</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Photoresist (PR)</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">PMMA</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">HDMS</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Organic Polymers</span>
            <span className="bg-surface-container-low text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium">Compound Semiconductors</span>
          </div>
        </div>
      </section>

      {/* Available Models */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Available Models</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">SHL100SV-RIE</h3>
              <p className="text-sm text-on-surface-variant">Base model with 300W RF power, ideal for standard research applications.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">SHL150SV-RIE</h3>
              <p className="text-sm text-on-surface-variant">Mid-range model with 500W RF power, suitable for enhanced etching performance.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-semibold text-primary mb-2">SHL200SV-RIE</h3>
              <p className="text-sm text-on-surface-variant">High-power model with 1000W RF power, designed for demanding etching applications.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Results */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Process Results</h2>
          <p className="text-on-surface-variant text-center mb-12 max-w-3xl mx-auto">
            Real-world etching results demonstrating the capabilities of the Compact RIE Etcher (SV-RIE) system across various materials and applications.
          </p>

          {/* Quartz/Silicon Grating Etching */}
          <div className="mb-12">
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Quartz/Silicon Grating Etching</h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              Etching of quartz or silicon material grating arrays using PR (photoresist) masking.
              Achieves minimum line widths of 300nm with sidewall verticality close to &gt;89°.
              Applications include 3D displays, micro-optical devices, and optoelectronic communications.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-1.jpg')}
                  alt="Quartz/Silicon grating etching - top view showing parallel vertical trenches"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">Grating structure - top view</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-2.jpg')}
                  alt="Quartz/Silicon grating etching - cross-sectional view showing deep narrow grooves"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">Cross-sectional view - deep trenches</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-3.jpg')}
                  alt="Quartz/Silicon grating etching - cross-sectional view showing high aspect ratio features"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">High aspect ratio features</p>
              </div>
            </div>
          </div>

          {/* Compound Semiconductor Etching */}
          <div className="mb-12">
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Compound Semiconductor Etching</h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              Precise control over etch profiles for GaN-based, GaAs, InP, and metal materials by accurately
              controlling the sample surface temperature. Suitable for blue LED devices, lasers, and optical communication applications.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-4.jpg')}
                  alt="Indium Phosphide (InP) etching - stepped terraced etch profile"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">InP (Indium Phosphide) - stepped profile</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-5.jpg')}
                  alt="Gallium Nitride (GaN) etching - multi-layered etch profile with smooth transitions"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">GaN (Gallium Nitride) - multi-layered profile</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-6.jpg')}
                  alt="Sapphire etching - corrugated surface with parallel ridges and valleys"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">Sapphire - corrugated surface</p>
              </div>
            </div>
          </div>

          {/* Silicon-based Material Etching */}
          <div className="mb-12">
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-3">Silicon-based Material Etching</h3>
            <p className="text-on-surface-variant leading-relaxed mb-6">
              Etching capabilities for silicon (Si), silicon dioxide (SiO₂), silicon nitride (SiNx), and other
              silicon-based materials. Achieves silicon line etching above 50nm and silicon deep hole etching below 100μm.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-7.jpg')}
                  alt="SiO2 etching - cross-sectional view showing wide shallow trench"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">SiO₂ Etching</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-8.jpg')}
                  alt="Silicon deep hole etching - high aspect ratio trench with vertical sidewalls"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">Silicon Deep Hole Etching (&lt;100μm)</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-9.jpg')}
                  alt="50nm silicon line etching - top view showing extremely fine parallel lines"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">50nm Silicon Line Etching</p>
              </div>
              <div className="rounded-xl overflow-hidden shadow-sm">
                <OptimizedImage
                  src={cdnUrl('/assets/images/products/compact-rie/process-results/result-10.jpg')}
                  alt="Silicon nanopillar etching - dense array of uniformly sized nanopillars"
                  width={400}
                  height={300}
                  className="w-full"
                />
                <p className="text-sm text-on-surface-variant text-center py-3 italic">Silicon Nanopillar Etching</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Branding Notice */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="p-8 bg-surface-container-low rounded-xl border-l-4 border-outline-variant">
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-4">Branding Notice</h3>
            <p className="text-on-surface-variant leading-relaxed m-0">
              Semiconductor and etching systems are professionally integrated, configured, and branded by NineScrolls LLC.
              Certain internal components or manufacturing nameplates may reflect our original manufacturing partner platforms.
              All performance specifications, technical warranty, and professional support are fully guaranteed and provided directly by NineScrolls LLC to ensure academic and research compliance.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What makes the Compact RIE different from a standard RIE system?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed m-0">
                A: The Compact RIE (SV-RIE) has a 50% smaller footprint (630mm x 600mm) compared to standard RIE systems while maintaining full process capability. It is available in three RF power options (300W, 500W, and 1000W) and supports wafer sizes from 4 to 12 inches with fully automated touchscreen operation.
              </p>
            </div>
            <div className="mb-8 p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What can I etch with the Compact RIE?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed m-0">
                A: The Compact RIE processes Si, SiO2, SiNx, SiC, photoresist (PR), PMMA, HMDS, organic polymers, and compound semiconductors. It achieves minimum line widths of 300nm and sidewall verticality above 89 degrees, making it suitable for photoresist removal, failure analysis, passivation layer removal, and rapid R&D prototyping.
              </p>
            </div>
            <div className="mb-8 p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: Is the Compact RIE suitable for a small research lab?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed m-0">
                A: Yes, it is specifically designed for space-constrained labs. Its compact footprint fits on a standard lab bench, and the touchscreen interface makes it accessible for multi-user environments. The modular design means you can choose the RF power level (300W/500W/1000W) that matches your process needs and budget.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Interested in this product?</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">Contact our team for detailed specifications, pricing information, and configuration options.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary/90 transition-colors"
              onClick={() => openContactForm(false)}
            >
              <span className="material-symbols-outlined text-[20px]">call</span>
              Request Information
            </button>
            <a
              href="#"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary hover:text-on-primary transition-colors no-underline"
              onClick={(e) => {
                e.preventDefault();
                setGateOpen(true);
              }}
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Download Brochure
            </a>
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
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="Compact RIE Etcher (SV-RIE)"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
        onDownloadBrochure={() => {
          closeContactForm();
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
