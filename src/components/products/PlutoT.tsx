import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { QuoteModal } from '../common/QuoteModal';
import { OptimizedImage } from '../common/OptimizedImage';
import { TrustSection } from '../common/TrustSection';
import { AcademicCitations } from '../common/AcademicCitations';

import { Helmet } from 'react-helmet-async';
import { SEO } from '../common/SEO';
import { analytics } from '../../services/analytics';
import { useCart } from '../../contexts/useCart';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { cdnUrl } from '../../config/imageConfig';

export function PlutoT() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const [selectedImage, setSelectedImage] = useState<'main' | 'front-view' | 'chamber' | 'samples' | 'with-pump'>('main');
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
      id: 'pluto-t',
      name: 'PLUTO-T - 200W RF Plasma Cleaner',
      price: 9999,
      quantity: 1,
      image: cdnUrl('/assets/images/products/pluto-t/main.jpg'),
      sku: 'pluto-t',
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: 9999,
          items: [{
            item_id: 'pluto-t',
            item_name: 'PLUTO-T - 200W RF Plasma Cleaner',
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: 9999,
            quantity: 1
          }]
        });
      }
      analytics.trackAddToCart('pluto-t', 'PLUTO-T - 200W RF Plasma Cleaner', 9999);
    }

    navigate('/cart');
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": "https://ninescrolls.com/products/pluto-t#product",
    "name": "PLUTO-T - 200W RF Plasma Cleaner for Research Labs",
    "description": "Compact, high-performance 200W RF plasma cleaner (13.56 MHz) with ~4.3L stainless steel chamber, touchscreen control, and 1 gas line (optional 2nd). Designed for research laboratories requiring true RF capability at an accessible price point. Under $10,000.",
    "image": ["https://ninescrolls.com/assets/images/products/pluto-t/main.jpg"],
    "sku": "pluto-t",
    "mpn": "PLUTO-T",
    "brand": {
      "@type": "Brand",
      "name": "NineScrolls LLC"
    },
    "category": "Semiconductor Manufacturing Equipment",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "USD",
      "price": "9999",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "url": "https://ninescrolls.com/products/pluto-t",
      "itemCondition": "https://schema.org/NewCondition",
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
        title="PLUTO-T | 200W RF Plasma Cleaner | 13.56 MHz | Under $10,000 | NineScrolls"
        description="Compact 200W RF plasma cleaner (13.56 MHz) with ~4.3L stainless steel chamber, touchscreen control, and 1 gas line (optional 2nd). High-power RF cleaning for research labs under $10,000. Authorized US distributor."
        keywords="PLUTO-T, 200W RF plasma cleaner, 13.56 MHz, plasma cleaning, surface activation, polymer treatment, research lab plasma, affordable RF plasma, touchscreen plasma cleaner"
        url="/products/pluto-t"
        image={cdnUrl('/assets/images/products/pluto-t/main.jpg')}
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
                "name": "Who is PLUTO-T designed for?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-T is designed as an entry-level research-grade plasma cleaner for labs that need reliable RF plasma cleaning without a large investment. At $9,999, it is ideal for university cleanrooms, materials science labs, biomedical research, and semiconductor R&D where single-sample or small-batch processing is sufficient."
                }
              },
              {
                "@type": "Question",
                "name": "What is the difference between PLUTO-T and PLUTO-M?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-T has a smaller chamber (~4.3L vs ~8L) and a single standard gas line (optional 2nd line). PLUTO-M ($12,999) offers nearly double the chamber volume for batch processing, 2 gas lines standard, a perforated gas-shower electrode for better plasma distribution, and recipe storage capability. Choose PLUTO-T for single-sample work and PLUTO-M for multi-sample batches."
                }
              },
              {
                "@type": "Question",
                "name": "What gases can I use with PLUTO-T?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "PLUTO-T supports O2, N2, Ar, and mixed-gas processes. It comes with 1 gas line standard, with an optional 2nd gas line available. The system uses 13.56 MHz RF at 0-200W with automatic impedance matching."
                }
              }
            ]
          })}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="hero-gradient relative min-h-[500px] flex items-center py-20 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <img className="w-full h-full object-cover" src={cdnUrl('/assets/images/products/product-detail-bg.jpg')} alt="" />
        </div>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <Breadcrumbs variant="dark" items={[
            { name: 'Products', path: '/products' },
            { name: 'Plasma Cleaners', path: '/products/plasma-cleaner' },
            { name: 'PLUTO-T', path: '/products/pluto-t' }
          ]} />
          <div className="max-w-3xl mx-auto text-center mt-6">
            <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">PLUTO-T</h1>
            <p className="text-lg md:text-xl text-white/95 mb-2">200W RF Plasma Cleaner for Research Labs</p>
            <p className="text-base text-white/80 tracking-wide">
              High-power RF cleaning under $10,000 | Research-validated technology
            </p>
            <p className="text-base text-white/80 tracking-wide">
              US-based scientific equipment provider · Authorized distributor for US research labs & institutions
            </p>

            {/* Cost-Efficiency Hero Card */}
            <div className="mt-8 p-6 bg-black/60 backdrop-blur-sm rounded-lg max-w-2xl mx-auto">
              <h3 className="text-[1.1rem] font-semibold text-white/90 mb-3 text-center">
                True 13.56 MHz RF performance, accessible pricing
              </h3>
              <p className="text-[0.95rem] text-white/90 leading-relaxed text-center">
                PLUTO-T delivers 33% more RF power than comparable entry-level systems with touchscreen automation
                and a stainless steel chamber — all for under $10,000. Ideal for labs that need real RF capability without overspending.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">bolt</span>
                <div>
                  <span className="block font-semibold">200W RF (13.56 MHz)</span>
                  <span className="block text-sm text-white/70">continuously adjustable, research-grade power</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">inventory_2</span>
                <div>
                  <span className="block font-semibold">~4.3L Stainless Steel Chamber</span>
                  <span className="block text-sm text-white/70">durable construction for consistent plasma processing</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">touch_app</span>
                <div>
                  <span className="block font-semibold">Touchscreen Control</span>
                  <span className="block text-sm text-white/70">fully automated operation</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">savings</span>
                <div>
                  <span className="block font-semibold">Under $10,000</span>
                  <span className="block text-sm text-white/70">accessible RF plasma for research budgets</span>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-white/70 mb-1">US Price:</p>
              <p className="text-3xl font-bold">$9,999 USD</p>
              <p className="text-sm text-white/70 mt-1">Availability: In Stock</p>
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
                  <OptimizedImage src={cdnUrl('/assets/images/products/pluto-t/main.jpg')} alt="PLUTO-T - 200W RF Plasma Cleaner" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'front-view' && (
                  <OptimizedImage src={cdnUrl('/assets/images/products/pluto-t/front-view.jpg')} alt="PLUTO-T - System with Pump" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'chamber' && (
                  <OptimizedImage src={cdnUrl('/assets/images/products/pluto-t/chamber.jpg')} alt="PLUTO-T - Chamber Interior" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'samples' && (
                  <OptimizedImage src={cdnUrl('/assets/images/products/pluto-t/samples.jpg')} alt="PLUTO-T - Sample Processing" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
                {selectedImage === 'with-pump' && (
                  <OptimizedImage src={cdnUrl('/assets/images/products/pluto-t/with-pump.jpg')} alt="PLUTO-T - Complete System" width={800} height={600} className="w-full rounded-xl shadow-lg" />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto [&_.lazy-load-image-background]:!w-full [&_.lazy-load-image-background]:!h-full">
                {(['main', 'front-view', 'chamber', 'samples', 'with-pump'] as const).map((img) => (
                  <button key={img} className={`w-20 h-15 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === img ? 'border-primary' : 'border-transparent hover:border-outline-variant'}`} onClick={() => setSelectedImage(img)} type="button">
                    <OptimizedImage src={cdnUrl(`/assets/images/products/pluto-t/${img}.jpg`)} alt={img.replace(/-/g, ' ')} width={150} height={112} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-semibold text-on-surface mb-4">System Overview</h2>
              <p className="text-on-surface-variant leading-relaxed mb-4">
                PLUTO-T is a compact, high-performance 200W RF plasma cleaner designed for research laboratories
                that require true 13.56 MHz RF capability at an accessible price point. With 33% more RF power
                than comparable entry-level systems, PLUTO-T delivers superior plasma cleaning, surface activation,
                and polymer treatment performance — all for under $10,000.
              </p>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                The system features a stainless steel chamber (~4.3L), touchscreen-controlled fully automated operation,
                and a gas line supporting O₂, N₂, and Ar (optional second line available). An oil pump is included as standard, with an optional
                dry pump upgrade available for oil-free operation.
              </p>

              <div className="mt-6 p-4 bg-primary/5 rounded-lg border-l-[3px] border-primary">
                <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                  <strong>Why 200W matters:</strong> Surface treatments that take 10+ min at 50W complete in 2–3 min. More power also means broader recipe flexibility for demanding substrates.
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
            PLUTO-T is commonly installed in:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">school</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">University Cleanrooms</h3>
              <p className="text-sm text-on-surface-variant">Teaching and shared research facilities</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">science</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Materials Science Labs</h3>
              <p className="text-sm text-on-surface-variant">Surface treatment and sample preparation</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">biotech</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Biomedical Research Labs</h3>
              <p className="text-sm text-on-surface-variant">Polymer surface activation and bio-compatibility</p>
            </div>
            <div className="p-6 bg-surface-container-low rounded-lg text-center">
              <span className="material-symbols-outlined text-primary text-[32px] mb-2 block">memory</span>
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-2">Semiconductor R&D</h3>
              <p className="text-sm text-on-surface-variant">Process development and substrate cleaning</p>
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
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">200W RF Power at 13.56 MHz</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">33% more power than comparable entry-level RF systems</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Continuously adjustable 200W RF power source operating at the industry-standard 13.56 MHz frequency. Delivers superior plasma density for faster, more uniform cleaning and surface treatment compared to lower-power alternatives.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">inventory_2</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">~4.3L Stainless Steel Chamber</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Durable, contamination-resistant construction</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Stainless steel vacuum chamber providing approximately 4.3 liters of process volume. Resistant to chemical attack from process gases and easy to maintain for consistent plasma processing results.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">touch_app</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Touchscreen Automated Control</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Fully automated operation for reproducible results</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Intuitive touchscreen interface with fully automated process control. Set parameters once and achieve consistent, repeatable results across runs — critical for research documentation and publication-quality data.</p>
            </div>
          </div>

          {/* Secondary Features */}
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-4 text-center">Additional Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">air</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Flexible Gas Configuration</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">One gas inlet standard with optional second line, supporting O₂, N₂, and Ar for flexible process configurations. Enables a range of plasma chemistries for cleaning, activation, and treatment applications.</p>
            </div>
            <div className="bg-white rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">build</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Included Oil Pump + Optional Dry Pump</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Mechanical oil pump included as standard. Optional dry pump upgrade (+$2,500) available for oil-free operation in sensitive cleanroom environments.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-4 text-center">Typical Applications</h2>
          <p className="text-on-surface-variant text-center mb-8 max-w-3xl mx-auto">
            <strong>Designed for:</strong> Research laboratories and cleanroom environments requiring versatile RF plasma processing for surface preparation, cleaning, and material treatment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">cleaning_services</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Plasma Cleaning</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Organic contaminant removal from substrates and components</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Effective removal of organic residues, photoresist remnants, and surface contaminants. 200W RF power ensures thorough cleaning with faster process times.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Surface Activation</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Enhance adhesion prior to bonding, coating, or deposition</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Improve surface energy and wettability for better adhesion in downstream processes. Essential for thin film deposition, bonding, and coating workflows.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">biotech</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Polymer Treatment</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Surface modification for improved bio-compatibility and wettability</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Modify polymer surfaces to enhance hydrophilicity, bio-compatibility, and adhesion characteristics without altering bulk material properties.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">science</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Sample Preparation</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Pre-analysis and pre-deposition substrate cleaning</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Prepare substrates and samples for characterization, deposition, or bonding steps. Consistent surface preparation ensures reliable experimental results.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">tune</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-2">Process Development</h3>
              <p className="text-sm font-medium text-primary/80 mb-3">Recipe optimization and parameter studies</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">Develop and optimize plasma process recipes with adjustable RF power, gas selection, and process timing. Touchscreen control enables systematic parameter exploration.</p>
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
              PLUTO-T occupies the sweet spot between budget desktop cleaners and premium research-grade systems,
              delivering true 13.56 MHz RF performance with touchscreen automation at a price point accessible
              to grant-funded and budget-conscious research labs.
            </p>
            <p className="text-on-surface-variant">
              For labs requiring higher power or larger chamber volume, see the <Link to="/products/pluto-m" className="text-primary font-medium hover:underline">PLUTO-M</Link> upgrade path.
            </p>
          </div>
        </div>
      </section>

      {/* Why PLUTO-T */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Why PLUTO-T</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">analytics</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">vs. HY-4L ($7,999 RF)</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">33% more RF power (200W vs 150W) with stainless steel chamber construction. The +$2,000 premium is justified by significantly better RF performance and a durable, contamination-resistant chamber.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">bolt</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">True Research-Grade RF</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">200W at 13.56 MHz with stainless steel chamber and touchscreen automation. Not a desktop cleaner with manual dials — a research-grade instrument designed for reproducible, documented plasma processing.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <span className="material-symbols-outlined text-primary text-3xl mb-3 block">savings</span>
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Accessible RF Performance</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">Under $10,000 makes PLUTO-T one of the most cost-effective true 13.56 MHz RF plasma cleaners available, suitable for grant-funded labs and institutional procurement.</p>
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
                  <th colSpan={2} className="bg-primary text-on-primary text-left px-6 py-3 font-semibold text-lg">PLUTO-T Specifications</th>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface w-1/3">Model</td>
                  <td className="px-6 py-3 text-on-surface-variant">PLUTO-T</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">System Dimensions (W×H×D)</td>
                  <td className="px-6 py-3 text-on-surface-variant">380 × 500 × 490 mm</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Dimensions</td>
                  <td className="px-6 py-3 text-on-surface-variant">φ150 mm × 245 mm depth</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Volume</td>
                  <td className="px-6 py-3 text-on-surface-variant">~4.3 L</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Chamber Material</td>
                  <td className="px-6 py-3 text-on-surface-variant">Stainless steel</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Electrode Size</td>
                  <td className="px-6 py-3 text-on-surface-variant">95 × 170 mm, multi-control adaptive flat plate electrode</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">RF Power</td>
                  <td className="px-6 py-3 text-on-surface-variant">0–200W continuously adjustable, 1W precision</td>
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
                  <td className="px-6 py-3 text-on-surface-variant">1 line standard, optional 2nd line (O₂, N₂, Ar supported)</td>
                </tr>
                <tr className="border-b border-outline-variant/30">
                  <td className="px-6 py-3 font-medium text-on-surface">Vacuum System</td>
                  <td className="px-6 py-3 text-on-surface-variant">Mechanical pump (oil pump included; dry pump optional +$2,500)</td>
                </tr>
                <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <td className="px-6 py-3 font-medium text-on-surface">Control</td>
                  <td className="px-6 py-3 text-on-surface-variant">4.3″ Touchscreen, fully automated</td>
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

      {/* Support & Integration */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-headline text-3xl font-bold text-on-surface mb-8 text-center">Support & Integration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Application-Oriented Configuration</h3>
              <p className="text-on-surface-variant leading-relaxed">NineScrolls provides application-oriented system configuration tailored to your specific research needs and process requirements.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Process Consultation</h3>
              <p className="text-on-surface-variant leading-relaxed">Expert process consultation for research environments, helping you optimize parameters and achieve desired results with PLUTO-T.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Installation Guidance</h3>
              <p className="text-on-surface-variant leading-relaxed">Comprehensive installation guidance and training support to ensure your system is set up correctly and operating at peak performance.</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-8">
              <h3 className="font-headline text-xl font-semibold text-primary mb-4">Warranty & Technical Support</h3>
              <p className="text-on-surface-variant leading-relaxed">US-based warranty service and ongoing technical support provided directly by NineScrolls LLC for all PLUTO Series systems.</p>
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
              PLUTO Series plasma systems are manufactured by Shanghai Peiyuan Instrument Equipment Co., Ltd. (上海沛沅仪器设备有限公司). NineScrolls LLC is the authorized US distributor, providing local sales, system configuration, technical support, installation guidance, and warranty service for US-based research laboratories and institutions.
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
              We specialize in connecting US research labs with high-performance plasma equipment at accessible price points. By partnering directly with established manufacturers, we deliver better specifications at lower cost than traditional distribution channels.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 list-none p-0 mb-8">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block mb-1">Direct manufacturer partnership</strong>
                  <span className="text-sm text-on-surface-variant">No unnecessary intermediaries</span>
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
                  <strong className="block mb-1">US-based support included</strong>
                  <span className="text-sm text-on-surface-variant">Local sales, configuration, and warranty</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">check_circle</span>
                <div>
                  <strong className="block mb-1">Lean operational structure</strong>
                  <span className="text-sm text-on-surface-variant">Savings passed to researchers</span>
                </div>
              </li>
            </ul>
            <div className="p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-4">Looking at other options?</h3>
              <ul className="pl-6 text-on-surface-variant leading-loose">
                <li><Link to="/products/hy-4l" className="text-primary hover:underline">HY-4L ($7,999)</Link> — Budget-friendly 150W RF alternative</li>
                <li><Link to="/products/pluto-m" className="text-primary hover:underline">PLUTO-M</Link> — Upgrade path with higher power and expanded capability</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Citations */}
      <AcademicCitations
        heading="Trusted by Leading Research Labs"
        subtitle="The PLUTO-T plasma cleaner is cited in 20+ peer-reviewed publications across top-tier journals including Nature, ACS Nano, and Small Methods, enabling breakthroughs in nanofabrication, biosensors, microfluidics, and surface engineering."
        stats={[
          { value: '20', suffix: '+', label: 'Peer-Reviewed Publications' },
          { value: '200', suffix: '+', label: 'Total Citations' },
          { value: '15', suffix: '+', label: 'Research Institutions' },
          { value: '4', suffix: ' yr', label: 'Publication Track Record' },
        ]}
        publications={[
          {
            journal: 'Advanced Optical Materials',
            tier: 'high',
            title: 'Ultraflexible photothermal superhydrophobic coating with multifunctional applications based on plasmonic TiN nanoparticles',
            authors: 'B Wang, Z Jing, M Zhao et al.',
            year: '2022',
            citations: 54,
          },
          {
            journal: 'Nature',
            tier: 'top',
            title: 'Metal 3D nanoprinting with coupled fields',
            authors: 'B Liu, S Liu, V Devaraj et al.',
            year: '2023',
            citations: 48,
          },
          {
            journal: 'Tribology International',
            tier: 'high',
            title: 'Fishbone-like micro-textured surface for unidirectional spreading of droplets and lubricity improvement',
            authors: 'H Zhang, DAI Songjie, LIU Yang et al.',
            year: '2024',
            citations: 40,
          },
          {
            journal: 'ACS Nano',
            tier: 'top',
            title: 'A calibration strategy for silicon nanowire field-effect transistor biosensors and its application in ultra-sensitive, label-free biosensing',
            authors: 'D Chen, T Xu, Y Dou, T Li',
            year: '2024',
            citations: 16,
          },
          {
            journal: 'ACS Applied Materials & Interfaces',
            tier: 'high',
            title: 'Facile transfer of a transparent silver nanowire pattern to a soft substrate using graphene oxide as a double-sided adhesion-tuning layer',
            authors: 'J Wang, Y Jin, K Wang et al.',
            year: '2023',
            citations: 15,
          },
        ]}
        journalNames={['Nature', 'ACS Nano', 'Small Methods', 'Nature Communications', 'Adv. Optical Materials', 'Lab on a Chip']}
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
                <span className="text-on-surface-variant">Installation guidance & training support</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-green-600 text-[20px] mt-0.5 shrink-0">check_circle</span>
                <span className="text-on-surface-variant">Engineering-backed system configuration</span>
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
                Q: Who is PLUTO-T designed for?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-T is designed as an entry-level research-grade plasma cleaner for labs that need reliable RF plasma cleaning without a large investment. At $9,999, it is ideal for university cleanrooms, materials science labs, biomedical research, and semiconductor R&D where single-sample or small-batch processing is sufficient.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What is the difference between PLUTO-T and PLUTO-M?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-T has a smaller chamber (~4.3L vs ~8L) and a single standard gas line (optional 2nd line). PLUTO-M ($12,999) offers nearly double the chamber volume for batch processing, 2 gas lines standard, a perforated gas-shower electrode for better plasma distribution, and recipe storage capability. Choose PLUTO-T for single-sample work and PLUTO-M for multi-sample batches.
              </p>
            </div>
            <div className="mb-8 p-6 bg-surface-container-low rounded-lg">
              <h3 className="font-headline text-[1.1rem] font-semibold text-on-surface mb-3">
                Q: What gases can I use with PLUTO-T?
              </h3>
              <p className="text-[0.95rem] text-on-surface-variant leading-relaxed">
                A: PLUTO-T supports O2, N2, Ar, and mixed-gas processes. It comes with 1 gas line standard, with an optional 2nd gas line available. The system uses 13.56 MHz RF at 0-200W with automatic impedance matching.
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

      <QuoteModal
        isOpen={isModalOpen}
        defaultIsQuote={isQuoteIntent}
        onClose={closeContactForm}
        productName="PLUTO-T"
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
