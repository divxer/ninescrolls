import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function PlutoF() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'with-pump' | 'chamber-open' | 'chamber-interior'>('main');
  const navigate = useNavigate();
  const { addItem } = useCart();

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

  const handleDownloadBrochure = () => {
    const a = document.createElement('a');
    a.href = '/docs/pluto-f-datasheet.pdf';
    a.download = 'NineScrolls-PLUTO-F-Datasheet.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleAddToCart = () => {
    addItem({
      id: 'pluto-f',
      name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
      price: 15999,
      quantity: 1,
      image: '/assets/images/products/pluto-f/main.jpg',
      sku: 'pluto-f',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 15999,
          items: [{
            item_id: 'pluto-f',
            item_name: 'PLUTO-F - 500W RF Flagship Plasma Cleaner',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 15999,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('pluto-f', 'PLUTO-F - 500W RF Flagship Plasma Cleaner', 15999);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pluto-f#product",
    "name": "PLUTO-F — 500W RF Flagship Plasma Cleaner",
    "description": "The most powerful RF plasma cleaner under $20K. 500W continuously adjustable at 13.56 MHz, ~14.5L 6061-T6 aluminum alloy chamber, touchscreen control with advanced recipe management. Designed for university core facilities, advanced materials labs, and semiconductor process development.",
    "image": ["https://ninescrolls.com/assets/images/products/pluto-f/main.jpg"],
    "sku": "pluto-f",
    "mpn": "PLUTO-F",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "15999",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pluto-f",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "NineScrolls LLC",
        "url": "https://ninescrolls.com"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
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
        title="PLUTO-F | 500W RF Flagship Plasma Cleaner | 14.5L Chamber | $15,999"
        description="The most powerful RF plasma cleaner under $20K. 500W continuously adjustable at 13.56 MHz with ~14.5L 6061-T6 aluminum alloy chamber. Designed for core facilities, advanced materials research, and semiconductor process development. Touchscreen control, advanced recipe management."
        keywords="PLUTO-F, 500W RF Plasma Cleaner, Flagship Plasma Cleaner, 14.5L Chamber, Harrick Alternative, Surface Activation, Batch Processing, Research Lab, 13.56MHz plasma, Advanced Recipe Management"
        url="/products/pluto-f"
        image="/assets/images/products/pluto-f/main.jpg"
        imageWidth={800}
        imageHeight={600}
        type="product"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Who is PLUTO-F designed for?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-F is designed for labs that need more capability than compact desktop plasma cleaners can provide. If your work involves aggressive ashing, deep surface activation, large-batch processing, or multi-step recipe sequences — and you need reproducible, documented results across multiple users — PLUTO-F provides the RF power, chamber volume, and automation to handle it."
                }
              },
              {
                "@type": "Question",
                "name": "Why would I choose PLUTO-F over HY-20LRF?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-F delivers 3.3x the RF power (500W vs 150W) for only $1,500 more ($15,999 vs $14,499). If your processes benefit from higher RF power — more aggressive cleaning, deeper surface activation, or faster processing — PLUTO-F is the clear upgrade. The advanced recipe management is also a significant advantage for multi-user labs."
                }
              },
              {
                "@type": "Question",
                "name": "Should I upgrade to the dry pump option?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The standard oil-sealed mechanical pump works well for most research applications. We recommend the dry pump upgrade (+$2,500) for cleanroom environments, contamination-sensitive processes, or facilities that prefer oil-free operation."
                }
              },
              {
                "@type": "Question",
                "name": "What gases can I use with PLUTO-F?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-F supports O₂, N₂, Ar, and mixed-gas processes with 2 gas lines. The system is designed for flexible gas configuration to support a wide range of surface treatment applications."
                }
              }
            ]
          })}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src="/assets/images/products/product-detail-bg.jpg" alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'PLUTO-F', path: '/products/pluto-f' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">PLUTO-F</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">500W RF Flagship Plasma Cleaner</p>
            <p className="text-base text-white/80 tracking-wide">
              The most powerful RF plasma cleaner under $20K | 14.5L large-capacity chamber
            </p>
            <p className="text-base text-white/80 tracking-wide">
              US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
            </p>

            {/* Flagship Positioning Hero Card */}
            <div className="mt-8 p-6 bg-black/60 backdrop-blur-sm rounded-lg max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white/90 mb-3 text-center">
                500W RF. 14.5L aluminum alloy chamber. Under $16K.
              </h3>
              <p className="text-[0.95rem] text-white/90 leading-relaxed text-center">
                When your research requires aggressive surface activation, large-batch plasma cleaning, or complex
                multi-step recipes — you need real RF power, not a desktop cleaner. PLUTO-F delivers industrial-level
                capability at a research-lab price point.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">bolt</span>
                <div>
                  <span className="block font-semibold">500W RF (13.56 MHz)</span>
                  <span className="block text-sm text-white/70">continuously adjustable, highest in its class under $20K</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">inventory_2</span>
                <div>
                  <span className="block font-semibold">~14.5L Aluminum Alloy Chamber</span>
                  <span className="block text-sm text-white/70">process wafers, devices, and components in batch</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">touch_app</span>
                <div>
                  <span className="block font-semibold">Touchscreen + Recipe Management</span>
                  <span className="block text-sm text-white/70">multi-step sequences, reproducible across users</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">savings</span>
                <div>
                  <span className="block font-semibold">Under $16,000</span>
                  <span className="block text-sm text-white/70">industrial-level RF power at research-lab pricing</span>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-white/70 mb-1">US Price:</p>
              <p className="text-3xl font-bold">$15,999 USD</p>
              <p className="text-sm text-white/70 mt-1">Availability: In Stock · Ships in 3–4 weeks</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>
              <button
                className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors"
                onClick={() => openContactForm(true)}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* System Overview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="min-w-0 overflow-hidden">
              <div className="[&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-auto">
                {selectedImage === 'main' && (
                  <OptimizedImage src="/assets/images/products/pluto-f/main.jpg" alt="PLUTO-F - 500W RF Flagship Plasma Cleaner" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'with-pump' && (
                  <OptimizedImage src="/assets/images/products/pluto-f/with-pump.jpg" alt="PLUTO-F - System with Pump" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'chamber-open' && (
                  <OptimizedImage src="/assets/images/products/pluto-f/chamber-open.jpg" alt="PLUTO-F - Chamber Open" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'chamber-interior' && (
                  <OptimizedImage src="/assets/images/products/pluto-f/chamber-interior.jpg" alt="PLUTO-F - Chamber Interior with Wafers" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                {(['main', 'with-pump', 'chamber-open', 'chamber-interior'] as const).map((img) => (
                  <button key={img} className={`w-20 h-15 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === img ? 'border-primary' : 'border-transparent hover:border-outline-variant'}`} onClick={() => setSelectedImage(img)} type="button">
                    <OptimizedImage src={`/assets/images/products/pluto-f/${img}.jpg`} alt={img.replace(/-/g, ' ')} width={150} height={112} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">System Overview</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                PLUTO-F is NineScrolls' flagship RF plasma cleaner, delivering an unmatched combination of 500W RF power
                and 14.5-liter chamber capacity at under $16,000. No other system in this price range comes close to
                this RF power level.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                For labs that have outgrown entry-level desktop cleaners or need capabilities beyond what compact
                systems can deliver — aggressive ashing, deep surface activation, large-batch processing — PLUTO-F
                provides the RF power and chamber volume to handle it, with touchscreen recipe management for
                reproducible, documented results across users and sessions.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                The system features continuously adjustable 13.56 MHz RF power, 2 gas lines supporting O₂, N₂, and Ar,
                and advanced recipe management via a touchscreen interface. A mechanical vacuum pump is included, with an
                optional dry pump upgrade available.
              </p>

              <div className="mt-6 p-4 bg-primary/5 rounded-lg border-l-[3px] border-primary">
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                  <Link
                    to="/insights/plasma-cleaner-comparison-research-labs"
                    className="text-primary font-medium hover:underline"
                  >
                    Learn how research-grade plasma cleaners compare across power, chamber size, and price →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What 500W RF Enables */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-3 text-center">What 500W RF Power Enables</h2>
          <p className="text-center mb-10 text-on-surface-variant text-lg">
            Higher RF power isn't just a bigger number — it unlocks processes that lower-power systems cannot perform.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-white rounded-lg border-t-[3px] border-primary">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">Faster process cycles</h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">Surface activation that takes 10–15 minutes at 50W completes in 1–2 minutes at 500W. For high-throughput labs, this means dramatically higher daily sample capacity.</p>
            </div>
            <div className="p-6 bg-white rounded-lg border-t-[3px] border-primary">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">Deeper surface modification</h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">Aggressive ashing, deep activation, and stubborn contaminant removal require sustained high-power plasma density that low-power sources cannot generate — regardless of treatment time.</p>
            </div>
            <div className="p-6 bg-white rounded-lg border-t-[3px] border-primary">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">Uniform large-batch processing</h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">A 14.5L chamber needs significantly more RF power to maintain uniform plasma density across the entire volume. 500W ensures consistent treatment from center to edge, batch after batch.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses This */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-2 text-center">Who Uses This</h2>
          <p className="text-center mb-8 text-on-surface-variant">
            PLUTO-F is designed for labs that need maximum RF power and large-batch capability:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">domain</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">University Core Facilities</h3>
              <p className="text-sm text-on-surface-variant">Shared-use labs needing high throughput</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">science</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Advanced Materials Labs</h3>
              <p className="text-sm text-on-surface-variant">High-power surface treatment & modification</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">memory</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Semiconductor Process Dev</h3>
              <p className="text-sm text-on-surface-variant">Plasma cleaning & activation at scale</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">local_hospital</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Biomedical Device Mfg</h3>
              <p className="text-sm text-on-surface-variant">Large-batch surface activation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Key Features</h2>

          {/* Primary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-4 text-center">Core Capabilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">500W RF Power at 13.56 MHz</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Highest RF power available in any benchtop plasma cleaner under $20K</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Continuously adjustable 500W RF power at 13.56 MHz. Enables aggressive cleaning, deep surface activation, and complex multi-step recipes. The power headroom to handle demanding processes — not just routine cleaning.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">~14.5L Aluminum Alloy Chamber</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Large-capacity batch processing for multi-sample workflows</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">6061-T6 aluminum alloy chamber with ~14.5 liters of processing volume. Supports large-batch processing of multiple substrates, components, or devices simultaneously — essential for core facilities and production-scale R&D workflows.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">touch_app</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Touchscreen Control with Recipe Management</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Fully automated operation with advanced recipe storage</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Touchscreen interface with advanced recipe management enables multi-step process sequences, parameter storage, and reproducible operation across users and sessions — critical for research documentation and multi-user core facilities.</p>
            </div>
          </div>

          {/* Secondary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-4 text-center">Additional Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">air</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">2 Gas Lines (O₂, N₂, Ar)</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Multi-gas capability supporting O₂, N₂, Ar, and mixed-gas processes. More flexible than single-gas systems, enabling a wider range of surface treatment chemistries and process optimization.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Vacuum System with Dry Pump Option</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Mechanical oil pump included as standard. Optional dry pump upgrade (+$2,500) for oil-free operation in cleanroom or sensitive research environments.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Typical Applications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Typical Applications</h2>
          <p className="text-on-surface-variant text-center mb-8 max-w-3xl mx-auto">
            <strong>Commonly used for:</strong> High-power plasma processing in university core facilities, advanced materials labs, semiconductor process development, and biomedical device manufacturing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">cleaning_services</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">High-Power Plasma Cleaning</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Aggressive contaminant removal at 500W</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Remove stubborn organic residues, photoresist, and surface contaminants with 500W of RF power. High power density means faster cycle times and more thorough cleaning — even on difficult substrates.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Advanced Surface Activation</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Deep activation for demanding bonding & coating</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Achieve deep surface activation and energy modification for advanced bonding, thin film deposition, and coating processes. 500W enables activation levels and contact angle changes that lower-power systems cannot reach.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Large-Batch Processing</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Process multiple substrates in a single run</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">14.5L chamber supports batch processing of multiple wafers, devices, or components simultaneously — essential for core facilities and production-scale research workflows.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">tune</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Complex Recipe Management</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Multi-step automated process sequences</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Advanced recipe management enables complex multi-step plasma sequences with precise parameter control. Store, recall, and share recipes across users and sessions.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">science</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Industrial-Grade Research Processing</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Research-grade pricing with industrial-level RF power</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Industrial-level RF power in a benchtop form factor at research-grade pricing. PLUTO-F fills the gap between entry-level cleaners and full industrial platforms — ideal for labs that need more capability without the complexity and cost of production-scale systems.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Positioning */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">System Positioning</h2>
            <p className="text-on-surface-variant text-lg leading-relaxed mb-4">
              PLUTO-F is NineScrolls' flagship RF plasma cleaner, delivering 500W of continuously adjustable RF power
              with a 14.5-liter aluminum alloy chamber at under $16,000. Designed for university core facilities,
              advanced materials labs, and semiconductor process development teams that need high-power plasma
              processing with reproducible, recipe-managed workflows.
            </p>
            <p className="text-on-surface-variant">
              For labs needing a mid-tier option, see <Link to="/products/pluto-m" className="text-primary font-medium hover:underline">PLUTO-M</Link> ($12,999, 200W, ~8L).
              For a budget RF alternative, see <Link to="/products/hy-20lrf" className="text-primary font-medium hover:underline">HY-20LRF</Link> ($14,499, 150W, 20L).
            </p>
          </div>
        </div>
      </section>

      {/* Choose PLUTO-F */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Choose PLUTO-F if you:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Your processes demand high RF power</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Aggressive ashing, deep surface activation, stubborn contaminant removal — these require sustained high-power plasma density. 500W at 13.56 MHz gives you the headroom to handle demanding applications.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">You process multiple samples per run</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">14.5L aluminum alloy chamber supports batch processing of wafers, devices, and components. Essential for core facilities and labs with high daily sample throughput.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">touch_app</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Multiple users share your system</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Touchscreen recipe management ensures every user runs the same documented process. Store, recall, and lock recipes — critical for shared facilities and publication-quality reproducibility.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">savings</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">You need industrial capability at research pricing</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">PLUTO-F delivers the RF power and chamber capacity of systems costing $30K+ in a benchtop format under $16K. Designed for labs that need real processing capability without production-scale complexity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">System Specifications</h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
              <tbody>
                <tr>
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">PLUTO-F Specifications</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Model</td>
                  <td className="px-6 py-3 text-on-surface-variant">PLUTO-F</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">System Dimensions (W×H×D)</td>
                  <td className="px-6 py-3 text-on-surface-variant">405 × 610 × 670 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">240 × 300 × 200 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Volume</td>
                  <td className="px-6 py-3 text-on-surface-variant">~14.5 L</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Material</td>
                  <td className="px-6 py-3 text-on-surface-variant">6061-T6 Aluminum alloy</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Electrode Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">205 × 205 mm, multi-control adaptive flat plate electrode</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">0–500W continuously adjustable, 1W precision</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Frequency</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz, auto-impedance matching</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum Gauge</td>
                  <td className="px-6 py-3 text-on-surface-variant">Thermocouple vacuum gauge, 0–100 KPa</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas Lines</td>
                  <td className="px-6 py-3 text-on-surface-variant">2 lines, precision needle valve control (O₂, N₂, Ar supported)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Mechanical pump (oil pump included; dry pump optional +$2,500)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">4.3″ Touchscreen, fully automated with advanced recipe management</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Power Supply</td>
                  <td className="px-6 py-3 text-on-surface-variant">110 V</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Optional Accessories</td>
                  <td className="px-6 py-3 text-on-surface-variant">Dry pump upgrade (Leybold / Agilent DS series); Oxygen generator; Gas mixer; Powder treatment fixture</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 font-medium text-on-surface">Manufacturer</td>
                  <td className="px-6 py-3 text-on-surface-variant">Shanghai Peiyuan Instrument Equipment Co., Ltd.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">What's Included</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">PLUTO-F Main System</h3>
              <p className="text-on-surface-variant leading-relaxed">500W RF plasma source with ~14.5L 6061-T6 aluminum alloy vacuum chamber and integrated power supply.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Touchscreen Control Interface</h3>
              <p className="text-on-surface-variant leading-relaxed">Advanced recipe management with multi-step process sequencing and parameter storage.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Mechanical Vacuum Pump</h3>
              <p className="text-on-surface-variant leading-relaxed">Oil-sealed mechanical pump included. Optional dry pump upgrade available (+$2,500).</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Gas Delivery System</h3>
              <p className="text-on-surface-variant leading-relaxed">2 gas line configuration supporting O₂, N₂, Ar, and mixed-gas processes.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">User Documentation</h3>
              <p className="text-on-surface-variant leading-relaxed">Comprehensive user manual, recipe templates, and basic operation guidance for quick startup.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Options / Customization */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Options / Customization (Recommended)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Dry Pump Upgrade (+$2,500)</h3>
              <p className="text-on-surface-variant leading-relaxed">Oil-free vacuum pumping for cleanroom environments and contamination-sensitive processes.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Additional Gas Line Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">Expand from 2 to 3 gas lines for more complex multi-gas process development.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Process Recipe Templates</h3>
              <p className="text-on-surface-variant leading-relaxed">Pre-configured recipes and training package for common applications (cleaning, activation, ashing).</p>
            </div>
          </div>
        </div>
      </section>

      {/* PLUTO Series Lineup */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-3 text-center">PLUTO Series Lineup</h2>
          <p className="text-center mb-10 text-on-surface-variant text-lg">
            Three tiers of RF plasma cleaning to match your lab's power and capacity needs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link to="/products/pluto-t" className="no-underline text-inherit">
              <div className="p-6 bg-surface-container-low rounded-lg border border-outline-variant/30 hover:border-primary/50 transition-colors">
                <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">PLUTO-T</h3>
                <p className="text-sm text-on-surface-variant mb-2">200W RF · ~4.3L · Touchscreen</p>
                <p className="text-[0.95rem] text-primary font-semibold">$9,999 USD</p>
                <p className="text-xs text-on-surface-variant/70 mt-2">Compact entry-level PLUTO</p>
              </div>
            </Link>
            <Link to="/products/pluto-m" className="no-underline text-inherit">
              <div className="p-6 bg-surface-container-low rounded-lg border border-outline-variant/30 hover:border-primary/50 transition-colors">
                <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">PLUTO-M</h3>
                <p className="text-sm text-on-surface-variant mb-2">200W RF · ~8L · Touchscreen</p>
                <p className="text-[0.95rem] text-primary font-semibold">$12,999 USD</p>
                <p className="text-xs text-on-surface-variant/70 mt-2">Mid-size batch processing</p>
              </div>
            </Link>
            <div className="p-6 bg-white rounded-lg border-2 border-primary">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-semibold">FLAGSHIP</span>
              </div>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">PLUTO-F</h3>
              <p className="text-sm text-on-surface-variant mb-2">500W RF · ~14.5L · Recipe Mgmt</p>
              <p className="text-[0.95rem] text-primary font-semibold">$15,999 USD</p>
              <p className="text-xs text-on-surface-variant/70 mt-2">Maximum power & capacity</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: Who is PLUTO-F designed for?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-F is designed for labs that need more capability than compact desktop plasma cleaners can provide. If your work involves aggressive ashing, deep surface activation, large-batch processing, or multi-step recipe sequences — and you need reproducible, documented results across multiple users — PLUTO-F provides the RF power, chamber volume, and automation to handle it.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: Why would I choose PLUTO-F over HY-20LRF?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-F delivers 3.3x the RF power (500W vs 150W) for only $1,500 more ($15,999 vs $14,499). If your processes benefit from higher RF power — more aggressive cleaning, deeper surface activation, or faster processing — PLUTO-F is the clear upgrade. The advanced recipe management is also a significant advantage for multi-user labs.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: Should I upgrade to the dry pump option?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: The standard oil-sealed mechanical pump works well for most research applications. We recommend the dry pump upgrade (+$2,500) for cleanroom environments, contamination-sensitive processes, or facilities that prefer oil-free operation. Contact us to discuss which option is best for your lab.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What gases can I use?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-F supports O₂, N₂, Ar, and mixed-gas processes with 2 gas lines. The system is designed for flexible gas configuration to support a wide range of surface treatment applications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Distributor Notice */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="p-8 bg-surface-container-low rounded-xl border-l-4 border-outline-variant">
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-4">Distributor Notice</h3>
            <p className="text-on-surface-variant leading-relaxed">
              PLUTO Series plasma systems are manufactured by Shanghai Peiyuan Instrument Equipment Co., Ltd., a professional plasma equipment manufacturer specializing in high-power RF plasma systems for research and industrial applications. NineScrolls LLC is the authorized US distributor, providing local sales, technical support, system configuration, and warranty service.
            </p>
          </div>
        </div>
      </section>

      {/* Cost Advantage Block */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Why Our Systems Are Cost-Efficient</h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-center mb-8 text-on-surface-variant text-lg leading-relaxed">
              We specialize in cost-efficient configurations for research labs that need to balance performance and budget. We help labs avoid paying for unnecessary industrial features and focus on what matters for research applications.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 list-none p-0 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block mb-1">Modular design</strong>
                  <span className="text-sm text-on-surface-variant">Pay only for what you need</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block mb-1">Research-focused configuration</strong>
                  <span className="text-sm text-on-surface-variant">Not overbuilt for production</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block mb-1">Direct engineering collaboration</strong>
                  <span className="text-sm text-on-surface-variant">No unnecessary intermediaries</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block mb-1">Lean operational structure</strong>
                  <span className="text-sm text-on-surface-variant">Efficient cost structure</span>
                </div>
              </li>
            </ul>
            <div className="p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-4">Typical use cases include:</h3>
              <ul className="pl-6 text-on-surface-variant leading-loose">
                <li>Core facilities needing high-throughput plasma processing</li>
                <li>Grant-funded labs needing maximum capability per dollar</li>
                <li>R&D centers requiring industrial-level RF power at research pricing</li>
                <li>Multi-user shared facilities needing recipe management</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Logos Section */}
      <TrustSection />

      {/* Trust Block */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">What You Can Expect When Working With Us</h2>
          <div className="max-w-3xl mx-auto">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 list-none p-0">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">US-based sales & project coordination</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Installation & training support available</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Engineering-backed configuration (not off-the-shelf)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">NDA & export compliance supported</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Responsive support before & after delivery</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-primary mb-4">Ready to order?</h2>
          <p className="text-on-surface-variant text-lg mb-8 max-w-xl mx-auto">
            You don't need a finalized specification or PO to reach out.
            We often assist labs during early evaluation and proposal stages.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary/90 transition-colors"
              onClick={handleAddToCart}
            >
              Add to Cart
            </button>
            <button
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-8 py-3 rounded-lg font-medium text-lg hover:bg-primary hover:text-on-primary transition-colors"
              onClick={() => openContactForm(true)}
            >
              Request a Budgetary Quote
            </button>
          </div>
          <p className="text-sm text-on-surface-variant mt-6">
            <strong>Shipping:</strong> Free shipping included. Standard delivery: 3-4 weeks after order confirmation.
          </p>
        </div>
      </section>

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        onDownloadBrochure={handleDownloadBrochure}
        productName="PLUTO-F"
        turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      />
    </>
  );
}
