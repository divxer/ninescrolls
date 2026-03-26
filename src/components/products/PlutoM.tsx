import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { DownloadGateModal } from '../common/DownloadGateModal';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';
import { AcademicCitations } from '../common/AcademicCitations';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';

export function PlutoM() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'with-pump' | 'chamber-open'>('main');
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

  const handleAddToCart = () => {
    addItem({
      id: 'pluto-m',
      name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
      price: 12999,
      quantity: 1,
      image: '/assets/images/products/pluto-m/main.jpg',
      sku: 'pluto-m',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 12999,
          items: [{
            item_id: 'pluto-m',
            item_name: 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 12999,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('pluto-m', 'PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber', 12999);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pluto-m#product",
    "name": "PLUTO-M - 200W RF Plasma Cleaner with 8L Mid-Capacity Chamber",
    "description": "200W RF plasma cleaner (13.56 MHz) with ~8L stainless steel chamber. Batch capability meets RF precision. Touchscreen control with recipe storage. Ideal for university research labs, MEMS fabrication, and multi-sample preparation.",
    "image": ["https://ninescrolls.com/assets/images/products/pluto-m/main.jpg"],
    "sku": "pluto-m",
    "mpn": "PLUTO-M",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "12999",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pluto-m",
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
        title="PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber | NineScrolls"
        description="200W RF plasma cleaner (13.56 MHz) with ~8L stainless steel chamber. Batch capability meets RF precision. Touchscreen control with recipe storage. Best value in mid-range RF plasma. $12,999 USD."
        keywords="PLUTO-M, RF plasma cleaner, 200W plasma, 8L chamber, batch plasma cleaning, surface activation, 13.56 MHz, research plasma system"
        url="/products/pluto-m"
        image="/assets/images/products/pluto-m/main.jpg"
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
                "name": "Who is PLUTO-M designed for?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-M is designed for labs that need mid-capacity batch plasma cleaning with recipe management. At $12,999, it is ideal for university research labs, materials characterization facilities, MEMS/micro-fab labs, and multi-user core facilities that process multiple samples per run."
                }
              },
              {
                "@type": "Question",
                "name": "What is the difference between PLUTO-M and PLUTO-F?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-M has a ~8L chamber with 200W RF power, while PLUTO-F ($15,999) offers a larger ~14.5L aluminum alloy chamber and 500W RF power \u2014 2.5x more power for aggressive ashing and deep surface activation. PLUTO-F also includes advanced recipe management for multi-user labs. Choose PLUTO-M for standard cleaning and PLUTO-F for high-power or large-batch applications."
                }
              },
              {
                "@type": "Question",
                "name": "Can I upgrade from oil pump to dry pump?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. The standard oil-sealed mechanical pump works well for most research applications. The dry pump upgrade (+$2,500) is recommended for cleanroom environments, contamination-sensitive processes, or facilities that prefer oil-free operation. Contact us to discuss which option is best for your lab."
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
            { name: 'PLUTO-M', path: '/products/pluto-m' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">PLUTO-M</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">200W RF Plasma Cleaner with 8L Mid-Capacity Chamber</p>
            <p className="text-base text-white/80 tracking-wide">
              Batch capability meets RF precision | Best value in mid-range RF plasma
            </p>
            <p className="text-base text-white/80 tracking-wide">
              US-based scientific equipment provider · Custom-configured systems for research labs & cleanrooms
            </p>

            {/* Positioning Hero Card */}
            <div className="mt-8 p-6 bg-black/60 backdrop-blur-sm rounded-lg max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white/90 mb-3 text-center">
                The optimal RF plasma cleaner for batch processing
              </h3>
              <p className="text-[0.95rem] text-white/90 leading-relaxed text-center">
                PLUTO-M is the optimal choice for laboratories that need both RF precision and batch processing capability.
                With an 8-liter chamber (2x the capacity of PLUTO-T) and 200W RF power, PLUTO-M enables efficient multi-sample
                processing without sacrificing RF performance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">bolt</span>
                <div>
                  <span className="block font-semibold">200W RF (13.56 MHz)</span>
                  <span className="block text-sm text-white/70">continuously adjustable, research-grade precision</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">inventory_2</span>
                <div>
                  <span className="block font-semibold">~8L Stainless Steel Chamber</span>
                  <span className="block text-sm text-white/70">2x capacity vs PLUTO-T for batch processing</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">touch_app</span>
                <div>
                  <span className="block font-semibold">Touchscreen Control with Recipe Storage</span>
                  <span className="block text-sm text-white/70">fully automated operation for reproducible results</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">savings</span>
                <div>
                  <span className="block font-semibold">$1,500 Less Than HY-20LRF</span>
                  <span className="block text-sm text-white/70">with superior 200W RF power (vs 150W)</span>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-white/70 mb-1">price:</p>
              <p className="text-3xl font-bold">12,999 USD</p>
              <p className="text-sm text-white/70 mt-1">availability: in stock</p>
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
                  <OptimizedImage src="/assets/images/products/pluto-m/main.jpg" alt="PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'with-pump' && (
                  <OptimizedImage src="/assets/images/products/pluto-m/with-pump.jpg" alt="PLUTO-M - System with Pump" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'chamber-open' && (
                  <OptimizedImage src="/assets/images/products/pluto-m/chamber-open.jpg" alt="PLUTO-M - Chamber Interior" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                {(['main', 'with-pump', 'chamber-open'] as const).map((img) => (
                  <button key={img} className={`w-20 h-15 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === img ? 'border-primary' : 'border-transparent hover:border-outline-variant'}`} onClick={() => setSelectedImage(img)} type="button">
                    <OptimizedImage src={`/assets/images/products/pluto-m/${img}.jpg`} alt={img.replace(/-/g, ' ')} width={150} height={112} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">System Overview</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                PLUTO-M is a 200W RF plasma cleaner with an ~8-liter stainless steel chamber, designed for laboratories
                that need both RF precision and batch processing capability. It delivers the same 200W / 13.56 MHz RF power
                as the compact PLUTO-T, but with double the chamber volume for efficient multi-sample processing.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                With touchscreen control, recipe storage, and a fully automated vacuum cycle, PLUTO-M bridges the gap
                between compact desktop RF cleaners and larger industrial systems—offering research-grade RF performance
                at a price point significantly below comparable Western-brand alternatives.
              </p>

              <div className="mt-6 p-4 bg-primary/5 rounded-lg border-l-[3px] border-primary">
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                  <Link
                    to="/insights/plasma-cleaner-comparison-research-labs"
                    className="text-primary font-medium hover:underline"
                  >
                    Learn how research-grade RF plasma cleaners compare across price and performance tiers →
                  </Link>
                </p>
              </div>

              <div className="mt-4 p-4 bg-primary/5 rounded-lg border-l-[3px] border-primary">
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                  <strong>Why PLUTO-M:</strong> 2x the chamber of PLUTO-T for batch processing, 33% more RF power than HY-20LRF at $1,500 less. The sweet spot between compact and industrial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses This */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-2 text-center">Who Uses This</h2>
          <p className="text-center mb-8 text-on-surface-variant">
            PLUTO-M is commonly installed in:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">school</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">University Research Labs</h3>
              <p className="text-sm text-on-surface-variant">Multi-sample RF plasma processing</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">science</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Materials Characterization Labs</h3>
              <p className="text-sm text-on-surface-variant">Surface analysis sample preparation</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">precision_manufacturing</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">MEMS / Micro Fabrication</h3>
              <p className="text-sm text-on-surface-variant">Surface activation and photoresist ashing</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">domain</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Multi-user Core Facilities</h3>
              <p className="text-sm text-on-surface-variant">Shared-use batch processing workflows</p>
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
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">200W RF Power (13.56 MHz)</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Continuously adjustable, research-grade RF precision</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">True RF plasma at 13.56 MHz with 200W continuously adjustable power. Delivers finer process control and broader recipe windows than mid-frequency alternatives, essential for advanced surface activation and selective etching applications.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">~8L Stainless Steel Chamber</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">2x capacity vs PLUTO-T for batch processing</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Mid-capacity stainless steel chamber enables efficient multi-sample processing. Large enough for batch workflows while maintaining uniform plasma distribution across the chamber volume.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">touch_app</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Touchscreen Control with Recipe Storage</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Fully automated operation for reproducible results</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Intuitive touchscreen interface with built-in recipe storage. Save, recall, and execute process recipes for consistent results across runs—critical for multi-user facilities and documented research workflows.</p>
            </div>
          </div>

          {/* Secondary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-4 text-center">Additional Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">air</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Mechanical Vacuum System</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Oil pump included as standard; dry pump available as an option (+$2,500) for oil-free operation in sensitive environments. Optimized for plasma processing pressures with reliable pump-down performance.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Multi-Gas Configuration</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">2 gas lines supporting O₂, N₂, and Ar. Flexible gas mixing enables a wide range of plasma chemistries for cleaning, activation, and etching applications.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Typical Applications</h2>
          <p className="text-on-surface-variant text-center mb-8 max-w-3xl mx-auto">
            <strong>Commonly used for:</strong> Batch plasma cleaning, surface activation, polymer treatment, photoresist ashing, and multi-sample preparation in research and development environments.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">cleaning_services</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Batch Plasma Cleaning</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Multi-sample organic contaminant removal in a single run</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Efficient removal of organic residues from multiple substrates simultaneously. The 8L chamber enables batch workflows that improve lab throughput without compromising RF cleaning quality.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Surface Activation</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Improve adhesion prior to bonding, coating, or deposition</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">RF plasma activation enhances surface energy for improved wettability and adhesion. Commonly used before PDMS bonding, thin film deposition, and coating applications.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">science</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Polymer / Plastics Treatment</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Surface modification for biocompatibility and adhesion</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Modify surface properties of polymers and plastics without affecting bulk material characteristics. Widely used in biomedical device research and materials science studies.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">local_fire_department</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Photoresist Ashing</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Complete PR removal with uniform RF processing</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Precise photoresist removal using oxygen-based RF plasma. Uniform processing across the chamber volume ensures consistent ashing results across batch samples.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">tune</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Multi-sample Preparation</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Efficient batch preparation for characterization workflows</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Prepare multiple samples simultaneously for XPS, SEM, TEM, and other characterization techniques. Recipe storage ensures repeatable preparation protocols.</p>
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
              PLUTO-M is the optimal choice for laboratories that need both RF precision and batch processing capability.
              With an 8-liter chamber (2x the capacity of PLUTO-T) and the same 200W RF power, PLUTO-M enables efficient
              multi-sample processing without sacrificing RF performance.
            </p>
            <p className="text-on-surface-variant">
              Clear upgrade path: <Link to="/products/pluto-t" className="text-primary font-medium hover:underline">PLUTO-T</Link> (compact, $9,999) → <strong>PLUTO-M</strong> (mid-capacity, $12,999) → <Link to="/products/pluto-f" className="text-primary font-medium hover:underline">PLUTO-F</Link> (flagship, $15,999)
            </p>
          </div>
        </div>
      </section>

      {/* Choose PLUTO-M */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Choose PLUTO-M if you:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Need RF precision with batch capability</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">8L chamber handles multiple samples per run while maintaining the RF plasma quality needed for advanced surface treatment and activation applications.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">savings</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Want the best value in mid-range RF plasma</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">$1,500 less than HY-20LRF with 33% more RF power (200W vs 150W). Stainless steel construction and touchscreen recipe management deliver research-grade reproducibility for multi-user labs.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">trending_up</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Are upgrading from a compact plasma cleaner</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Clear upgrade path from PLUTO-T: same 200W RF power with 2x chamber volume for $3,000 more. Scales naturally as your lab's batch processing needs grow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why PLUTO-M */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Why PLUTO-M</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Superior RF Power</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">200W at 13.56 MHz delivers true research-grade RF performance with the power headroom for demanding surface activation, polymer treatment, and multi-step process development. More power means faster cycle times and broader recipe flexibility.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Right-Sized for Batch</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">~8L chamber provides 2x the capacity of PLUTO-T without the footprint of a 20L system. Ideal for labs that process 3–10 samples per run and need efficient batch throughput.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">savings</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Exceptional Value</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">At $12,999, PLUTO-M delivers 200W of true 13.56 MHz RF power with an 8L stainless steel batch chamber and touchscreen recipe management. Research-grade performance without production-scale pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">System Specifications</h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
              <tbody>
                <tr>
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">PLUTO-M Specifications</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">System Dimensions (W×H×D)</td>
                  <td className="px-6 py-3 text-on-surface-variant">405 × 610 × 670 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">φ210 mm × 230 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Volume</td>
                  <td className="px-6 py-3 text-on-surface-variant">~8 L</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Material</td>
                  <td className="px-6 py-3 text-on-surface-variant">Stainless steel</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Electrode Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">125 × 125 mm, perforated gas-shower flat plate electrode</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">0–200W continuously adjustable, 1W precision</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Frequency</td>
                  <td className="px-6 py-3 text-on-surface-variant">13.56 MHz, auto-impedance matching</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum Gauge</td>
                  <td className="px-6 py-3 text-on-surface-variant">Thermocouple vacuum gauge, 0–100 KPa</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Gas Lines</td>
                  <td className="px-6 py-3 text-on-surface-variant">2 lines, 6 mm hose connectors (O₂, N₂, Ar supported)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">VRD-4 two-stage oil pump, 4 m³/h (dry pump optional +$2,500)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Control System</td>
                  <td className="px-6 py-3 text-on-surface-variant">4.3″ Touchscreen, fully automated with recipe storage</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Power Supply</td>
                  <td className="px-6 py-3 text-on-surface-variant">110 V</td>
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

      {/* Support & Integration */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Support & Integration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Application-Oriented Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">NineScrolls provides application-oriented system configuration tailored to your specific research needs and process requirements.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Process Consultation</h3>
              <p className="text-on-surface-variant leading-relaxed">Expert process consultation for research environments, helping you optimize parameters and achieve desired results.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Documentation & Support</h3>
              <p className="text-on-surface-variant leading-relaxed">Comprehensive documentation and long-term technical support to ensure your system operates at peak performance.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Custom Configurations</h3>
              <p className="text-on-surface-variant leading-relaxed">Custom configurations and upgrade options are available upon request, including dry pump upgrade and additional gas line configurations.</p>
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
              PLUTO Series plasma systems are manufactured by Shanghai Peiyuan Instrument Equipment Co., Ltd., a specialized plasma equipment manufacturer. NineScrolls LLC is the authorized US distributor, providing local sales, technical support, system configuration, and warranty service.
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
                <li>New lab setup with limited initial funding</li>
                <li>Grant-based or proposal-stage projects</li>
                <li>Pilot or exploratory research</li>
                <li>Teaching and shared facilities</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="The PLUTO-M plasma cleaner is cited in peer-reviewed publications across top-tier journals including Science, Advanced Materials, and ACS Applied Materials, supporting research in 2D materials, photodetectors, nano-antibiotics, and surface engineering."
        stats={[
          { value: '6', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '85', suffix: '+', label: 'Total Citations' },
          { value: '5', suffix: '+', label: 'Research Institutions' },
          { value: '4', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Science',
            tier: 'top',
            title: 'Transformable nano-antibiotics for mechanotherapy and immune activation against drug-resistant Gram-negative bacteria',
            authors: 'RS Li, J Liu, C Wen, Y Shi et al.',
            year: '2023',
            citations: 37,
          },
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'An Ultrasensitive and Broad-Spectrum MoS₂ Photodetector with Extrinsic Response Using Surrounding Homojunction',
            authors: 'X Liu, J Zhu, Y Shan, C Liu et al.',
            year: '2024',
            citations: 21,
          },
          {
            journal: 'Advanced Electronic Materials',
            tier: 'high',
            title: 'Few-layered MoS₂ Based Vertical van der Waals p-n Homojunction by Highly-efficient N₂ Plasma Implantation',
            authors: 'Y Shan, Z Yin, J Zhu, X Li et al.',
            year: '2022',
            citations: 16,
          },
          {
            journal: 'ACS Applied Materials & Interfaces',
            tier: 'high',
            title: 'Ultrafast and Highly Sensitive Dual-Channel FET Photodetector Based on a Two-Dimensional MoS₂ Homojunction',
            authors: 'Y Shan, Z Yin, Y Zhang, C Pan et al.',
            year: '2021',
            citations: 7,
          },
          {
            journal: 'Advanced Materials',
            tier: 'top',
            title: 'Tailoring Dynamic Chains of Cross-Linked PDMS to Hinder Oil Penetration',
            authors: 'R Hao, H Jing, Q Wang, Y Han et al.',
            year: '2025',
            citations: 4,
          },
        ]}
        journalNames={['Science', 'Adv. Materials', 'Adv. Electronic Materials', 'ACS Applied Materials']}
        onRequestQuote={() => openContactForm(true)}
        ctaLabel="Request a Quote"
      />

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

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: Who is PLUTO-M designed for?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-M is designed for labs that need mid-capacity batch plasma cleaning with recipe management. At $12,999, it is ideal for university research labs, materials characterization facilities, MEMS/micro-fab labs, and multi-user core facilities that process multiple samples per run.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What is the difference between PLUTO-M and PLUTO-F?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-M has a ~8L chamber with 200W RF power, while PLUTO-F ($15,999) offers a larger ~14.5L aluminum alloy chamber and 500W RF power — 2.5x more power for aggressive ashing and deep surface activation. PLUTO-F also includes advanced recipe management for multi-user labs. Choose PLUTO-M for standard cleaning and PLUTO-F for high-power or large-batch applications.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: Can I upgrade from oil pump to dry pump?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: Yes. The standard oil-sealed mechanical pump works well for most research applications. The dry pump upgrade (+$2,500) is recommended for cleanroom environments, contamination-sensitive processes, or facilities that prefer oil-free operation. Contact us to discuss which option is best for your lab.
              </p>
            </div>
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
        productName="PLUTO-M"
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
